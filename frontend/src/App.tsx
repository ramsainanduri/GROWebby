import {
  Activity,
  Atom,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  FileArchive,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  HelpCircle,
  Info,
  LayoutDashboard,
  LogOut,
  Network,
  Play,
  PlayCircle,
  RefreshCw,
  Scale,
  ServerCog,
  Settings,
  Sparkles,
  TerminalSquare,
  Timer,
  UploadCloud,
  Waves,
  Zap
} from "lucide-react";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  adminApproveUser,
  adminDenyUser,
  adminListUsers,
  AdminUser,
  createSimulation,
  getSimulation,
  getSimulationLogs,
  getSession,
  listSimulations,
  listUploads,
  loginUser,
  logHistoryUrl,
  logStreamUrl,
  logoutUser,
  registerUser,
  SimulationJob,
  SessionState,
  UploadedCoordinate,
  uploadCoordinate
} from "./lib/api";
import { ThemeToggle } from "./components/ThemeToggle";
import { Viewer3D } from "./components/Viewer3D";

type StepKey = "topology" | "box" | "solvation" | "ions" | "minimize" | "equilibrate" | "production";
type ViewKey = "dashboard" | "workflow" | "files" | "runs" | "results" | "stats" | "admin" | "about";

const steps = [
  { key: "topology", name: "Topology", icon: Network, detail: "pdb2gmx force field and water model" },
  { key: "box", name: "Box", icon: Boxes, detail: "editconf box shape, distance, centering" },
  { key: "solvation", name: "Solvation", icon: Waves, detail: "solvate solvent structure and topology update" },
  { key: "ions", name: "Ions", icon: Sparkles, detail: "genion neutralization and salt concentration" },
  { key: "minimize", name: "Minimize", icon: Gauge, detail: "energy minimization MDP options" },
  { key: "equilibrate", name: "Equilibrate", icon: Scale, detail: "NVT/NPT temperature and pressure control" },
  { key: "production", name: "Production", icon: FlaskConical, detail: "production MD runtime and output cadence" }
] satisfies { key: StepKey; name: string; icon: typeof Atom; detail: string }[];

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "workflow", label: "Workflow Setup", icon: GitBranch },
  { key: "files", label: "Files", icon: FileArchive },
  { key: "runs", label: "Simulation Runs", icon: PlayCircle },
  { key: "results", label: "Results", icon: Database },
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "admin", label: "Admin Panel", icon: ServerCog },
  { key: "about", label: "About", icon: Info }
] satisfies { key: ViewKey; label: string; icon: typeof LayoutDashboard }[];

const defaults = {
  startStep: "topology" as StepKey,
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
  ensemble: "NPT",
  thermostat: "V-rescale",
  barostat: "Parrinello-Rahman",
  dt: 0.002,
  minimizationSteps: 50000,
  equilibrationPs: 100,
  productionNs: 10,
  outputEveryPs: 10,
  constraints: "h-bonds",
  useGpu: true
};

