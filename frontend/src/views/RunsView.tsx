import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { SimulationJob } from "../lib/api";
import { ViewKey } from "../types";
import { formatRunTime, groupRuns, statusClass, stepName, runStepKey } from "../lib/utils";

interface RunsProps {
  job: SimulationJob | null;
  runs: SimulationJob[];
  removeRun: (runId: number) => void;
  selectRun: (runId: number, view?: ViewKey) => void;
}

export function RunsView({ job, runs, removeRun, selectRun }: RunsProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
  const groups = groupRuns(runs);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-[90px_1.1fr_1fr_130px_110px_100px_170px_110px] border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>Run</span>
        <span>Name</span>
        <span>Input</span>
        <span>Status</span>
        <span>Progress</span>
        <span>Steps</span>
        <span>Created</span>
        <span>Actions</span>
      </div>
      <div className="max-h-[calc(100vh-150px)] overflow-auto">
        {groups.map((group) => {
          const expanded = Boolean(expandedGroups[group.id]);
          const focused = group.steps.some((run) => run.id === job?.id);
          return (
            <div key={group.id} className={`border-b border-slate-100 dark:border-slate-800 ${focused ? "bg-ocean-50/70 dark:bg-ocean-950/60" : ""}`}>
              <div className="grid grid-cols-[90px_1.1fr_1fr_130px_110px_100px_170px_110px] items-center gap-3 px-4 py-3 text-sm">
                <button type="button" className="flex items-center gap-2 text-left font-semibold" onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !expanded }))}>
                  <ChevronRight size={16} className={`transition ${expanded ? "rotate-90" : ""}`} />
                  #{group.id}
                </button>
                <button type="button" onClick={() => selectRun(group.latest.id, "results")} className="truncate text-left font-medium hover:text-ocean-700 dark:hover:text-ocean-200">{group.name}</button>
                <span className="truncate">{group.input}</span>
                <span><span className={statusClass(group.status)}>{group.status}</span></span>
                <span>{group.progress}%</span>
                <span>{group.steps.length}</span>
                <span className="text-slate-500 dark:text-slate-400">{formatRunTime(group.createdAt)}</span>
                <span className="flex gap-1">
                  <button type="button" className="rounded-md px-2 py-1 text-xs font-semibold text-ocean-700 hover:bg-ocean-50 dark:text-ocean-200 dark:hover:bg-ocean-950" onClick={() => selectRun(group.latest.id, "results")}>Open</button>
                  <button type="button" className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={() => removeRun(group.latest.id)}>Delete</button>
                </span>
              </div>
              {expanded && (
                <div className="mx-4 mb-3 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                  <div className="grid grid-cols-[90px_150px_130px_110px_1fr_170px] gap-3 border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <span>Job</span>
                    <span>Step</span>
                    <span>Status</span>
                    <span>Progress</span>
                    <span>Current State</span>
                    <span>Created</span>
                  </div>
                  {group.steps.map((run) => (
                    <button key={run.id} type="button" onClick={() => selectRun(run.id, "results")} className={`grid w-full grid-cols-[90px_150px_130px_110px_1fr_170px] items-center gap-3 px-3 py-2 text-left text-sm hover:bg-white dark:hover:bg-slate-900 ${job?.id === run.id ? "bg-white dark:bg-slate-900" : ""}`}>
                      <span className="font-semibold">#{run.id}</span>
                      <span>{stepName(runStepKey(run))}</span>
                      <span><span className={statusClass(run.status)}>{run.status}</span></span>
                      <span>{run.progress}%</span>
                      <span className="truncate">{run.currentStep}</span>
                      <span className="text-slate-500 dark:text-slate-400">{formatRunTime(run.createdAt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
