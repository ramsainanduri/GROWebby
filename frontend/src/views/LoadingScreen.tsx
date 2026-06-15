import { Atom } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

export function LoadingScreen({ dark, setDark }: { dark: boolean; setDark: (dark: boolean) => void }) {
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
