from __future__ import annotations

import json
import os
import signal
import shutil
import time
from typing import Any
from urllib.parse import unquote, urlparse

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.core.files.base import ContentFile
from django.http import HttpRequest, JsonResponse, StreamingHttpResponse
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from .models import SimulationJob, SimulationLog, UploadedCoordinate
from .runner import completed_step_available, enqueue_simulation, previous_step_key, user_dir_for_job

LYSOZYME_DEMO_PDB = """HEADER    GROWebby lysozyme tutorial validation structure
ATOM      1  N   LYS A   1      -1.450   0.000   0.000  1.00 20.00           N
ATOM      2  CA  LYS A   1      -0.080   0.000   0.000  1.00 20.00           C
ATOM      3  C   LYS A   1       0.520   1.410   0.000  1.00 20.00           C
ATOM      4  O   LYS A   1      -0.120   2.430   0.000  1.00 20.00           O
ATOM      5  CB  LYS A   1       0.520  -0.780  -1.180  1.00 20.00           C
ATOM      6  N   VAL A   2       1.790   1.430   0.000  1.00 20.00           N
ATOM      7  CA  VAL A   2       2.520   2.690   0.000  1.00 20.00           C
ATOM      8  C   VAL A   2       3.990   2.360   0.000  1.00 20.00           C
ATOM      9  O   VAL A   2       4.760   3.300   0.000  1.00 20.00           O
TER
END
"""

SMALL_MOLECULE_DEMO_PDB = """HEADER    GROWebby small molecule validation structure
HETATM    1  C1  LIG A   1       0.000   0.000   0.000  1.00 10.00           C
HETATM    2  O1  LIG A   1       1.210   0.000   0.000  1.00 10.00           O
HETATM    3  N1  LIG A   1      -0.620   1.050   0.000  1.00 10.00           N
HETATM    4  C2  LIG A   1      -0.710  -1.180   0.000  1.00 10.00           C
END
"""


def visible_uploads(request: HttpRequest):
    queryset = UploadedCoordinate.objects.all()
    if request.user.is_authenticated and request.user.is_staff:
        return queryset
    if request.user.is_authenticated:
        group_ids = request.user.groups.values_list("id", flat=True)
        return queryset.filter(owner=request.user) | queryset.filter(group_id__in=group_ids)
    return queryset.filter(owner__isnull=True)


def visible_jobs(request: HttpRequest):
    queryset = SimulationJob.objects.select_related("upload", "owner", "group")
    if request.user.is_authenticated and request.user.is_staff:
        return queryset
    if request.user.is_authenticated:
        group_ids = request.user.groups.values_list("id", flat=True)
        return queryset.filter(owner=request.user) | queryset.filter(group_id__in=group_ids)
    return queryset.filter(owner__isnull=True)


def upload_payload(upload: UploadedCoordinate) -> dict[str, Any]:
    return {
        "id": upload.id,
        "originalName": upload.original_name,
        "size": upload.size,
        "url": upload.file.url,
        "owner": upload.owner.get_username() if upload.owner else None,
        "group": upload.group.name if upload.group else None,
        "createdAt": upload.created_at.isoformat(),
    }


def job_payload(job: SimulationJob) -> dict[str, Any]:
    run_group_id = job.parameters.get("runGroupId") or job.id
    step = str(job.parameters.get("startStep") or job.parameters.get("runUntil") or job.current_step or "")
    return {
        "id": job.id,
        "runGroupId": run_group_id,
        "step": step,
        "name": job.name or f"Run {job.id}",
        "workspaceSlug": job.workspace_slug or f"run-{job.id}",
        "status": job.status,
        "currentStep": job.current_step,
        "progress": job.progress,
        "processPid": job.process_pid,
        "parameters": job.parameters,
        "artifactFiles": job.parameters.get("artifactFiles", []),
        "executionMode": job.parameters.get("executionMode", "unknown"),
        "metrics": job.metrics,
        "error": job.error,
        "upload": upload_payload(job.upload),
        "owner": job.owner.get_username() if job.owner else None,
        "group": job.group.name if job.group else None,
        "createdAt": job.created_at.isoformat(),
        "updatedAt": job.updated_at.isoformat(),
        "startedAt": job.started_at.isoformat() if job.started_at else None,
        "finishedAt": job.finished_at.isoformat() if job.finished_at else None,
    }


def default_run_name() -> str:
    return f"Run {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"


def workspace_slug(job_id: int, name: str) -> str:
    return f"run-{job_id}-{slugify(name)[:90] or 'simulation'}"


