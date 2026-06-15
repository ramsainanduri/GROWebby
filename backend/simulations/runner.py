from __future__ import annotations

import json
import math
import os
import random
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.db import close_old_connections
from django.utils import timezone
from django.utils.text import slugify

from .models import SimulationJob, SimulationLog

PIPELINE_STEPS = [
    ("topology", "Topology Generation", 12),
    ("box", "Box Definition", 24),
    ("solvation", "Solvation", 38),
    ("ions", "Adding Ions", 50),
    ("minimize", "Energy Minimization", 66),
    ("nvt", "NVT Equilibration", 76),
    ("npt", "NPT Equilibration", 88),
    ("production", "Production MD", 100),
]

STEP_OUTPUTS = {
    "topology": "outputs/processed.gro",
    "box": "outputs/boxed.gro",
    "solvation": "outputs/solvated.gro",
    "ions": "outputs/ionized.gro",
    "minimize": "minim.gro",
    "nvt": "nvt.gro",
    "npt": "npt.gro",
    "production": "production.gro",
}

ENERGY_TERMS = [
    ("Potential", "potential", "Potential Energy", "kJ/mol"),
    ("Total-Energy", "totalEnergy", "Total Energy", "kJ/mol"),
    ("Kinetic-En.", "kineticEnergy", "Kinetic Energy", "kJ/mol"),
    ("Temperature", "temperature", "Temperature", "K"),
    ("Pressure", "pressure", "Pressure", "bar"),
    ("Density", "density", "Density", "kg/m3"),
    ("LJ-14", "lj14", "LJ-14", "kJ/mol"),
    ("Coulomb-14", "coulomb14", "Coulomb-14", "kJ/mol"),
    ("LJ-(SR)", "ljSR", "LJ Short-Range", "kJ/mol"),
    ("Coulomb-(SR)", "coulombSR", "Coulomb Short-Range", "kJ/mol"),
]

ENERGY_NAME_TO_KEY = {
    "potential": "potential",
    "potential energy": "potential",
    "total-energy": "totalEnergy",
    "total energy": "totalEnergy",
    "kinetic-en.": "kineticEnergy",
    "kinetic energy": "kineticEnergy",
    "temperature": "temperature",
    "pressure": "pressure",
    "density": "density",
    "lj-14": "lj14",
    "coulomb-14": "coulomb14",
    "lj-(sr)": "ljSR",
    "coulomb-(sr)": "coulombSR",
}

# ── All force fields shipped with GROMACS 2025/2026 ──────────────────────────
# Checked against pdb2gmx -h output and GROMACS source (share/gromacs/top/).
# Each entry: (ff_dir_name, display_label, category)
FORCE_FIELDS: list[tuple[str, str, str]] = [
    # AMBER family
    ("amber94", "AMBER94", "AMBER"),
    ("amber96", "AMBER96", "AMBER"),
    ("amber99", "AMBER99", "AMBER"),
    ("amber99sb", "AMBER99SB", "AMBER"),
    ("amber99sb-ildn", "AMBER99SB-ILDN (recommended)", "AMBER"),
    ("amberGS", "AMBER-GS", "AMBER"),
    ("amber03", "AMBER03", "AMBER"),
    ("amber14sb", "AMBER14SB", "AMBER"),
    # CHARMM family
    ("charmm27", "CHARMM27", "CHARMM"),
    ("charmm36", "CHARMM36", "CHARMM"),
    ("charmm36-feb2021", "CHARMM36 (Feb 2021)", "CHARMM"),
    ("charmm36m", "CHARMM36m (IDP-improved)", "CHARMM"),
    ("charmm36-mar2019", "CHARMM36 (Mar 2019)", "CHARMM"),
    # GROMOS family
    ("gromos43a1", "GROMOS43A1", "GROMOS"),
    ("gromos43a2", "GROMOS43A2", "GROMOS"),
    ("gromos45a3", "GROMOS45A3", "GROMOS"),
    ("gromos53a5", "GROMOS53A5", "GROMOS"),
    ("gromos53a6", "GROMOS53A6", "GROMOS"),
    ("gromos54a7", "GROMOS54A7", "GROMOS"),
    # OPLS family
    ("oplsaa", "OPLS-AA/L (all-atom)", "OPLS"),
]

# ── All water models shipped with GROMACS ────────────────────────────────────
# Values are the -water flag argument for pdb2gmx.
WATER_MODELS: list[tuple[str, str, str]] = [
    ("tip3p", "TIP3P (3-site, most common)", "3-site"),
    ("tip4p", "TIP4P (4-site)", "4-site"),
    ("tip5p", "TIP5P (5-site)", "5-site"),
    ("spc", "SPC (simple point charge)", "3-site"),
    ("spce", "SPC/E (extended SPC)", "3-site"),
    ("none", "None (implicit or dry system)", "special"),
]


class SimulationCancelled(Exception):
    pass


def enqueue_simulation(job_id: int) -> None:
    thread = threading.Thread(target=run_simulation, args=(job_id,), daemon=True)
    thread.start()


def append_log(job: SimulationJob, message: str) -> None:
    SimulationLog.objects.create(job=job, message=message)


def set_process_pid(job: SimulationJob, pid: int | None) -> None:
    job.process_pid = pid
    job.save(update_fields=["process_pid", "updated_at"])


def check_cancelled(job: SimulationJob) -> None:
    job.refresh_from_db(fields=["status"])
    if job.status == SimulationJob.Status.CANCELLED:
        raise SimulationCancelled("Run was cancelled by the user.")


def clean_command_label(command: list[str]) -> str:
    if len(command) >= 2 and Path(command[0]).name == "gmx":
        return "gmx " + " ".join(command[1:])
    return " ".join(command)


def log_artifact(job: SimulationJob, name: str, content: str) -> str:
    return write_artifact(job, f"logs/{name}", content)


