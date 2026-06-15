import { useEffect, useState } from "react";
import { Activity, Atom, Boxes, Database, FlaskConical, LayoutDashboard, Network, PlayCircle, ServerCog, Sparkles, TerminalSquare, Zap } from "lucide-react";

export function AboutView() {
  const [versionInfo, setVersionInfo] = useState<{ version: string; buildDate: string; tools: Record<string, string> } | null>(null);

  useEffect(() => {
    fetch("/api/health/versions/")
      .then(r => r.json())
      .then(liveRes => {
        setVersionInfo({
          version: "1.0.0",
          buildDate: new Date().toISOString().split('T')[0],
          tools: {
            ...__LIVE_FRONTEND_VERSIONS__,
            ...liveRes.tools
          }
        });
      })
      .catch(() => {
        setVersionInfo({
          version: "1.0.0",
          buildDate: new Date().toISOString().split('T')[0],
          tools: __LIVE_FRONTEND_VERSIONS__
        });
      });
  }, []);

  const iconMap: Record<string, { icon: typeof FlaskConical; color: string; label: string }> = {
    gromacs: { label: "GROMACS", icon: FlaskConical, color: "text-ocean-600 dark:text-ocean-400" },
    gmxapi: { label: "gmxapi", icon: Network, color: "text-cyan-600 dark:text-cyan-400" },
    cuda: { label: "CUDA", icon: Zap, color: "text-green-600 dark:text-green-400" },
    ubuntuBase: { label: "Ubuntu base", icon: ServerCog, color: "text-orange-600 dark:text-orange-400" },
    python: { label: "Python", icon: TerminalSquare, color: "text-emerald-600 dark:text-emerald-400" },
    django: { label: "Django", icon: Database, color: "text-amber-600 dark:text-amber-400" },
    react: { label: "React", icon: Sparkles, color: "text-cyan-600 dark:text-cyan-400" },
    vite: { label: "Vite", icon: PlayCircle, color: "text-purple-600 dark:text-purple-400" },
    nodeJs: { label: "Node.js", icon: Activity, color: "text-lime-600 dark:text-lime-400" },
    npm: { label: "npm", icon: Boxes, color: "text-red-600 dark:text-red-400" },
    molstar: { label: "MolStar", icon: FlaskConical, color: "text-indigo-600 dark:text-indigo-400" },
    docker: { label: "Docker", icon: LayoutDashboard, color: "text-blue-600 dark:text-blue-400" },
  };

  const toolRows = versionInfo
    ? Object.entries(versionInfo.tools).map(([key, version]) => {
        const mapping = iconMap[key];
        return {
          key,
          label: mapping ? mapping.label : key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
          version,
          icon: mapping ? mapping.icon : Sparkles,
          color: mapping ? mapping.color : "text-slate-600 dark:text-slate-400",
        };
      })
    : [];

  return (
    <div className="grid max-w-3xl gap-6">
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
          through a Django and React interface. Each user gets a private workspace with isolated files,
          simulation runs, and results.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
          <span className="block font-semibold text-slate-900 dark:text-slate-100">Developer</span>
          <a className="mt-1 inline-flex text-ocean-700 hover:underline dark:text-ocean-300" href="https://github.com/ramsainanduri" target="_blank" rel="noreferrer">
            Ram Sai Nanduri (@ramsainanduri)
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h3 className="font-semibold">Component Versions</h3>
        </div>
        {!versionInfo ? (
          <p className="p-5 text-sm text-slate-400">Loading version information…</p>
        ) : (
          <div className="grid divide-y divide-slate-100 dark:border-slate-800 dark:divide-slate-800 sm:grid-cols-2 sm:divide-y-0">
            {toolRows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.key} className="flex items-center gap-3 px-5 py-3.5 odd:sm:border-r odd:sm:border-slate-100 dark:odd:sm:border-slate-800">
                  <Icon size={18} className={row.color} />
                  <span className="flex-1 text-sm font-medium">{row.label}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{row.version}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
