import { Atom } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

export function LoadingScreen({ dark, setDark }: { dark: boolean; setDark: (dark: boolean) => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute right-5 top-5">
        <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
      </div>
      <div className="text-center">
        <img src="/logo.svg" alt="GROWebby Logo" className="mx-auto mb-4 h-12 w-12 animate-pulse object-contain" />
        <div className="text-lg font-semibold">Opening GROWebby</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Checking your session</div>
      </div>
    </main>
  );
}
