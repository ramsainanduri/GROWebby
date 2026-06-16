import { useEffect, useState } from "react";
import { TerminalSquare } from "lucide-react";
import {
  ArtifactFile,
  logHistoryUrl,
  readArtifact,
  saveArtifact,
  SimulationJob,
  analyzeSimulation,
  AnalysisResult,
} from "../lib/api";
import { ViewKey, StepKey } from "../types";
import {
  downloadAllMetricsCsv,
  executionModeLabel,
  formatDuration,
  formatRunTime,
  statusClass,
  stepName,
} from "../lib/utils";
import { EmptyState, StatusDatum } from "../components/ui";
import { SelectField } from "../components/form";
import { Viewer3D } from "../components/Viewer3D";
import { PlotCard } from "../components/PlotCard";
import { AnalysisPlot } from "../components/AnalysisPlot";

interface ResultsProps {
  cancelRun: (runId: number) => void;
  configureNextStep: (run: SimulationJob) => void;
  job: SimulationJob | null;
  logs: string[];
  notify: (tone: "success" | "error" | "info", message: string) => void;
  renameRun: (runId: number, name: string) => void;
  selectRun: (runId: number, view?: ViewKey) => void;
  dark: boolean;
}

export function ResultsView({
  cancelRun,
  configureNextStep,
  job,
  logs,
  notify,
  renameRun,
  selectRun,
  dark,
}: ResultsProps) {
  const [runNameDraft, setRunNameDraft] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactFile | null>(
    null,
  );
  const [artifactText, setArtifactText] = useState("");
  const [artifactBusy, setArtifactBusy] = useState(false);
  const [analysisTool, setAnalysisTool] = useState("rmsd");
  const [analysisStep, setAnalysisStep] = useState("production");
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);

  useEffect(() => {
    if (job) setRunNameDraft(job.name || `Run #${job.id}`);
  }, [job?.id, job?.name]);

  if (!job) {
    return (
      <EmptyState
        title="No run selected"
        detail="Open Simulation Runs and choose a run to inspect results, logs, and output files."
      />
    );
  }

  const logFiles = [
    {
      name: "run-events.json",
      detail: "Clean event stream shown in the log window",
      href: logHistoryUrl(job.id),
    },
    {
      name: `run-${job.id}-summary.json`,
      detail: "Run metadata and metric payload",
      href: `/api/simulations/${job.id}/`,
    },
  ];
  const artifactFiles = job.artifactFiles ?? [];
  const analysisAvailableSteps = Array.from(
    new Set(
      artifactFiles
        .filter((f) => f.name.endsWith(".tpr"))
        .map((f) => f.name.replace(".tpr", "")),
    ),
  );
  if (analysisAvailableSteps.length === 0)
    analysisAvailableSteps.push("production");

  const activeStepKey =
    (job.parameters.startStep as string | undefined) ??
    [...job.metrics].reverse().find((metric) => metric.stage)?.stage ??
    "topology";
  const producedFiles = artifactFiles.filter(
    (file) =>
      file.kind === "structure" ||
      file.kind === "analysis" ||
      file.kind === "config",
  );
  const chartSeries = [
    {
      key: "potential",
      label: "Potential Energy",
      color: "#0891b2",
      fill: "#cffafe",
      unit: "kJ/mol",
    },
    {
      key: "totalEnergy",
      label: "Total Energy",
      color: "#2563eb",
      fill: "#dbeafe",
      unit: "kJ/mol",
    },
    {
      key: "kineticEnergy",
      label: "Kinetic Energy",
      color: "#7c3aed",
      fill: "#ede9fe",
      unit: "kJ/mol",
    },
    {
      key: "energy",
      label: "Energy",
      color: "#0f766e",
      fill: "#ccfbf1",
      unit: "kJ/mol",
    },
    {
      key: "temperature",
      label: "Temperature",
      color: "#10b981",
      fill: "#d1fae5",
      unit: "K",
    },
    {
      key: "pressure",
      label: "Pressure",
      color: "#f59e0b",
      fill: "#fef3c7",
      unit: "bar",
    },
    {
      key: "density",
      label: "Density",
      color: "#ef4444",
      fill: "#fee2e2",
      unit: "kg/m3",
    },
  ];
  const stageOptions = [
    "all",
    ...Array.from(
      new Set(job.metrics.map((metric) => metric.stage).filter(Boolean)),
    ),
  ] as string[];
  const plottedMetrics =
    stageFilter === "all"
      ? job.metrics
      : job.metrics.filter((metric) => metric.stage === stageFilter);
  const canCancel = job.status === "queued" || job.status === "running";

  return (
    <div className="grid h-full min-h-[780px] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(480px,0.75fr)]">
      <section className="flex min-h-0 flex-col gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex max-w-xl items-center gap-2">
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800"
                  value={runNameDraft}
                  onChange={(event) => setRunNameDraft(event.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 h-[2.35rem] whitespace-nowrap"
                  onClick={() => renameRun(job.id, runNameDraft)}
                >
                  Rename
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {job.upload?.originalName}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  job.executionMode === "validation-mode"
                    ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-200"
                    : "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                }
              >
                {executionModeLabel(job.executionMode)}
              </span>
              <span className={statusClass(job.status)}>{job.status}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <StatusDatum label="Progress" value={`${job.progress}%`} />
            <StatusDatum label="Step" value={job.currentStep} />
            <StatusDatum
              label="Started"
              value={
                job.startedAt ? formatRunTime(job.startedAt) : "Not started"
              }
            />
            <StatusDatum
              label="Finished"
              value={job.finishedAt ? formatRunTime(job.finishedAt) : "Pending"}
            />
            <StatusDatum
              label="Duration"
              value={
                job.startedAt
                  ? formatDuration(
                      (job.finishedAt
                        ? new Date(job.finishedAt).getTime()
                        : Date.now()) - new Date(job.startedAt).getTime(),
                    )
                  : "-"
              }
            />
          </div>
          {canCancel && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">Run is active</span>
                  <span className="text-xs">
                    {job.processPid
                      ? `GROMACS process PID ${job.processPid}`
                      : "Waiting for the next GROMACS process to start."}
                  </span>
                </span>
                <button
                  type="button"
                  className="rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-soft hover:bg-rose-700"
                  onClick={() => cancelRun(job.id)}
                >
                  Cancel run
                </button>
              </div>
            </div>
          )}
          {job.error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
              <span className="block font-semibold">Run error</span>
              <span className="mt-1 block whitespace-pre-wrap break-words">
                {job.error}
              </span>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-ocean-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-ocean-700 disabled:opacity-50"
              onClick={() => configureNextStep(job)}
              disabled={activeStepKey === "production"}
            >
              Configure next step
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              onClick={() => selectRun(job.id, "results")}
            >
              Refresh run
            </button>
          </div>
          <div className="mt-4 flex max-w-2xl flex-wrap items-start gap-4">
            <div className="min-w-[200px] flex-1">
              <SelectField
                label="Plot stage"
                help="Filter all analysis plots to one stage, or show the whole run."
                value={stageFilter}
                options={stageOptions}
                onChange={setStageFilter}
              />
            </div>
            <div className="mt-6">
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                onClick={() =>
                  downloadAllMetricsCsv(
                    `${job.name}-metrics-${stageFilter}.csv`,
                    plottedMetrics,
                  )
                }
              >
                Export All Metrics
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Step Files</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Produced by {stepName(activeStepKey as StepKey)}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {producedFiles.length}
              </span>
            </div>
            <div className="max-h-96 space-y-2 overflow-auto">
              {producedFiles.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No files have been produced yet.
                </p>
              ) : (
                producedFiles.map((file) => (
                  <button
                    key={`${file.kind}-${file.url}`}
                    type="button"
                    onClick={async () => {
                      setArtifactBusy(true);
                      setSelectedArtifact(file);
                      try {
                        const data = await readArtifact(job.id, file);
                        setArtifactText(data.content);
                      } catch (err) {
                        notify(
                          "error",
                          err instanceof Error
                            ? err.message
                            : "Could not open file",
                        );
                        setArtifactText("");
                      } finally {
                        setArtifactBusy(false);
                      }
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:border-ocean-400 hover:bg-ocean-50 dark:hover:bg-ocean-950 ${
                      selectedArtifact?.url === file.url
                        ? "border-ocean-500 bg-ocean-50 dark:bg-ocean-950"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span className="block truncate font-semibold">
                      {file.name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {file.kind}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">
                  {selectedArtifact ? selectedArtifact.name : "File Preview"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedArtifact
                    ? selectedArtifact.kind
                    : "Select a produced file to inspect or edit it."}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedArtifact && (
                  <a
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    href={selectedArtifact.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                )}
                <button
                  type="button"
                  className="rounded-lg bg-ocean-600 px-3 py-1 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-ocean-700 disabled:opacity-50"
                  disabled={!selectedArtifact || artifactBusy}
                  onClick={async () => {
                    if (!selectedArtifact) return;
                    setArtifactBusy(true);
                    try {
                      await saveArtifact(
                        job.id,
                        selectedArtifact,
                        artifactText,
                      );
                      notify("success", `Saved ${selectedArtifact.name}.`);
                    } catch (err) {
                      notify(
                        "error",
                        err instanceof Error
                          ? err.message
                          : "Could not save file",
                      );
                    } finally {
                      setArtifactBusy(false);
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </div>
            <textarea
              className="h-96 w-full resize-y rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-mint-100 outline-none focus:border-ocean-400 dark:border-slate-800"
              value={artifactText}
              onChange={(event) => setArtifactText(event.target.value)}
              placeholder={
                artifactBusy
                  ? "Loading..."
                  : "Select a file to preview it here."
              }
            />
          </section>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <div className="grid gap-4">
            {chartSeries
              .filter((series) =>
                plottedMetrics.some((metric) =>
                  Number.isFinite(Number(metric[series.key])),
                ),
              )
              .map((series) => (
                <PlotCard
                  key={series.key}
                  jobName={job.name}
                  metrics={plottedMetrics}
                  series={series}
                  stageFilter={stageFilter}
                />
              ))}
            {plottedMetrics.length === 0 && (
              <EmptyState
                title="No plot data yet"
                detail="Plots appear as GROMACS writes energy data during minimization, equilibration, or production."
              />
            )}
            {analysisResults.map((res, i) => (
              <AnalysisPlot key={i} result={res} jobName={job.name || "run"} />
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Molecule View</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {job.upload?.originalName}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  MolStar
                </span>
              </div>
              <div className="h-[360px]">
                <Viewer3D coordinateUrl={job.upload?.url} dark={dark} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Analysis Plugins</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Run native GROMACS analysis tools
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <SelectField
                  label="Select Stage"
                  help="Choose which stage's output to analyze"
                  value={analysisStep}
                  options={analysisAvailableSteps.map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  onChange={setAnalysisStep}
                />
                <SelectField
                  label="Select Tool"
                  help="Choose the tool to run on the selected output"
                  value={analysisTool}
                  options={[
                    {
                      value: "rmsd",
                      label: "RMSD (Root Mean Square Deviation)",
                    },
                    {
                      value: "rmsf",
                      label: "RMSF (Root Mean Square Fluctuation)",
                    },
                    { value: "gyrate", label: "Radius of Gyration" },
                    { value: "sasa", label: "Solvent Accessible Surface Area" },
                    { value: "hbond", label: "Hydrogen Bonds" },
                  ]}
                  onChange={setAnalysisTool}
                />
                <button
                  type="button"
                  className="rounded-lg bg-ocean-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-ocean-700 disabled:opacity-50"
                  disabled={analysisBusy || job.status !== "completed"}
                  onClick={async () => {
                    setAnalysisBusy(true);
                    try {
                      const res = await analyzeSimulation(
                        job.id,
                        analysisTool,
                        analysisStep,
                      );
                      setAnalysisResults((prev) => [...prev, res]);
                      notify("success", `Analysis complete.`);
                    } catch (err) {
                      notify(
                        "error",
                        err instanceof Error ? err.message : "Analysis failed",
                      );
                    } finally {
                      setAnalysisBusy(false);
                    }
                  }}
                >
                  {analysisBusy ? "Running..." : "Run Analysis"}
                </button>
                {job.status !== "completed" && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Analysis can only be run on fully completed simulations.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-semibold">Run Files</h3>
          <div className="space-y-2">
            {[
              ...logFiles,
              ...artifactFiles.map((file) => ({
                name: file.name,
                detail: file.kind,
                href: file.url,
              })),
            ].map((file) => (
              <a
                key={`${file.name}-${file.href}`}
                href={file.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm transition hover:border-ocean-500 hover:bg-ocean-50 dark:border-slate-700 dark:hover:bg-ocean-950"
              >
                <TerminalSquare size={18} className="text-ocean-600" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {file.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {file.detail}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
        <div className="flex min-h-80 flex-1 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 flex-none text-base font-semibold">Log Window</h3>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-5 text-mint-100">
            {logs.length === 0 ? (
              <div>No logs captured for this run yet.</div>
            ) : (
              logs.map((line, index) => (
                <div
                  key={`${line}-${index}`}
                  className={`whitespace-pre-wrap break-words ${
                    line.toLowerCase().includes("failed") ||
                    line.toLowerCase().includes("error details")
                      ? "text-rose-200"
                      : ""
                  }`}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
