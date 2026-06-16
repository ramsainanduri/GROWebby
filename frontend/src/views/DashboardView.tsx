import {
  Activity,
  Database,
  FlaskConical,
  Play,
  UploadCloud,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SimulationJob } from "../lib/api";
import { MetricCard } from "../components/ui";

export function DashboardView({
  busy,
  completedRuns,
  createExample,
  failedRuns,
  job,
  runningRuns,
  uploadsCount,
}: {
  busy: boolean;
  completedRuns: number;
  createExample: (exampleKey: "lysozyme" | "small-molecule") => void;
  failedRuns: number;
  job: SimulationJob | null;
  runningRuns: number;
  uploadsCount: number;
}) {
  return (
    <div className="flex h-full min-h-[640px] flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Running Now" value={runningRuns} icon={Activity} />
        <MetricCard label="Completed" value={completedRuns} icon={Database} />
        <MetricCard label="Failed" value={failedRuns} icon={Activity} />
        <MetricCard
          label="Stored Files"
          value={uploadsCount}
          icon={UploadCloud}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-semibold">Active Run Focus</h3>
          {job ? (
            <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
              <h4 className="font-semibold text-ocean-700 dark:text-ocean-400">
                {job.name}
              </h4>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Step: {job.currentStep}
              </p>
              <div className="mb-2 h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-4 rounded-full bg-ocean-500 transition-all duration-1000"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>{job.progress}% complete</span>
                <span className="uppercase">{job.status}</span>
              </div>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-950">
              <Activity className="mb-2 text-slate-400" size={32} />
              <p className="font-medium text-slate-500">
                No active run selected.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-semibold">Quick Start</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => createExample("lysozyme")}
              disabled={busy}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center transition hover:border-ocean-300 hover:bg-ocean-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-ocean-800 dark:hover:bg-ocean-950/50 disabled:opacity-50"
            >
              <FlaskConical
                className="text-ocean-600 dark:text-ocean-400"
                size={32}
              />
              <span className="font-semibold">Lysozyme in Water</span>
              <span className="text-xs text-slate-500">
                Standard OPLS-AA tutorial
              </span>
            </button>
            <button
              type="button"
              onClick={() => createExample("small-molecule")}
              disabled={busy}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center transition hover:border-ocean-300 hover:bg-ocean-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-ocean-800 dark:hover:bg-ocean-950/50 disabled:opacity-50"
            >
              <Activity
                className="text-ocean-600 dark:text-ocean-400"
                size={32}
              />
              <span className="font-semibold">Small Molecule</span>
              <span className="text-xs text-slate-500">
                Ligand with generated topology
              </span>
            </button>
            <Link
              to="/files"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center transition hover:border-ocean-300 hover:bg-ocean-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-ocean-800 dark:hover:bg-ocean-950/50 disabled:opacity-50"
            >
              <UploadCloud
                className="text-ocean-600 dark:text-ocean-400"
                size={32}
              />
              <span className="font-semibold">Custom Upload</span>
              <span className="text-xs text-slate-500">
                Upload your own .gro or .pdb
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