function MainApp() {
  const location = useLocation();
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const view = (location.pathname === "/" ? "dashboard" : location.pathname.substring(1)) as ViewKey;
  const [activeStep, setActiveStep] = useState(0);
  const [parameters, setParameters] = useState(defaults);
  const [upload, setUpload] = useState<UploadedCoordinate | null>(null);
  const [uploads, setUploads] = useState<UploadedCoordinate[]>([]);
  const [job, setJob] = useState<SimulationJob | null>(null);
  const [runs, setRuns] = useState<SimulationJob[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<SessionState>({ isAuthenticated: false, user: null });
  const [sessionChecked, setSessionChecked] = useState(false);


  useEffect(() => {
    getSession()
      .then((nextSession) => {
        setSession(nextSession);
        if (nextSession.isAuthenticated) {
          refreshWorkspace();
        }
      })
      .catch(() => undefined)
      .finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    if (!job || ["completed", "failed", "cancelled"].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      const fresh = await getSimulation(job.id);
      setJob(fresh);
      setRuns((current) => upsertRun(current, fresh));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [job]);

  useEffect(() => {
    if (!job) return;
    const source = new EventSource(logStreamUrl(job.id));
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { message: string };
      setLogs((current) => [...current.slice(-160), data.message]);
    };
    source.addEventListener("done", () => source.close());
    source.onerror = () => source.close();
    return () => source.close();
  }, [job?.id]);

  const canStart = useMemo(() => Boolean(upload && !busy), [upload, busy]);
  const completedRuns = runs.filter((run) => run.status === "completed");
  const runningRuns = runs.filter((run) => run.status === "running" || run.status === "queued");
  const failedRuns = runs.filter((run) => run.status === "failed");

  async function refreshWorkspace() {
    try {
      const [freshRuns, freshUploads] = await Promise.all([listSimulations(), listUploads()]);
      setRuns(freshRuns);
      setUploads(freshUploads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh workspace");
    }
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadCoordinate(file);
      setUpload(uploaded);
      setUploads((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)]);
      navigate("/workflow");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function startSimulation() {
    if (!upload) return;
    setBusy(true);
    setError("");
    setLogs([]);
    try {
      const created = await createSimulation(upload!.id, parameters);
      setJob(created);
      setRuns((current) => upsertRun(current, created));
      navigate("/runs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start simulation");
    } finally {
      setBusy(false);
    }
  }

  async function selectRun(runId: number, nextView: ViewKey = "results") {
    setError("");
    try {
      const selected = await getSimulation(runId);
      const logEntries = await getSimulationLogs(runId);
      setJob(selected);
      setUpload(selected.upload);
      setParameters({ ...defaults, ...selected.parameters });
      setLogs(logEntries.map((entry) => entry.message));
      setRuns((current) => upsertRun(current, selected));
      navigate(`/${nextView}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load run");
    }
  }

  const navigate = useNavigate();

  async function handleSignOut() {
    const nextSession = await logoutUser();
    setSession(nextSession);
    setRuns([]);
    setUploads([]);
    setUpload(null);
    setJob(null);
    setLogs([]);
  }

  if (!sessionChecked) {
    return <LoadingScreen dark={dark} setDark={setDark} />;
  }

  if (!session.isAuthenticated) {
    return (
      <AuthScreen
        dark={dark}
        setDark={setDark}
        setSession={setSession}
        onAuthenticated={refreshWorkspace}
      />
    );
  }

  return (
    <main className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 transition dark:bg-slate-950 dark:text-slate-100">
      <aside className={`${navCollapsed ? "w-[4.5rem]" : "w-[15.5rem] 2xl:w-[16.25rem]"} hidden shrink-0 border-r border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col`}>
        <div className={`flex h-14 2xl:h-16 items-center border-b border-slate-200 dark:border-slate-800 ${navCollapsed ? "justify-center px-2" : "gap-2.5 px-3"}`}>
          <div className="flex h-9 w-9 items-center justify-center text-ocean-600 dark:text-ocean-400 2xl:h-10 2xl:w-10">
            <Atom size="1.35em" />
          </div>
          {!navCollapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold 2xl:text-lg">GROWebby</h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">MD operations console</p>
            </div>
          )}
        </div>

        <nav className={`flex-1 space-y-1 overflow-auto ${navCollapsed ? "p-2" : "p-3"}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={`/${item.key}`}
                aria-label={item.label}
                className={`flex h-9 w-full items-center rounded-lg text-[0.8rem] font-semibold transition 2xl:h-10 ${navCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"} ${
                  view === item.key ? "bg-ocean-100 text-ocean-800 dark:bg-ocean-900 dark:text-ocean-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
                title={navCollapsed ? item.label : undefined}
              >
                <Icon size="1.18em" />
                {!navCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-2.5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setNavCollapsed((value) => !value)}
            className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-ocean-500 hover:text-ocean-700 dark:border-slate-700 dark:text-slate-200 2xl:h-10"
            title={navCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {navCollapsed ? <ChevronRight size="1.12em" /> : <ChevronLeft size="1.12em" />}
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 2xl:h-16 2xl:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="lg:hidden flex h-9 w-9 items-center justify-center text-ocean-600 dark:text-ocean-400">
              <Atom size="1.35em" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold 2xl:text-lg">{navItems.find((item) => item.key === view)?.label}</h2>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400 2xl:text-sm">{job ? `Focused on run #${job.id} · ${job.currentStep}` : "Configure, launch, and review molecular dynamics runs"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshWorkspace}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-ocean-500 hover:text-ocean-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 2xl:h-10 2xl:w-10"
              aria-label="Refresh workspace"
              title="Refresh workspace"
            >
              <RefreshCw size="1.08em" />
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-ocean-500 hover:text-ocean-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 2xl:h-10 2xl:px-3 2xl:text-sm"
              title="Sign out"
            >
              <LogOut size="1.08em" />
              <span className="hidden sm:inline">{session.user?.username}</span>
            </button>
            <ThemeToggle dark={dark} onToggle={() => setDark((value) => !value)} />
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={`/${item.key}`}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  view === item.key ? "bg-ocean-100 text-ocean-800 dark:bg-ocean-900 dark:text-ocean-100" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView completedRuns={completedRuns.length} failedRuns={failedRuns.length} job={job} runningRuns={runningRuns.length} uploadsCount={uploads.length} />} />
            <Route path="/workflow" element={<WorkflowView activeStep={activeStep} busy={busy} canStart={canStart} handleFile={handleFile} job={job} parameters={parameters} setActiveStep={setActiveStep} setParameters={setParameters} startSimulation={startSimulation} upload={upload} uploads={uploads} selectUpload={(selected) => { setUpload(selected); navigate("/workflow"); }} dark={dark} />} />
            <Route path="/files" element={<FilesView handleFile={handleFile} selectUpload={setUpload} upload={upload} uploads={uploads} />} />
            <Route path="/runs" element={<RunsView job={job} runs={runs} selectRun={selectRun} />} />
            <Route path="/results" element={<ResultsView job={job} logs={logs} selectRun={selectRun} dark={dark} />} />
            <Route path="/stats" element={<StatsView runs={runs} />} />
            <Route path="/admin" element={<AdminView session={session} />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </section>
    </main>
  );
}

type DashboardProps = {
  completedRuns: number;
  failedRuns: number;
  job: SimulationJob | null;
  runningRuns: number;
  uploadsCount: number;
};

function DashboardView({ completedRuns, failedRuns, job, runningRuns, uploadsCount }: DashboardProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Files" value={uploadsCount} icon={FileArchive} />
        <MetricCard label="Running" value={runningRuns} icon={Timer} />
        <MetricCard label="Complete" value={completedRuns} icon={CheckCircle2} />
        <MetricCard label="Failed" value={failedRuns} icon={TerminalSquare} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Workflow Overview</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Choose or upload input files, configure each GROMACS stage, then start from any stage.</p>
            </div>
            <Link className="button-primary" to="/workflow">
              <GitBranch size={18} />
              Open setup
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.key} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <Icon className="mb-3 text-ocean-600" size={22} />
                  <div className="text-sm font-semibold">{index + 1}. {step.name}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{step.detail}</div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-semibold">Focused Run</h3>
          <div className="mb-4 h-3 rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-3 rounded-full bg-gradient-to-r from-ocean-500 to-mint-500 transition-all" style={{ width: `${job?.progress ?? 0}%` }} />
          </div>
          <div className="grid gap-3 text-sm">
            <StatusDatum label="Run" value={job ? `#${job.id}` : "None"} />
            <StatusDatum label="Progress" value={job ? `${job.progress}%` : "Idle"} />
            <StatusDatum label="Status" value={job?.status ?? "idle"} />
            <StatusDatum label="Step" value={job?.currentStep ?? "Waiting"} />
          </div>
        </section>
      </div>
    </div>
  );
}

type WorkflowProps = {
  activeStep: number;
  busy: boolean;
  canStart: boolean;
  handleFile: (file?: File) => void;
  job: SimulationJob | null;
  parameters: typeof defaults;
  setActiveStep: (step: number) => void;
  setParameters: (parameters: typeof defaults) => void;
  startSimulation: () => void;
  upload: UploadedCoordinate | null;
  uploads: UploadedCoordinate[];
  selectUpload: (upload: UploadedCoordinate) => void;
  dark: boolean;
};

function WorkflowView({ activeStep, busy, canStart, handleFile, job, parameters, setActiveStep, setParameters, startSimulation, upload, uploads, selectUpload, dark }: WorkflowProps) {
  const selectedStep = steps[activeStep];
  const configPreview = buildConfigPreview(parameters, upload);
  const resumeStep = suggestedResumeStep(job);

  return (
    <div className="grid h-full min-h-[860px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)_minmax(520px,0.9fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_minmax(620px,0.95fr)]">
      <aside className="flex min-h-0 flex-col gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-semibold">Input File</h3>
          <label className="mb-3 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ocean-200 bg-ocean-50/60 px-4 text-center transition hover:border-ocean-500 dark:border-slate-700 dark:bg-slate-950">
            <UploadCloud className="mb-2 text-ocean-600" size={26} />
            <span className="font-medium">{upload ? upload.originalName : "Upload new file"}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">PDB, GRO, CIF, or MOL2</span>
            <input className="sr-only" type="file" accept=".pdb,.gro,.cif,.mol2" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
          <div className="max-h-56 space-y-2 overflow-auto">
            {uploads.map((item) => (
              <button key={item.id} type="button" onClick={() => selectUpload(item)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${upload?.id === item.id ? "border-ocean-500 bg-ocean-50 dark:bg-ocean-950" : "border-slate-200 hover:border-ocean-300 dark:border-slate-700"}`}>
                <span className="block truncate font-semibold">{item.originalName}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(item.size)} · {formatRunTime(item.createdAt)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 px-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Configure Step</div>
          <div className="space-y-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const selected = activeStep === index;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${selected ? "border-ocean-500 bg-ocean-50 text-ocean-800 dark:border-ocean-500 dark:bg-ocean-950 dark:text-ocean-100" : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"}`}
                >
                  <Icon className={selected ? "text-ocean-600" : "text-mint-600"} size={20} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{step.name}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{step.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      <section className="flex min-h-0 flex-col gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{selectedStep.name} Options</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{selectedStep.detail}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {resumeStep && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-200">Resume suggestion: {stepName(resumeStep)}</span>}
              <SelectField label="Start from" value={parameters.startStep} options={steps.map((step) => step.key)} onChange={(value) => setParameters({ ...parameters, startStep: value as StepKey })} />
            </div>
          </div>
          <StepOptions activeStep={selectedStep.key} parameters={parameters} setParameters={setParameters} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Run Control</h3>
            <span className={statusClass(job?.status ?? "queued")}>{job?.status ?? "not started"}</span>
          </div>
          <div className="mb-4 h-3 rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-3 rounded-full bg-gradient-to-r from-ocean-500 to-mint-500 transition-all" style={{ width: `${job?.progress ?? 0}%` }} />
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <StatusDatum label="Input" value={upload?.originalName ?? "None"} />
              <StatusDatum label="Start Step" value={stepName(parameters.startStep)} />
              <StatusDatum label="Focused Run" value={job ? `#${job.id}` : "None"} />
            </div>
            <button className="button-primary min-h-14" type="button" disabled={!canStart || busy} onClick={startSimulation}>
              <Play size={20} />
              Start / resume
            </button>
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4">
        <section className="min-h-[380px] rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Molecule View</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{upload ? upload.originalName : "Select or upload a structure"}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">MolStar</span>
          </div>
          <div className="h-[320px]">
            <Viewer3D coordinateUrl={upload?.url} dark={dark} />
          </div>
        </section>
        <section className="min-h-0 flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Generated Config</h3>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">live preview</span>
          </div>
          <pre className="h-[calc(100%-36px)] min-h-96 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-5 text-mint-100">{configPreview}</pre>
        </section>
      </aside>
    </div>
  );
}

function StepOptions({ activeStep, parameters, setParameters }: { activeStep: StepKey; parameters: typeof defaults; setParameters: (parameters: typeof defaults) => void }) {
  if (activeStep === "topology") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField label="Force field" help="Passed to gmx pdb2gmx with -ff. Choose the force field that matches your molecule and intended protocol." value={parameters.forceField} options={["amber99sb-ildn", "charmm27", "oplsaa", "gromos54a7"]} onChange={(value) => setParameters({ ...parameters, forceField: value })} />
        <SelectField label="Water model" help="Passed to pdb2gmx with -water. Keep this compatible with the selected force field." value={parameters.waterModel} options={["tip3p", "spce", "tip4p", "tip5p"]} onChange={(value) => setParameters({ ...parameters, waterModel: value })} />
        <SelectField label="Termini handling" value={parameters.termini} options={["interactive", "charged", "neutral"]} onChange={(value) => setParameters({ ...parameters, termini: value })} />
        <ToggleField label="Ignore input hydrogens" checked={parameters.ignoreHydrogens} onChange={(value) => setParameters({ ...parameters, ignoreHydrogens: value })} />
      </div>
    );
  }

  if (activeStep === "box") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField label="Box type" help="Passed to gmx editconf with -bt. Dodecahedron is compact for solvated globular proteins." value={parameters.boxType} options={["dodecahedron", "cubic", "triclinic", "octahedron"]} onChange={(value) => setParameters({ ...parameters, boxType: value })} />
        <Slider label="Molecule distance" help="Passed to editconf with -d. This is the minimum solute-to-box-edge distance in nm." value={parameters.distanceNm} min={0.6} max={2.5} step={0.1} suffix="nm" onChange={(value) => setParameters({ ...parameters, distanceNm: value })} />
        <ToggleField label="Center molecule in box" checked={parameters.centerMolecule} onChange={(value) => setParameters({ ...parameters, centerMolecule: value })} />
      </div>
    );
  }

  if (activeStep === "solvation") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField label="Solvent structure" value={parameters.solventStructure} options={["spc216.gro", "tip4p.gro", "tip5p.gro"]} onChange={(value) => setParameters({ ...parameters, solventStructure: value })} />
        <Slider label="Van der Waals scale" value={parameters.solventScale} min={0.45} max={0.75} step={0.01} suffix="" onChange={(value) => setParameters({ ...parameters, solventScale: value })} />
        <NumberField label="Max solvent molecules" value={parameters.maxSolventMolecules} min={0} step={100} onChange={(value) => setParameters({ ...parameters, maxSolventMolecules: value })} />
      </div>
    );
  }

  if (activeStep === "ions") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <ToggleField label="Neutralize total charge" checked={parameters.neutralize} onChange={(value) => setParameters({ ...parameters, neutralize: value })} />
        <Slider label="Salt concentration" help="Passed to gmx genion with -conc. 0.15 M is a common physiological default." value={parameters.saltMolar} min={0} max={1} step={0.05} suffix="M" onChange={(value) => setParameters({ ...parameters, saltMolar: value })} />
        <SelectField label="Positive ion" value={parameters.positiveIon} options={["NA", "K", "CA"]} onChange={(value) => setParameters({ ...parameters, positiveIon: value })} />
        <SelectField label="Negative ion" value={parameters.negativeIon} options={["CL", "BR"]} onChange={(value) => setParameters({ ...parameters, negativeIon: value })} />
      </div>
    );
  }

  if (activeStep === "minimize") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField label="Integrator" value={parameters.minimizer} options={["steep", "cg", "l-bfgs"]} onChange={(value) => setParameters({ ...parameters, minimizer: value })} />
        <NumberField label="Maximum steps" value={parameters.minimizationSteps} min={100} step={1000} onChange={(value) => setParameters({ ...parameters, minimizationSteps: value })} />
        <NumberField label="Energy tolerance" help="MDP emtol. Minimization stops when the maximum force is below this threshold." value={parameters.emtol} min={10} step={100} onChange={(value) => setParameters({ ...parameters, emtol: value })} />
        <Slider label="Initial step size" value={parameters.emstep} min={0.001} max={0.05} step={0.001} suffix="nm" onChange={(value) => setParameters({ ...parameters, emstep: value })} />
      </div>
    );
  }

  if (activeStep === "equilibrate") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SelectField label="Ensemble" value={parameters.ensemble} options={["NVT", "NPT"]} onChange={(value) => setParameters({ ...parameters, ensemble: value })} />
        <Slider label="Equilibration length" value={parameters.equilibrationPs} min={10} max={1000} step={10} suffix="ps" onChange={(value) => setParameters({ ...parameters, equilibrationPs: value })} />
        <Slider label="Temperature" help="MDP ref_t in Kelvin for temperature coupling." value={parameters.temperature} min={250} max={360} step={1} suffix="K" onChange={(value) => setParameters({ ...parameters, temperature: value })} />
        <Slider label="Pressure" help="MDP ref_p in bar for pressure coupling when the ensemble uses a barostat." value={parameters.pressure} min={0.5} max={2} step={0.1} suffix="bar" onChange={(value) => setParameters({ ...parameters, pressure: value })} />
        <SelectField label="Thermostat" value={parameters.thermostat} options={["V-rescale", "Berendsen", "Nose-Hoover", "no"]} onChange={(value) => setParameters({ ...parameters, thermostat: value })} />
        <SelectField label="Barostat" value={parameters.barostat} options={["Parrinello-Rahman", "Berendsen", "C-rescale", "no"]} onChange={(value) => setParameters({ ...parameters, barostat: value })} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Slider label="Production length" help="Converted into production.mdp nsteps using length / dt." value={parameters.productionNs} min={1} max={100} step={1} suffix="ns" onChange={(value) => setParameters({ ...parameters, productionNs: value })} />
      <Slider label="Time step" help="MDP dt in ps. 0.002 ps is a common value when constraining bonds to hydrogen." value={parameters.dt} min={0.001} max={0.004} step={0.001} suffix="ps" onChange={(value) => setParameters({ ...parameters, dt: value })} />
      <Slider label="Output interval" value={parameters.outputEveryPs} min={1} max={100} step={1} suffix="ps" onChange={(value) => setParameters({ ...parameters, outputEveryPs: value })} />
      <SelectField label="Constraints" value={parameters.constraints} options={["h-bonds", "all-bonds", "none"]} onChange={(value) => setParameters({ ...parameters, constraints: value })} />
      <ToggleField label="Request GPU acceleration" checked={parameters.useGpu} onChange={(value) => setParameters({ ...parameters, useGpu: value })} />
    </div>
  );
}

