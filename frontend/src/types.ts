import { Atom, BarChart3, Boxes, Database, FileArchive, FlaskConical, Gauge, GitBranch, Info, LayoutDashboard, Network, PlayCircle, Scale, ServerCog, Sparkles, Waves } from "lucide-react";

export type StepKey = "topology" | "box" | "solvation" | "ions" | "minimize" | "nvt" | "npt" | "production";
export type ViewKey = "dashboard" | "workflow" | "files" | "runs" | "results" | "stats" | "admin" | "about";

export const steps = [
  { key: "topology", name: "Topology", icon: Network, detail: "pdb2gmx force field and water model" },
  { key: "box", name: "Box", icon: Boxes, detail: "editconf box shape, distance, centering" },
  { key: "solvation", name: "Solvation", icon: Waves, detail: "solvate solvent structure and topology update" },
  { key: "ions", name: "Ions", icon: Sparkles, detail: "genion neutralization and salt concentration" },
  { key: "minimize", name: "Minimize", icon: Gauge, detail: "energy minimization MDP options" },
  { key: "nvt", name: "NVT", icon: Scale, detail: "constant volume temperature equilibration" },
  { key: "npt", name: "NPT", icon: Gauge, detail: "constant pressure density equilibration" },
  { key: "production", name: "Production", icon: FlaskConical, detail: "production MD runtime and output cadence" }
] satisfies { key: StepKey; name: string; icon: typeof Atom; detail: string }[];

export const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "workflow", label: "Workflow Setup", icon: GitBranch },
  { key: "files", label: "Files", icon: FileArchive },
  { key: "runs", label: "Simulation Runs", icon: PlayCircle },
  { key: "results", label: "Results", icon: Database },
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "admin", label: "Admin Panel", icon: ServerCog },
  { key: "about", label: "About", icon: Info }
] satisfies { key: ViewKey; label: string; icon: typeof LayoutDashboard }[];

export const defaults = {
  runName: "",
  runGroupId: 0,
  runMode: "step",
  startStep: "topology" as StepKey,
  runUntil: "topology" as StepKey,
  forceField: "amber99sb-ildn",
  waterModel: "tip3p",
  ignoreHydrogens: true,
  termini: "interactive",
  boxType: "dodecahedron",
  distanceNm: 1.0,
  centerMolecule: true,
  solventStructure: "spc216.gro",
  solventScale: 0.57,
  maxSolventMolecules: 0,
  neutralize: true,
  saltMolar: 0.15,
  positiveIon: "NA",
  negativeIon: "CL",
  minimizer: "steep",
  emtol: 1000,
  emstep: 0.01,
  temperature: 300,
  pressure: 1,
  thermostat: "V-rescale",
  barostat: "Parrinello-Rahman",
  dt: 0.002,
  minimizationSteps: 50000,
  nvtPs: 100,
  nptPs: 100,
  targetDensity: 1000,
  productionNs: 10,
  outputEveryPs: 10,
  constraints: "h-bonds",
  useGpu: true
};