def job_run_group_id(job: SimulationJob) -> int:
    try:
        return int(job.parameters.get("runGroupId") or job.id)
    except (TypeError, ValueError):
        return job.id


def artifact_relative_path(job: SimulationJob, artifact: dict[str, Any]) -> str:
    if artifact.get("path"):
        return str(artifact["path"]).lstrip("/")
    url_path = unquote(urlparse(str(artifact.get("url", ""))).path)
    user_dir = user_dir_for_job(job)
    marker = f"/workspaces/{user_dir}/runs/{job.workspace_slug}/"
    if marker not in url_path:
        raise ValueError("Artifact does not belong to this run workspace.")
    return url_path.split(marker, 1)[1]


def artifact_file_path(job: SimulationJob, artifact: dict[str, Any]):
    relative = artifact_relative_path(job, artifact)
    user_dir = user_dir_for_job(job)
    root = (settings.MEDIA_ROOT / "workspaces" / user_dir / "runs" / job.workspace_slug).resolve()
    path = (root / relative).resolve()
    if root not in path.parents and path != root:
        raise ValueError("Artifact path is outside the run workspace.")
    return path


@csrf_exempt
@require_POST
def upload_coordinate(request: HttpRequest) -> JsonResponse:
    coordinate = request.FILES.get("file")
    if coordinate is None:
        return JsonResponse({"error": "Upload a coordinate file with the form field name 'file'."}, status=400)

    allowed_extensions = (".pdb", ".gro", ".cif", ".mol2")
    if not coordinate.name.lower().endswith(allowed_extensions):
        return JsonResponse({"error": "Supported coordinate formats: PDB, GRO, CIF, MOL2."}, status=400)

    first_group = request.user.groups.first() if request.user.is_authenticated else None
    upload = UploadedCoordinate.objects.create(
        owner=request.user if request.user.is_authenticated else None,
        group=first_group,
        original_name=coordinate.name,
        file=coordinate,
        size=coordinate.size,
    )
    return JsonResponse(upload_payload(upload), status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def simulations(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        latest = visible_jobs(request).select_related("upload").order_by("-created_at")[:50]
        return JsonResponse({"results": [job_payload(job) for job in latest]})

    try:
        body = json.loads(request.body.decode("utf-8"))
        upload = visible_uploads(request).get(pk=body["uploadId"])
    except (json.JSONDecodeError, KeyError, ObjectDoesNotExist):
        return JsonResponse({"error": "Provide a valid uploadId and parameters JSON body."}, status=400)

    parameters = body.get("parameters", {})
    start_step = str(parameters.get("startStep", "topology"))
    run_until = str(parameters.get("runUntil", start_step))
    if start_step == "equilibrate":
        start_step = "nvt"
    if run_until == "equilibrate":
        run_until = "npt"
    previous_step = previous_step_key(start_step)
    prerequisite_owner = None if (request.user.is_authenticated and request.user.is_staff) else (request.user if request.user.is_authenticated else None)
    if previous_step and start_step == run_until and not completed_step_available(upload, previous_step, prerequisite_owner):
        return JsonResponse(
            {
                "error": f"Cannot run {start_step.upper()} yet. Complete the previous step first: {previous_step.upper()} output is required."
            },
            status=400,
        )
    run_group_job = None
    raw_run_group_id = parameters.get("runGroupId")
    if raw_run_group_id:
        try:
            run_group_job = visible_jobs(request).get(pk=int(raw_run_group_id))
        except (TypeError, ValueError, SimulationJob.DoesNotExist):
            return JsonResponse({"error": "The requested run group is not available."}, status=400)
    run_name = str(body.get("name") or parameters.get("runName") or (run_group_job.name if run_group_job else "") or default_run_name()).strip()[:160]
    job = SimulationJob.objects.create(
        upload=upload,
        owner=request.user if request.user.is_authenticated else upload.owner,
        group=upload.group,
        name=run_name,
        parameters={**parameters, "runName": run_name},
    )
    if run_group_job:
        run_group_id = job_run_group_id(run_group_job)
        job.workspace_slug = run_group_job.workspace_slug or workspace_slug(run_group_id, run_group_job.name)
        job.parameters = {**job.parameters, "runGroupId": run_group_id, "runName": run_name}
    else:
        job.workspace_slug = workspace_slug(job.id, job.name)
        job.parameters = {**job.parameters, "runGroupId": job.id, "runName": run_name}
    job.save(update_fields=["workspace_slug", "parameters", "updated_at"])
    enqueue_simulation(job.id)
    return JsonResponse(job_payload(job), status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def simulation_detail(_request: HttpRequest, job_id: int) -> JsonResponse:
    try:
        job = visible_jobs(_request).select_related("upload").get(pk=job_id)
    except SimulationJob.DoesNotExist:
        return JsonResponse({"error": "Simulation not found."}, status=404)
    if _request.method == "PATCH":
        try:
            body = json.loads(_request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"error": "Provide a JSON body."}, status=400)
        new_name = str(body.get("name", "")).strip()[:160]
        if not new_name:
            return JsonResponse({"error": "Run name is required."}, status=400)
        group_id = job_run_group_id(job)
        group_jobs = [candidate for candidate in visible_jobs(_request).select_related("upload") if job_run_group_id(candidate) == group_id]
        old_slugs = {candidate.workspace_slug for candidate in group_jobs if candidate.workspace_slug}
        old_workspace = settings.MEDIA_ROOT / "workspaces" / user_dir_for_job(job) / (job.workspace_slug or workspace_slug(group_id, job.name))
        new_slug = workspace_slug(group_id, new_name)
        new_workspace = settings.MEDIA_ROOT / "workspaces" / user_dir_for_job(job) / new_slug
        if old_workspace.exists() and old_workspace != new_workspace:
            new_workspace.parent.mkdir(parents=True, exist_ok=True)
            if new_workspace.exists():
                shutil.rmtree(new_workspace)
            shutil.move(str(old_workspace), str(new_workspace))
        for candidate in group_jobs:
            candidate.name = new_name
            candidate.workspace_slug = new_slug
            candidate.parameters = {**candidate.parameters, "runName": new_name, "runGroupId": group_id}
            artifacts = []
            for artifact in candidate.parameters.get("artifactFiles", []):
                if isinstance(artifact, dict) and "url" in artifact:
                    updated_url = str(artifact["url"])
                    for old_slug in old_slugs:
                        updated_url = updated_url.replace(old_slug, new_slug)
                    artifact = {**artifact, "url": updated_url}
                artifacts.append(artifact)
            candidate.parameters = {**candidate.parameters, "artifactFiles": artifacts}
            candidate.save(update_fields=["name", "workspace_slug", "parameters", "updated_at"])
        job = SimulationJob.objects.select_related("upload").get(pk=job.id)
        return JsonResponse(job_payload(job))
    if _request.method == "DELETE":
        group_id = job_run_group_id(job)
        group_jobs = [candidate for candidate in visible_jobs(_request) if job_run_group_id(candidate) == group_id]
        workspaces = {candidate.workspace_slug for candidate in group_jobs if candidate.workspace_slug}
        for candidate in group_jobs:
            candidate.delete()
        for slug in workspaces:
            for candidate_job in group_jobs:
                shutil.rmtree(settings.MEDIA_ROOT / "workspaces" / user_dir_for_job(candidate_job) / slug, ignore_errors=True)
                break  # all jobs in group share same owner; one removal is enough
        return JsonResponse({"deleted": True, "runGroupId": group_id, "deletedJobs": len(group_jobs)})
    return JsonResponse(job_payload(job))


def terminate_process(pid: int) -> tuple[bool, str]:
    try:
        os.killpg(pid, signal.SIGTERM)
        return True, f"Sent SIGTERM to process group {pid}."
    except ProcessLookupError:
        return False, "The process is no longer running."
    except PermissionError:
        return False, "The server does not have permission to terminate this process."
    except OSError:
        try:
            os.kill(pid, signal.SIGTERM)
            return True, f"Sent SIGTERM to process {pid}."
        except ProcessLookupError:
            return False, "The process is no longer running."
        except PermissionError:
            return False, "The server does not have permission to terminate this process."


@csrf_exempt
@require_POST
def cancel_simulation(request: HttpRequest, job_id: int) -> JsonResponse:
    try:
        job = visible_jobs(request).select_related("upload").get(pk=job_id)
    except SimulationJob.DoesNotExist:
        return JsonResponse({"error": "Simulation not found."}, status=404)

    if job.status in {SimulationJob.Status.COMPLETED, SimulationJob.Status.FAILED, SimulationJob.Status.CANCELLED}:
        return JsonResponse({"error": f"Cannot cancel a {job.status} run."}, status=400)

    pid = job.process_pid
    termination_message = "No active GROMACS process was attached yet. The run was marked for cancellation."
    if pid:
        _terminated, termination_message = terminate_process(pid)

    job.status = SimulationJob.Status.CANCELLED
    job.current_step = "Cancellation requested"
    job.error = "Run was cancelled by the user."
    job.process_pid = None
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "current_step", "error", "process_pid", "finished_at", "updated_at"])
    SimulationLog.objects.create(job=job, message=f"Cancellation requested. {termination_message}")
    return JsonResponse(job_payload(job))


