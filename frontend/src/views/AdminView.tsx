import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ServerCog,
  TerminalSquare,
  Plus,
  Edit2,
  KeyRound,
  Users,
  Shield,
  Database,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import {
  adminApproveUser,
  adminDeleteUser,
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminResetUserPassword,
  adminListGroups,
  adminCreateGroup,
  adminUpdateGroup,
  adminDeleteGroup,
  adminListAllSimulations,
  deleteSimulation,
  AdminUser,
  AdminGroup,
  SimulationJob,
  SessionState,
} from "../lib/api";
import { MetricCard } from "../components/ui";
import { formatDuration } from "../lib/utils";

export function AdminView({ session }: { session: SessionState }) {
  const [activeTab, setActiveTab] = useState<
    "users" | "groups" | "simulations"
  >("users");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [simulations, setSimulations] = useState<SimulationJob[]>([]);

  const [loading, setLoading] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [working, setWorking] = useState<number | string | null>(null);

  const isAdmin = session.user?.isStaff || session.user?.isSuperuser;

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<
    "create_user" | "edit_user" | "password" | "create_group" | "edit_group"
  >("create_user");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null);

  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formGroups, setFormGroups] = useState<string[]>([]);

  const [formGroupName, setFormGroupName] = useState("");

  const [modalError, setModalError] = useState("");

  async function loadData() {
    setLoading(true);
    setAdminError("");
    try {
      if (activeTab === "users") {
        setUsers(await adminListUsers());
        setGroups(await adminListGroups());
      } else if (activeTab === "groups") {
        setGroups(await adminListGroups());
      } else if (activeTab === "simulations") {
        setSimulations(await adminListAllSimulations());
      }
    } catch (err: any) {
      setAdminError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, activeTab]);

  // --- User Actions ---
  async function handleApprove(userId: number) {
    setWorking(userId);
    try {
      await adminApproveUser(userId);
      await loadData();
    } catch {
      setAdminError("Approve failed.");
    } finally {
      setWorking(null);
    }
  }

  async function handleDeleteUser(userId: number) {
    if (!window.confirm("Delete this user account permanently?")) return;
    setWorking(userId);
    try {
      await adminDeleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setAdminError("Delete failed.");
    } finally {
      setWorking(null);
    }
  }

  function openCreateUserModal() {
    setModalMode("create_user");
    setEditingUser(null);
    setFormUsername("");
    setFormEmail("");
    setFormPassword("");
    setFormIsAdmin(false);
    setFormIsActive(true);
    setFormGroups(["user"]);
    setModalError("");
    setShowModal(true);
  }

  function openEditUserModal(user: AdminUser) {
    setModalMode("edit_user");
    setEditingUser(user);
    setFormUsername(user.username);
    setFormEmail(user.email);
    setFormPassword("");
    setFormIsAdmin(user.isSuperuser || user.isStaff);
    setFormIsActive(user.isActive);
    setFormGroups(user.groups || []);
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

  // --- Group Actions ---
  function openCreateGroupModal() {
    setModalMode("create_group");
    setEditingGroup(null);
    setFormGroupName("");
    setModalError("");
    setShowModal(true);
  }

  function openEditGroupModal(group: AdminGroup) {
    setModalMode("edit_group");
    setEditingGroup(group);
    setFormGroupName(group.name);
    setModalError("");
    setShowModal(true);
  }

  async function handleDeleteGroup(groupId: number) {
    if (!window.confirm("Delete this group?")) return;
    setWorking(`g-${groupId}`);
    try {
      await adminDeleteGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err: any) {
      setAdminError(err.message || "Delete group failed.");
    } finally {
      setWorking(null);
    }
  }

  // --- Simulation Actions ---
  async function handleDeleteSimulation(jobId: number) {
    if (
      !window.confirm(
        "Permanently delete this simulation run and all its data?",
      )
    )
      return;
    setWorking(`s-${jobId}`);
    try {
      await deleteSimulation(jobId);
      setSimulations((prev) =>
        prev.filter((s) => s.id !== jobId && s.runGroupId !== jobId),
      );
    } catch (err: any) {
      setAdminError(err.message || "Delete simulation failed.");
    } finally {
      setWorking(null);
    }
  }

  // --- Modal Submit ---
  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    setWorking(-1);
    try {
      if (modalMode === "create_user") {
        await adminCreateUser({
          username: formUsername,
          email: formEmail,
          password: formPassword,
          isAdmin: formIsAdmin,
          isActive: formIsActive,
          groups: formGroups,
        });
      } else if (modalMode === "edit_user" && editingUser) {
        await adminUpdateUser(editingUser.id, {
          email: formEmail,
          isAdmin: formIsAdmin,
          isActive: formIsActive,
          groups: formGroups,
        });
      } else if (modalMode === "password" && editingUser) {
        await adminResetUserPassword(editingUser.id, {
          password: formPassword,
        });
      } else if (modalMode === "create_group") {
        await adminCreateGroup(formGroupName);
      } else if (modalMode === "edit_group" && editingGroup) {
        await adminUpdateGroup(editingGroup.id, formGroupName);
      }

      await loadData();
      setShowModal(false);
    } catch (err: any) {
      setModalError(err.message || "Operation failed.");
    } finally {
      setWorking(null);
    }
  }

  const toggleFormGroup = (name: string) => {
    setFormGroups((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name],
    );
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="mx-auto mb-3 text-slate-400" size={40} />
          <h3 className="text-lg font-semibold">Admin Access Required</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This page is only accessible to staff and superusers.
          </p>
        </div>
      </div>
    );
  }

  const pending = users.filter((u) => !u.isActive && u.purpose);
  const allOtherUsers = users.filter((u) => u.isActive || !u.purpose);

  return (
    <div className="grid gap-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 px-2 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "users"
              ? "border-ocean-600 text-ocean-600 dark:text-ocean-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Users size={16} /> Users Management
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "groups"
              ? "border-ocean-600 text-ocean-600 dark:text-ocean-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Shield size={16} /> Groups
        </button>
        <button
          onClick={() => setActiveTab("simulations")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "simulations"
              ? "border-ocean-600 text-ocean-600 dark:text-ocean-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Database size={16} /> System Simulations
        </button>
      </div>

      {adminError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {adminError}
        </p>
      )}

      {activeTab === "users" && (
        <div className="grid gap-6">
          {pending.length > 0 && (
            <section className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 border-b border-amber-200 px-5 py-3 dark:border-amber-900">
                <Clock3
                  size={16}
                  className="text-amber-600 dark:text-amber-400"
                />
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                  Pending Approval ({pending.length})
                </h3>
              </div>
              <div className="divide-y divide-amber-100 dark:divide-amber-900">
                {pending.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{user.username}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {user.email}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        <span className="font-medium">Purpose: </span>
                        {user.purpose}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Registered{" "}
                        {new Date(user.dateJoined).toLocaleDateString()}
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
                        onClick={() => handleDeleteUser(user.id)}
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

          <section className="rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users
                  size={16}
                  className="text-ocean-600 dark:text-ocean-400"
                />
                <h3 className="font-semibold">
                  All Users ({allOtherUsers.length})
                </h3>
              </div>
              <button
                onClick={openCreateUserModal}
                className="flex items-center gap-1.5 rounded-lg bg-ocean-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-ocean-700"
              >
                <Plus size={14} /> Add New User
              </button>
            </div>
            {loading ? (
              <p className="p-5 text-sm text-slate-400">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                      <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                        Username
                      </th>
                      <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                        Status
                      </th>
                      <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                        Groups
                      </th>
                      <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {allOtherUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium">{user.username}</div>
                          <div className="text-xs text-slate-500">
                            {user.email}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {!user.isActive ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              Inactive
                            </span>
                          ) : user.isSuperuser ? (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                              Superuser
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.groups?.map((g) => (
                              <span
                                key={g}
                                className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openEditUserModal(user)}
                              className="text-ocean-600 hover:underline dark:text-ocean-400"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openPasswordModal(user)}
                              className="text-amber-600 hover:underline dark:text-amber-400"
                            >
                              Reset
                            </button>
                            {!user.isSuperuser && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-rose-600 hover:underline dark:text-rose-400"
                              >
                                Delete
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
        </div>
      )}

      {activeTab === "groups" && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Shield
                size={16}
                className="text-purple-600 dark:text-purple-400"
              />
              <h3 className="font-semibold">Groups ({groups.length})</h3>
            </div>
            <button
              onClick={openCreateGroupModal}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              <Plus size={14} /> Create Group
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                    Name
                  </th>
                  <th className="px-5 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {groups.map((group) => (
                  <tr
                    key={group.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-3 font-medium">{group.name}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEditGroupModal(group)}
                          className="text-ocean-600 hover:underline dark:text-ocean-400"
                        >
                          Rename
                        </button>
                        {!["admin", "user"].includes(group.name) && (
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="text-rose-600 hover:underline dark:text-rose-400"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "simulations" && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Database
                size={16}
                className="text-slate-600 dark:text-slate-400"
              />
              <h3 className="font-semibold">
                Global System Simulations ({simulations.length})
              </h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                    Job ID
                  </th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                    Name
                  </th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                    Owner
                  </th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                    Status
                  </th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                    Step
                  </th>
                  <th className="px-5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                    Duration
                  </th>
                  <th className="px-5 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {simulations.map((sim) => (
                  <tr
                    key={sim.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-3 text-slate-500">{sim.id}</td>
                    <td className="px-5 py-3 font-medium">{sim.name}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                      {(sim as any).owner || "Anonymous"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize
                        ${
                          sim.status === "completed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : sim.status === "failed"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                              : sim.status === "cancelled"
                                ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400"
                                : "bg-ocean-100 text-ocean-800 dark:bg-ocean-900/30 dark:text-ocean-400"
                        }`}
                      >
                        {sim.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                      {sim.currentStep || "-"}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {sim.startedAt
                        ? formatDuration(
                            (sim.finishedAt
                              ? new Date(sim.finishedAt).getTime()
                              : Date.now()) - new Date(sim.startedAt).getTime(),
                          )
                        : "-"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDeleteSimulation(sim.id)}
                        className="text-rose-600 hover:underline dark:text-rose-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Shared Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="text-xl font-bold">
                {modalMode === "create_user" && "Add New User"}
                {modalMode === "edit_user" && "Edit User"}
                {modalMode === "password" && "Reset Password"}
                {modalMode === "create_group" && "Create Group"}
                {modalMode === "edit_group" && "Edit Group"}
              </h2>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
              {modalError && (
                <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                  {modalError}
                </p>
              )}

              <form
                id="adminForm"
                onSubmit={handleModalSubmit}
                className="flex flex-col gap-4"
              >
                {modalMode === "create_group" || modalMode === "edit_group" ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Group Name
                    </label>
                    <input
                      required
                      type="text"
                      value={formGroupName}
                      onChange={(e) => setFormGroupName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700"
                    />
                  </div>
                ) : (
                  <>
                    {modalMode === "create_user" && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">
                          Username
                        </label>
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
                        <label className="mb-1.5 block text-sm font-medium">
                          Email
                        </label>
                        <input
                          required
                          type="email"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700"
                        />
                      </div>
                    )}
                    {modalMode !== "edit_user" && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">
                          Password
                        </label>
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
                      <>
                        <div className="my-2 border-t border-slate-100 dark:border-slate-800"></div>
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={formIsActive}
                            onChange={(e) => setFormIsActive(e.target.checked)}
                            className="h-4 w-4 rounded"
                          />
                          User is Active (Can log in)
                        </label>
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={formIsAdmin}
                            onChange={(e) => setFormIsAdmin(e.target.checked)}
                            className="h-4 w-4 rounded"
                          />
                          Is Admin (Superuser)
                        </label>

                        <div className="mt-2">
                          <label className="mb-1.5 block text-sm font-medium">
                            Assign Groups
                          </label>
                          <div className="flex max-h-32 flex-col gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
                            {groups.length === 0 ? (
                              <p className="text-xs text-slate-500">
                                No groups available.
                              </p>
                            ) : (
                              groups.map((g) => (
                                <label
                                  key={g.id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={formGroups.includes(g.name)}
                                    onChange={() => toggleFormGroup(g.name)}
                                    className="h-3.5 w-3.5 rounded"
                                  />
                                  {g.name}
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </form>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="adminForm"
                disabled={working === -1}
                className="rounded-lg bg-ocean-600 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-700 disabled:opacity-50"
              >
                {working === -1 ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
