import { useEffect, useState } from "react";
import { Atom } from "lucide-react";

export function AboutView() {
  const [version, setVersion] = useState({ version: "0.0.0", stack: [] as { name: string; version: string }[] });
  useEffect(() => {
    fetch("/version.json")
      .then(r => r.json())
      .then(setVersion)
      .catch(() => {});
  }, []);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-ocean-500 to-ocean-700 text-white shadow-lg">
            <Atom size={36} />
          </div>
        </div>
        <h1 className="text-center text-3xl font-bold">GROWebby</h1>
        <p className="mt-2 text-center text-slate-500 dark:text-slate-400">A modern web interface for GROMACS molecular dynamics</p>

        <div className="mt-8 rounded-lg bg-slate-50 p-6 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <span className="font-medium">Version</span>
            <span className="rounded bg-ocean-100 px-2 py-1 text-sm font-semibold text-ocean-700 dark:bg-ocean-900/30 dark:text-ocean-400">v{version.version}</span>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">Technology Stack</h3>
            {version.stack.map(tech => (
              <div key={tech.name} className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{tech.name}</span>
                <span className="font-mono text-slate-500 dark:text-slate-400">{tech.version}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
