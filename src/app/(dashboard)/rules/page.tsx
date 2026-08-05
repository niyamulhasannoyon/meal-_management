"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, addDoc, deleteDoc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { format } from "date-fns";
import { Scale, Plus, Trash2, Edit2, AlertCircle } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  date: string | Date;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { x: -20, opacity: 0 },
  show: { x: 0, opacity: 1 },
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

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin" || profile?.role === "moderator";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const rulesSnap = await getDocs(query(collection(db, "rules"), orderBy("createdAt", "asc")));
      const rulesData: Rule[] = [];
      rulesSnap.forEach((docSnap) => rulesData.push({ id: docSnap.id, ...docSnap.data() } as Rule));
      setRules(rulesData);

      const finesSnap = await getDocs(query(collection(db, "fines"), orderBy("date", "desc")));
      const finesData: Fine[] = [];
      finesSnap.forEach((docSnap) => finesData.push({ id: docSnap.id, ...docSnap.data() } as Fine));
      setFines(finesData);

      const usersSnap = await getDocs(collection(db, "users"));
      const usersData: UserProfile[] = [];
      usersSnap.forEach((docSnap) => usersData.push({ id: docSnap.id, ...docSnap.data() } as UserProfile));
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newRuleText.trim()) return;

    try {
      if (editingRuleId) {
        await updateDoc(doc(db, "rules", editingRuleId), { text: newRuleText });
        toast.success("Rule updated!");
        await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "UPDATED_RULE", "Updated a rule", "system");
      } else {
        await addDoc(collection(db, "rules"), {
          text: newRuleText,
          createdAt: new Date().toISOString(),
        });
        toast.success("Rule added!");
        await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "ADDED_RULE", "Added a new rule", "system");
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
      await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "DELETED_RULE", "Deleted a rule", "system");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete rule");
    }
  };

  const handleSaveFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fineUserId || !fineAmount || !fineReason) return;

    if (!isAdmin) {
      toast.error("Only admins can manage fines.");
      return;
    }

    try {
      const user = users.find((u) => u.id === fineUserId);
      const amountNum = parseFloat(fineAmount);

      if (editingFineId) {
        await updateDoc(doc(db, "fines", editingFineId), {
          userId: fineUserId,
          userName: user?.name,
          amount: amountNum,
          reason: fineReason,
        });
        toast.success("Fine updated!");
        await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "UPDATED_FINE", `Updated fine for ${user?.name} to ${amountNum} meals`, "fine");
      } else {
        await addDoc(collection(db, "fines"), {
          userId: fineUserId,
          userName: user?.name,
          amount: amountNum,
          reason: fineReason,
          date: new Date().toISOString(),
          addedBy: profile?.id,
        });
        toast.success("Fine added!");
        await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "ADDED_FINE", `Added ${amountNum} meals fine to ${user?.name}`, "fine");
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
      await logActivity(profile?.id || "unknown", profile?.name || "Unknown", "DELETED_FINE", "Deleted a fine", "fine");
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
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Scale className="h-6 w-6 text-brand" />
            House Rules & Penalties
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Terms of stay and system of fines.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rules Section */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-card overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Terms and Conditions
              </h2>
            </div>

            <div className="p-6">
              <motion.ol variants={container} initial="hidden" animate="show" className="space-y-3">
                {rules.length === 0 ? (
                  <p className="text-zinc-500 italic text-xs py-4 text-center">No rules defined yet.</p>
                ) : (
                  rules.map((rule, idx) => (
                    <motion.li
                      variants={item}
                      key={rule.id}
                      className="text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-3 group bg-zinc-50 dark:bg-zinc-900/30 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-colors"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                        {idx + 1}
                      </span>
                      <span className="flex-1 pt-0.5">{rule.text}</span>
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setNewRuleText(rule.text);
                              setEditingRuleId(rule.id);
                            }}
                            className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </motion.li>
                  ))
                )}
              </motion.ol>
            </div>

            {isAdmin && (
              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800">
                <form onSubmit={handleSaveRule} className="flex gap-2">
                  <Input
                    type="text"
                    value={newRuleText}
                    onChange={(e) => setNewRuleText(e.target.value)}
                    placeholder="Enter new rule..."
                    required
                  />
                  <Button type="submit" variant="primary" size="md">
                    {editingRuleId ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </Button>
                  {editingRuleId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => {
                        setEditingRuleId(null);
                        setNewRuleText("");
                      }}
                    >
                      Cancel
                    </Button>
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
            className="bg-card rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-card overflow-hidden"
          >
            {isAdmin && (
              <div className="px-6 py-4 border-b border-red-100 dark:border-red-950 bg-red-50/40 dark:bg-red-950/20">
                <h2 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Issue New Fine
                </h2>
              </div>
            )}
            <div className="p-6">
              {isAdmin ? (
                <form onSubmit={handleSaveFine} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Target Member"
                      value={fineUserId}
                      onChange={(e) => setFineUserId(e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select member...
                      </option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>

                    <Input
                      label="Fine (Meals)"
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                      required
                    />
                  </div>

                  <Input
                    label="Reason for Penalty"
                    type="text"
                    value={fineReason}
                    onChange={(e) => setFineReason(e.target.value)}
                    placeholder="e.g. Violation of rule #3"
                    required
                  />

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" variant="danger" size="md" className="flex-1">
                      {editingFineId ? "Update Penalty" : "Issue Penalty"}
                    </Button>
                    {editingFineId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => {
                          setEditingFineId(null);
                          setFineUserId("");
                          setFineReason("");
                          setFineAmount("2.5");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="text-center py-6">
                  <AlertCircle className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                  <p className="text-zinc-500 text-xs italic">Only administrators can issue or modify fines.</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-card overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Recent Penalties</h2>
              <span className="text-xs text-zinc-500">{fines.length} total</span>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
              {fines.length === 0 ? (
                <p className="p-8 text-zinc-500 text-xs text-center italic">No fines recorded.</p>
              ) : (
                fines.map((fine) => (
                  <div
                    key={fine.id}
                    className="p-4 flex items-center justify-between group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{fine.userName}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{fine.reason}</p>
                      <p className="text-[10px] text-zinc-400 mt-1 uppercase font-semibold">
                        {format(new Date(fine.date), "dd MMM yyyy, hh:mm a")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="danger">{fine.amount} MEALS</Badge>
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditFine(fine)}
                            className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFine(fine.id)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
