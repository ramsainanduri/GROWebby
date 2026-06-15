import { SimulationJob, UploadedCoordinate } from "./api";
import { defaults, StepKey, steps } from "../types";

export function upsertRun(runs: SimulationJob[], next: SimulationJob): SimulationJob[] {
  const withoutNext = runs.filter((run) => run.id !== next.id);
  return [next, ...withoutNext].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 50);
}

export function formatRunTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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
  const explicit = String(run.step || run.parameters.startStep || run.parameters.runUntil || run.currentStep || "");
  return stepKeyFromName(explicit);
}

export function groupRuns(runs: SimulationJob[]): RunGroup[] {
  const byGroup = new Map<number, SimulationJob[]>();
  for (const run of runs) {
    const groupId = Number(run.runGroupId || run.id);
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), run]);
  }

  const statusPriority: SimulationJob["status"][] = ["failed", "running", "queued", "cancelled", "completed"];
  return Array.from(byGroup.entries())
    .map(([id, groupedRuns]) => {
      const stepsInOrder = [...groupedRuns].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
      const latest = [...groupedRuns].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? stepsInOrder[0];
      const status = statusPriority.find((candidate) => groupedRuns.some((run) => run.status === candidate)) ?? latest.status;
      const progress = Math.max(...groupedRuns.map((run) => run.progress ?? 0));
      return {
        id,
        name: latest.name || `Run #${id}`,
        input: latest.upload.originalName,
        status,
        progress,
        createdAt: stepsInOrder[0]?.createdAt ?? latest.createdAt,
        latest,
        steps: stepsInOrder
      };
    })
    .sort((left, right) => new Date(right.latest.updatedAt).getTime() - new Date(left.latest.updatedAt).getTime());
}

export function makeRunName(inputName = "simulation"): string {
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const base = inputName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "simulation";
  return `${base} ${stamp}`;
}

export function normalizeRunParameters(parameters: typeof defaults): typeof defaults {
  const runMode = parameters.runMode === "pipeline" ? "pipeline" : "step";
  const startStep = runMode === "pipeline" ? "topology" : parameters.startStep;
  const runUntil = runMode === "pipeline" ? "production" : startStep;
  return {
    ...parameters,
    runName: parameters.runName.trim() || makeRunName(),
    runMode,
    startStep,
    runUntil
  };
}

