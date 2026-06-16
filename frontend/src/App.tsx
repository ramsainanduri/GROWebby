import {
  Atom,
  ChevronLeft,
  ChevronRight,
  LogOut,
  RefreshCw,
} from "lucide-react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import {
  cancelSimulation,
  createExampleSetup,
  createSimulation,
  deleteSimulation,
  getHealth,
  getSimulation,
  getSimulationLogs,
  getSession,
  HealthState,
  listSimulations,
  listUploads,
  logStreamUrl,
  logoutUser,
  renameSimulation,
  SimulationJob,
  SessionState,
  UploadedCoordinate,
  uploadCoordinate,
  getGromacsOptions,
  GromacsOptions,
} from "./lib/api";

import { makeRunName, normalizeRunParameters, upsertRun } from "./lib/utils";
import { ViewKey, defaults, steps, navItems } from "./types";
import { ThemeToggle } from "./components/ThemeToggle";
import { NotificationStack } from "./components/NotificationStack";

import { AboutView } from "./views/AboutView";
import { AdminView } from "./views/AdminView";
import { AuthScreen } from "./views/AuthScreen";
import { DashboardView } from "./views/DashboardView";
import { FilesView } from "./views/FilesView";
import { LoadingScreen } from "./views/LoadingScreen";
import { ResultsView } from "./views/ResultsView";
import { RunsView } from "./views/RunsView";
import { StatsView } from "./views/StatsView";
import { WorkflowView } from "./views/WorkflowView";

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
  const view = (
    location.pathname === "/" ? "dashboard" : location.pathname.substring(1)
  ) as ViewKey;
  const [activeStep, setActiveStep] = useState(() => {
    const saved = localStorage.getItem("growebby-step");
    return saved ? Number(saved) : 0;
  });
  const [parameters, setParameters] = useState(() => {
    const saved = localStorage.getItem("growebby-parameters");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { ...defaults, runName: makeRunName() };
  });
  const [upload, setUpload] = useState<UploadedCoordinate | null>(() => {
    const saved = localStorage.getItem("growebby-upload");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });
  const [uploads, setUploads] = useState<UploadedCoordinate[]>([]);
  const [job, setJob] = useState<SimulationJob | null>(() => {
    const saved = localStorage.getItem("growebby-job");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });
  const [runs, setRuns] = useState<SimulationJob[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState<
    { id: number; tone: "success" | "error" | "info"; message: string }[]
  >([]);
  const [versionInfo, setVersionInfo] = useState<{
    version: string;
    buildDate: string;
    tools: Record<string, string>;
  } | null>(null);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [gmxOptions, setGmxOptions] = useState<GromacsOptions | null>(null);
  const [session, setSession] = useState<SessionState>({
    isAuthenticated: false,
    user: null,
  });
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    localStorage.setItem("growebby-step", String(activeStep));
  }, [activeStep]);

  useEffect(() => {
    localStorage.setItem("growebby-parameters", JSON.stringify(parameters));
  }, [parameters]);

  useEffect(() => {
    if (upload) {
      localStorage.setItem("growebby-upload", JSON.stringify(upload));
    } else {
      localStorage.removeItem("growebby-upload");
    }
  }, [upload]);

  useEffect(() => {
    if (job) {
      localStorage.setItem("growebby-job", JSON.stringify(job));
    } else {
      localStorage.removeItem("growebby-job");
    }
  }, [job]);

  useEffect(() => {
    fetch("/version.json")
      .then((response) => response.json())
      .then(setVersionInfo)
      .catch(() => undefined);
    getHealth()
      .then(setHealth)
      .catch(() => undefined);
    getGromacsOptions()
      .then(setGmxOptions)
      .catch(() => undefined);
  }, []);

  function notify(tone: "success" | "error" | "info", message: string) {
    const id = Date.now() + Math.random();
    setNotifications((current: any) => [
      ...current.slice(-3),
      { id, tone, message },
    ]);
    window.setTimeout(
      () =>
        setNotifications((current: any) => current.filter((item) => item.id !== id)),
      6000,
    );
  }

  function reportError(err: unknown, fallback: string) {
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    notify("error", message);
  }

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
    if (!job || ["completed", "failed", "cancelled"].includes(job.status))
      return;
    const timer = window.setInterval(async () => {
      const fresh = await getSimulation(job.id);
      setJob(fresh);
      setRuns((current: any) => upsertRun(current, fresh));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [job]);

  useEffect(() => {
    if (!job) return;
    const source = new EventSource(logStreamUrl(job.id));
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { message: string };
        setLogs((current: any) =>
          current.includes(data.message)
            ? current
            : [...current.slice(-160), data.message],
        );
      } catch {
        setLogs((current: any) => [...current.slice(-160), event.data]);
      }
    };
    source.addEventListener("done", () => source.close());
    source.onerror = () => source.close();
    return () => source.close();
  }, [job?.id]);

  const handleNewRun = () => {
    const newParams = { ...defaults, runGroupId: 0, runName: makeRunName() };
    setParameters(newParams);
    setUpload(null);
    setJob(null);
    setActiveStep(0);
  };

  const canStart = useMemo(() => Boolean(upload && !busy), [upload, busy]);
  const completedRuns = runs.filter((run) => run.status === "completed");
  const runningRuns = runs.filter(
    (run) => run.status === "running" || run.status === "queued",
  );
  const failedRuns = runs.filter((run) => run.status === "failed");

  async function refreshWorkspace() {
    try {
      const [freshRuns, freshUploads] = await Promise.all([
        listSimulations(),
        listUploads(),
      ]);
      setRuns(freshRuns);
      setUploads(freshUploads);
    } catch (err) {
      reportError(err, "Could not refresh workspace");
    }
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadCoordinate(file);
      setUpload(uploaded);
      setParameters((current: any) => ({
        ...current,
        runName: current.runName || makeRunName(uploaded.originalName),
      }));
      setUploads((current: any) => [
        uploaded,
        ...current.filter((item) => item.id !== uploaded.id),
      ]);
      notify("success", `Uploaded ${uploaded.originalName}.`);
      navigate("/workflow");
    } catch (err) {
      reportError(err, "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function startSimulation(overrides: Partial<typeof defaults> = {}) {
    if (!upload) return;
    setBusy(true);
    setError("");
    setLogs([]);
    try {
      const runParameters = normalizeRunParameters({
        ...parameters,
        ...overrides,
      });
      const created = await createSimulation(
        upload!.id,
        runParameters,
        String(runParameters.runName),
      );
      setJob(created);
      setRuns((current: any) => upsertRun(current, created));
      notify("success", `Started ${created.name}.`);
      navigate("/results");
    } catch (err) {
      reportError(err, "Could not start simulation");
    } finally {
      setBusy(false);
    }
  }

  async function createExample(exampleKey: "lysozyme" | "small-molecule") {
    setBusy(true);
    setError("");
    try {
      const example = await createExampleSetup(exampleKey);
      setUpload(example.upload);
      setUploads((current: any) => [
        example.upload,
        ...current.filter((item) => item.id !== example.upload.id),
      ]);
      setParameters({
        ...defaults,
        runName: makeRunName(example.upload.originalName),
        ...example.parameters,
      });
      notify("success", "Example setup created.");
      navigate("/workflow");
    } catch (err) {
      reportError(err, "Could not create example setup");
    } finally {
      setBusy(false);
    }
  }

  async function removeRun(runId: number) {
    const target = runs.find((run) => run.id === runId);
    const groupId = target?.runGroupId ?? runId;
    if (!confirm(`Delete run #${groupId} and its stored files?`)) return;
    setError("");
    try {
      await deleteSimulation(runId);
      setRuns((current: any) =>
        current.filter((run) => (run.runGroupId ?? run.id) !== groupId),
      );
      if (job && (job.runGroupId ?? job.id) === groupId) {
        setJob(null);
        setLogs([]);
        navigate("/runs");
      }
      notify("success", `Deleted run #${groupId}.`);
    } catch (err) {
      reportError(err, "Could not delete run");
    }
  }

  async function renameRun(runId: number, name: string) {
    setError("");
    try {
      const renamed = await renameSimulation(runId, name);
      setJob((current: any) => (current?.id === runId ? renamed : current));
      setRuns((current: any) =>
        upsertRun(
          current.map((run) =>
            (run.runGroupId ?? run.id) === renamed.runGroupId
              ? {
                  ...run,
                  name: renamed.name,
                  workspaceSlug: renamed.workspaceSlug,
                  parameters: {
                    ...run.parameters,
                    runName: renamed.name,
                    runGroupId: renamed.runGroupId,
                  },
                }
              : run,
          ),
          renamed,
        ),
      );
      setParameters((current: any) =>
        current.runName === name
          ? current
          : { ...current, runName: renamed.name },
      );
      notify("success", "Run renamed.");
    } catch (err) {
      reportError(err, "Could not rename run");
    }
  }

  async function cancelRun(runId: number) {
    const target = runs.find((run) => run.id === runId) ?? job;
    if (!target || !["queued", "running"].includes(target.status)) return;
    if (
      !confirm(
        `Cancel ${
          target.name || `run #${target.id}`
        }? The active GROMACS process will be terminated.`,
      )
    )
      return;
    setError("");
    try {
      const cancelled = await cancelSimulation(runId);
      setJob((current: any) => (current?.id === runId ? cancelled : current));
      setRuns((current: any) => upsertRun(current, cancelled));
      notify("info", `Cancellation requested for ${cancelled.name}.`);
    } catch (err) {
      reportError(err, "Could not cancel run");
    }
  }

  async function selectRun(runId: number, nextView: ViewKey = "results") {
    setError("");
    try {
      const selected = await getSimulation(runId);
      const logEntries = await getSimulationLogs(runId);
      setJob(selected);
      setUpload(selected.upload);
      setParameters({
        ...defaults,
        runName: selected.name,
        ...selected.parameters,
      });
      setLogs(logEntries.map((entry) => entry.message));
      setRuns((current: any) => upsertRun(current, selected));
      navigate(`/${nextView}`);
    } catch (err) {
      reportError(err, "Could not load run");
    }
  }

  function configureNextStepFromRun(run: SimulationJob) {
    const lastStage = [...run.metrics].reverse().find((metric) => metric.stage)
      ?.stage;
    const currentStep =
      (run.parameters.startStep as string | undefined) ??
      lastStage ??
      "topology";
    const currentIndex = steps.findIndex((step) => step.key === currentStep);
    const nextIndex = Math.min(Math.max(currentIndex, 0) + 1, steps.length - 1);
    const nextStep = steps[nextIndex].key;
    setActiveStep(nextIndex);
    setUpload(run.upload);
    setParameters({
      ...defaults,
      runName: run.name || makeRunName(run.upload.originalName),
      ...run.parameters,
      runGroupId: run.runGroupId ?? run.id,
      startStep: nextStep,
      runUntil: nextStep,
    });
    navigate("/workflow");
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
      <aside
        className={`${
          navCollapsed ? "w-[4.5rem]" : "w-[15.5rem] 2xl:w-[16.25rem]"
        } hidden shrink-0 border-r border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col`}
      >
        <div
          className={`flex h-14 2xl:h-16 items-center border-b border-slate-200 dark:border-slate-800 ${
            navCollapsed ? "justify-center px-2" : "gap-2.5 px-3"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center 2xl:h-10 2xl:w-10">
            <img
              src="/logo.svg"
              alt="GROWebby Logo"
              className="h-full w-full object-contain"
            />
          </div>
          {!navCollapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold 2xl:text-lg">
                GROWebby{" "}
                {versionInfo ? (
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    v{versionInfo.version}
                  </span>
                ) : null}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                MD operations console
              </p>
            </div>
          )}
        </div>

        <nav
          className={`flex-1 space-y-1 overflow-auto ${
            navCollapsed ? "p-2" : "p-3"
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={`/${item.key}`}
                aria-label={item.label}
                className={`flex h-9 w-full items-center rounded-lg text-[0.8rem] font-semibold transition 2xl:h-10 ${
                  navCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                } ${
                  view === item.key
                    ? "bg-ocean-100 text-ocean-800 dark:bg-ocean-900 dark:text-ocean-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
                title={navCollapsed ? item.label : undefined}
              >
                <Icon size="1.18em" />
                {!navCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
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
            {navCollapsed ? (
              <ChevronRight size="1.12em" />
            ) : (
              <ChevronLeft size="1.12em" />
            )}
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 2xl:h-16 2xl:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="lg:hidden flex h-9 w-9 items-center justify-center">
              <img
                src="/logo.svg"
                alt="GROWebby Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold 2xl:text-lg">
                {navItems.find((item) => item.key === view)?.label}
              </h2>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400 2xl:text-sm">
                {job
                  ? `Focused on run #${job.id} · ${job.currentStep}`
                  : `GROWebby${
                      versionInfo ? ` v${versionInfo.version}` : ""
                    } · Configure, launch, and review molecular dynamics runs`}
              </p>
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
            <ThemeToggle
              dark={dark}
              onToggle={() => setDark((value) => !value)}
            />
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
                  view === item.key
                    ? "bg-ocean-100 text-ocean-800 dark:bg-ocean-900 dark:text-ocean-100"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <DashboardView
                  completedRuns={completedRuns.length}
                  createExample={createExample}
                  failedRuns={failedRuns.length}
                  job={job}
                  runningRuns={runningRuns.length}
                  uploadsCount={uploads.length}
                  busy={busy}
                />
              }
            />
            <Route
              path="/workflow"
              element={
                <WorkflowView
                  activeStep={activeStep}
                  busy={busy}
                  canStart={canStart}
                  handleFile={handleFile}
                  health={health}
                  job={job}
                  parameters={parameters}
                  setActiveStep={setActiveStep}
                  setParameters={setParameters}
                  startSimulation={startSimulation}
                  upload={upload}
                  uploads={uploads}
                  selectUpload={(selected) => {
                    setUpload(selected);
                    navigate("/workflow");
                  }}
                  dark={dark}
                  gmxOptions={gmxOptions}
                  handleNewRun={handleNewRun}
                />
              }
            />
            <Route
              path="/files"
              element={
                <FilesView
                  handleFile={handleFile}
                  selectUpload={setUpload}
                  upload={upload}
                  uploads={uploads}
                />
              }
            />
            <Route
              path="/runs"
              element={
                <RunsView
                  job={job}
                  runs={runs}
                  removeRun={removeRun}
                  selectRun={selectRun}
                />
              }
            />
            <Route
              path="/results"
              element={
                <ResultsView
                  cancelRun={cancelRun}
                  configureNextStep={configureNextStepFromRun}
                  job={job}
                  logs={logs}
                  notify={notify}
                  renameRun={renameRun}
                  selectRun={selectRun}
                  dark={dark}
                />
              }
            />
            <Route path="/stats" element={<StatsView runs={runs} />} />
            <Route path="/admin" element={<AdminView session={session} />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </section>
      <NotificationStack
        notifications={notifications}
        dismiss={(id) =>
          setNotifications((current: any) =>
            current.filter((item) => item.id !== id),
          )
        }
      />
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
}
