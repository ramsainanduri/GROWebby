import { HelpCircle } from "lucide-react";

export function InfoPopover({ title, body }: { title: string; body: string }) {
  return (
    <div className="group relative inline-flex items-center justify-center">
      <HelpCircle size={14} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
      <div className="absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 flex-col rounded bg-slate-800 p-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:flex group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900 z-50">
        <div className="mb-1 font-bold">{title}</div>
        <div>{body}</div>
        <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-800 dark:bg-slate-100"></div>
      </div>
    </div>
  );
}