export function downloadCsv(filename: string, metrics: SimulationJob["metrics"], valueKey: string) {
  const safeName = filename.replace(/[^\w.-]+/g, "_");
  const rows = ["stage,progress,sample,timePs,value"];
  rows.push(...metrics.map((metric) => `${metric.stage ?? ""},${metric.progress},${metric.sample ?? ""},${metric.timePs ?? ""},${metric[valueKey] ?? ""}`));
  const blob = new Blob([`${rows.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadAllMetricsCsv(filename: string, metrics: SimulationJob["metrics"]) {
  const safeName = filename.replace(/[^\w.-]+/g, "_");
  const preferred = ["stage", "progress", "sample", "timePs", "energy", "potential", "totalEnergy", "kineticEnergy", "temperature", "pressure", "density"];
  const columns = [...preferred.filter((key) => metrics.some((metric) => metric[key] !== undefined)), ...Array.from(new Set(metrics.flatMap((metric) => Object.keys(metric)))).filter((key) => !preferred.includes(key)).sort()];
  const rows = [columns.join(",")];
  rows.push(...metrics.map((metric) => columns.map((column) => metric[column] ?? "").join(",")));
  const blob = new Blob([`${rows.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadChartSvg(filename: string, container: HTMLDivElement | null) {
  const svg = container?.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
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
  if (job.progress >= 82) return "production";
  if (job.progress >= 76) return "npt";
  if (job.progress >= 66) return "nvt";
  if (job.progress >= 50) return "minimize";
  if (job.progress >= 38) return "ions";
  if (job.progress >= 24) return "solvation";
  if (job.progress >= 12) return "box";
  return "topology";
}

function stepKeyFromName(name: string): StepKey {
  const normalized = name.toLowerCase();
  if (normalized.includes("production")) return "production";
  if (normalized.includes("npt")) return "npt";
  if (normalized.includes("nvt") || normalized.includes("equil")) return "nvt";
  if (normalized.includes("minim")) return "minimize";
  if (normalized.includes("ion")) return "ions";
  if (normalized.includes("solv")) return "solvation";
  if (normalized.includes("box")) return "box";
  return "topology";
}

export function buildConfigPreview(parameters: typeof defaults, upload: UploadedCoordinate | null, gpuAvailable = false): string {
  const input = upload?.originalName ?? "<select-or-upload-coordinate-file>";
  const useGpu = parameters.useGpu && gpuAvailable;
  const prefix = [
    "# GROWebby GROMACS workflow preview",
    `# run_name = ${parameters.runName || "<unnamed-run>"}`,
    `# run_mode = ${parameters.runMode}`,
    `# input = ${input}`,
    `# start_step = ${parameters.startStep}`,
    `# run_until = ${parameters.runUntil}`,
    `# gpu_acceleration = ${useGpu ? "enabled" : parameters.useGpu ? "requested but unavailable in current engine" : "disabled"}`,
    "",
    "[commands]",
    `gmx pdb2gmx -f ${input} -o processed.gro -p topol.top -ff ${parameters.forceField} -water ${parameters.waterModel}${parameters.ignoreHydrogens ? " -ignh" : ""}${parameters.termini === "interactive" ? "" : ` -ter`}`,
    `gmx editconf -f processed.gro -o boxed.gro -bt ${parameters.boxType} -d ${parameters.distanceNm}${parameters.centerMolecule ? " -c" : ""}`,
    `gmx solvate -cp boxed.gro -cs ${parameters.solventStructure} -o solvated.gro -p topol.top -scale ${parameters.solventScale}${parameters.maxSolventMolecules > 0 ? ` -maxsol ${parameters.maxSolventMolecules}` : ""}`,
    "gmx grompp -f ions.mdp -c solvated.gro -p topol.top -o ions.tpr",
    `gmx genion -s ions.tpr -o ionized.gro -p topol.top -pname ${parameters.positiveIon} -nname ${parameters.negativeIon}${parameters.neutralize ? " -neutral" : ""} -conc ${parameters.saltMolar}`,
    "gmx grompp -f minim.mdp -c ionized.gro -p topol.top -o minim.tpr",
    `gmx mdrun -deffnm minim${useGpu ? " -nb gpu" : ""}`,
    "gmx grompp -f nvt.mdp -c minim.gro -r minim.gro -p topol.top -o nvt.tpr",
    `gmx mdrun -deffnm nvt${useGpu ? " -nb gpu" : ""}`,
    "gmx grompp -f npt.mdp -c nvt.gro -r nvt.gro -t nvt.cpt -p topol.top -o npt.tpr",
    `gmx mdrun -deffnm npt${useGpu ? " -nb gpu" : ""}`,
    "gmx energy -f npt.edr -o density.xvg  # select Density",
    "gmx grompp -f production.mdp -c npt.gro -t npt.cpt -p topol.top -o production.tpr",
    `gmx mdrun -deffnm production${useGpu ? " -nb gpu" : ""}`,
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
    `nsteps                  = ${Math.round((parameters.productionNs * 1000) / parameters.dt)}`,
    `dt                      = ${parameters.dt}`,
    `nstxout-compressed      = ${Math.max(1, Math.round(parameters.outputEveryPs / parameters.dt))}`,
    `nstenergy               = ${Math.max(1, Math.round(parameters.outputEveryPs / parameters.dt))}`,
    `nstlog                  = ${Math.max(1, Math.round(parameters.outputEveryPs / parameters.dt))}`,
    `tcoupl                  = ${parameters.thermostat}`,
    "tc-grps                 = System",
    "tau_t                   = 0.1",
    `ref_t                   = ${parameters.temperature}`,
    `pcoupl                  = ${parameters.barostat}`,
    "pcoupltype              = isotropic",
    "tau_p                   = 2.0",
    `ref_p                   = ${parameters.pressure}`,
    "compressibility         = 4.5e-5",
    `constraints             = ${parameters.constraints}`
  ];
  return prefix.join("\n");
}

export function statusClass(status: SimulationJob["status"]): string {
  const base = "rounded-full px-2 py-0.5 text-xs font-semibold";
  if (status === "completed") return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200`;
  if (status === "failed") return `${base} bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200`;
  if (status === "running") return `${base} bg-ocean-100 text-ocean-700 dark:bg-ocean-950 dark:text-ocean-200`;
  return `${base} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200`;
}
