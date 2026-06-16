import {
  Atom,
  BarChart3,
  Boxes,
  Database,
  FileArchive,
  FlaskConical,
  Gauge,
  GitBranch,
  Info,
  LayoutDashboard,
  Network,
  PlayCircle,
  Scale,
  ServerCog,
  Sparkles,
  Waves,
} from "lucide-react";

export type StepKey =
  | "topology"
  | "box"
  | "solvation"
  | "ions_grompp"
  | "ions_genion"
  | "minimize_grompp"
  | "minimize_mdrun"
  | "nvt_grompp"
  | "nvt_mdrun"
  | "npt_grompp"
  | "npt_mdrun"
  | "production_grompp"
  | "production_mdrun";
export type ViewKey =
  | "dashboard"
  | "workflow"
  | "files"
  | "runs"
  | "results"
  | "stats"
  | "admin"
  | "about";

export const steps = [
  {
    key: "topology",
    name: "Topology",
    icon: Network,
    detail: "pdb2gmx force field and water model",
  },
  {
    key: "box",
    name: "Box",
    icon: Boxes,
    detail: "editconf box shape, distance, centering",
  },
  {
    key: "solvation",
    name: "Solvation",
    icon: Waves,
    detail: "solvate solvent structure and topology update",
  },
  {
    key: "ions_grompp",
    name: "Ions Config",
    icon: Sparkles,
    detail: "grompp generate ions.tpr",
  },
  {
    key: "ions_genion",
    name: "Ions Addition",
    icon: Sparkles,
    detail: "genion neutralization and salt concentration",
  },
  {
    key: "minimize_grompp",
    name: "Minimize Config",
    icon: Gauge,
    detail: "grompp minimize MDP options",
  },
  {
    key: "minimize_mdrun",
    name: "Minimize Run",
    icon: Gauge,
    detail: "mdrun energy minimization execution",
  },
  {
    key: "nvt_grompp",
    name: "NVT Config",
    icon: Scale,
    detail: "grompp constant volume temperature MDP",
  },
  {
    key: "nvt_mdrun",
    name: "NVT Run",
    icon: Scale,
    detail: "mdrun constant volume temperature equilibration",
  },
  {
    key: "npt_grompp",
    name: "NPT Config",
    icon: Gauge,
    detail: "grompp constant pressure density MDP",
  },
  {
    key: "npt_mdrun",
    name: "NPT Run",
    icon: Gauge,
    detail: "mdrun constant pressure density equilibration",
  },
  {
    key: "production_grompp",
    name: "Production Config",
    icon: FlaskConical,
    detail: "grompp production MD runtime MDP",
  },
  {
    key: "production_mdrun",
    name: "Production Run",
    icon: FlaskConical,
    detail: "mdrun production execution and output",
  },
] satisfies { key: StepKey; name: string; icon: typeof Atom; detail: string }[];

export const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "workflow", label: "Workflow Setup", icon: GitBranch },
  { key: "files", label: "Files", icon: FileArchive },
  { key: "runs", label: "Simulation Runs", icon: PlayCircle },
  { key: "results", label: "Results", icon: Database },
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "admin", label: "Admin Panel", icon: ServerCog },
  { key: "about", label: "About", icon: Info },
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
  missingAtoms: false,
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
  useGpu: true,
  customArgs: undefined as Record<string, string> | undefined,
};