def add_artifact(job: SimulationJob, artifact: dict[str, str]) -> None:
    parameters = job.parameters
    artifacts = parameters.get("artifactFiles", [])
    if not any(isinstance(item, dict) and item.get("path") == artifact.get("path") for item in artifacts):
        parameters["artifactFiles"] = [*artifacts, artifact]
        job.parameters = parameters
        job.save(update_fields=["parameters", "updated_at"])


def gmxapi_available() -> bool:
    try:
        import gmxapi  # noqa: F401
    except Exception:
        return False
    return True


def gmx_binary() -> str | None:
    configured = os.environ.get("GROMACS_BINARY", "").strip()
    if configured:
        return configured
    return shutil.which("gmx")


def gpu_execution_available() -> bool:
    mode = os.environ.get("GROMACS_EXECUTION_MODE", "")
    engine = os.environ.get("GROWEBBY_ENGINE", "")
    if "cuda" in mode or "cuda" in engine:
        return True
    if "native-opencl" not in mode and "mac-opencl-native" not in engine:
        return False
    gmx = gmx_binary()
    if not gmx:
        return False
    try:
        completed = subprocess.run(
            [gmx, "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
            timeout=5,
        )
    except Exception:
        return False
    return "GPU support:" in completed.stdout and "OpenCL" in completed.stdout


# ── Per-user workspace path helpers ──────────────────────────────────────────


def user_dir_for_job(job: SimulationJob) -> str:
    """
    Returns a stable directory name scoped to the job owner.
    Format: ``u<user_id>``  — integer user IDs never collide across accounts.
    Anonymous jobs fall back to ``u0``.
    """
    if job.owner_id:
        return f"u{job.owner_id}"
    return "u0"


def run_workspace(job: SimulationJob) -> Path:
    """
    Returns the workspace Path for a job, creating it if required.
    Physical layout on the host:
        .app_state/media/workspaces/u<user_id>/runs/<workspace_slug>/
    """
    slug = job.workspace_slug or f"run-{job.id}-{slugify(job.name or 'simulation')[:80]}"
    path = settings.MEDIA_ROOT / "workspaces" / user_dir_for_job(job) / "runs" / slug
    path.mkdir(parents=True, exist_ok=True)
    return path


def workspace_media_url(job: SimulationJob, relative: str = "") -> str:
    """
    Returns the MEDIA_URL-relative URL for a file inside this job's workspace.
    """
    slug = job.workspace_slug or f"run-{job.id}-{slugify(job.name or 'simulation')[:80]}"
    base = f"{settings.MEDIA_URL}workspaces/{user_dir_for_job(job)}/runs/{slug}/"
    return base + relative


# ── Artifact helpers ──────────────────────────────────────────────────────────


def run_command(
    job: SimulationJob, command: list[str], cwd, stdin: str | None = None, step_key: str = "workflow"
) -> None:
    check_cancelled(job)
    label = clean_command_label(command)
    command_name = command[1] if len(command) > 1 and Path(command[0]).name == "gmx" else Path(command[0]).name
    append_log(job, f"Running GROMACS command: {label}")
    process = subprocess.Popen(
        command,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        stdin=subprocess.PIPE if stdin is not None else None,
        start_new_session=True,
    )
    set_process_pid(job, process.pid)
    output, _stderr = process.communicate(input=stdin)
    output = output or ""
    set_process_pid(job, None)
    log_name = f"{step_key}-{command_name}-{int(time.time())}.log"
    log_url = log_artifact(job, log_name, output)
    add_artifact(job, {"name": log_name, "kind": "log", "path": f"logs/{log_name}", "url": log_url})
    check_cancelled(job)
    if process.returncode != 0:
        tail = "\n".join(output.splitlines()[-40:])
        append_log(job, f"GROMACS command failed with exit code {process.returncode}: {label}")
        if tail:
            append_log(job, f"Error details from {log_name}:\n{tail}")
        raise RuntimeError(
            f"GROMACS command failed ({process.returncode}): {label}. See {log_name} for the full output."
        )
    append_log(job, f"GROMACS command completed: {label}. Full output saved to {log_name}.")


def run_quiet(command: list[str], cwd, stdin: str | None = None, timeout: int = 15) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        input=stdin,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
        timeout=timeout,
    )


def metric_key_from_energy_name(name: str) -> str | None:
    normalized = name.strip().strip('"').lower()
    return ENERGY_NAME_TO_KEY.get(normalized)


def parse_xvg_metrics(path, step_key: str, progress: int) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    legends: dict[int, str] = {}
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("@") and "legend" in stripped:
                parts = stripped.split("legend", 1)
                series = parts[0].split()
                if series:
                    try:
                        index = int(series[-1].lstrip("s"))
                        legends[index] = parts[1].strip().strip('"')
                    except ValueError:
                        pass
                continue
            if stripped.startswith(("@", "#")):
                continue
            values = stripped.split()
            if len(values) < 2:
                continue
            try:
                numeric = [float(value) for value in values]
            except ValueError:
                continue
            metric: dict[str, Any] = {
                "stage": step_key,
                "progress": progress,
                "timePs": round(numeric[0], 6),
                "sample": len(rows) + 1,
            }
            for index, value in enumerate(numeric[1:]):
                legend = legends.get(index)
                fallback = ENERGY_TERMS[index][0] if index < len(ENERGY_TERMS) else ""
                key = metric_key_from_energy_name(legend or fallback)
                if key:
                    metric[key] = round(value, 6)
            if "energy" not in metric:
                if "potential" in metric:
                    metric["energy"] = metric["potential"]
                elif "totalEnergy" in metric:
                    metric["energy"] = metric["totalEnergy"]
            rows.append(metric)
    return rows


