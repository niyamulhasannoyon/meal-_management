"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { Users, Shield, UserCheck, UserX, Trash2, UserPlus, Edit2 } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import toast from "react-hot-toast";
import { sortUsers } from "@/lib/utils";

import { motion } from "framer-motion";

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
  
  // Add Member State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // Edit Member State
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersData: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(sortUsers(usersData));
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
      
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as any } : u));
      toast.success(`Role updated to ${newRole}`);
    } catch (error) {
      console.error("Error updating role:", error);
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
      
      setUsers(users.map(u => u.id === userId ? { ...u, isPermanent: newStatus } : u));
      toast.success(newStatus ? "Marked as Permanent" : "Marked as Guest");
    } catch (error) {
      console.error("Error toggling permanent status:", error);
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (profile?.role !== "admin") return;
    if (!confirm("Are you sure you want to delete this member?")) return;
    
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
      
      setUsers(users.filter(u => u.id !== userId));
      toast.success("User deleted successfully!");
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
      
      setUsers(users.map(u => u.id === userId ? { ...u, name: editName, email: editEmail } : u));
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
      const docRef = await addDoc(collection(db, "users"), {
        name: newName,
        email: newEmail || "No Email",
        role: "visitor",
        isPermanent: false,
        currentBalance: 0,
        createdAt: serverTimestamp(),
      });
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "ADDED_USER_MANUALLY",
        `Added new member: ${newName}`
      );
      
      const newUser = {
        id: docRef.id,
        name: newName,
        email: newEmail || "No Email",
        role: "visitor",
        isPermanent: false,
        currentBalance: 0,
      } as UserProfile;

      setUsers([...users, newUser]);
      setNewName("");
      setNewEmail("");
      setShowAddForm(false);
      toast.success("Member added successfully!");
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

  return (
    <motion.main 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Manage Members
          </h1>
          <p className="mt-1 text-sm text-gray-500">View and manage all mess members and roles.</p>
        </div>
        {profile?.role === "admin" && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
          >
            <UserPlus className="h-4 w-4" />
            {showAddForm ? "Close Form" : "Add Member"}
          </button>
        )}
      </div>

      {showAddForm && profile?.role === "admin" && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50"
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Quick Add Manual Member</h3>
          <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
              <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} className="w-full rounded-xl border-gray-200 px-4 py-2.5 text-sm dark:bg-gray-700 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Email (Optional)</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full rounded-xl border-gray-200 px-4 py-2.5 text-sm dark:bg-gray-700 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" placeholder="john@example.com" />
            </div>
            <button type="submit" disabled={updating === "new"} className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 disabled:opacity-50 h-[42px]">
              {updating === "new" ? "Saving..." : "Add Member"}
            </button>
          </form>
        </motion.div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="py-4 pl-4 pr-3 text-left text-sm font-bold text-gray-900 uppercase tracking-wider sm:pl-6 dark:text-white">Member</th>
                <th scope="col" className="px-3 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider dark:text-white">Role</th>
                <th scope="col" className="px-3 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider dark:text-white">Inclusion</th>
                <th scope="col" className="px-3 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider dark:text-white">Balance</th>
                <th scope="col" className="relative py-4 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <motion.tbody 
              variants={container}
              initial="hidden"
              animate="show"
              className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-800"
            >
              {users.map((user) => (
                <motion.tr variants={item} key={user.id} className={`${updating === user.id ? "opacity-30" : ""} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors`}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    {editingUser === user.id ? (
                      <div className="flex flex-col gap-2 max-w-[200px]">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-lg border-gray-200 px-3 py-1.5 text-xs dark:bg-gray-700" placeholder="Name" />
                        <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="rounded-lg border-gray-200 px-3 py-1.5 text-xs dark:bg-gray-700" placeholder="Email" />
                      </div>
                    ) : (
                      <>
                        <div className="font-bold text-gray-900 dark:text-white">{user.name}</div>
                        <div className="text-[10px] font-medium text-gray-400 mt-0.5">{user.email}</div>
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {profile?.role === "admin" ? (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={updating === user.id}
                        className="rounded-xl border-gray-200 px-3 py-1.5 text-xs font-bold dark:bg-gray-700 dark:text-white focus:ring-indigo-500"
                      >
                        <option value="visitor">Visitor</option>
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase tracking-tighter border border-indigo-100">
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <button
                      onClick={() => handleTogglePermanent(user.id, user.isPermanent)}
                      disabled={updating === user.id}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-tighter transition-all ${
                        user.isPermanent
                          ? "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                          : "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600"
                      }`}
                    >
                      {user.isPermanent ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                      {user.isPermanent ? "Permanent" : "Guest"}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-black">
                    <span className={user.currentBalance >= 0 ? "text-green-600" : "text-red-600"}>
                      ৳ {user.currentBalance}
                    </span>
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    {profile?.role === "admin" && (
                      <div className="flex justify-end gap-2">
                        {editingUser === user.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleEditUser(user.id)} className="text-green-600 hover:text-green-800 font-bold text-xs uppercase">Save</button>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 text-xs uppercase">×</button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button onClick={() => { setEditingUser(user.id); setEditName(user.name); setEditEmail(user.email); }} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors"><Edit2 className="h-4 w-4" /></button>
                            {profile.id !== user.id && (
                              <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="h-4 w-4" /></button>
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
    </motion.main>
  );
}
