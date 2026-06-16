import { CheckCircle2, AlertCircle, Info } from "lucide-react";

export function NotificationStack({ notifications, dismiss }: { notifications: { id: number; tone: "success" | "error" | "info"; message: string }[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-md">
      {notifications.map(n => (
        <div key={n.id} onClick={() => dismiss(n.id)} className={`flex cursor-pointer items-start gap-3 w-full rounded-lg border p-4 shadow-lg transition-all hover:scale-[1.02] ${n.tone === "error" ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200" : n.tone === "success" ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-200" : "border-ocean-200 bg-ocean-50 text-ocean-900 dark:border-ocean-900/50 dark:bg-ocean-900/20 dark:text-ocean-200"}`}>
          <div className="mt-0.5 shrink-0">
            {n.tone === "success" ? <CheckCircle2 size={20} /> : n.tone === "error" ? <AlertCircle size={20} /> : <Info size={20} />}
          </div>
          <div className="text-sm font-medium whitespace-pre-wrap break-words overflow-hidden">{n.message}</div>
        </div>
      ))}
    </div>
  );
}
