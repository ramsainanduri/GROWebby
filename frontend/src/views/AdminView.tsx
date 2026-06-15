import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ServerCog, TerminalSquare } from "lucide-react";
import { adminApproveUser, adminDenyUser, adminListUsers, AdminUser, SessionState } from "../lib/api";
import { MetricCard } from "../components/ui";

export function AdminView({ session }: { session: SessionState }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [working, setWorking] = useState<number | null>(null);

  const isAdmin = session.user?.isStaff || session.user?.isSuperuser;

  useEffect(() => {
    if (!isAdmin) return;
    adminListUsers()
      .then(setUsers)
      .catch(() => setAdminError("Could not load users."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  async function handleApprove(userId: number) {
    setWorking(userId);
    try {
      await adminApproveUser(userId);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: true } : u));
    } catch {
      setAdminError("Approve failed.");
    } finally {
      setWorking(null);
    }
  }

  async function handleDeny(userId: number) {
    if (!confirm("Delete this user account permanently?")) return;
    setWorking(userId);
    try {
      await adminDenyUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setAdminError("Deny failed.");
    } finally {
      setWorking(null);
    }
  }

  const pending = users.filter((u) => !u.isActive);
  const active = users.filter((u) => u.isActive);

  if (!isAdmin) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <ServerCog className="mx-auto mb-3 text-slate-400" size={40} />
          <h3 className="text-lg font-semibold">Admin Access Required</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This page is only accessible to staff and superusers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Users" value={users.length} icon={ServerCog} />
        <MetricCard label="Active" value={active.length} icon={CheckCircle2} />
        <MetricCard label="Pending Approval" value={pending.length} icon={Clock3} />
      </div>

      {adminError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{adminError}</p>}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 border-b border-amber-200 px-5 py-3 dark:border-amber-900">
            <Clock3 size={16} className="text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">Pending Approval ({pending.length})</h3>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-900">
            {pending.map((user) => (
              <div key={user.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{user.username}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{user.email}</span>
                  </div>
                  {user.purpose && (
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-medium">Purpose: </span>{user.purpose}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400">
                    Registered {new Date(user.dateJoined).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={working === user.id}
                    onClick={() => handleApprove(user.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={working === user.id}
                    onClick={() => handleDeny(user.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950 disabled:opacity-50"
                  >
                    <TerminalSquare size={14} /> Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active users table */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold">Active Users ({active.length})</h3>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-slate-400">Loading…</p>
        ) : active.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No active users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">User</th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">Email</th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">Role</th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">Joined</th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {active.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3 font-medium">{user.username}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{user.email}</td>
                    <td className="px-5 py-3">
                      {user.isSuperuser ? (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">Superuser</span>
                      ) : user.isStaff ? (
                        <span className="rounded-full bg-ocean-100 px-2 py-0.5 text-xs font-semibold text-ocean-700 dark:bg-ocean-950 dark:text-ocean-300">Staff</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">User</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{new Date(user.dateJoined).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      {!user.isSuperuser && (
                        <button
                          type="button"
                          disabled={working === user.id}
                          onClick={() => handleDeny(user.id)}
                          className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