@csrf_exempt
@require_http_methods(["POST", "PUT"])
def simulation_artifact(request: HttpRequest, job_id: int) -> JsonResponse:
    try:
        job = visible_jobs(request).get(pk=job_id)
    except SimulationJob.DoesNotExist:
        return JsonResponse({"error": "Simulation not found."}, status=404)
    try:
        body = json.loads(request.body.decode("utf-8"))
        artifact = body["artifact"]
        path = artifact_file_path(job, artifact)
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        return JsonResponse({"error": str(exc) or "Provide a valid artifact."}, status=400)

    if request.method == "POST":
        if not path.exists() or not path.is_file():
            return JsonResponse({"error": "Artifact file is not available on disk."}, status=404)
        if path.stat().st_size > 1_000_000:
            return JsonResponse({"error": "This file is too large to edit in the browser."}, status=400)
        return JsonResponse({"artifact": artifact, "content": path.read_text(encoding="utf-8", errors="replace")})

    editable_kinds = {"config", "analysis", "structure", "input"}
    if artifact.get("kind") not in editable_kinds:
        return JsonResponse({"error": "This artifact type cannot be edited."}, status=400)
    content = str(body.get("content", ""))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return JsonResponse({"saved": True, "artifact": artifact})


@csrf_exempt
@require_POST
def create_example(request: HttpRequest, example_key: str) -> JsonResponse:
    examples = {
        "lysozyme": {
            "name": "lysozyme-tutorial-example.pdb",
            "content": LYSOZYME_DEMO_PDB,
            "parameters": {
                "exampleName": "Lysozyme tutorial example",
                "tutorialUrl": "http://www.mdtutorials.com/gmx/lysozyme/index.html",
                "forceField": "oplsaa",
                "waterModel": "spce",
                "boxType": "cubic",
                "distanceNm": 1.0,
                "saltMolar": 0.15,
                "nvtPs": 100,
                "nptPs": 100,
                "productionNs": 1,
            },
        },
        "small-molecule": {
            "name": "small-molecule-example.pdb",
            "content": SMALL_MOLECULE_DEMO_PDB,
            "parameters": {
                "exampleName": "Small molecule example",
                "forceField": "oplsaa",
                "waterModel": "tip3p",
                "boxType": "dodecahedron",
                "distanceNm": 1.2,
                "saltMolar": 0,
                "nvtPs": 20,
                "nptPs": 20,
                "productionNs": 0.1,
            },
        },
    }
    example = examples.get(example_key)
    if example is None:
        return JsonResponse({"error": "Unknown example setup."}, status=404)

    first_group = request.user.groups.first() if request.user.is_authenticated else None
    upload = UploadedCoordinate(
        owner=request.user if request.user.is_authenticated else None,
        group=first_group,
        original_name=example["name"],
        size=len(example["content"]),
    )
    upload.file.save(example["name"], ContentFile(example["content"].encode("utf-8")), save=True)
    return JsonResponse({"upload": upload_payload(upload), "parameters": example["parameters"]}, status=201)


