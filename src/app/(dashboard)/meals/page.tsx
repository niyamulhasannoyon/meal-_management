"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, query, where, addDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { format } from "date-fns";
import {
  Utensils,
  ShoppingBag,
  Plus,
  Save,
  Clock,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle2,
  AlertCircle,
  Send
} from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { sortUsers, formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { MealCutoffBanner } from "@/components/meals/MealCutoffBanner";
import { staggerContainer, fadeIn } from "@/lib/motion";
import { MealEntry } from "@/lib/types/firestore";

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
  
  // Current working state of meals (local UI)
  const [meals, setMeals] = useState<Record<string, MealEntry>>({});
  
  // Database snapshot state of meals (what's actually saved in Firestore)
  const [savedMeals, setSavedMeals] = useState<Record<string, MealEntry>>({});

  // Filter tab state for member list
  const [filterTab, setFilterTab] = useState<"all" | "submitted" | "pending">("all");

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
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
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
        // ONLY include users with role === 'member' (Member Eats Meals)
        if (data.role === "member") {
          usersData.push({ id: docSnap.id, ...data } as UserProfile);
        }
      });
      const activeMembers = sortUsers(usersData);
      setUsers(activeMembers);

      const mealsQuery = query(collection(db, "meals"), where("date", "==", selectedDate));
      const mealsSnap = await getDocs(mealsQuery);
      
      const mealsMap: Record<string, MealEntry> = {};
      const savedMap: Record<string, MealEntry> = {};

      mealsSnap.forEach((d) => {
        const data = d.data() as MealEntry;
        const entryWithMeta: MealEntry = {
          ...data,
          id: d.id,
          breakfast: Number(data.breakfast ?? 0),
          lunch: Number(data.lunch ?? 0),
          dinner: Number(data.dinner ?? 0),
          totalMeals: Number(data.totalMeals ?? ((data.breakfast || 0) + (data.lunch || 0) + (data.dinner || 0))),
          isSubmitted: data.isSubmitted !== false, // If doc exists in DB, it's submitted
        };
        mealsMap[data.userId] = entryWithMeta;
        savedMap[data.userId] = { ...entryWithMeta };
      });

      // Query previous day's meals as default for missing members
      const prevDateObj = new Date(`${selectedDate}T12:00:00`);
      prevDateObj.setDate(prevDateObj.getDate() - 1);
      const prevDateStr = format(prevDateObj, "yyyy-MM-dd");

      const prevMealsQuery = query(collection(db, "meals"), where("date", "==", prevDateStr));
      const prevMealsSnap = await getDocs(prevMealsQuery);
      const prevMealsMap: Record<string, MealEntry> = {};
      prevMealsSnap.forEach((d) => {
        const data = d.data() as MealEntry;
        prevMealsMap[data.userId] = data;
      });

      const defaultB = settings?.defaultBreakfast !== undefined ? settings.defaultBreakfast : 0.5;
      const defaultL = settings?.defaultLunch !== undefined ? settings.defaultLunch : 1.0;
      const defaultD = settings?.defaultDinner !== undefined ? settings.defaultDinner : 1.0;

      activeMembers.forEach((user) => {
        if (!mealsMap[user.id]) {
          const prevEntry = prevMealsMap[user.id];
          let b = defaultB;
          let l = defaultL;
          let d = defaultD;
          let tot = defaultB + defaultL + defaultD;

          if (prevEntry) {
            b = prevEntry.breakfast !== undefined ? Number(prevEntry.breakfast) : defaultB;
            l = prevEntry.lunch !== undefined ? Number(prevEntry.lunch) : defaultL;
            d = prevEntry.dinner !== undefined ? Number(prevEntry.dinner) : defaultD;
            tot =
              prevEntry.totalMeals !== undefined
                ? Number(prevEntry.totalMeals)
                : (prevEntry as any).count !== undefined
                ? Number((prevEntry as any).count)
                : b + l + d;
          }

          const defaultEntry: MealEntry = {
            userId: user.id,
            userName: user.name,
            date: selectedDate,
            breakfast: b,
            lunch: l,
            dinner: d,
            totalMeals: tot,
            isSubmitted: false, // NOT saved in DB yet (Pending)
          };

          mealsMap[user.id] = defaultEntry;
          // Note: savedMap[user.id] remains undefined because it's not saved in DB yet
        }
      });

      setMeals(mealsMap);
      setSavedMeals(savedMap);
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
        isSubmitted: false,
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

  // Helper to determine status for a specific user
  const getUserStatus = (userId: string): "submitted" | "pending" | "unsaved" => {
    const saved = savedMeals[userId];
    const current = meals[userId];

    if (!saved || !saved.isSubmitted) {
      // Never submitted to DB yet
      return "pending";
    }

    // Saved in DB exists - check if modified locally
    const isModified =
      current.breakfast !== saved.breakfast ||
      current.lunch !== saved.lunch ||
      current.dinner !== saved.dinner;

    if (isModified) {
      return "unsaved";
    }

    return "submitted";
  };

  // Save single user meal
  const handleSaveSingleMeal = async (user: UserProfile) => {
    setSavingUserId(user.id);
    try {
      const meal = meals[user.id];
      const docId = meal.id || `${selectedDate}_${user.id}`;
      const total = (meal.breakfast || 0) + (meal.lunch || 0) + (meal.dinner || 0);

      const timestamp = new Date().toISOString();
      const updatedEntry: MealEntry = {
        id: docId,
        userId: user.id,
        userName: user.name,
        date: selectedDate,
        breakfast: Number(meal.breakfast || 0),
        lunch: Number(meal.lunch || 0),
        dinner: Number(meal.dinner || 0),
        totalMeals: Number(total),
        isSubmitted: true,
        submittedAt: timestamp,
        submittedBy: profile?.name || "User",
        submittedById: profile?.id || "unknown",
      };

      await setDoc(doc(db, "meals", docId), updatedEntry);

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown",
        "UPDATED_MEALS",
        `Submitted meal entry (${total} meals) for ${user.name} on ${selectedDate}`,
        "meal"
      );

      setSavedMeals((prev) => ({ ...prev, [user.id]: updatedEntry }));
      setMeals((prev) => ({ ...prev, [user.id]: updatedEntry }));

      toast.success(`Meals for ${user.name} submitted!`);
    } catch (error) {
      console.error("Error saving member meal:", error);
      toast.error(`Failed to save meals for ${user.name}`);
    } finally {
      setSavingUserId(null);
    }
  };

  // Batch save all daily meals
  const handleSaveMeals = async () => {
    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const newSavedMeals: Record<string, MealEntry> = { ...savedMeals };
      const newMeals: Record<string, MealEntry> = { ...meals };

      for (const userId of Object.keys(meals)) {
        const meal = meals[userId];
        const user = users.find((u) => u.id === userId);
        const docId = meal.id || `${selectedDate}_${userId}`;
        const total = (meal.breakfast || 0) + (meal.lunch || 0) + (meal.dinner || 0);

        const updatedEntry: MealEntry = {
          id: docId,
          userId,
          userName: user?.name || meal.userName || "Member",
          date: selectedDate,
          breakfast: Number(meal.breakfast || 0),
          lunch: Number(meal.lunch || 0),
          dinner: Number(meal.dinner || 0),
          totalMeals: Number(total),
          isSubmitted: true,
          submittedAt: timestamp,
          submittedBy: profile?.name || "User",
          submittedById: profile?.id || "unknown",
        };

        await setDoc(doc(db, "meals", docId), updatedEntry);

        newSavedMeals[userId] = updatedEntry;
        newMeals[userId] = updatedEntry;
      }

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown",
        "UPDATED_MEALS",
        `Saved all meals for date ${selectedDate}`,
        "meal"
      );

      setSavedMeals(newSavedMeals);
      setMeals(newMeals);

      toast.success(`All meals for ${selectedDate} submitted!`);
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

  // Status statistics for selectedDate
  const submittedCount = users.filter((u) => getUserStatus(u.id) === "submitted").length;
  const unsavedCount = users.filter((u) => getUserStatus(u.id) === "unsaved").length;
  const pendingCount = users.filter((u) => getUserStatus(u.id) === "pending").length;
  const totalActiveUsers = users.length;
  const isAllSubmitted = totalActiveUsers > 0 && submittedCount === totalActiveUsers;

  // Filtered members list
  const filteredUsers = users.filter((u) => {
    const status = getUserStatus(u.id);
    if (filterTab === "submitted") return status === "submitted";
    if (filterTab === "pending") return status === "pending" || status === "unsaved";
    return true;
  });

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
            Track and submit daily meal counts for members with real-time submission status.
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

      {/* Submission Status Summary Banner */}
      <motion.div
        variants={fadeIn}
        className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          isAllSubmitted
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-100"
            : unsavedCount > 0
            ? "bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-100"
            : "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100"
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-full ${
            isAllSubmitted
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : unsavedCount > 0
              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
              : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
          }`}>
            {isAllSubmitted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : unsavedCount > 0 ? (
              <Edit3 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-sm tracking-tight">
                {isAllSubmitted
                  ? `✓ All Meals Submitted for ${selectedDate}`
                  : unsavedCount > 0
                  ? `Unsaved Meal Edits on ${selectedDate}`
                  : `Meal Submission Pending for ${selectedDate}`}
              </h3>
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              {isAllSubmitted
                ? `All ${totalActiveUsers} member meal records are saved and confirmed in the database.`
                : `${submittedCount} of ${totalActiveUsers} submitted. ${pendingCount} pending, ${unsavedCount} unsaved.`}
            </p>
          </div>
        </div>

        {/* Status Pills & Progress */}
        <div className="flex items-center space-x-2 self-start md:self-auto">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {submittedCount} Submitted
          </span>

          {unsavedCount > 0 && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
              <Edit3 className="w-3.5 h-3.5" /> {unsavedCount} Unsaved
            </span>
          )}

          {pendingCount > 0 && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {pendingCount} Pending
            </span>
          )}
        </div>
      </motion.div>

      {/* Grid Layout: Compact Left Meals Matrix, Right Bazar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Compact Member Meal Cards */}
        <div className="lg:col-span-2 space-y-3">
          {/* Section Header & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                Active Members ({users.length}) — {selectedDate}
              </span>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  filterTab === "all"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                All ({users.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("submitted")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                  filterTab === "submitted"
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                }`}
              >
                <CheckCircle2 className="w-3 h-3" /> Submitted ({submittedCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("pending")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                  filterTab === "pending"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "text-amber-600 dark:text-amber-400 hover:text-amber-700"
                }`}
              >
                <Clock className="w-3 h-3" /> Pending ({pendingCount + unsavedCount})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-zinc-400">Loading daily meals matrix...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400 bg-card rounded-xl border border-zinc-200 dark:border-zinc-800">
              No members configured for meals. Go to Users page and assign "Member" role to members.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400 bg-card rounded-xl border border-zinc-200 dark:border-zinc-800">
              No members match the selected filter tab ({filterTab}).
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredUsers.map((user) => {
                const meal = meals[user.id] || { breakfast: 0.5, lunch: 1, dinner: 1, totalMeals: 2.5 };
                const saved = savedMeals[user.id];
                const status = getUserStatus(user.id);
                const isYou = user.id === profile?.id;

                return (
                  <motion.div
                    key={user.id}
                    variants={fadeIn}
                    className={`p-3.5 rounded-xl border bg-card shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      status === "submitted"
                        ? "border-emerald-500/30 hover:border-emerald-500/60"
                        : status === "unsaved"
                        ? "border-blue-500/40 hover:border-blue-500/70"
                        : "border-amber-500/40 hover:border-amber-500/70"
                    }`}
                  >
                    {/* Member Details & Status */}
                    <div className="flex items-center space-x-3 min-w-[200px]">
                      <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-black text-xs shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{user.name}</span>
                          {isYou && <Badge variant="info" className="text-[9px] px-1.5 py-0">You</Badge>}
                        </div>

                        {/* Status Badge */}
                        <div className="mt-0.5 flex items-center space-x-1.5">
                          {status === "submitted" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Submitted
                              {saved?.submittedBy ? ` (${saved.submittedBy})` : ""}
                            </span>
                          ) : status === "unsaved" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                              <Edit3 className="w-3 h-3" /> Unsaved Edits
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <AlertCircle className="w-3 h-3" /> Pending Submission
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Compact 3-Part Toggle: Breakfast (.5), Lunch (1), Dinner (1) */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Breakfast (.5) */}
                      <button
                        type="button"
                        onClick={() => handleMealChange(user.id, "breakfast", (meal.breakfast || 0) > 0 ? 0 : 0.5)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all border ${
                          (meal.breakfast || 0) > 0
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/40 shadow-xs"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent hover:text-zinc-600"
                        }`}
                      >
                        B ({meal.breakfast ?? 0})
                      </button>

                      {/* Lunch (1) */}
                      <button
                        type="button"
                        onClick={() => handleMealChange(user.id, "lunch", (meal.lunch || 0) > 0 ? 0 : 1)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all border ${
                          (meal.lunch || 0) > 0
                            ? "bg-brand/15 text-brand border-brand/40 shadow-xs"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent hover:text-zinc-600"
                        }`}
                      >
                        L ({meal.lunch ?? 0})
                      </button>

                      {/* Dinner (1) */}
                      <button
                        type="button"
                        onClick={() => handleMealChange(user.id, "dinner", (meal.dinner || 0) > 0 ? 0 : 1)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all border ${
                          (meal.dinner || 0) > 0
                            ? "bg-brand/15 text-brand border-brand/40 shadow-xs"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent hover:text-zinc-600"
                        }`}
                      >
                        D ({meal.dinner ?? 0})
                      </button>
                    </div>

                    {/* Presets, Total & Individual Submit Button */}
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
                      <span className="w-10 text-center font-black text-sm text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {meal.totalMeals}
                      </span>

                      {/* Single Submit Button */}
                      <button
                        type="button"
                        disabled={savingUserId === user.id}
                        onClick={() => handleSaveSingleMeal(user)}
                        title={status === "submitted" ? "Re-submit / Save meal" : "Submit meal for member"}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center ${
                          status === "submitted"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : status === "unsaved"
                            ? "bg-blue-600 text-white border-blue-500 hover:bg-blue-700 shadow-xs"
                            : "bg-brand text-white border-brand hover:bg-brand-hover shadow-xs"
                        }`}
                      >
                        {savingUserId === user.id ? (
                          <span className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : status === "submitted" ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
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
