import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export function NotificationStack({ notifications, dismiss }: { notifications: { id: number; tone: "success" | "error" | "info"; message: string }[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-[calc(100vw-3rem)] sm:max-w-sm pointer-events-none">
      {notifications.map(n => (
        <div 
          key={n.id} 
          className="pointer-events-auto flex items-start gap-3 w-full rounded-xl bg-white p-3.5 shadow-xl ring-1 ring-slate-900/5 transition-all hover:-translate-y-0.5 dark:bg-slate-900 dark:ring-white/10"
        >
          <div className="mt-0.5 shrink-0">
            {n.tone === "success" ? <CheckCircle2 size={18} className="text-emerald-500" /> : 
             n.tone === "error" ? <AlertCircle size={18} className="text-rose-500" /> : 
             <Info size={18} className="text-ocean-500" />}
          </div>
          <div className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
            {n.message}
          </div>
          <button 
            onClick={() => dismiss(n.id)}
            className="mt-0.5 shrink-0 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