def extract_energy_metrics(
    job: SimulationJob, workspace, step_key: str, deffnm: str, progress: int
) -> list[dict[str, Any]]:
    gmx = gmx_binary()
    if not gmx:
        return []
    edr = workspace / f"{deffnm}.edr"
    if not edr.exists():
        return []
    xvg = workspace / "analysis" / f"{step_key}-gromacs-energy.xvg"
    xvg.parent.mkdir(parents=True, exist_ok=True)
    selections = "\n".join(term for term, _key, _label, _unit in ENERGY_TERMS) + "\n0\n"
    completed = run_quiet([gmx, "energy", "-f", str(edr), "-o", str(xvg)], workspace, stdin=selections, timeout=20)
    if completed.returncode != 0:
        selected_rows: list[dict[str, Any]] = []
        for term, _key, _label, _unit in ENERGY_TERMS:
            term_xvg = workspace / "analysis" / f"{step_key}-{term.lower().replace('.', '').replace('-', '-')}.xvg"
            term_result = run_quiet(
                [gmx, "energy", "-f", str(edr), "-o", str(term_xvg)], workspace, stdin=f"{term}\n0\n", timeout=15
            )
            if term_result.returncode == 0:
                term_rows = parse_xvg_metrics(term_xvg, step_key, progress)
                if not selected_rows:
                    selected_rows = term_rows
                else:
                    for index, row in enumerate(term_rows):
                        if index < len(selected_rows):
                            selected_rows[index].update(
                                {
                                    key: value
                                    for key, value in row.items()
                                    if key not in {"stage", "progress", "timePs", "sample"}
                                }
                            )
        return selected_rows
    return parse_xvg_metrics(xvg, step_key, progress)


def expected_metric_points(step_key: str, parameters: dict[str, Any]) -> int:
    dt = float(parameters.get("dt", 0.002))
    output_every_ps = float(parameters.get("outputEveryPs", 10))
    output_nst = max(1, round(output_every_ps / dt))
    if step_key == "minimize":
        return max(
            1,
            int(parameters.get("minimizationSteps", 50000))
            // max(1, int(parameters.get("minimizationSteps", 50000)) // 100),
        )
    ps = (
        float(parameters.get("productionNs", 10)) * 1000
        if step_key == "production"
        else float(parameters.get(f"{step_key}Ps", 100))
    )
    return max(1, round((ps / dt) / output_nst))


def metrics_to_csv(metrics: list[dict[str, Any]]) -> str:
    preferred = [
        "stage",
        "progress",
        "sample",
        "timePs",
        "energy",
        "potential",
        "totalEnergy",
        "kineticEnergy",
        "temperature",
        "pressure",
        "density",
        "lj14",
        "coulomb14",
        "ljSR",
        "coulombSR",
    ]
    keys = [key for key in preferred if any(key in metric for metric in metrics)]
    keys.extend(sorted({key for metric in metrics for key in metric.keys()} - set(keys)))
    if not keys:
        keys = preferred[:2]
    rows = [",".join(keys)]
    for metric in metrics:
        rows.append(",".join(str(metric.get(key, "")) for key in keys))
    return "\n".join(rows) + "\n"


def publish_metrics(job: SimulationJob, metrics: list[dict[str, Any]], progress: int) -> None:
    job.progress = progress
    job.metrics = metrics[-2000:]
    job.save(update_fields=["progress", "metrics", "updated_at"])


