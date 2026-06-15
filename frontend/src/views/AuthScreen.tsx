import { useEffect, useState } from "react";
import { CheckCircle2, Database, GitBranch, BarChart3, Network, Sparkles } from "lucide-react";
import { SessionState, loginUser, registerUser } from "../lib/api";
import { ThemeToggle } from "../components/ThemeToggle";

export function AuthScreen({ dark, setDark, setSession, onAuthenticated }: { dark: boolean; setDark: (dark: boolean) => void; setSession: (session: SessionState) => void; onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [purpose, setPurpose] = useState("");
  const [authError, setAuthError] = useState("");
  const [registered, setRegistered] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{ version: string } | null>(null);
  const isRegister = mode === "register";

  useEffect(() => {
    fetch("/version.json")
      .then((response) => response.json())
      .then(setVersionInfo)
      .catch(() => undefined);
  }, []);

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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-ocean-400/30">
            <img src="/logo.svg" alt="GROWebby Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">GROWebby {versionInfo ? <span className="text-sm font-medium text-slate-400">v{versionInfo.version}</span> : null}</h1>
            <p className="text-xs text-slate-400">Molecular Dynamics Console</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <h2 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Run molecular dynamics from your browser.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Configure every stage of your GROMACS pipeline, monitor live metrics, and download results - all in one place.
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-1">
                <img src="/logo.svg" alt="GROWebby Logo" className="h-full w-full object-contain" />
              </div>
              <span className="font-bold">GROWebby {versionInfo ? <span className="text-xs font-medium text-slate-500">v{versionInfo.version}</span> : null}</span>
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
              <img src="/logo.svg" alt="GROWebby Logo" className="mx-auto mb-6 h-14 w-14 object-contain" />
-             <p className="font-semibold text-emerald-800 dark:text-emerald-200">Registration submitted!</p>
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
                className="rounded-lg bg-ocean-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-ocean-700 disabled:opacity-50 h-11 w-full"
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
