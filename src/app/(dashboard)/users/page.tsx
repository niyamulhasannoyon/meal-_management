"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { Users, Shield, UserCheck, UserX, Trash2, UserPlus, Edit2, ExternalLink, Clock, Eye, UserCheck2, Utensils, Home, ShieldAlert, Sparkles } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import toast from "react-hot-toast";
import { sortUsers } from "@/lib/utils";
import Avatar from "@/components/layout/Avatar";
import MemberProfilePanel from "@/components/profile/MemberProfilePanel";

import { motion, AnimatePresence } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { y: 10, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Tab State: 'meals' | 'rent' | 'all'
  const [activeTab, setActiveTab] = useState<"meals" | "rent" | "all">("meals");

  // Add Member State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"member" | "visitor" | "moderator" | "admin">("member");
  const [newIsPermanent, setNewIsPermanent] = useState(true);

  // Edit Member State
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Profile Panel State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Real-time listener for users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        usersData.push({ id: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      setUsers(sortUsers(usersData));
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to users:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleApproveVisitor = async (userId: string, targetRole: "visitor" | "member" | "moderator" | "admin" = "visitor") => {
    if (profile?.role !== "admin" && profile?.role !== "moderator") {
      return toast.error("Only admins or moderators can approve users");
    }
    setUpdating(userId);
    try {
      const userToApprove = users.find(u => u.id === userId);
      await updateDoc(doc(db, "users", userId), { role: targetRole });
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "APPROVED_MEMBER",
        `Approved ${userToApprove?.name || "Unknown"} as ${targetRole}`
      );
      
      toast.success(`${userToApprove?.name || "User"} set to ${targetRole.toUpperCase()}!`);
    } catch (error) {
      console.error("Error approving user:", error);
      toast.error("Failed to approve user");
    } finally {
      setUpdating(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (profile?.role !== "admin") return toast.error("Only admins can change roles");
    setUpdating(userId);
    try {
      const userToUpdate = users.find(u => u.id === userId);
      await updateDoc(doc(db, "users", userId), { role: newRole });
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "UPDATED_ROLE",
        `Changed role of ${userToUpdate?.name || "Unknown"} to ${newRole}`
      );
      
      toast.success(`Role updated to ${newRole}`);
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  const handleTogglePermanent = async (userId: string, currentStatus: boolean) => {
    if (profile?.role !== "admin" && profile?.role !== "moderator") return;
    setUpdating(userId);
    try {
      const userToUpdate = users.find(u => u.id === userId);
      const newStatus = !currentStatus;
      await updateDoc(doc(db, "users", userId), { isPermanent: newStatus });
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "TOGGLED_PERMANENT",
        `Changed permanent status of ${userToUpdate?.name || "Unknown"} to ${newStatus ? "Yes" : "No"}`
      );
      
      toast.success(newStatus ? "Added to Rent Members List" : "Removed from Rent Members List");
    } catch (error) {
      console.error("Error toggling permanent status:", error);
      toast.error("Failed to toggle permanent status");
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (profile?.role !== "admin" && profile?.role !== "moderator") return;
    if (!confirm("Are you sure you want to delete/reject this account?")) return;
    
    setUpdating(userId);
    try {
      const userToDelete = users.find(u => u.id === userId);
      await deleteDoc(doc(db, "users", userId));
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "DELETED_USER",
        `Deleted member: ${userToDelete?.name || "Unknown"}`
      );
      
      toast.success("Account deleted successfully!");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user.");
    } finally {
      setUpdating(null);
    }
  };

  const handleEditUser = async (userId: string) => {
    if (profile?.role !== "admin") return;
    setUpdating(userId);
    try {
      await updateDoc(doc(db, "users", userId), { name: editName, email: editEmail });
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "UPDATED_USER",
        `Updated details for ${editName}`
      );
      
      setEditingUser(null);
      toast.success("User updated successfully!");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user.");
    } finally {
      setUpdating(null);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== "admin") return;
    if (!newName) return;

    setUpdating("new");
    try {
      await addDoc(collection(db, "users"), {
        name: newName,
        email: newEmail || "No Email",
        role: newRole,
        isPermanent: newIsPermanent,
        currentBalance: 0,
        createdAt: serverTimestamp(),
      });
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "ADDED_USER_MANUALLY",
        `Added new member: ${newName} (${newRole})`
      );
      
      setNewName("");
      setNewEmail("");
      setShowAddForm(false);
      toast.success(`New ${newRole} added successfully!`);
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Failed to add member");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent"
        />
      </div>
    );
  }

  if (profile?.role === "member") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-red-50 p-6 text-red-700 font-bold border border-red-100 flex items-center gap-3">
          <Shield className="h-6 w-6" />
          Access Denied. Admins or Moderators only.
        </div>
      </div>
    );
  }

  // Segmented user categories for 100% calculation isolation
  const pendingUsers = users.filter(u => u.role === "pending");
  const mealMembers = users.filter(u => u.role === "member" || u.role === "moderator");
  const rentMembers = users.filter(u => u.isPermanent === true && u.role !== "pending");
  const visitorUsers = users.filter(u => u.role === "visitor");

  // Determine current list to display based on active tab
  let displayedUsers = users;
  if (activeTab === "meals") {
    displayedUsers = mealMembers;
  } else if (activeTab === "rent") {
    displayedUsers = rentMembers;
  }

  // Apply search query
  const filteredUsers = displayedUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.main 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8"
    >
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Manage Members & Roles
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Isolated management for Daily Meal Members, Rent Members, and User Roles.
          </p>
        </div>
        {profile?.role === "admin" && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
          >
            <UserPlus className="h-4 w-4" />
            {showAddForm ? "Close Form" : "Add New Member"}
          </button>
        )}
      </div>

      {/* PENDING APPROVALS NOTIFICATION BANNER */}
      {pendingUsers.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border-2 border-amber-500/30 p-6 shadow-md"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/30">
                <Clock className="h-5 w-5 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                  Pending Member Approvals
                  <span className="inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-white">
                    {pendingUsers.length} waiting
                  </span>
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  New users waiting for approval. Approve them as Visitor (Read-only) or Member (Active Mess Member).
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingUsers.map((pendingUser) => (
              <motion.div 
                key={pendingUser.id}
                whileHover={{ y: -2 }}
                className="flex flex-col justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={pendingUser.name} size={42} />
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-gray-900 dark:text-white truncate">{pendingUser.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{pendingUser.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                      Pending Approval
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveVisitor(pendingUser.id, "visitor")}
                      disabled={updating === pendingUser.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-2.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
                      title="Approve as Visitor (Read-only guest)"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Visitor
                    </button>
                    <button
                      onClick={() => handleApproveVisitor(pendingUser.id, "member")}
                      disabled={updating === pendingUser.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
                      title="Approve as Member (Full mess member)"
                    >
                      <UserCheck2 className="h-3.5 w-3.5" />
                      Member
                    </button>
                    <button
                      onClick={() => handleDeleteUser(pendingUser.id)}
                      disabled={updating === pendingUser.id}
                      className="inline-flex items-center justify-center p-2 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-600 dark:bg-gray-700 dark:hover:bg-red-950/50 text-gray-500 transition-all"
                      title="Reject / Delete Account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* QUICK ADD FORM (ADMIN ONLY) */}
      {showAddForm && profile?.role === "admin" && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50"
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-600" /> Add Member or User Account
          </h3>
          <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
              <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} className="w-full rounded-xl border-gray-200 px-4 py-2.5 text-sm dark:bg-gray-700 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Email (Optional)</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full rounded-xl border-gray-200 px-4 py-2.5 text-sm dark:bg-gray-700 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" placeholder="john@example.com" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Initial Role</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="w-full rounded-xl border-gray-200 px-4 py-2.5 text-sm font-bold dark:bg-gray-700 dark:border-gray-600 focus:ring-indigo-500">
                <option value="member">Member (Daily Meal Member)</option>
                <option value="visitor">Visitor (Read-only Guest)</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={updating === "new"} className="flex-1 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 disabled:opacity-50 h-[42px]">
                {updating === "new" ? "Saving..." : "Create User"}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ISOLATED CATEGORY TABS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("meals")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all ${
              activeTab === "meals"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700 hover:bg-gray-50"
            }`}
          >
            <Utensils className="h-4 w-4" />
            Daily Meal Members
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === "meals" ? "bg-indigo-700 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>
              {mealMembers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("rent")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all ${
              activeTab === "rent"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700 hover:bg-gray-50"
            }`}
          >
            <Home className="h-4 w-4" />
            Rent Members (Permanent)
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === "rent" ? "bg-indigo-700 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>
              {rentMembers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all ${
              activeTab === "all"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700 hover:bg-gray-50"
            }`}
          >
            <Users className="h-4 w-4" />
            All Users & Roles
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === "all" ? "bg-indigo-700 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>
              {users.length}
            </span>
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="w-full sm:w-72">
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-2xl border-gray-200 px-4 py-2.5 text-xs focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* TAB EXPLANATION BANNER */}
      <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
          <span>
            {activeTab === "meals" && "These members participate in daily breakfast/lunch/dinner sheets, bazar costs, and meal rates."}
            {activeTab === "rent" && "These members are fixed for monthly room rent allocations (house rent, gas, wifi, electricity, maid)."}
            {activeTab === "all" && "Complete registry of all registered users (Visitors, Moderators, Admins, Members, and Pending approvals)."}
          </span>
        </div>
      </div>

      {/* MEMBER TABLE */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="py-4 pl-4 pr-3 text-left text-sm font-bold text-gray-900 uppercase tracking-wider sm:pl-6 dark:text-white">Member</th>
                <th scope="col" className="px-3 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider dark:text-white">Role & Status</th>
                <th scope="col" className="px-3 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider dark:text-white">Rent Status</th>
                <th scope="col" className="relative py-4 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <motion.tbody 
              variants={container}
              initial="hidden"
              animate="show"
              className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-800"
            >
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-sm text-gray-400 font-medium">
                    No members found in this list.
                  </td>
                </tr>
              ) : filteredUsers.map((user) => (
                <motion.tr variants={item} key={user.id} className={`${updating === user.id ? "opacity-30" : ""} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors`}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    {editingUser === user.id ? (
                      <div className="flex flex-col gap-2 max-w-[200px]">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-lg border-gray-200 px-3 py-1.5 text-xs dark:bg-gray-700" placeholder="Name" />
                        <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="rounded-lg border-gray-200 px-3 py-1.5 text-xs dark:bg-gray-700" placeholder="Email" />
                      </div>
                    ) : (
                      <button onClick={() => setSelectedUserId(user.id)} className="flex items-center gap-3 group text-left w-full">
                        <Avatar name={user.name} size={36} />
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                            {user.name}
                            <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                          </div>
                          <div className="text-[10px] font-medium text-gray-400 mt-0.5">{user.email}</div>
                        </div>
                      </button>
                    )}
                  </td>

                  {/* ROLE & STATUS COLUMN */}
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {user.role === "pending" ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 uppercase tracking-tighter border border-amber-200 dark:border-amber-800">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                        <button
                          onClick={() => handleApproveVisitor(user.id, "visitor")}
                          disabled={updating === user.id}
                          className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm hover:bg-blue-700 transition-all"
                        >
                          Visitor
                        </button>
                        <button
                          onClick={() => handleApproveVisitor(user.id, "member")}
                          disabled={updating === user.id}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-700 transition-all"
                        >
                          Member
                        </button>
                      </div>
                    ) : user.role === "visitor" ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 uppercase tracking-tighter border border-blue-200 dark:border-blue-800">
                          <Eye className="h-3 w-3" /> Visitor (Guest)
                        </span>
                        {(profile?.role === "admin" || profile?.role === "moderator") && (
                          <button
                            onClick={() => handleApproveVisitor(user.id, "member")}
                            disabled={updating === user.id}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-700 transition-all"
                            title="Make Active Meal Member"
                          >
                            Make Member
                          </button>
                        )}
                      </div>
                    ) : profile?.role === "admin" ? (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={updating === user.id}
                        className="rounded-xl border-gray-200 px-3 py-1.5 text-xs font-bold dark:bg-gray-700 dark:text-white focus:ring-indigo-500"
                      >
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                        <option value="visitor">Visitor</option>
                        <option value="pending">Pending</option>
                      </select>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase tracking-tighter border border-indigo-100">
                        {user.role}
                      </span>
                    )}
                  </td>

                  {/* RENT STATUS COLUMN */}
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <button
                      onClick={() => handleTogglePermanent(user.id, user.isPermanent)}
                      disabled={updating === user.id || profile?.role === "member"}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-tighter transition-all ${
                        user.isPermanent
                          ? "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                          : "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600"
                      }`}
                      title={user.isPermanent ? "Click to remove from Rent Members list" : "Click to add to Rent Members list"}
                    >
                      {user.isPermanent ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                      {user.isPermanent ? "Rent Member (Permanent)" : "Guest / Non-Renter"}
                    </button>
                  </td>

                  {/* ACTIONS COLUMN */}
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    {(profile?.role === "admin" || profile?.role === "moderator") && (
                      <div className="flex justify-end gap-2">
                        {editingUser === user.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleEditUser(user.id)} className="text-green-600 hover:text-green-800 font-bold text-xs uppercase">Save</button>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 text-xs uppercase">×</button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            {profile?.role === "admin" && (
                              <button onClick={() => { setEditingUser(user.id); setEditName(user.name); setEditEmail(user.email); }} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors" title="Edit Member"><Edit2 className="h-4 w-4" /></button>
                            )}
                            {profile?.id !== user.id && (
                              <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Delete Member"><Trash2 className="h-4 w-4" /></button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      </div>

      {/* Member Profile Panel */}
      <MemberProfilePanel userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </motion.main>
  );
}