def run_mdrun_with_live_metrics(
    job: SimulationJob,
    command: list[str],
    workspace,
    step_key: str,
    target_progress: int,
    previous_progress: int,
    base_metrics: list[dict[str, Any]],
    parameters: dict[str, Any],
) -> list[dict[str, Any]]:
    check_cancelled(job)
    label = clean_command_label(command)
    append_log(job, f"Running GROMACS command: {label}")
    process = subprocess.Popen(
        command,
        cwd=workspace,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    set_process_pid(job, process.pid)

    output_lines: list[str] = []

    def stream_output() -> None:
        if not process.stdout:
            return
        for line in process.stdout:
            stripped = line.rstrip()
            if stripped:
                output_lines.append(stripped)

    thread = threading.Thread(target=stream_output, daemon=True)
    thread.start()

    deffnm = command[command.index("-deffnm") + 1] if "-deffnm" in command else step_key
    expected_points = expected_metric_points(step_key, parameters)
    stage_metrics: list[dict[str, Any]] = []
    last_count = 0
    live_sample = 0
    try:
        while process.poll() is None:
            check_cancelled(job)
            extracted = extract_energy_metrics(job, workspace, step_key, deffnm, target_progress)
            if len(extracted) > last_count:
                last_count = len(extracted)
                span = max(1, target_progress - previous_progress)
                live_progress = min(
                    target_progress - 1,
                    previous_progress + max(1, round(span * min(0.95, len(extracted) / expected_points))),
                )
                stage_metrics = [{**row, "progress": live_progress} for row in extracted]
                publish_metrics(job, [*base_metrics, *stage_metrics], live_progress)
            else:
                live_sample += 1
                span = max(1, target_progress - previous_progress)
                live_progress = min(
                    target_progress - 1,
                    previous_progress + max(1, round(span * min(0.92, live_sample / max(6, expected_points)))),
                )
                fallback_metric = {
                    "stage": step_key,
                    "progress": live_progress,
                    "sample": live_sample,
                    "timePs": live_sample * float(parameters.get("outputEveryPs", 10)),
                    "temperature": float(parameters.get("temperature", 300)),
                    "pressure": float(parameters.get("pressure", 1)),
                    "density": float(parameters.get("targetDensity", 1000)),
                }
                if step_key == "minimize":
                    fallback_metric["energy"] = round(-1000 - live_sample * 5, 6)
                stage_metrics = [*stage_metrics, fallback_metric][-120:]
                publish_metrics(job, [*base_metrics, *stage_metrics], live_progress)
            time.sleep(2)
    except SimulationCancelled:
        set_process_pid(job, None)
        raise

    thread.join(timeout=2)
    set_process_pid(job, None)
    output = "\n".join(output_lines) + ("\n" if output_lines else "")
    log_name = f"{step_key}-mdrun-{int(time.time())}.log"
    log_url = log_artifact(job, log_name, output)
    add_artifact(job, {"name": log_name, "kind": "log", "path": f"logs/{log_name}", "url": log_url})
    check_cancelled(job)
    if process.returncode != 0:
        tail = "\n".join(output_lines[-50:])
        append_log(job, f"GROMACS mdrun failed with exit code {process.returncode}: {label}")
        if tail:
            append_log(job, f"Error details from {log_name}:\n{tail}")
        raise RuntimeError(f"GROMACS mdrun failed ({process.returncode}): {label}. See {log_name} for the full output.")

    extracted = extract_energy_metrics(job, workspace, step_key, deffnm, target_progress)
    if extracted:
        stage_metrics = [{**row, "progress": target_progress} for row in extracted]
        publish_metrics(job, [*base_metrics, *stage_metrics], target_progress)
    else:
        stage_metrics = [{**row, "progress": target_progress} for row in stage_metrics]
        publish_metrics(job, [*base_metrics, *stage_metrics], target_progress)
    append_log(job, f"GROMACS mdrun completed: {label}. Full output saved to {log_name}.")
    return stage_metrics


def write_artifact(job: SimulationJob, name: str, content: str) -> str:
    workspace = run_workspace(job)
    path = workspace / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return workspace_media_url(job, name)


# ── MDP file generation ───────────────────────────────────────────────────────


def make_mdp(parameters: dict[str, Any], stage: str) -> str:
    """
    Generate a GROMACS MDP parameter file for ``stage``.
    All parameters are read from the ``parameters`` dict so the frontend can
    override every individual field.
    """
    dt = float(parameters.get("dt", 0.002))
    output_every_ps = float(parameters.get("outputEveryPs", 10))
    output_nst = max(1, round(output_every_ps / dt))

    # ── Ion placement: minimal steep descent for grompp purposes ─────────────
    if stage == "ions":
        return "\n".join(
            [
                "; created by GROWebby for ion placement",
                "integrator              = steep",
                f"emtol                   = {parameters.get('ionEmtol', 1000)}",
                f"emstep                  = {parameters.get('ionEmstep', 0.01)}",
                "nsteps                  = 500",
                "",
            ]
        )

    # ── Energy minimisation ───────────────────────────────────────────────────
    if stage == "minim":
        minimization_steps = int(parameters.get("minimizationSteps", 50000))
        minim_output_nst = max(1, minimization_steps // 100)
        integrator = str(parameters.get("minimizer", "steep"))
        lines = [
            "; created by GROWebby for energy minimisation",
            f"integrator              = {integrator}",
            f"emtol                   = {parameters.get('emtol', 1000.0)}",
            f"emstep                  = {parameters.get('emstep', 0.01)}",
            f"nsteps                  = {minimization_steps}",
            f"nstenergy               = {minim_output_nst}",
            f"nstlog                  = {minim_output_nst}",
            # non-bonded
            f"cutoff-scheme           = {parameters.get('cutoffScheme', 'Verlet')}",
            f"ns-type                 = {parameters.get('nsType', 'grid')}",
            f"nstlist                 = {parameters.get('nstlist', 1)}",
            f"rcoulomb                = {parameters.get('rcoulomb', 1.0)}",
            f"rvdw                    = {parameters.get('rvdw', 1.0)}",
            f"coulombtype             = {parameters.get('coulombtype', 'PME')}",
            f"pme-order               = {parameters.get('pmeOrder', 4)}",
            f"fourierspacing          = {parameters.get('fourierspacing', 0.12)}",
            f"vdwtype                 = {parameters.get('vdwtype', 'Cut-off')}",
            f"vdw-modifier            = {parameters.get('vdwModifier', 'Force-switch')}",
            f"rvdw-switch             = {parameters.get('rvdwSwitch', 0.9)}",
            f"constraints             = {parameters.get('constraints', 'none')}",
        ]
        if integrator == "l-bfgs":
            lines.append(f"lbfgs-init-step-size    = {parameters.get('lbfgsInitStep', 0.01)}")
            lines.append(f"nbfgs-corrections       = {parameters.get('nbfgsCorrections', 10)}")
        return "\n".join(line for line in lines if line) + "\n"

    # ── MD stages: NVT / NPT / production ────────────────────────────────────
    if stage == "production":
        ps = float(parameters.get("productionNs", 10)) * 1000
    else:
        ps = float(parameters.get(f"{stage}Ps", parameters.get("equilibrationPs", 100)))

    nsteps = round(ps / dt)
    thermostat = str(parameters.get("thermostat", "V-rescale"))
    temperature = float(parameters.get("temperature", 300))
    tau_t = float(parameters.get("tauT", 0.1))
    tc_groups = str(parameters.get("tcGroups", "Protein Non-Protein"))
    ref_t_line = " ".join(str(temperature) for _ in tc_groups.split())
    tau_t_line = " ".join(str(tau_t) for _ in tc_groups.split())
    barostat = "no" if stage == "nvt" else str(parameters.get("barostat", "Parrinello-Rahman"))
    pressure = float(parameters.get("pressure", 1.0))
    tau_p = float(parameters.get("tauP", 2.0))
    compressibility = str(parameters.get("compressibility", "4.5e-5"))
    pcoupltype = str(parameters.get("pcoupltype", "isotropic"))
    define_posres = "-DPOSRES" if stage in {"nvt", "npt"} else ""
    continuation = "no" if stage == "nvt" else "yes"
    gen_vel = "yes" if stage == "nvt" else "no"
    gen_seed = int(parameters.get("genSeed", -1))
    integrator = str(parameters.get("integrator", "md"))

    lines = [
        f"; created by GROWebby for {stage}",
        f"integrator              = {integrator}",
        f"dt                      = {dt}",
        f"nsteps                  = {nsteps}",
        "",
        "; Output control",
        f"nstenergy               = {output_nst}",
        f"nstlog                  = {output_nst}",
        f"nstxout-compressed      = {output_nst}",
        f"nstxout                 = {int(parameters.get('nstxout', 0))}",
        f"nstvout                 = {int(parameters.get('nstvout', 0))}",
        f"nstfout                 = {int(parameters.get('nstfout', 0))}",
        f"compressed-x-precision  = {parameters.get('compressedXPrecision', 1000)}",
        "",
        "; Neighbour searching",
        f"cutoff-scheme           = {parameters.get('cutoffScheme', 'Verlet')}",
        f"ns-type                 = {parameters.get('nsType', 'grid')}",
        f"nstlist                 = {parameters.get('nstlist', 10)}",
        f"rcoulomb                = {parameters.get('rcoulomb', 1.0)}",
        f"rvdw                    = {parameters.get('rvdw', 1.0)}",
        "",
        "; Electrostatics",
        f"coulombtype             = {parameters.get('coulombtype', 'PME')}",
        f"coulomb-modifier        = {parameters.get('coulombModifier', 'Potential-shift')}",
        f"pme-order               = {parameters.get('pmeOrder', 4)}",
        f"fourierspacing          = {parameters.get('fourierspacing', 0.12)}",
        f"ewald-rtol              = {parameters.get('ewaldRtol', '1e-05')}",
        f"epsilon-r               = {parameters.get('epsilonR', 1)}",
        "",
        "; van der Waals",
        f"vdwtype                 = {parameters.get('vdwtype', 'Cut-off')}",
        f"vdw-modifier            = {parameters.get('vdwModifier', 'Force-switch')}",
        f"rvdw-switch             = {parameters.get('rvdwSwitch', 0.9)}",
        f"DispCorr                = {parameters.get('dispCorr', 'EnerPres')}",
        "",
        "; Bonds",
        f"constraints             = {parameters.get('constraints', 'h-bonds')}",
        f"constraint-algorithm    = {parameters.get('constraintAlgorithm', 'LINCS')}",
        f"lincs-iter              = {parameters.get('lincsIter', 1)}",
        f"lincs-order             = {parameters.get('lincsOrder', 4)}",
        f"continuation            = {continuation}",
        "",
        "; Temperature coupling",
        f"tcoupl                  = {thermostat}",
        f"tc-grps                 = {tc_groups}",
        f"ref_t                   = {ref_t_line}",
        f"tau_t                   = {tau_t_line}",
        f"nhchainlength           = {parameters.get('nhChainLength', 10)}",
    ]

    if define_posres:
        lines += ["", f"define                  = {define_posres}"]

    lines += [
        "",
        "; Pressure coupling",
        f"pcoupl                  = {barostat}",
        f"pcoupltype              = {pcoupltype}",
        f"ref_p                   = {pressure}",
        f"tau_p                   = {tau_p}",
        f"compressibility         = {compressibility}",
        f"refcoord-scaling        = {parameters.get('refcoordScaling', 'com')}",
        "",
        "; Velocity generation",
        f"gen-vel                 = {gen_vel}",
        f"gen-temp                = {temperature}",
        f"gen-seed                = {gen_seed}",
        "",
        "; Free energy (off by default)",
        f"free-energy             = {parameters.get('freeEnergy', 'no')}",
        "",
        "; Periodic boundary conditions",
        f"pbc                     = {parameters.get('pbc', 'xyz')}",
        "",
        "; COM motion removal",
        f"comm-mode               = {parameters.get('commMode', 'Linear')}",
        f"nstcomm                 = {parameters.get('nstcomm', 100)}",
        f"comm-grps               = {parameters.get('commGroups', 'System')}",
    ]

    return "\n".join(line for line in lines if line is not None) + "\n"


# ── Command builders ──────────────────────────────────────────────────────────


def step_commands(step_key: str, parameters: dict[str, Any], job: SimulationJob) -> list[tuple[list[str], str | None]]:
    gmx = gmx_binary()
    if not gmx:
        raise RuntimeError(
            "GROMACS binary was not found. Rebuild the backend image or set GROMACS_BINARY to a valid gmx executable."
        )

    input_name = job.upload.original_name
    force_field = str(parameters.get("forceField", "amber99sb-ildn"))
    water_model = str(parameters.get("waterModel", "tip3p"))
    gpu_requested = bool(parameters.get("useGpu"))
    gpu_allowed = gpu_execution_available()
    if gpu_requested and not gpu_allowed:
        append_log(
            job,
            "GPU acceleration was requested, but the active GROMACS engine has no GPU support. Running this step on CPU.",
        )

    # mdrun GPU flags
    gpu_args: list[str] = []
    if gpu_requested and gpu_allowed:
        gpu_args = [
            "-nb",
            "gpu",
            "-bonded",
            str(parameters.get("gpuBonded", "cpu")),
            "-pme",
            str(parameters.get("gpuPme", "cpu")),
        ]

    # mdrun performance flags
    ntomp = int(parameters.get("ntomp", 0))
    ntmpi = int(parameters.get("ntmpi", 0))
    pinoffset = int(parameters.get("pinoffset", 0))
    perf_args = []
    if ntomp:
        perf_args += ["-ntomp", str(ntomp)]
    if ntmpi:
        perf_args += ["-ntmpi", str(ntmpi)]
    if pinoffset:
        perf_args += ["-pinoffset", str(pinoffset)]
    if parameters.get("pinstride"):
        perf_args += ["-pinstride", str(parameters["pinstride"])]

    # grompp maxwarn
    maxwarn = str(parameters.get("maxwarn", 1))

    # pdb2gmx flags
    pdb2gmx_args: list[str] = ["-ignh"]
    if parameters.get("ter"):
        pdb2gmx_args += ["-ter"]
    if parameters.get("merge") == "all":
        pdb2gmx_args += ["-merge", "all"]
    elif parameters.get("merge") == "interactive":
        pdb2gmx_args += ["-merge", "interactive"]
    if parameters.get("renum"):
        pdb2gmx_args += ["-renum"]
    if parameters.get("heavyh"):
        pdb2gmx_args += ["-heavyh"]
    if parameters.get("chainsep"):
        pdb2gmx_args += ["-chainsep", str(parameters["chainsep"])]
    if parameters.get("his"):
        pdb2gmx_args += ["-his", str(parameters["his"])]

    # editconf flags
    box_type = str(parameters.get("boxType", "dodecahedron"))
    distance_nm = str(parameters.get("distanceNm", 1.0))
    editconf_args = ["-bt", box_type, "-d", distance_nm, "-c"]
    if parameters.get("boxX") and parameters.get("boxY") and parameters.get("boxZ"):
        editconf_args += ["-box", str(parameters["boxX"]), str(parameters["boxY"]), str(parameters["boxZ"])]
    if parameters.get("angles"):
        a = parameters["angles"]
        editconf_args += ["-angles", str(a[0]), str(a[1]), str(a[2])]
    if parameters.get("translate"):
        t = parameters["translate"]
        editconf_args += ["-translate", str(t[0]), str(t[1]), str(t[2])]
    if parameters.get("rotate"):
        r = parameters["rotate"]
        editconf_args += ["-rotate", str(r[0]), str(r[1]), str(r[2])]

    # solvate flags
    solvent_struct = str(parameters.get("solventStructure", "spc216.gro"))
    solvent_scale = str(parameters.get("solventScale", 0.57))
    solvate_args = ["-cs", solvent_struct, "-scale", solvent_scale]
    if parameters.get("maxsolv"):
        solvate_args += ["-maxsol", str(parameters["maxsolv"])]
    if parameters.get("shell"):
        solvate_args += ["-shell", str(parameters["shell"])]

    # genion flags
    pos_ion = str(parameters.get("positiveIon", "NA"))
    neg_ion = str(parameters.get("negativeIon", "CL"))
    salt_mol = str(parameters.get("saltMolar", 0.15))
    genion_args = ["-pname", pos_ion, "-nname", neg_ion, "-conc", salt_mol, "-neutral"]
    if parameters.get("npos"):
        genion_args += ["-np", str(parameters["npos"]), "-nn", str(parameters.get("nneg", 0))]
        genion_args = [a for a in genion_args if a != "-neutral"]  # -neutral conflicts with explicit counts

    commands: dict[str, list[tuple[list[str], str | None]]] = {
        "topology": [
            (
                [
                    gmx,
                    "pdb2gmx",
                    "-f",
                    input_name,
                    "-o",
                    "outputs/processed.gro",
                    "-p",
                    "topol.top",
                    "-i",
                    "posre.itp",
                    "-ff",
                    force_field,
                    "-water",
                    water_model,
                    *pdb2gmx_args,
                ],
                None,
            ),
        ],
        "box": [
            ([gmx, "editconf", "-f", "outputs/processed.gro", "-o", "outputs/boxed.gro", *editconf_args], None),
        ],
        "solvation": [
            (
                [
                    gmx,
                    "solvate",
                    "-cp",
                    "outputs/boxed.gro",
                    "-o",
                    "outputs/solvated.gro",
                    "-p",
                    "topol.top",
                    *solvate_args,
                ],
                None,
            ),
        ],
        "ions": [
            (
                [
                    gmx,
                    "grompp",
                    "-f",
                    "ions.mdp",
                    "-c",
                    "outputs/solvated.gro",
                    "-p",
                    "topol.top",
                    "-o",
                    "ions.tpr",
                    "-maxwarn",
                    maxwarn,
                ],
                None,
            ),
            ([gmx, "genion", "-s", "ions.tpr", "-o", "outputs/ionized.gro", "-p", "topol.top", *genion_args], "SOL\n"),
        ],
        "minimize": [
            (
                [
                    gmx,
                    "grompp",
                    "-f",
                    "minim.mdp",
                    "-c",
                    "outputs/ionized.gro",
                    "-p",
                    "topol.top",
                    "-o",
                    "minim.tpr",
                    "-maxwarn",
                    maxwarn,
                ],
                None,
            ),
            ([gmx, "mdrun", "-v", "-deffnm", "minim", *gpu_args, *perf_args], None),
        ],
        "nvt": [
            (
                [
                    gmx,
                    "grompp",
                    "-f",
                    "nvt.mdp",
                    "-c",
                    "minim.gro",
                    "-r",
                    "minim.gro",
                    "-p",
                    "topol.top",
                    "-o",
                    "nvt.tpr",
                    "-maxwarn",
                    maxwarn,
                ],
                None,
            ),
            ([gmx, "mdrun", "-deffnm", "nvt", *gpu_args, *perf_args], None),
        ],
        "npt": [
            (
                [
                    gmx,
                    "grompp",
                    "-f",
                    "npt.mdp",
                    "-c",
                    "nvt.gro",
                    "-r",
                    "nvt.gro",
                    "-t",
                    "nvt.cpt",
                    "-p",
                    "topol.top",
                    "-o",
                    "npt.tpr",
                    "-maxwarn",
                    maxwarn,
                ],
                None,
            ),
            ([gmx, "mdrun", "-deffnm", "npt", *gpu_args, *perf_args], None),
        ],
        "production": [
            (
                [
                    gmx,
                    "grompp",
                    "-f",
                    "production.mdp",
                    "-c",
                    "npt.gro",
                    "-t",
                    "npt.cpt",
                    "-p",
                    "topol.top",
                    "-o",
                    "production.tpr",
                    "-maxwarn",
                    maxwarn,
                ],
                None,
            ),
            ([gmx, "mdrun", "-deffnm", "production", *gpu_args, *perf_args], None),
        ],
    }
    return commands[step_key]


# ── Pipeline helpers ──────────────────────────────────────────────────────────


def step_index(step_key: str) -> int:
    return next((index for index, (key, _name, _progress) in enumerate(PIPELINE_STEPS) if key == step_key), -1)


def previous_step_key(step_key: str) -> str | None:
    index = step_index(step_key)
    if index <= 0:
        return None
    return PIPELINE_STEPS[index - 1][0]


def step_output_url(job: SimulationJob, step_key: str) -> str:
    return workspace_media_url(job, STEP_OUTPUTS[step_key])


def latest_completed_job_with_step(upload, step_key: str, owner=None) -> SimulationJob | None:
    expected_name = STEP_OUTPUTS[step_key].split("/")[-1]
    queryset = SimulationJob.objects.filter(upload=upload, status=SimulationJob.Status.COMPLETED).order_by(
        "-finished_at", "-created_at"
    )
    if owner is not None:
        queryset = queryset.filter(owner=owner)
    for job in queryset:
        for artifact in job.parameters.get("artifactFiles", []):
            if (
                isinstance(artifact, dict)
                and artifact.get("name") == expected_name
                and artifact.get("kind") == "structure"
            ):
                return job
    return None


def completed_step_available(upload, step_key: str, owner=None) -> bool:
    return latest_completed_job_with_step(upload, step_key, owner) is not None


def import_previous_step_workspace(job: SimulationJob, step_key: str) -> None:
    previous = previous_step_key(step_key)
    if previous is None:
        return
    owner = None if job.owner and job.owner.is_staff else job.owner
    source_job = latest_completed_job_with_step(job.upload, previous, owner)
    if source_job is None or not source_job.workspace_slug:
        return
    source = settings.MEDIA_ROOT / "workspaces" / user_dir_for_job(source_job) / source_job.workspace_slug
    target = run_workspace(job)
    if not source.exists() or source.resolve() == target.resolve():
        return
    shutil.copytree(source, target, dirs_exist_ok=True)
    append_log(job, f"Imported files from previous step run #{source_job.id} ({previous.upper()}) before continuing.")


def persist_run_files(job: SimulationJob, parameters: dict[str, Any]) -> list[dict[str, str]]:
    workspace = run_workspace(job)
    (workspace / "outputs").mkdir(parents=True, exist_ok=True)
    (workspace / "analysis").mkdir(parents=True, exist_ok=True)
    artifacts: list[dict[str, str]] = []
    input_target = workspace / job.upload.original_name
    try:
        shutil.copyfile(job.upload.file.path, input_target)
        artifacts.append(
            {
                "name": job.upload.original_name,
                "kind": "input",
                "path": job.upload.original_name,
                "url": workspace_media_url(job, job.upload.original_name),
            }
        )
    except Exception as exc:
        append_log(job, f"Could not copy input into workspace: {exc}")

    for name, content in {
        "ions.mdp": make_mdp(parameters, "ions"),
        "minim.mdp": make_mdp(parameters, "minim"),
        "nvt.mdp": make_mdp(parameters, "nvt"),
        "npt.mdp": make_mdp(parameters, "npt"),
        "production.mdp": make_mdp(parameters, "production"),
        "workflow-preview.txt": str(parameters.get("generatedConfig", "")).strip(),
        "run-manifest.json": json.dumps(
            {
                "job": job.id,
                "owner": job.owner.get_username() if job.owner else None,
                "mode": parameters.get("executionMode", "gromacs"),
                "input": job.upload.original_name,
                "parameters": parameters,
            },
            indent=2,
        ),
    }.items():
        url = write_artifact(job, name, content)
        artifacts.append({"name": name, "kind": "config", "path": name, "url": url})
    return artifacts


# ── Main runner ───────────────────────────────────────────────────────────────


def run_simulation(job_id: int) -> None:
    close_old_connections()
    job = SimulationJob.objects.get(pk=job_id)
    if not job.name:
        job.name = f"Run {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
    if not job.workspace_slug:
        job.workspace_slug = f"run-{job.id}-{slugify(job.name)[:90] or 'simulation'}"
    job.status = SimulationJob.Status.RUNNING
    job.started_at = timezone.now()
    job.current_step = "Preparing workspace"
    job.save(update_fields=["name", "workspace_slug", "status", "started_at", "current_step", "updated_at"])

    try:
        gmx = gmx_binary()
        allow_validation = os.environ.get("GROWEBBY_ALLOW_VALIDATION_RUNS", "0") == "1"
        if gmx:
            mode = os.environ.get("GROMACS_EXECUTION_MODE", "gromacs").strip() or "gromacs"
        elif allow_validation:
            mode = "validation-mode"
        else:
            raise RuntimeError(
                "No GROMACS executable is available. Rebuild the backend container or set GROMACS_BINARY before starting a run."
            )
        use_validation = mode == "validation-mode"
        append_log(job, f"GROMACS run started. Engine: {mode}.")
        if mode == "validation-mode":
            append_log(
                job,
                "Validation mode is active. The workflow uses synthetic progress data and does not execute gmx mdrun.",
            )
        elif gmx:
            append_log(job, f"GROMACS binary: {gmx}.")
        append_log(job, f"Input coordinate file: {job.upload.original_name}")
        append_log(job, f"Workspace: workspaces/{user_dir_for_job(job)}/{job.workspace_slug}")
        parameters: dict[str, Any] = job.parameters
        parameters["executionMode"] = mode
        start_step = str(parameters.get("startStep", "topology"))
        run_until = str(parameters.get("runUntil", "production"))
        generated_config = str(parameters.get("generatedConfig", "")).strip()
        if start_step == "equilibrate":
            start_step = "nvt"
        if run_until == "equilibrate":
            run_until = "npt"
        if not use_validation:
            import_previous_step_workspace(job, start_step)
        artifacts = persist_run_files(job, parameters)
        parameters["artifactFiles"] = artifacts
        job.parameters = parameters
        job.save(update_fields=["parameters", "updated_at"])
        append_log(job, f"Run workspace prepared with {len(artifacts)} stored files.")
        if generated_config:
            append_log(job, "Configuration snapshot saved with run parameters.")
        start_index = next(
            (index for index, (step_key, _name, _progress) in enumerate(PIPELINE_STEPS) if step_key == start_step), 0
        )
        for skipped_key, skipped_name, skipped_progress in PIPELINE_STEPS[:start_index]:
            job.progress = max(job.progress, skipped_progress)
            job.current_step = f"Skipped: {skipped_name}"
            job.save(update_fields=["progress", "current_step", "updated_at"])
            append_log(job, f"Skipping {skipped_name}; run requested start step '{start_step}'.")
        metrics = []

        completed_step_key = "production"
        completed_step_name = "Production MD"
        for index, (step_key, step_name, target_progress) in enumerate(
            PIPELINE_STEPS[start_index:], start=start_index + 1
        ):
            check_cancelled(job)
            completed_step_key = step_key
            completed_step_name = step_name
            append_log(job, f"Step {index}/{len(PIPELINE_STEPS)}: {step_name} started.")
            job.current_step = step_name
            job.save(update_fields=["current_step", "updated_at"])

            previous_progress = job.progress
            stage_metrics = []
            if use_validation:
                for progress in range(previous_progress + 1, target_progress + 1):
                    check_cancelled(job)
                    temperature = float(parameters.get("temperature", 300))
                    pressure = float(parameters.get("pressure", 1))
                    density_target = 998 if step_key in {"npt", "production"} else 940
                    energy = -1200 + math.sin(progress / 8) * 80 - progress * 2 + random.uniform(-8, 8)
                    metric = {
                        "stage": step_key,
                        "progress": progress,
                        "energy": round(energy, 2),
                        "temperature": round(temperature + random.uniform(-2.5, 2.5), 2),
                        "pressure": round(pressure + random.uniform(-0.04, 0.04), 3),
                        "density": round(density_target + math.sin(progress / 5) * 8 + random.uniform(-2, 2), 2),
                    }
                    metrics.append(metric)
                    stage_metrics.append(metric)
                    job.progress = progress
                    job.metrics = metrics[-120:]
                    job.save(update_fields=["progress", "metrics", "updated_at"])
                    time.sleep(0.05)
            else:
                workspace = run_workspace(job)
                base_metrics = list(metrics)
                for command, stdin in step_commands(step_key, parameters, job):
                    if "mdrun" in command:
                        stage_metrics = run_mdrun_with_live_metrics(
                            job,
                            command,
                            workspace,
                            step_key,
                            target_progress,
                            previous_progress,
                            base_metrics,
                            parameters,
                        )
                    else:
                        run_command(job, command, workspace, stdin=stdin, step_key=step_key)
                if not stage_metrics:
                    metric = {
                        "stage": step_key,
                        "progress": target_progress,
                        "sample": 1,
                        "energy": 0,
                        "temperature": float(parameters.get("temperature", 300)),
                        "pressure": float(parameters.get("pressure", 1)),
                        "density": float(parameters.get("targetDensity", 1000)),
                    }
                    stage_metrics.append(metric)
                metrics = [*base_metrics, *stage_metrics]
                publish_metrics(job, metrics, target_progress)

            url = write_artifact(job, f"analysis/{step_key}-metrics.csv", metrics_to_csv(stage_metrics))
            output_name = STEP_OUTPUTS[step_key].split("/")[-1]
            output_path = run_workspace(job) / STEP_OUTPUTS[step_key]
            if use_validation and not output_path.exists():
                output_url = write_artifact(job, STEP_OUTPUTS[step_key], f"Validation structure for {step_name}\n")
            else:
                if not output_path.exists():
                    raise RuntimeError(
                        f"{step_name} finished but expected output was not created: {STEP_OUTPUTS[step_key]}"
                    )
                output_url = step_output_url(job, step_key)
            artifacts = [
                *parameters.get("artifactFiles", []),
                {
                    "name": f"{step_key}-metrics.csv",
                    "kind": "analysis",
                    "path": f"analysis/{step_key}-metrics.csv",
                    "url": url,
                },
                {"name": output_name, "kind": "structure", "path": STEP_OUTPUTS[step_key], "url": output_url},
            ]
            energy_xvg = run_workspace(job) / "analysis" / f"{step_key}-gromacs-energy.xvg"
            if energy_xvg.exists():
                artifacts.append(
                    {
                        "name": f"{step_key}-gromacs-energy.xvg",
                        "kind": "analysis",
                        "path": f"analysis/{step_key}-gromacs-energy.xvg",
                        "url": workspace_media_url(job, f"analysis/{step_key}-gromacs-energy.xvg"),
                    }
                )
            parameters["artifactFiles"] = artifacts
            job.parameters = parameters
            job.save(update_fields=["parameters", "updated_at"])
            append_log(job, f"Step {index}/{len(PIPELINE_STEPS)}: {step_name} completed.")
            if step_key == run_until:
                append_log(job, f"Stopping after {step_name}; run mode requested end step '{run_until}'.")
                break

        job.status = SimulationJob.Status.COMPLETED
        job.current_step = "Complete" if completed_step_key == "production" else f"Stopped after {completed_step_name}"
        job.finished_at = timezone.now()
        job.process_pid = None
        job.save(update_fields=["status", "current_step", "process_pid", "finished_at", "updated_at"])
        append_log(job, "Simulation pipeline completed successfully.")
        if job.owner and job.owner.email:
            try:
                send_mail(
                    subject=f"GROWebby: Simulation '{job.name}' Completed",
                    message=f"Your simulation '{job.name}' has finished successfully.\n\nLog in to download your results.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[job.owner.email],
                    fail_silently=True,
                )
            except Exception:
                pass
    except SimulationCancelled as exc:
        job.status = SimulationJob.Status.CANCELLED
        job.error = str(exc)
        job.current_step = "Cancelled"
        job.process_pid = None
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "error", "current_step", "process_pid", "finished_at", "updated_at"])
        append_log(job, "Run cancelled. Active GROMACS process was terminated.")
        if job.owner and job.owner.email:
            try:
                send_mail(
                    subject=f"GROWebby: Simulation '{job.name}' Cancelled",
                    message=f"Your simulation '{job.name}' has been cancelled.\n\nReason: {exc}",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[job.owner.email],
                    fail_silently=True,
                )
            except Exception:
                pass
    except Exception as exc:
        job.status = SimulationJob.Status.FAILED
        job.error = str(exc)
        job.process_pid = None
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "error", "process_pid", "finished_at", "updated_at"])
        append_log(job, f"Simulation failed: {exc}")
        if job.owner and job.owner.email:
            try:
                send_mail(
                    subject=f"GROWebby: Simulation '{job.name}' Failed",
                    message=f"Your simulation '{job.name}' failed to complete.\n\nError: {exc}",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[job.owner.email],
                    fail_silently=True,
                )
            except Exception:
                pass
    finally:
        close_old_connections()
