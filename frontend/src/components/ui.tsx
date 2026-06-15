import { Activity, Database } from "lucide-react";

export function MetricCard({ label, value, icon: Icon = Activity }: { label: string; value: string | number; icon?: any }) {
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

export function StatusDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
      <div className="truncate text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
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
