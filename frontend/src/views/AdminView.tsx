import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ServerCog, TerminalSquare, Plus, Edit2, KeyRound } from "lucide-react";
import { adminApproveUser, adminDenyUser, adminListUsers, adminCreateUser, adminUpdateUser, adminResetUserPassword, AdminUser, SessionState } from "../lib/api";
import { MetricCard } from "../components/ui";

export function AdminView({ session }: { session: SessionState }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [working, setWorking] = useState<number | null>(null);

  const isAdmin = session.user?.isStaff || session.user?.isSuperuser;

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "password">("create");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [modalError, setModalError] = useState("");

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
    if (!window.confirm("Delete this user account permanently?")) return;
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

  function openCreateModal() {
    setModalMode("create");
    setEditingUser(null);
    setFormUsername("");
    setFormEmail("");
    setFormPassword("");
    setFormIsAdmin(false);
    setModalError("");
    setShowModal(true);
  }

  function openEditModal(user: AdminUser) {
    setModalMode("edit");
    setEditingUser(user);
    setFormUsername(user.username);
    setFormEmail(user.email);
    setFormPassword("");
    setFormIsAdmin(user.isSuperuser || user.isStaff);
    setModalError("");
    setShowModal(true);
  }

  function openPasswordModal(user: AdminUser) {
    setModalMode("password");
    setEditingUser(user);
    setFormPassword("");
    setModalError("");
    setShowModal(true);
  }

  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    setWorking(-1);
    try {
      if (modalMode === "create") {
        await adminCreateUser({ username: formUsername, email: formEmail, password: formPassword, isAdmin: formIsAdmin });
      } else if (modalMode === "edit" && editingUser) {
        await adminUpdateUser(editingUser.id, { email: formEmail, isAdmin: formIsAdmin });
      } else if (modalMode === "password" && editingUser) {
        await adminResetUserPassword(editingUser.id, { password: formPassword });
      }
      
      const updatedUsers = await adminListUsers();
      setUsers(updatedUsers);
      setShowModal(false);
    } catch (err: any) {
      setModalError(err.message || "Operation failed.");
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
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold">Active Users ({active.length})</h3>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-ocean-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-ocean-700"
          >
            <Plus size={14} /> Add New User
          </button>
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
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={working !== null}
                          onClick={() => openEditModal(user)}
                          className="flex items-center gap-1 text-xs font-medium text-ocean-600 hover:underline dark:text-ocean-400 disabled:opacity-50"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={working !== null}
                          onClick={() => openPasswordModal(user)}
                          className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline dark:text-amber-400 disabled:opacity-50"
                        >
                          <KeyRound size={12} /> Reset
                        </button>
                        {!user.isSuperuser && (
                          <button
                            type="button"
                            disabled={working !== null}
                            onClick={() => handleDeny(user.id)}
                            className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-xl font-bold">
              {modalMode === "create" && "Add New User"}
              {modalMode === "edit" && "Edit User"}
              {modalMode === "password" && "Reset Password"}
            </h2>
            {modalError && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{modalError}</p>}
            <form onSubmit={handleModalSubmit} className="flex flex-col gap-4">
              {modalMode === "create" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Username</label>
                  <input
                    required
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700"
                  />
                </div>
              )}
              {modalMode !== "password" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Email</label>
                  <input
                    required
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700"
                  />
                </div>
              )}
              {modalMode !== "edit" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Password</label>
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700"
                  />
                </div>
              )}
              {modalMode !== "password" && (
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={formIsAdmin}
                    onChange={(e) => setFormIsAdmin(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-ocean-600 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  Is Admin (Superuser)
                </label>
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={working === -1}
                  className="rounded-lg bg-ocean-600 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-700 disabled:opacity-50"
                >
                  {working === -1 ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