function FilesView({ handleFile, selectUpload, upload, uploads }: { handleFile: (file?: File) => void; selectUpload: (upload: UploadedCoordinate) => void; upload: UploadedCoordinate | null; uploads: UploadedCoordinate[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-semibold">Upload Library</h3>
        <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ocean-200 bg-ocean-50/60 px-5 text-center transition hover:border-ocean-500 dark:border-slate-700 dark:bg-slate-950">
          <UploadCloud className="mb-2 text-ocean-600" size={32} />
          <span className="font-medium">Add coordinate file</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">PDB, GRO, CIF, or MOL2</span>
          <input className="sr-only" type="file" accept=".pdb,.gro,.cif,.mol2" onChange={(event) => handleFile(event.target.files?.[0])} />
        </label>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-[1fr_120px_180px] border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>Name</span>
          <span>Size</span>
          <span>Uploaded</span>
        </div>
        <div className="max-h-[calc(100vh-180px)] overflow-auto">
          {uploads.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectUpload(item)}
              className={`grid w-full grid-cols-[1fr_120px_180px] items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${upload?.id === item.id ? "bg-ocean-50 dark:bg-ocean-950" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-2 font-medium"><FileText size={17} className="text-ocean-600" /><span className="truncate">{item.originalName}</span></span>
              <span className="text-slate-500 dark:text-slate-400">{formatBytes(item.size)}</span>
              <span className="text-slate-500 dark:text-slate-400">{formatRunTime(item.createdAt)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function RunsView({ job, runs, selectRun }: { job: SimulationJob | null; runs: SimulationJob[]; selectRun: (runId: number, view?: ViewKey) => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-[100px_1fr_130px_120px_180px] border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>Run</span>
        <span>Input</span>
        <span>Status</span>
        <span>Progress</span>
        <span>Created</span>
      </div>
      <div className="max-h-[calc(100vh-150px)] overflow-auto">
        {runs.map((run) => (
          <button
            key={run.id}
            type="button"
            onClick={() => selectRun(run.id, "results")}
            className={`grid w-full grid-cols-[100px_1fr_130px_120px_180px] items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${job?.id === run.id ? "bg-ocean-50 dark:bg-ocean-950" : ""}`}
          >
            <span className="font-semibold">#{run.id}</span>
            <span className="truncate">{run.upload.originalName}</span>
            <span><span className={statusClass(run.status)}>{run.status}</span></span>
            <span>{run.progress}%</span>
            <span className="text-slate-500 dark:text-slate-400">{formatRunTime(run.createdAt)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ResultsView({ job, logs, selectRun, dark }: { job: SimulationJob | null; logs: string[]; selectRun: (runId: number, view?: ViewKey) => void; dark: boolean; }) {
  if (!job) {
    return <EmptyState title="No run selected" detail="Open Simulation Runs and choose a run to inspect results, logs, and output files." />;
  }

  const logFiles = [
    { name: "live-stream.log", detail: "Captured pipeline event stream", href: logHistoryUrl(job.id) },
    { name: `run-${job.id}-summary.json`, detail: "Run metadata and metric payload", href: `/api/simulations/${job.id}/` }
  ];

  return (
    <div className="grid h-full min-h-[780px] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(480px,0.75fr)]">
      <section className="flex min-h-0 flex-col gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Run #{job.id} Results</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{job.upload.originalName}</p>
            </div>
            <span className={statusClass(job.status)}>{job.status}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatusDatum label="Progress" value={`${job.progress}%`} />
            <StatusDatum label="Step" value={job.currentStep} />
            <StatusDatum label="Started" value={job.startedAt ? formatRunTime(job.startedAt) : "Not started"} />
            <StatusDatum label="Finished" value={job.finishedAt ? formatRunTime(job.finishedAt) : "Pending"} />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-base font-semibold">Energy Trace</h3>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={job.metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="progress" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="energy" stroke="#0891b2" fill="#cffafe" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Molecule View</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{job.upload.originalName}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">MolStar</span>
            </div>
            <div className="h-[360px]">
              <Viewer3D coordinateUrl={job.upload.url} dark={dark} />
            </div>
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-semibold">Log Files</h3>
          <div className="space-y-2">
            {logFiles.map((file) => (
              <a key={file.name} href={file.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm transition hover:border-ocean-500 hover:bg-ocean-50 dark:border-slate-700 dark:hover:bg-ocean-950">
                <TerminalSquare size={18} className="text-ocean-600" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{file.name}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{file.detail}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-semibold">Log Window</h3>
          <div className="h-[calc(100%-32px)] min-h-80 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-mint-100">
            {logs.length === 0 ? <div>No logs captured for this run yet.</div> : logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatsView({ runs }: { runs: SimulationJob[] }) {
  const byStatus = ["queued", "running", "completed", "failed", "cancelled"].map((status) => ({
    status,
    count: runs.filter((run) => run.status === status).length
  }));
  const latest = runs.slice(0, 10).reverse().map((run) => ({ run: `#${run.id}`, progress: run.progress }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-lg font-semibold">Run Status</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0891b2" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-lg font-semibold">Recent Progress</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={latest}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="run" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="progress" stroke="#10b981" fill="#d1fae5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function AdminView({ session }: { session: SessionState }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [working, setWorking] = useState<number | null>(null);

  const isAdmin = session.user?.isStaff || session.user?.isSuperuser;

  useEffect(() => {
    if (!isAdmin) return;
    adminListUsers()
      .then(setUsers)
      .catch(() => setAdminError("Could not load users."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  async function handleApprove(userId: number) {
    setWorking(userId);
    try {
      await adminApproveUser(userId);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: true } : u));
    } catch {
      setAdminError("Approve failed.");
    } finally {
      setWorking(null);
    }
  }

  async function handleDeny(userId: number) {
    if (!confirm("Delete this user account permanently?")) return;
    setWorking(userId);
    try {
      await adminDenyUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setAdminError("Deny failed.");
    } finally {
      setWorking(null);
    }
  }

  const pending = users.filter((u) => !u.isActive);
  const active = users.filter((u) => u.isActive);

  if (!isAdmin) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <ServerCog className="mx-auto mb-3 text-slate-400" size={40} />
          <h3 className="text-lg font-semibold">Admin Access Required</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This page is only accessible to staff and superusers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Users" value={users.length} icon={ServerCog} />
        <MetricCard label="Active" value={active.length} icon={CheckCircle2} />
        <MetricCard label="Pending Approval" value={pending.length} icon={Clock3} />
      </div>

      {adminError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{adminError}</p>}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 border-b border-amber-200 px-5 py-3 dark:border-amber-900">
            <Clock3 size={16} className="text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">Pending Approval ({pending.length})</h3>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-900">
            {pending.map((user) => (
              <div key={user.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{user.username}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{user.email}</span>
                  </div>
                  {user.purpose && (
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-medium">Purpose: </span>{user.purpose}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400">
                    Registered {new Date(user.dateJoined).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={working === user.id}
                    onClick={() => handleApprove(user.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={working === user.id}
                    onClick={() => handleDeny(user.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950 disabled:opacity-50"
                  >
                    <TerminalSquare size={14} /> Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active users table */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold">Active Users ({active.length})</h3>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-slate-400">Loading…</p>
        ) : active.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No active users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">User</th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">Email</th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">Role</th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">Joined</th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {active.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3 font-medium">{user.username}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{user.email}</td>
                    <td className="px-5 py-3">
                      {user.isSuperuser ? (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">Superuser</span>
                      ) : user.isStaff ? (
                        <span className="rounded-full bg-ocean-100 px-2 py-0.5 text-xs font-semibold text-ocean-700 dark:bg-ocean-950 dark:text-ocean-300">Staff</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">User</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{new Date(user.dateJoined).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      {!user.isSuperuser && (
                        <button
                          type="button"
                          disabled={working === user.id}
                          onClick={() => handleDeny(user.id)}
                          className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function LoadingScreen({ dark, setDark }: { dark: boolean; setDark: (dark: boolean) => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute right-5 top-5">
        <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
      </div>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center text-ocean-600 dark:text-ocean-400">
          <Atom size={30} />
        </div>
        <div className="text-lg font-semibold">Opening GROWebby</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Checking your session</div>
      </div>
    </main>
  );
}

function AuthScreen({ dark, setDark, setSession, onAuthenticated }: { dark: boolean; setDark: (dark: boolean) => void; setSession: (session: SessionState) => void; onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [purpose, setPurpose] = useState("");
  const [authError, setAuthError] = useState("");
  const [registered, setRegistered] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  function switchMode(next: "login" | "register") {
    setMode(next);
    setAuthError("");
    setRegistered("");
  }

  async function submit() {
    setAuthError("");
    setRegistered("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        const nextSession = await loginUser(username, password);
        setSession(nextSession);
        onAuthenticated();
      } else {
        const result = await registerUser(username, email, password, purpose);
        setRegistered(result.message);
        setUsername(""); setEmail(""); setPassword(""); setPurpose("");
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.52fr)]">
      {/* ── Left hero panel ── */}
      <section className="relative hidden overflow-hidden bg-slate-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(6,182,212,0.35),transparent_40%),radial-gradient(ellipse_at_80%_80%,rgba(16,185,129,0.2),transparent_50%),linear-gradient(160deg,#020617,#0f172a_60%,#052e16)]" />
        {/* Decorative grid lines */}
        <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "48px 48px"}} />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ocean-500/20 ring-1 ring-ocean-400/30">
            <Network className="text-ocean-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">GROWebby</h1>
            <p className="text-xs text-slate-400">Molecular Dynamics Console</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            <Sparkles size={12} /> Local · Docker · GROMACS
          </div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Run molecular dynamics from your browser.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Configure every stage of your GROMACS pipeline, monitor live metrics, and download results — all in one place.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <Database className="mb-3 text-cyan-300" size={20} />
            <p className="text-sm text-slate-300">Per-user private workspaces and file storage.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <GitBranch className="mb-3 text-emerald-300" size={20} />
            <p className="text-sm text-slate-300">Each run retains its full workflow configuration.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <BarChart3 className="mb-3 text-amber-300" size={20} />
            <p className="text-sm text-slate-300">Live energy, temperature and pressure charts.</p>
          </div>
        </div>
      </section>

      {/* ── Right form panel ── */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-white p-6 dark:bg-slate-900 lg:border-l lg:border-slate-800">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ocean-100 text-ocean-700 dark:bg-ocean-900 dark:text-ocean-300">
                <Network size={18} />
              </div>
              <span className="font-bold">GROWebby</span>
            </div>
            <div className="ml-auto">
              <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">{isRegister ? "Request access" : "Welcome back"}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isRegister ? "New accounts require admin approval before you can sign in." : "Sign in to your GROWebby workspace."}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button type="button" onClick={() => switchMode("login")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${!isRegister ? "bg-white text-slate-950 shadow dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}>Sign in</button>
            <button type="button" onClick={() => switchMode("register")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${isRegister ? "bg-white text-slate-950 shadow dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}>Register</button>
          </div>

          {registered ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950">
              <CheckCircle2 className="mb-2 text-emerald-600 dark:text-emerald-400" size={22} />
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">Registration submitted!</p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">{registered}</p>
              <button type="button" onClick={() => switchMode("login")} className="mt-4 text-sm font-medium text-emerald-700 underline dark:text-emerald-300">Back to sign in</button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Username</span>
                <input className="field" autoComplete="username" value={username} placeholder="your_username" onChange={(e) => setUsername(e.target.value)} />
              </label>
              {isRegister && (
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Email</span>
                  <input className="field" type="email" autoComplete="email" value={email} placeholder="you@lab.edu" onChange={(e) => setEmail(e.target.value)} />
                </label>
              )}
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Password</span>
                <input className="field" type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} placeholder={isRegister ? "Min. 8 characters" : ""} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !isRegister) submit(); }} />
              </label>
              {isRegister && (
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Purpose</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Why do you need access? (shown to admin)</span>
                  <textarea className="field min-h-[80px] resize-none" value={purpose} placeholder="e.g. PhD research on protein folding at University of XYZ" onChange={(e) => setPurpose(e.target.value)} />
                </label>
              )}

              {authError && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">{authError}</p>}

              <button
                className="button-primary h-11 w-full"
                type="button"
                disabled={submitting}
                onClick={submit}
              >
                {submitting ? "Please wait…" : isRegister ? "Submit request" : "Sign in"}
              </button>

              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                Accounts are stored locally in this GROWebby installation.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

type SliderProps = {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
};

function Slider({ label, help, value, min, max, step, suffix, onChange }: SliderProps) {
  return (
    <label className="space-y-2">
      <span className="flex items-center justify-between gap-3 text-sm font-medium">
        <span className="inline-flex items-center gap-2">{label}{help && <InfoPopover title={label} body={help} />}</span>
        <span className="text-ocean-700 dark:text-ocean-200">{value}{suffix}</span>
      </span>
      <input className="w-full accent-ocean-600" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SelectField({ label, help, value, options, onChange }: { label: string; help?: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="inline-flex items-center gap-2 text-sm font-medium">{label}{help && <InfoPopover title={label} body={help} />}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function NumberField({ label, help, value, min, step, onChange }: { label: string; help?: string; value: number; min: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-2">
      <span className="inline-flex items-center gap-2 text-sm font-medium">{label}{help && <InfoPopover title={label} body={help} />}</span>
      <input className="field" type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700">
      <span>{label}</span>
      <input className="h-5 w-5 accent-ocean-600" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function InfoPopover({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          setOpen((value) => !value);
        }}
        className="inline-flex h-6 w-6 items-center justify-center text-ocean-600 transition hover:text-ocean-800 dark:text-ocean-400 dark:hover:text-ocean-300"
        aria-label={`Show help for ${title}`}
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <span className="absolute left-0 top-8 z-30 w-80 rounded-lg border border-slate-200 bg-white p-3 text-left text-sm font-normal text-slate-600 shadow-soft dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <span className="mb-2 flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{title}</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Close</button>
          </span>
          {body}
        </span>
      )}
    </span>
  );
}

function AboutView() {
  const [versionInfo, setVersionInfo] = useState<{ version: string; buildDate: string; tools: Record<string, string> } | null>(null);

  useEffect(() => {
    fetch("/version.json")
      .then((r) => r.json())
      .then(setVersionInfo)
      .catch(() => undefined);
  }, []);

  const toolRows = versionInfo
    ? [
        { label: "GROMACS",      version: versionInfo.tools.gromacs,     icon: FlaskConical,   color: "text-ocean-600 dark:text-ocean-400" },
        { label: "gmxapi",       version: versionInfo.tools.gmxapi,      icon: Network,        color: "text-cyan-600 dark:text-cyan-400" },
        { label: "CUDA",         version: versionInfo.tools.cuda,         icon: Zap,            color: "text-green-600 dark:text-green-400" },
        { label: "Ubuntu base",  version: versionInfo.tools.ubuntuBase,  icon: ServerCog,      color: "text-orange-600 dark:text-orange-400" },
        { label: "Python",       version: versionInfo.tools.python,       icon: TerminalSquare, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Django",       version: versionInfo.tools.django,       icon: Database,       color: "text-amber-600 dark:text-amber-400" },
        { label: "React",        version: versionInfo.tools.react,        icon: Sparkles,       color: "text-cyan-600 dark:text-cyan-400" },
        { label: "Vite",         version: versionInfo.tools.vite,         icon: PlayCircle,     color: "text-purple-600 dark:text-purple-400" },
        { label: "Node.js",      version: versionInfo.tools.nodeJs,       icon: Activity,       color: "text-lime-600 dark:text-lime-400" },
        { label: "npm",          version: versionInfo.tools.npm,          icon: Boxes,          color: "text-red-600 dark:text-red-400" },
        { label: "MolStar",      version: versionInfo.tools.molstar,      icon: FlaskConical,   color: "text-indigo-600 dark:text-indigo-400" },
        { label: "Docker",       version: versionInfo.tools.docker,       icon: LayoutDashboard,color: "text-blue-600 dark:text-blue-400" },
      ]
    : [];

  return (
    <div className="grid gap-6 max-w-3xl">
      {/* App identity card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-ocean-100 text-ocean-600 dark:bg-ocean-900 dark:text-ocean-300">
            <Network size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">GROWebby</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Molecular Dynamics Web Console</p>
          </div>
          {versionInfo && (
            <div className="ml-auto text-right">
              <span className="inline-block rounded-full bg-ocean-100 px-3 py-1 text-sm font-semibold text-ocean-700 dark:bg-ocean-950 dark:text-ocean-300">
                v{versionInfo.version}
              </span>
              <p className="mt-1 text-xs text-slate-400">{versionInfo.buildDate}</p>
            </div>
          )}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          GROWebby is a local, Dockerized web interface for running GROMACS molecular dynamics workflows
          through a friendly Django + React UI. Each user gets a private workspace with isolated files,
          simulation runs, and results.
        </p>
      </section>

      {/* Tools & versions */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h3 className="font-semibold">Component Versions</h3>
        </div>
        {!versionInfo ? (
          <p className="p-5 text-sm text-slate-400">Loading version information…</p>
        ) : (
          <div className="grid divide-y divide-slate-100 dark:divide-slate-800 sm:grid-cols-2 sm:divide-y-0">
            {toolRows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-center gap-3 px-5 py-3.5 odd:sm:border-r odd:sm:border-slate-100 dark:odd:sm:border-slate-800">
                  <Icon size={18} className={row.color} />
                  <span className="flex-1 text-sm font-medium">{row.label}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{row.version}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Links */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 font-semibold">Resources</h3>
        <div className="flex flex-wrap gap-3">
          <a href="https://www.gromacs.org/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium transition hover:border-ocean-400 hover:text-ocean-700 dark:border-slate-700 dark:hover:border-ocean-500 dark:hover:text-ocean-300">
            <FlaskConical size={14} /> GROMACS Documentation
          </a>
          <a href="http://www.mdtutorials.com/gmx/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium transition hover:border-ocean-400 hover:text-ocean-700 dark:border-slate-700 dark:hover:border-ocean-500 dark:hover:text-ocean-300">
            <ServerCog size={14} /> MD Tutorials
          </a>
          <a href="https://tutorials.gromacs.org/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium transition hover:border-ocean-400 hover:text-ocean-700 dark:border-slate-700 dark:hover:border-ocean-500 dark:hover:text-ocean-300">
            <Sparkles size={14} /> GROMACS Tutorials
          </a>
          <a href="https://gromacstutorials.github.io/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium transition hover:border-ocean-400 hover:text-ocean-700 dark:border-slate-700 dark:hover:border-ocean-500 dark:hover:text-ocean-300">
            <Sparkles size={14} /> GROMACS Tutorials (Github)
          </a>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Activity }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex h-10 w-10 items-center justify-center text-ocean-600 dark:text-ocean-400">
        <Icon size={20} />
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function StatusDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
      <div className="truncate text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <div>
        <Database className="mx-auto mb-3 text-ocean-600" size={34} />
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
}

export default App;


function upsertRun(runs: SimulationJob[], next: SimulationJob): SimulationJob[] {
  const withoutNext = runs.filter((run) => run.id !== next.id);
  return [next, ...withoutNext].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 50);
}

function formatRunTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function stepName(key: StepKey): string {
  return steps.find((step) => step.key === key)?.name ?? key;
}

function suggestedResumeStep(job: SimulationJob | null): StepKey | null {
  if (!job || job.status === "completed") return null;
  if (job.status === "failed") return stepKeyFromName(job.currentStep);
  if (job.progress >= 82) return "production";
  if (job.progress >= 66) return "equilibrate";
  if (job.progress >= 50) return "minimize";
  if (job.progress >= 38) return "ions";
  if (job.progress >= 24) return "solvation";
  if (job.progress >= 12) return "box";
  return "topology";
}

function stepKeyFromName(name: string): StepKey {
  const normalized = name.toLowerCase();
  if (normalized.includes("production")) return "production";
  if (normalized.includes("equil")) return "equilibrate";
  if (normalized.includes("minim")) return "minimize";
  if (normalized.includes("ion")) return "ions";
  if (normalized.includes("solv")) return "solvation";
  if (normalized.includes("box")) return "box";
  return "topology";
}

function buildConfigPreview(parameters: typeof defaults, upload: UploadedCoordinate | null): string {
  const input = upload?.originalName ?? "<select-or-upload-coordinate-file>";
  const prefix = [
    "# GROWebby generated GROMACS workflow preview",
    `# input = ${input}`,
    `# start_step = ${parameters.startStep}`,
    "",
    "[commands]",
    `gmx pdb2gmx -f ${input} -o processed.gro -p topol.top -ff ${parameters.forceField} -water ${parameters.waterModel}${parameters.ignoreHydrogens ? " -ignh" : ""}${parameters.termini === "interactive" ? "" : ` -ter`}`,
    `gmx editconf -f processed.gro -o boxed.gro -bt ${parameters.boxType} -d ${parameters.distanceNm}${parameters.centerMolecule ? " -c" : ""}`,
    `gmx solvate -cp boxed.gro -cs ${parameters.solventStructure} -o solvated.gro -p topol.top -scale ${parameters.solventScale}${parameters.maxSolventMolecules > 0 ? ` -maxsol ${parameters.maxSolventMolecules}` : ""}`,
    "gmx grompp -f ions.mdp -c solvated.gro -p topol.top -o ions.tpr",
    `gmx genion -s ions.tpr -o ionized.gro -p topol.top -pname ${parameters.positiveIon} -nname ${parameters.negativeIon}${parameters.neutralize ? " -neutral" : ""} -conc ${parameters.saltMolar}`,
    "gmx grompp -f minim.mdp -c ionized.gro -p topol.top -o minim.tpr",
    "gmx mdrun -deffnm minim",
    "gmx grompp -f equil.mdp -c minim.gro -p topol.top -o equil.tpr",
    "gmx mdrun -deffnm equil",
    "gmx grompp -f production.mdp -c equil.gro -p topol.top -o production.tpr",
    `gmx mdrun -deffnm production${parameters.useGpu ? " -nb gpu" : ""}`,
    "",
    "[minim.mdp]",
    `integrator              = ${parameters.minimizer}`,
    `emtol                   = ${parameters.emtol}`,
    `emstep                  = ${parameters.emstep}`,
    `nsteps                  = ${parameters.minimizationSteps}`,
    "",
    "[equil.mdp]",
    "integrator              = md",
    `nsteps                  = ${Math.round(parameters.equilibrationPs / parameters.dt)}`,
    `dt                      = ${parameters.dt}`,
    "define                  = -DPOSRES",
    `tcoupl                  = ${parameters.thermostat}`,
    "tc-grps                 = System",
    "tau_t                   = 0.1",
    `ref_t                   = ${parameters.temperature}`,
    `pcoupl                  = ${parameters.ensemble === "NPT" ? parameters.barostat : "no"}`,
    "pcoupltype              = isotropic",
    "tau_p                   = 2.0",
    `ref_p                   = ${parameters.pressure}`,
    "compressibility         = 4.5e-5",
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

function statusClass(status: SimulationJob["status"]): string {
  const base = "rounded-full px-2 py-0.5 text-xs font-semibold";
  if (status === "completed") return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200`;
  if (status === "failed") return `${base} bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200`;
  if (status === "running") return `${base} bg-ocean-100 text-ocean-700 dark:bg-ocean-950 dark:text-ocean-200`;
  return `${base} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200`;
}
