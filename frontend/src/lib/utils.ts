import { SimulationJob, UploadedCoordinate } from "./api";
import { defaults, StepKey, steps } from "../types";

export function upsertRun(
  runs: SimulationJob[],
  next: SimulationJob,
): SimulationJob[] {
  const withoutNext = runs.filter((run) => run.id !== next.id);
  return [next, ...withoutNext]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 50);
}

export function formatRunTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDuration(ms: number): string {
  if (ms < 0) return "0s";
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000);
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function stepName(key: StepKey): string {
  return steps.find((step) => step.key === key)?.name ?? key;
}

export function executionModeLabel(mode: string): string {
  if (!mode || mode === "unknown") return "GROMACS";
  if (mode === "validation-mode") return "Validation mode";
  if (mode.includes("2026.2")) return "GROMACS 2026.2";
  if (mode.includes("native-opencl")) return "GROMACS OpenCL";
  if (mode.includes("cuda")) return "GROMACS CUDA";
  return mode;
}

export type RunGroup = {
  id: number;
  name: string;
  input: string;
  status: SimulationJob["status"];
  progress: number;
  createdAt: string;
  latest: SimulationJob;
  steps: SimulationJob[];
};

export function runStepKey(run: SimulationJob): StepKey {
  const explicit = String(
    run.step ||
      run.parameters.startStep ||
      run.parameters.runUntil ||
      run.currentStep ||
      "",
  );
  return stepKeyFromName(explicit);
}

export function groupRuns(runs: SimulationJob[]): RunGroup[] {
  const byGroup = new Map<number, SimulationJob[]>();
  for (const run of runs) {
    const groupId = Number(run.runGroupId || run.id);
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), run]);
  }

  const statusPriority: SimulationJob["status"][] = [
    "failed",
    "running",
    "queued",
    "cancelled",
    "completed",
  ];
  return Array.from(byGroup.entries())
    .map(([id, groupedRuns]) => {
      const stepsInOrder = [...groupedRuns].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
      );
      const latest =
        [...groupedRuns].sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime(),
        )[0] ?? stepsInOrder[0];
      const status =
        statusPriority.find((candidate) =>
          groupedRuns.some((run) => run.status === candidate),
        ) ?? latest.status;
      const progress = Math.max(...groupedRuns.map((run) => run.progress ?? 0));
      return {
        id,
        name: latest.name || `Run #${id}`,
        input: latest.upload.originalName,
        status,
        progress,
        createdAt: stepsInOrder[0]?.createdAt ?? latest.createdAt,
        latest,
        steps: stepsInOrder,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.latest.updatedAt).getTime() -
        new Date(left.latest.updatedAt).getTime(),
    );
}

export function makeRunName(inputName = "simulation"): string {
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const base =
    inputName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || "simulation";
  return `${base} ${stamp}`;
}

export function normalizeRunParameters(
  parameters: typeof defaults,
): typeof defaults {
  const runMode = parameters.runMode === "pipeline" ? "pipeline" : "step";
  const startStep = runMode === "pipeline" ? "topology" : parameters.startStep;
  const runUntil = runMode === "pipeline" ? "production_mdrun" : startStep;
  return {
    ...parameters,
    runName: parameters.runName.trim() || makeRunName(),
    runMode,
    startStep,
    runUntil,
  };
}

