import { Moon, Sun } from "lucide-react";

type Props = {
  dark: boolean;
  onToggle: () => void;
};

export function ThemeToggle({ dark, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-ocean-500 hover:text-ocean-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 2xl:h-10 2xl:w-10"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Sun size="1.12em" /> : <Moon size="1.12em" />}
    </button>
  );
}
