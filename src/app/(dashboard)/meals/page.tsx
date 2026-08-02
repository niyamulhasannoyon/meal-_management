"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, setDoc, query, where, addDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { format } from "date-fns";
import { Utensils, ShoppingBag, Plus, Save, Calendar, Clock, Edit3, Trash2, ChevronDown, ChevronUp, History, X, Check, Star } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { sortUsers, formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { MealCutoffBanner } from "@/components/meals/MealCutoffBanner";
import { getRoleTheme } from "@/lib/theme";
import { staggerContainer, fadeIn } from "@/lib/motion";

interface MealEntry {
  id?: string;
  userId: string;
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  totalMeals: number;
  createdAt?: string;
}

interface BazarEntry {
  id: string;
  date: any;
  amount: number;
  description: string;
  addedBy: string;
  spenderId: string;
  spenderName: string;
}

export default function MealsPage() {
  const { profile, settings } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meals, setMeals] = useState<Record<string, MealEntry>>({});

  // Bazar state
  const [bazarAmount, setBazarAmount] = useState("");
  const [bazarDesc, setBazarDesc] = useState("");
  const [bazarSpenderId, setBazarSpenderId] = useState("");
  const [bazarEntries, setBazarEntries] = useState<BazarEntry[]>([]);
  const [showBazarHistory, setShowBazarHistory] = useState(false);

  // Edit Bazar state
  const [editingBazar, setEditingBazar] = useState<BazarEntry | null>(null);
  const [editBazarAmount, setEditBazarAmount] = useState("");
  const [editBazarDesc, setEditBazarDesc] = useState("");
  const [editBazarSpenderId, setEditBazarSpenderId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemStartDate, setSystemStartDate] = useState("");

  const currentMonth = format(new Date(selectedDate), "yyyy-MM");

  useEffect(() => {
    if (settings) {
      setSystemStartDate(settings.systemStartDate || "");
    }
  }, [settings]);

  useEffect(() => {
    fetchUsersAndMeals();
  }, [selectedDate]);

  useEffect(() => {
    if (users.length > 0) {
      const isValidSpender = users.some((u) => u.id === bazarSpenderId);
      if (!isValidSpender) {
        const isMember = users.some((u) => u.id === profile?.id);
        const defaultSpender = isMember ? profile?.id || "" : users[0]?.id || "";
        if (bazarSpenderId !== defaultSpender) {
          setBazarSpenderId(defaultSpender);
        }
      }
    }
  }, [users, profile, bazarSpenderId]);

  // Real-time bazar listener
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "bazar_costs"), (snapshot) => {
      const entries: BazarEntry[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const dateObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
        const dateStr = format(dateObj, "yyyy-MM-dd");
        if (format(dateObj, "yyyy-MM") === currentMonth && (!systemStartDate || dateStr >= systemStartDate)) {
          entries.push({ id: d.id, ...data } as BazarEntry);
        }
      });
      entries.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      setBazarEntries(entries);
    });

    return () => unsubscribe();
  }, [currentMonth, systemStartDate]);

  const fetchUsersAndMeals = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersData: UserProfile[] = [];
      usersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const role = data.role || "member";
        if (role !== "visitor" && role !== "pending") {
          usersData.push({ id: docSnap.id, ...data } as UserProfile);
        }
      });
      const activeMembers = sortUsers(usersData);
      setUsers(activeMembers);

      const mealsQuery = query(collection(db, "meals"), where("date", "==", selectedDate));
      const mealsSnap = await getDocs(mealsQuery);
      const mealsMap: Record<string, MealEntry> = {};

      mealsSnap.forEach((d) => {
        const data = d.data() as MealEntry;
        mealsMap[data.userId] = { ...data, id: d.id };
      });

      const defaultB = settings?.defaultBreakfast !== undefined ? settings.defaultBreakfast : 0.5;
      const defaultL = settings?.defaultLunch !== undefined ? settings.defaultLunch : 1.0;
      const defaultD = settings?.defaultDinner !== undefined ? settings.defaultDinner : 1.0;

      activeMembers.forEach((user) => {
        if (!mealsMap[user.id]) {
          mealsMap[user.id] = {
            userId: user.id,
            date: selectedDate,
            breakfast: defaultB,
            lunch: defaultL,
            dinner: defaultD,
            totalMeals: defaultB + defaultL + defaultD,
          };
        }
      });

      setMeals(mealsMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load meal data");
    } finally {
      setLoading(false);
    }
  };

  const handleMealChange = (userId: string, field: "breakfast" | "lunch" | "dinner", value: number) => {
    const val = isNaN(value) ? 0 : Math.max(0, value);
    setMeals((prev) => {
      const current = prev[userId] || {
        userId,
        date: selectedDate,
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        totalMeals: 0,
      };
      const updated = { ...current, [field]: val };
      updated.totalMeals = (updated.breakfast || 0) + (updated.lunch || 0) + (updated.dinner || 0);
      return { ...prev, [userId]: updated };
    });
  };

  const setPresetMeals = (userId: string, preset: 0 | 1 | 2 | 2.5) => {
    if (preset === 0) {
      setMeals((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], breakfast: 0, lunch: 0, dinner: 0, totalMeals: 0 },
      }));
    } else if (preset === 1) {
      setMeals((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], breakfast: 0, lunch: 1, dinner: 0, totalMeals: 1 },
      }));
    } else if (preset === 2) {
      setMeals((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], breakfast: 0, lunch: 1, dinner: 1, totalMeals: 2 },
      }));
    } else if (preset === 2.5) {
      setMeals((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], breakfast: 0.5, lunch: 1, dinner: 1, totalMeals: 2.5 },
      }));
    }
  };

  const handleSaveMeals = async () => {
    setSaving(true);
    try {
      for (const userId of Object.keys(meals)) {
        const meal = meals[userId];
        const docId = meal.id || `${selectedDate}_${userId}`;
        const total = (meal.breakfast || 0) + (meal.lunch || 0) + (meal.dinner || 0);

        await setDoc(doc(db, "meals", docId), {
          userId,
          date: selectedDate,
          breakfast: Number(meal.breakfast || 0),
          lunch: Number(meal.lunch || 0),
          dinner: Number(meal.dinner || 0),
          totalMeals: Number(total),
        });
      }

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown",
        "UPDATED_MEALS",
        `Saved meals for date ${selectedDate}`,
        "meal"
      );

      toast.success(`Meals for ${selectedDate} saved!`);
      fetchUsersAndMeals();
    } catch (error) {
      console.error("Error saving meals:", error);
      toast.error("Failed to save meals");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBazar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bazarAmount || !bazarSpenderId) return;

    setSaving(true);
    try {
      const spender = users.find((u) => u.id === bazarSpenderId);
      const amountNum = parseFloat(bazarAmount);

      await addDoc(collection(db, "bazar_costs"), {
        date: selectedDate,
        amount: amountNum,
        description: bazarDesc,
        addedBy: profile?.id,
        spenderId: bazarSpenderId,
        spenderName: spender?.name || "Unknown",
      });

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown",
        "ADDED_BAZAR",
        `Added ৳${amountNum} bazar spent by ${spender?.name || "Unknown"} on ${selectedDate}`,
        "bazar"
      );

      toast.success("Bazar cost added!");
      setBazarAmount("");
      setBazarDesc("");
    } catch (error) {
      console.error("Error adding bazar:", error);
      toast.error("Failed to add bazar cost");
    } finally {
      setSaving(false);
    }
  };

  const handleEditBazar = (entry: BazarEntry) => {
    setEditingBazar(entry);
    setEditBazarAmount(entry.amount.toString());
    setEditBazarDesc(entry.description || "");
    setEditBazarSpenderId(entry.spenderId || "");
  };

  const handleUpdateBazar = async () => {
    if (!editingBazar || !editBazarAmount) return;
    setSaving(true);
    try {
      const spender = users.find((u) => u.id === editBazarSpenderId);
      const amountNum = parseFloat(editBazarAmount);

      await updateDoc(doc(db, "bazar_costs", editingBazar.id), {
        amount: amountNum,
        description: editBazarDesc,
        spenderId: editBazarSpenderId,
        spenderName: spender?.name || "Unknown",
      });

      toast.success("Bazar entry updated!");
      setEditingBazar(null);
    } catch (error) {
      console.error("Error updating bazar:", error);
      toast.error("Failed to update bazar entry");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBazar = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bazar entry?")) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "bazar_costs", id));
      toast.success("Bazar entry deleted!");
    } catch (error) {
      console.error("Error deleting bazar:", error);
      toast.error("Failed to delete bazar entry");
    } finally {
      setSaving(false);
    }
  };

  const totalDailyMeals = Object.values(meals).reduce((sum, m) => sum + (m.totalMeals || 0), 0);
  const totalBazarMonth = bazarEntries.reduce((sum, b) => sum + (b.amount || 0), 0);

  return (
    <motion.main
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Utensils className="w-6 h-6 text-brand" />
            Daily Meal Attendance (.5 / 1 / 1)
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Sleek, compact meal tracking for members. Only assigned members enter calculation.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44 text-xs font-bold"
          />
          <Button variant="primary" size="sm" isLoading={saving} onClick={handleSaveMeals}>
            <Save className="w-4 h-4 mr-1.5" /> Save Daily Meals
          </Button>
        </div>
      </motion.div>

      {/* 10 PM Cutoff Banner */}
      <motion.div variants={fadeIn}>
        <MealCutoffBanner />
      </motion.div>

      {/* Grid Layout: Compact Left Meals Matrix, Right Bazar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Compact Member Meal Cards */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
              Active Members ({users.length}) — {selectedDate}
            </span>
            <span className="text-xs font-extrabold text-brand bg-brand/10 px-2.5 py-1 rounded-full">
              Total Today: {totalDailyMeals} Meals
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-zinc-400">Loading daily meals matrix...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400 bg-card rounded-xl border border-zinc-200 dark:border-zinc-800">
              No members configured for meals. Go to Users page and assign "Member" role to members.
            </div>
          ) : (
            <div className="space-y-2.5">
              {users.map((user) => {
                const meal = meals[user.id] || { breakfast: 0.5, lunch: 1, dinner: 1, totalMeals: 2.5 };
                const isYou = user.id === profile?.id;

                return (
                  <motion.div
                    key={user.id}
                    variants={fadeIn}
                    className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-card shadow-xs hover:border-brand/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {/* Member Name */}
                    <div className="flex items-center space-x-3 min-w-[160px]">
                      <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-black text-xs">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{user.name}</span>
                          {isYou && <Badge variant="info" className="text-[9px] px-1.5">You</Badge>}
                        </div>
                        <span className="text-[10px] text-zinc-400">Meal Member</span>
                      </div>
                    </div>

                    {/* Compact 3-Part Toggle: Breakfast (.5), Lunch (1), Dinner (1) */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Breakfast (.5) */}
                      <button
                        type="button"
                        onClick={() => handleMealChange(user.id, "breakfast", meal.breakfast > 0 ? 0 : 0.5)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all border ${
                          meal.breakfast > 0
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/40 shadow-xs"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent hover:text-zinc-600"
                        }`}
                      >
                        B ({meal.breakfast})
                      </button>

                      {/* Lunch (1) */}
                      <button
                        type="button"
                        onClick={() => handleMealChange(user.id, "lunch", meal.lunch > 0 ? 0 : 1)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all border ${
                          meal.lunch > 0
                            ? "bg-brand/15 text-brand border-brand/40 shadow-xs"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent hover:text-zinc-600"
                        }`}
                      >
                        L ({meal.lunch})
                      </button>

                      {/* Dinner (1) */}
                      <button
                        type="button"
                        onClick={() => handleMealChange(user.id, "dinner", meal.dinner > 0 ? 0 : 1)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all border ${
                          meal.dinner > 0
                            ? "bg-brand/15 text-brand border-brand/40 shadow-xs"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent hover:text-zinc-600"
                        }`}
                      >
                        D ({meal.dinner})
                      </button>
                    </div>

                    {/* Presets & Total */}
                    <div className="flex items-center space-x-2 self-end sm:self-auto">
                      {/* Presets */}
                      <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-900/60 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setPresetMeals(user.id, 0)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            meal.totalMeals === 0 ? "bg-red-500 text-white shadow-xs" : "text-zinc-500 hover:text-zinc-900"
                          }`}
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => setPresetMeals(user.id, 2)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            meal.totalMeals === 2 ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                          }`}
                        >
                          2.0
                        </button>
                        <button
                          type="button"
                          onClick={() => setPresetMeals(user.id, 2.5)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            meal.totalMeals === 2.5 ? "bg-brand text-white shadow-xs" : "text-zinc-500 hover:text-zinc-900"
                          }`}
                        >
                          2.5
                        </button>
                      </div>

                      {/* Total Badge */}
                      <span className="w-12 text-center font-black text-sm text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {meal.totalMeals}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Column: Bazar Entry & History */}
        <div className="space-y-6">
          {/* Add Bazar Form */}
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-card p-5 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amberAccent-500" />
              Add Daily Bazar Expenditure
            </h3>

            <form onSubmit={handleAddBazar} className="space-y-3">
              <Input
                label={`Amount (${settings?.currencySymbol || "৳"})`}
                type="number"
                step="1"
                min="1"
                placeholder="e.g. 450"
                value={bazarAmount}
                onChange={(e) => setBazarAmount(e.target.value)}
                required
              />

              <Input
                label="Description (Optional)"
                type="text"
                placeholder="e.g. Chicken, Vegetables, Rice"
                value={bazarDesc}
                onChange={(e) => setBazarDesc(e.target.value)}
              />

              <Select
                label="Spender (Who paid?)"
                value={bazarSpenderId}
                onChange={(e) => setBazarSpenderId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select Member...
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>

              <Button type="submit" variant="amber" className="w-full mt-2" isLoading={saving}>
                <Plus className="w-4 h-4 mr-1" /> Add Bazar Cost
              </Button>
            </form>
          </div>

          {/* Bazar History List */}
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-card shadow-card overflow-hidden">
            <button
              onClick={() => setShowBazarHistory(!showBazarHistory)}
              className="w-full p-4 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 text-left"
            >
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Bazar Log ({currentMonth})</h4>
                <p className="text-[11px] text-zinc-500 font-semibold">Total Spent: ৳{formatCurrency(totalBazarMonth)}</p>
              </div>
              {showBazarHistory ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {showBazarHistory && (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-64 overflow-y-auto p-4 space-y-2">
                {bazarEntries.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic text-center py-4">No bazar entries for this month.</p>
                ) : (
                  bazarEntries.map((entry) => {
                    const dateObj = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);

                    return (
                      <div key={entry.id} className="flex items-center justify-between text-xs py-1.5">
                        <div>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{entry.spenderName}</span>
                          <span className="block text-[10px] text-zinc-400">
                            {format(dateObj, "MMM dd")} — {entry.description || "Bazar cost"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-amberAccent-600">৳{formatCurrency(entry.amount)}</span>
                          {(profile?.role === "admin" || profile?.role === "super_admin" || profile?.role === "moderator") && (
                            <div className="flex items-center space-x-1">
                              <button onClick={() => handleEditBazar(entry)} className="p-1 text-blue-500 hover:bg-blue-50 rounded">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteBazar(entry.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Bazar Dialog */}
      <Dialog
        isOpen={!!editingBazar}
        onClose={() => setEditingBazar(null)}
        title="Edit Bazar Entry"
        description="Update amount or spender details for this expenditure."
      >
        <div className="space-y-4 pt-2">
          <Input
            label="Amount (৳)"
            type="number"
            value={editBazarAmount}
            onChange={(e) => setEditBazarAmount(e.target.value)}
            required
          />
          <Input
            label="Description"
            type="text"
            value={editBazarDesc}
            onChange={(e) => setEditBazarDesc(e.target.value)}
          />
          <Select
            label="Spender"
            value={editBazarSpenderId}
            onChange={(e) => setEditBazarSpenderId(e.target.value)}
            required
          >
            <option value="" disabled>Select Member</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>

          <div className="flex justify-end space-x-3 pt-3">
            <Button variant="outline" size="sm" onClick={() => setEditingBazar(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" isLoading={saving} onClick={handleUpdateBazar}>
              Update Entry
            </Button>
          </div>
        </div>
      </Dialog>
    </motion.main>
  );
}