@require_GET
def simulation_logs(_request: HttpRequest, job_id: int) -> StreamingHttpResponse:
    def events():
        last_id = 0
        while True:
            logs = SimulationLog.objects.filter(job_id=job_id, id__gt=last_id)
            for log in logs:
                last_id = log.id
                yield f"data: {json.dumps({'id': log.id, 'message': log.message, 'createdAt': log.created_at.isoformat()})}\n\n"

            try:
                job = visible_jobs(_request).get(pk=job_id)
            except SimulationJob.DoesNotExist:
                yield "event: error\ndata: {\"error\":\"Simulation not found\"}\n\n"
                break

            if job.status in {SimulationJob.Status.COMPLETED, SimulationJob.Status.FAILED, SimulationJob.Status.CANCELLED}:
                yield f"event: done\ndata: {json.dumps({'status': job.status})}\n\n"
                break

            time.sleep(1)

    response = StreamingHttpResponse(events(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@require_GET
def simulation_log_history(_request: HttpRequest, job_id: int) -> JsonResponse:
    if not visible_jobs(_request).filter(pk=job_id).exists():
        return JsonResponse({"error": "Simulation not found."}, status=404)

    logs = SimulationLog.objects.filter(job_id=job_id)
    return JsonResponse(
        {
            "results": [
                {
                    "id": log.id,
                    "message": log.message,
                    "createdAt": log.created_at.isoformat(),
                }
                for log in logs
            ]
        }
    )


@require_GET
def uploads(_request: HttpRequest) -> JsonResponse:
    latest = visible_uploads(_request).order_by("-created_at")[:20]
    return JsonResponse({"results": [upload_payload(upload) for upload in latest]})


@require_GET
def gromacs_options(_request: HttpRequest) -> JsonResponse:
    """
    Returns all supported force fields, water models, and other dropdown options
    so the frontend can build fully-populated parameter forms without hardcoding values.
    """
    from .runner import FORCE_FIELDS, WATER_MODELS
    return JsonResponse({
        "forceFields": [
            {"value": ff, "label": label, "category": category}
            for ff, label, category in FORCE_FIELDS
        ],
        "waterModels": [
            {"value": wm, "label": label, "category": category}
            for wm, label, category in WATER_MODELS
        ],
        "boxTypes": [
            {"value": "dodecahedron",  "label": "Rhombic dodecahedron (recommended for globular proteins)"},
            {"value": "cubic",         "label": "Cubic"},
            {"value": "octahedron",    "label": "Truncated octahedron"},
            {"value": "triclinic",     "label": "Triclinic (custom)"},
        ],
        "minimizers": [
            {"value": "steep",   "label": "Steepest descent (robust, default)"},
            {"value": "cg",      "label": "Conjugate gradient (slower, more accurate)"},
            {"value": "l-bfgs",  "label": "L-BFGS quasi-Newton (fastest near minimum)"},
        ],
        "thermostats": [
            {"value": "V-rescale",   "label": "V-rescale (recommended)"},
            {"value": "Nose-Hoover", "label": "Nosé-Hoover (rigorous canonical ensemble)"},
            {"value": "Berendsen",   "label": "Berendsen (fast, not rigorous)"},
            {"value": "Andersen",    "label": "Andersen (stochastic)"},
            {"value": "no",          "label": "None"},
        ],
        "barostats": [
            {"value": "Parrinello-Rahman", "label": "Parrinello-Rahman (production quality)"},
            {"value": "C-rescale",         "label": "C-rescale (stochastic, good for equilibration)"},
            {"value": "Berendsen",         "label": "Berendsen (fast relaxation, equilibration only)"},
            {"value": "MTTK",              "label": "MTTK (Martyna-Tobias-Klein, rigorous)"},
            {"value": "no",                "label": "None (NVT)"},
        ],
        "constraints": [
            {"value": "none",       "label": "None"},
            {"value": "h-bonds",    "label": "H-bonds (recommended for 2 fs)"},
            {"value": "all-bonds",  "label": "All bonds"},
            {"value": "h-angles",   "label": "H-bond angles"},
            {"value": "all-angles", "label": "All angles"},
        ],
        "integrators": [
            {"value": "md",    "label": "md — Leap-frog (default, fastest)"},
            {"value": "md-vv", "label": "md-vv — Velocity Verlet (energy-conserving)"},
            {"value": "sd",    "label": "sd — Stochastic dynamics / Langevin"},
            {"value": "bd",    "label": "bd — Brownian dynamics (coarse-grained)"},
        ],
        "coulombTypes": [
            {"value": "PME",             "label": "PME — Particle Mesh Ewald (recommended)"},
            {"value": "Cut-off",         "label": "Cut-off"},
            {"value": "Ewald",           "label": "Ewald (slow, reference)"},
            {"value": "P3M-AD",          "label": "P3M-AD"},
            {"value": "Reaction-Field",  "label": "Reaction-Field"},
        ],
        "positiveIons": [
            {"value": "NA", "label": "Sodium (Na⁺)"},
            {"value": "K",  "label": "Potassium (K⁺)"},
            {"value": "MG", "label": "Magnesium (Mg²⁺)"},
            {"value": "CA", "label": "Calcium (Ca²⁺)"},
            {"value": "ZN", "label": "Zinc (Zn²⁺)"},
        ],
        "negativeIons": [
            {"value": "CL", "label": "Chloride (Cl⁻)"},
            {"value": "BR", "label": "Bromide (Br⁻)"},
            {"value": "F",  "label": "Fluoride (F⁻)"},
            {"value": "I",  "label": "Iodide (I⁻)"},
        ],
    })

