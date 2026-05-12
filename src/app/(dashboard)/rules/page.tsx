"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, addDoc, deleteDoc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { format } from "date-fns";
import { Scale, Plus, Trash2, Edit2, AlertCircle } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import toast from "react-hot-toast";

interface Rule {
  id: string;
  text: string;
  createdAt: string;
}

interface Fine {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  reason: string;
  date: any;
}

import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { x: -20, opacity: 0 },
  show: { x: 0, opacity: 1 }
};

export default function RulesAndFinesPage() {
  const { profile } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Rule state
  const [newRuleText, setNewRuleText] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Add Fine state
  const [fineUserId, setFineUserId] = useState("");
  const [fineAmount, setFineAmount] = useState("2.5");
  const [fineReason, setFineReason] = useState("");
  const [editingFineId, setEditingFineId] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Rules
      const rulesSnap = await getDocs(query(collection(db, "rules"), orderBy("createdAt", "asc")));
      const rulesData: Rule[] = [];
      rulesSnap.forEach((doc) => rulesData.push({ id: doc.id, ...doc.data() } as Rule));
      setRules(rulesData);

      // Fetch Fines (You can filter by month later if needed, but we fetch all for now)
      const finesSnap = await getDocs(query(collection(db, "fines"), orderBy("date", "desc")));
      const finesData: Fine[] = [];
      finesSnap.forEach((doc) => finesData.push({ id: doc.id, ...doc.data() } as Fine));
      setFines(finesData);

      // Fetch Users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersData: UserProfile[] = [];
      usersSnap.forEach((doc) => usersData.push({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Rules Management ---
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newRuleText.trim()) return;

    try {
      if (editingRuleId) {
        await updateDoc(doc(db, "rules", editingRuleId), { text: newRuleText });
        toast.success("Rule updated!");
        await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "UPDATED_RULE", "Updated a rule");
      } else {
        await addDoc(collection(db, "rules"), {
          text: newRuleText,
          createdAt: new Date().toISOString()
        });
        toast.success("Rule added!");
        await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "ADDED_RULE", "Added a new rule");
      }
      setNewRuleText("");
      setEditingRuleId(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to save rule");
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Are you sure you want to delete this rule?")) return;
    try {
      await deleteDoc(doc(db, "rules", id));
      toast.success("Rule deleted!");
      await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "DELETED_RULE", "Deleted a rule");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete rule");
    }
  };

  // --- Fines Management ---
  const handleSaveFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fineUserId || !fineAmount || !fineReason) return;
    
    // Only admins can add/edit/update fines
    if (!isAdmin) {
      toast.error("Only admins can manage fines.");
      return;
    }

    try {
      const user = users.find(u => u.id === fineUserId);
      const amountNum = parseFloat(fineAmount);
      
      if (editingFineId) {
        await updateDoc(doc(db, "fines", editingFineId), {
          userId: fineUserId,
          userName: user?.name,
          amount: amountNum,
          reason: fineReason,
        });
        toast.success("Fine updated!");
        await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "UPDATED_FINE", `Updated fine for ${user?.name} to ${amountNum} meals`);
      } else {
        await addDoc(collection(db, "fines"), {
          userId: fineUserId,
          userName: user?.name,
          amount: amountNum,
          reason: fineReason,
          date: new Date().toISOString(),
          addedBy: profile?.id
        });
        toast.success("Fine added!");
        await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "ADDED_FINE", `Added ${amountNum} meals fine to ${user?.name}`);
      }
      setFineUserId("");
      setFineAmount("2.5");
      setFineReason("");
      setEditingFineId(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to save fine");
    }
  };

  const handleDeleteFine = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Are you sure you want to delete this fine?")) return;
    try {
      await deleteDoc(doc(db, "fines", id));
      toast.success("Fine deleted!");
      await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "DELETED_FINE", "Deleted a fine");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete fine");
    }
  };

  const handleEditFine = (fine: Fine) => {
    setFineUserId(fine.userId);
    setFineAmount(fine.amount.toString());
    setFineReason(fine.reason);
    setEditingFineId(fine.id);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-8 w-8 rounded-full border-4 border-red-500 border-t-transparent"
        />
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
            <Scale className="h-6 w-6 text-red-600 dark:text-red-400" />
            House Rules & Penalties
          </h1>
          <p className="mt-1 text-sm text-gray-500">Terms of stay and system of fines.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rules Section */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Terms and Conditions
              </h2>
            </div>
            
            <div className="p-6">
              <motion.ol 
                variants={container}
                initial="hidden"
                animate="show"
                className="space-y-4"
              >
                {rules.length === 0 ? (
                  <p className="text-gray-500 italic text-sm py-4 text-center">No rules defined yet.</p>
                ) : (
                  rules.map((rule, idx) => (
                    <motion.li variants={item} key={rule.id} className="text-sm text-gray-800 dark:text-gray-200 flex items-start gap-3 group bg-gray-50 dark:bg-gray-900/30 p-3 rounded-xl border border-gray-100 dark:border-gray-800 transition-colors hover:bg-white dark:hover:bg-gray-700/50">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 dark:bg-indigo-900/30">
                        {idx + 1}
                      </span>
                      <span className="flex-1 pt-0.5">{rule.text}</span>
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setNewRuleText(rule.text); setEditingRuleId(rule.id); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </motion.li>
                  ))
                )}
              </motion.ol>
            </div>
            
            {isAdmin && (
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                <form onSubmit={handleSaveRule} className="flex gap-2">
                  <input
                    type="text"
                    value={newRuleText}
                    onChange={(e) => setNewRuleText(e.target.value)}
                    placeholder="Enter new rule..."
                    className="flex-1 rounded-xl border-gray-200 px-4 py-2.5 text-sm dark:bg-gray-700 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all hover:-translate-y-0.5">
                    {editingRuleId ? <Edit2 className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
                  </button>
                  {editingRuleId && (
                    <button type="button" onClick={() => { setEditingRuleId(null); setNewRuleText(""); }} className="bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-bold">
                      ×
                    </button>
                  )}
                </form>
              </div>
            )}
          </motion.div>
        </div>

        {/* Fines Section */}
        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 overflow-hidden"
          >
            {isAdmin && (
              <div className="px-6 py-4 border-b border-red-50 dark:border-gray-700 bg-red-50/50 dark:bg-red-900/20">
                <h2 className="text-lg font-bold text-red-800 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Issue New Fine
                </h2>
              </div>
            )}
            <div className="p-6">
              {isAdmin ? (
                <form onSubmit={handleSaveFine} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Target Member</label>
                      <select
                        value={fineUserId}
                        onChange={(e) => setFineUserId(e.target.value)}
                        className="w-full rounded-xl border-gray-200 px-4 py-2.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                        required
                      >
                        <option value="" disabled>Select member...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fine (Meals)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={fineAmount}
                        onChange={(e) => setFineAmount(e.target.value)}
                        className="w-full rounded-xl border-gray-200 px-4 py-2.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Reason for Penalty</label>
                    <input
                      type="text"
                      value={fineReason}
                      onChange={(e) => setFineReason(e.target.value)}
                      placeholder="e.g. Violation of rule #3"
                      className="w-full rounded-xl border-gray-200 px-4 py-2.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-red-100 dark:shadow-none transition-all hover:-translate-y-0.5">
                      {editingFineId ? "Update Penalty" : "Issue Penalty"}
                    </button>
                    {editingFineId && (
                      <button type="button" onClick={() => { setEditingFineId(null); setFineUserId(""); setFineReason(""); setFineAmount("2.5"); }} className="bg-gray-200 text-gray-800 px-6 py-2.5 rounded-xl font-bold transition-all hover:bg-gray-300">
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="text-center py-6">
                  <AlertCircle className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm italic">Only administrators can issue or modify fines.</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Recent Penalties
              </h2>
              <span className="text-xs text-gray-500">{fines.length} total</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
              {fines.length === 0 ? (
                <p className="p-8 text-gray-500 text-sm text-center italic">No fines recorded.</p>
              ) : (
                fines.map(fine => (
                  <div key={fine.id} className="p-5 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{fine.userName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fine.reason}</p>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">{format(new Date(fine.date), "dd MMM yyyy, hh:mm a")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-[10px] font-black text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                        {fine.amount} MEALS
                      </span>
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditFine(fine)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors">
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDeleteFine(fine.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.main>
  );
}