export function downloadCsv(filename: string, data: any[], valueKey: string) {
  if (!data || data.length === 0) return;
  const header = `Time (ps),${valueKey}\n`;
  const rows = data.map((d) => `${d.x},${d.y}`);
  const csvContent = "data:text/csv;charset=utf-8," + header + rows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadAllMetricsCsv(
  filename: string,
  metrics: SimulationJob["metrics"],
) {
  const safeName = filename.replace(/[^\w.-]+/g, "_");
  const preferred = [
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
  ];
  const columns = [
    ...preferred.filter((key) =>
      metrics.some((metric) => metric[key] !== undefined),
    ),
    ...Array.from(new Set(metrics.flatMap((metric) => Object.keys(metric))))
      .filter((key) => !preferred.includes(key))
      .sort(),
  ];
  const rows = [columns.join(",")];
  rows.push(
    ...metrics.map((metric) =>
      columns.map((column) => metric[column] ?? "").join(","),
    ),
  );
  const blob = new Blob([`${rows.join("\n")}\n`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadChartSvg(
  filename: string,
  container: HTMLDivElement | null,
  bgColor: string = "transparent",
  plotTitle?: string
) {
  const svg = container?.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (bgColor !== "transparent") {
    clone.style.backgroundColor = bgColor;
  }

  if (plotTitle) {
    const viewBox = clone.getAttribute("viewBox");
    let width = 800;
    let height = 400;
    if (viewBox) {
      const parts = viewBox.split(" ").map(Number);
      if (parts.length === 4) {
        width = parts[2];
        height = parts[3];
      }
    } else {
      width = Number(clone.getAttribute("width") || 800);
      height = Number(clone.getAttribute("height") || 400);
    }

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", "translate(0, 30)");

    while (clone.firstChild) {
      g.appendChild(clone.firstChild);
    }

    const titleText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    titleText.setAttribute("x", (width / 2).toString());
    titleText.setAttribute("y", "20");
    titleText.setAttribute("text-anchor", "middle");
    titleText.setAttribute("font-family", "sans-serif");
    titleText.setAttribute("font-size", "16");
    titleText.setAttribute("font-weight", "600");
    
    const axisText = g.querySelector("text");
    const textColor = axisText ? axisText.getAttribute("fill") || "#94a3b8" : "#94a3b8";
    titleText.setAttribute("fill", textColor);
    titleText.textContent = plotTitle;

    clone.appendChild(titleText);
    clone.appendChild(g);

    clone.setAttribute("viewBox", `0 0 ${width} ${height + 30}`);
    if (clone.hasAttribute("height")) {
      const hStr = clone.getAttribute("height");
      if (hStr && !hStr.includes("%")) {
        clone.setAttribute("height", `${height + 30}`);
      }
    }
  }

  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[^\w.-]+/g, "_");
  link.click();
  URL.revokeObjectURL(url);
}

export function suggestedResumeStep(job: SimulationJob | null): StepKey | null {
  if (!job || job.status === "completed") return null;
  if (job.status === "failed") return stepKeyFromName(job.currentStep);
  if (job.progress >= 82) return "production_grompp";
  if (job.progress >= 76) return "npt_grompp";
  if (job.progress >= 66) return "nvt_grompp";
  if (job.progress >= 50) return "minimize_grompp";
  if (job.progress >= 38) return "ions_grompp";
  if (job.progress >= 24) return "solvation";
  if (job.progress >= 12) return "box";
  return "topology";
}

function stepKeyFromName(name: string): StepKey {
  const normalized = name.toLowerCase();
  if (normalized.includes("production"))
    return normalized.includes("mdrun")
      ? "production_mdrun"
      : "production_grompp";
  if (normalized.includes("npt"))
    return normalized.includes("mdrun") ? "npt_mdrun" : "npt_grompp";
  if (normalized.includes("nvt") || normalized.includes("equil"))
    return normalized.includes("mdrun") ? "nvt_mdrun" : "nvt_grompp";
  if (normalized.includes("minim"))
    return normalized.includes("mdrun") ? "minimize_mdrun" : "minimize_grompp";
  if (normalized.includes("ion"))
    return normalized.includes("genion") ? "ions_genion" : "ions_grompp";
  if (normalized.includes("solv")) return "solvation";
  if (normalized.includes("box")) return "box";
  return "topology";
}

function mergeArgs(defaultArgs: string[], customArgsStr?: string): string {
  const defaultStr = defaultArgs.join(" ");
  if (!customArgsStr) return defaultStr;

  const defaultTokens =
    defaultStr.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const customTokens =
    customArgsStr.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

  const customFlags = new Set(
    customTokens.filter((t) => t.startsWith("-")).map((t) => t.split("=")[0]),
  );

  const filteredDefaults = [];
  for (let i = 0; i < defaultTokens.length; i++) {
    const token = defaultTokens[i];
    if (token.startsWith("-")) {
      const flag = token.split("=")[0];
      if (customFlags.has(flag)) {
        if (
          i + 1 < defaultTokens.length &&
          !defaultTokens[i + 1].startsWith("-")
        ) {
          i++;
        }
        continue;
      }
    }
    filteredDefaults.push(token);
  }

  return [...filteredDefaults, ...customTokens].join(" ");
}

export function buildConfigPreview(
  parameters: typeof defaults,
  upload: UploadedCoordinate | null,
  gpuAvailable = false,
): string {
  const input = upload?.originalName ?? "<select-or-upload-coordinate-file>";
  const useGpu = parameters.useGpu && gpuAvailable;

  const pdb2gmxArgs = [];
  if (parameters.forceField) pdb2gmxArgs.push(`-ff ${parameters.forceField}`);
  if (parameters.waterModel)
    pdb2gmxArgs.push(`-water ${parameters.waterModel}`);
  if (parameters.ignoreHydrogens) pdb2gmxArgs.push("-ignh");
  if (parameters.missingAtoms) pdb2gmxArgs.push("-missing");
  if (parameters.termini !== "interactive") pdb2gmxArgs.push("-ter");
  const pdb2gmxStr = mergeArgs(pdb2gmxArgs, parameters.customArgs?.pdb2gmx);

  const editconfArgs = [];
  if (parameters.boxType) editconfArgs.push(`-bt ${parameters.boxType}`);
  if (parameters.distanceNm) editconfArgs.push(`-d ${parameters.distanceNm}`);
  if (parameters.centerMolecule) editconfArgs.push("-c");
  const editconfStr = mergeArgs(editconfArgs, parameters.customArgs?.editconf);

  const solvateArgs = [];
  if (parameters.solventStructure)
    solvateArgs.push(`-cs ${parameters.solventStructure}`);
  if (parameters.solventScale)
    solvateArgs.push(`-scale ${parameters.solventScale}`);
  if (parameters.maxSolventMolecules > 0)
    solvateArgs.push(`-maxsol ${parameters.maxSolventMolecules}`);
  const solvateStr = mergeArgs(solvateArgs, parameters.customArgs?.solvate);

  const genionArgs = [];
  if (parameters.positiveIon)
    genionArgs.push(`-pname ${parameters.positiveIon}`);
  if (parameters.negativeIon)
    genionArgs.push(`-nname ${parameters.negativeIon}`);
  if (parameters.neutralize) genionArgs.push("-neutral");
  if (parameters.saltMolar) genionArgs.push(`-conc ${parameters.saltMolar}`);
  const genionStr = mergeArgs(genionArgs, parameters.customArgs?.genion);

  const gromppStr = mergeArgs([], parameters.customArgs?.grompp);

  const mdrunArgs = [];
  if (useGpu) mdrunArgs.push("-nb gpu");
  const mdrunStr = mergeArgs(mdrunArgs, parameters.customArgs?.mdrun);

  const lines = [
    "# GROWebby GROMACS workflow preview",
    `# run_name = ${parameters.runName || "<unnamed-run>"}`,
    `# run_mode = ${parameters.runMode}`,
    `# input = ${input}`,
    `# start_step = ${parameters.startStep}`,
    `# run_until = ${parameters.runUntil}`,
    `# gpu_acceleration = ${
      useGpu
        ? "enabled"
        : parameters.useGpu
          ? "requested but unavailable in current engine"
          : "disabled"
    }`,
    "",
    "[commands]",
    `gmx pdb2gmx -f ${input} -o outputs/processed.gro -p topol.top -i posre.itp ${pdb2gmxStr}`.trim(),
    `gmx editconf -f outputs/processed.gro -o outputs/boxed.gro ${editconfStr}`.trim(),
    `gmx solvate -cp outputs/boxed.gro -o outputs/solvated.gro -p topol.top ${solvateStr}`.trim(),
    `gmx grompp -f ions.mdp -c outputs/solvated.gro -p topol.top -o ions.tpr ${gromppStr}`.trim(),
    `gmx genion -s ions.tpr -o outputs/ionized.gro -p topol.top ${genionStr}`.trim(),
    `gmx grompp -f minim.mdp -c outputs/ionized.gro -p topol.top -o minim.tpr ${gromppStr}`.trim(),
    `gmx mdrun -deffnm minim ${mdrunStr}`.trim(),
    `gmx grompp -f nvt.mdp -c minim.gro -r minim.gro -p topol.top -o nvt.tpr ${gromppStr}`.trim(),
    `gmx mdrun -deffnm nvt ${mdrunStr}`.trim(),
    `gmx grompp -f npt.mdp -c nvt.gro -r nvt.gro -t nvt.cpt -p topol.top -o npt.tpr ${gromppStr}`.trim(),
    `gmx mdrun -deffnm npt ${mdrunStr}`.trim(),
    "gmx energy -f npt.edr -o density.xvg  # select Density",
    `gmx grompp -f production.mdp -c npt.gro -t npt.cpt -p topol.top -o production.tpr ${gromppStr}`.trim(),
    `gmx mdrun -deffnm production ${mdrunStr}`.trim(),
    "",
    "[minim.mdp]",
    `integrator              = ${parameters.minimizer}`,
    `emtol                   = ${parameters.emtol}`,
    `emstep                  = ${parameters.emstep}`,
    `nsteps                  = ${parameters.minimizationSteps}`,
    "",
    "[nvt.mdp]",
    "integrator              = md",
    `nsteps                  = ${Math.round(parameters.nvtPs / parameters.dt)}`,
    `dt                      = ${parameters.dt}`,
    "define                  = -DPOSRES",
    `tcoupl                  = ${parameters.thermostat}`,
    "tc-grps                 = System",
    "tau_t                   = 0.1",
    `ref_t                   = ${parameters.temperature}`,
    "pcoupl                  = no",
    `constraints             = ${parameters.constraints}`,
    "",
    "[npt.mdp]",
    "integrator              = md",
    `nsteps                  = ${Math.round(parameters.nptPs / parameters.dt)}`,
    `dt                      = ${parameters.dt}`,
    "define                  = -DPOSRES",
    `tcoupl                  = ${parameters.thermostat}`,
    "tc-grps                 = System",
    "tau_t                   = 0.1",
    `ref_t                   = ${parameters.temperature}`,
    `pcoupl                  = ${parameters.barostat}`,
    "pcoupltype              = isotropic",
    "tau_p                   = 2.0",
    `ref_p                   = ${parameters.pressure}`,
    "compressibility         = 4.5e-5",
    `; target_density_plot_ref = ${parameters.targetDensity} kg/m3`,
    `constraints             = ${parameters.constraints}`,
    "",
    "[production.mdp]",
    "integrator              = md",
    `nsteps                  = ${Math.round(
      (parameters.productionNs * 1000) / parameters.dt,
    )}`,
    `dt                      = ${parameters.dt}`,
    `nstxout-compressed      = ${Math.max(
      1,
      Math.round(parameters.outputEveryPs / parameters.dt),
    )}`,
    `nstenergy               = ${Math.max(
      1,
      Math.round(parameters.outputEveryPs / parameters.dt),
    )}`,
    `nstlog                  = ${Math.max(
      1,
      Math.round(parameters.outputEveryPs / parameters.dt),
    )}`,
    `tcoupl                  = ${parameters.thermostat}`,
    "tc-grps                 = System",
    "tau_t                   = 0.1",
    `ref_t                   = ${parameters.temperature}`,
    `pcoupl                  = ${parameters.barostat}`,
    "pcoupltype              = isotropic",
    "tau_p                   = 2.0",
    `ref_p                   = ${parameters.pressure}`,
    "compressibility         = 4.5e-5",
    `constraints             = ${parameters.constraints}`,
  ];
  return lines.join("\n");
}
export function statusClass(status: SimulationJob["status"]): string {
  const base = "rounded-full px-2 py-0.5 text-xs font-semibold";
  if (status === "completed")
    return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200`;
  if (status === "failed")
    return `${base} bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200`;
  if (status === "running")
    return `${base} bg-ocean-100 text-ocean-700 dark:bg-ocean-950 dark:text-ocean-200`;
  return `${base} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200`;
}
