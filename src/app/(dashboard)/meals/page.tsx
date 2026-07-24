"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, setDoc, query, where, addDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { format } from "date-fns";
import { Calculator, ShoppingCart, Utensils, Calendar, Users as UsersIcon, PlusCircle, Save, Edit3, Trash2, History, X } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { sortUsers, formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";
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

export default function MealsPage() {
  const { profile, settings } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meals, setMeals] = useState<Record<string, MealEntry>>({});
  const [isSubmittedForDate, setIsSubmittedForDate] = useState(false);
  
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

  // Get current month from selected date
  const currentMonth = format(new Date(selectedDate), "yyyy-MM");

  useEffect(() => {
    if (settings) {
      setSystemStartDate(settings.systemStartDate || "");
    }
  }, [settings]);

  useEffect(() => {
    fetchUsersAndMeals();
  }, [selectedDate]);

  // Set default bazar spender when users list or profile loads
  useEffect(() => {
    if (users.length > 0) {
      const isValidSpender = users.some(u => u.id === bazarSpenderId);
      if (!isValidSpender) {
        const isMember = users.some(u => u.id === profile?.id);
        const defaultSpender = isMember ? (profile?.id || "") : "";
        if (bazarSpenderId !== defaultSpender) {
          setBazarSpenderId(defaultSpender);
        }
      }
    }
  }, [users, profile, bazarSpenderId]);

  useEffect(() => {
    // Automated submission trigger
    const checkAutoSubmit = () => {
      const autoEnabled = settings?.autoSubmitEnabled !== undefined ? settings.autoSubmitEnabled : true;
      const autoHour = settings?.autoSubmitHour !== undefined ? settings.autoSubmitHour : 22;
      if (!autoEnabled) return;

      const now = new Date();
      const hours = now.getHours();
      const todayStr = format(new Date(), "yyyy-MM-dd");
      
      if (hours >= autoHour && selectedDate === todayStr && !isSubmittedForDate && !loading && Object.keys(meals).length > 0) {
        console.log(`Auto-submitting meals at ${autoHour}:00...`);
        handleSaveMeals();
      }
    };

    const interval = setInterval(checkAutoSubmit, 60000); // Check every minute
    checkAutoSubmit(); // Check immediately on mount

    return () => clearInterval(interval);
  }, [selectedDate, isSubmittedForDate, loading, meals, settings]);

  // Real-time bazar listener — automatically updates whenever bazar_costs changes in Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "bazar_costs"), (snapshot) => {
      const entries: BazarEntry[] = [];
      snapshot.forEach(d => {
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
    }, (error) => {
      console.error("Real-time bazar listener error:", error);
    });

    return () => unsubscribe();
  }, [currentMonth, systemStartDate]);

  const fetchUsersAndMeals = async () => {
    setLoading(true);
    try {
      // Settings are loaded reactively from AuthContext

      const usersSnap = await getDocs(collection(db, "users"));
      const usersData: UserProfile[] = [];
      usersSnap.forEach((doc) => {
        const data = doc.data();
        if (data.role === "member" || data.role === "moderator") {
          usersData.push({ id: doc.id, ...data } as UserProfile);
        }
      });
      setUsers(sortUsers(usersData));

      // Fetch meals for selected date
      const mealsQuery = query(collection(db, "meals"), where("date", "==", selectedDate));
      const mealsSnap = await getDocs(mealsQuery);
      
      const mealsData: Record<string, MealEntry> = {};
      let hasSubmitted = false;
      mealsSnap.forEach((doc) => {
        const data = doc.data() as MealEntry;
        mealsData[data.userId] = { id: doc.id, ...data };
        hasSubmitted = true;
      });
      setIsSubmittedForDate(hasSubmitted);

      const defBreakfast = settings?.defaultBreakfast !== undefined ? settings.defaultBreakfast : 0.5;
      const defLunch = settings?.defaultLunch !== undefined ? settings.defaultLunch : 1.0;
      const defDinner = settings?.defaultDinner !== undefined ? settings.defaultDinner : 1.0;

      // Populate default meals if not exist (will be overwritten by previous day's data if available)
      usersData.forEach(u => {
        if (!mealsData[u.id]) {
          mealsData[u.id] = {
            userId: u.id,
            date: selectedDate,
            breakfast: defBreakfast,
            lunch: defLunch,
            dinner: defDinner,
            totalMeals: defBreakfast + defLunch + defDinner
          };
        }
      });

      // If no meals submitted for this date, try to copy previous day's meals as defaults
      if (!hasSubmitted) {
        const prevDate = format(new Date(new Date(selectedDate).getTime() - 86400000), "yyyy-MM-dd");
        const prevMealsSnap = await getDocs(query(collection(db, "meals"), where("date", "==", prevDate)));
        const prevMeals: Record<string, MealEntry> = {};
        prevMealsSnap.forEach(doc => {
          const data = doc.data() as MealEntry;
          prevMeals[data.userId] = data;
        });
        // Override defaults where previous data exists
        Object.keys(mealsData).forEach(uid => {
          if (prevMeals[uid]) {
            mealsData[uid] = {
              ...mealsData[uid],
              breakfast: prevMeals[uid].breakfast,
              lunch: prevMeals[uid].lunch,
              dinner: prevMeals[uid].dinner,
              totalMeals: prevMeals[uid].breakfast + prevMeals[uid].lunch + prevMeals[uid].dinner,
            };
          }
        });
      }

      setMeals(mealsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMealChange = (userId: string, field: "breakfast"|"lunch"|"dinner", value: number) => {
    setMeals(prev => {
      const entry = { ...prev[userId], [field]: value };
      entry.totalMeals = entry.breakfast + entry.lunch + entry.dinner;
      return { ...prev, [userId]: entry };
    });
  };

  const handleSaveMeals = async () => {
    setSaving(true);
    try {
      for (const userId of Object.keys(meals)) {
        const entry = meals[userId];
        const docId = entry.id || `${selectedDate}_${userId}`;
        await setDoc(doc(db, "meals", docId), {
          ...entry,
          id: docId,
          createdAt: entry.createdAt || new Date().toISOString()
        });
      }
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "UPDATED_MEALS",
        `Updated meals for ${selectedDate}`
      );
      
      setIsSubmittedForDate(true);
      toast.success("Meals saved successfully!");
    } catch (error) {
      console.error("Error saving meals:", error);
      toast.error("Failed to save meals.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBazar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bazarAmount) return;
    
    setSaving(true);
    try {
      const spender = users.find(u => u.id === bazarSpenderId);
      await addDoc(collection(db, "bazar_costs"), {
        date: new Date(),
        amount: Number(bazarAmount),
        description: bazarDesc,
        addedBy: profile?.id,
        spenderId: bazarSpenderId,
        spenderName: spender?.name || "Unknown"
      });
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "ADDED_BAZAR",
        `Added bazar cost: ${settings?.currencySymbol || "৳"}${bazarAmount} (Spender: ${spender?.name || "Unknown"})`
      );
      
      setBazarAmount("");
      setBazarDesc("");
      toast.success("Bazar cost added!");
    } catch (error) {
      console.error("Error adding bazar:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditBazar = (entry: BazarEntry) => {
    setEditingBazar(entry);
    setEditBazarAmount(String(entry.amount));
    setEditBazarDesc(entry.description || "");
    setEditBazarSpenderId(entry.spenderId || "");
  };

  const handleUpdateBazar = async () => {
    if (!editingBazar || !editBazarAmount) return;
    setSaving(true);
    try {
      const spender = users.find(u => u.id === editBazarSpenderId);
      await updateDoc(doc(db, "bazar_costs", editingBazar.id), {
        amount: Number(editBazarAmount),
        description: editBazarDesc,
        spenderId: editBazarSpenderId,
        spenderName: spender?.name || "Unknown"
      });

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "UPDATED_BAZAR",
        `Updated bazar cost: ${settings?.currencySymbol || "৳"}${editBazarAmount} (Spender: ${spender?.name || "Unknown"})`
      );

      toast.success("Bazar entry updated successfully!");
      setEditingBazar(null);
      setEditBazarAmount("");
      setEditBazarDesc("");
      setEditBazarSpenderId("");
    } catch (error) {
      console.error("Error updating bazar:", error);
      toast.error("Failed to update bazar entry.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBazar = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this bazar entry? This cannot be undone.")) return;
    setSaving(true);
    try {
      const deletedEntry = bazarEntries.find(e => e.id === entryId);
      await deleteDoc(doc(db, "bazar_costs", entryId));

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "DELETED_BAZAR",
        `Deleted bazar cost of ${settings?.currencySymbol || "৳"}${deletedEntry?.amount || ""} (Spender: ${deletedEntry?.spenderName || "Unknown"})`
      );

      toast.success("Bazar entry deleted!");
    } catch (error) {
      console.error("Error deleting bazar:", error);
      toast.error("Failed to delete bazar entry.");
    } finally {
      setSaving(false);
    }
  };

  // Derive bazar total from the live bazar entries state (avoids redundant state)
  const currentMonthBazarTotal = bazarEntries.reduce((sum, e) => sum + e.amount, 0);

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

  return (
    <motion.main 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8"
    >
      {systemStartDate && selectedDate < systemStartDate && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400 text-sm font-semibold flex items-center gap-2">
          ⚠️ Meal logging and bazar entries are disabled because the selected date is before the System Start Date ({systemStartDate}).
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 sticky top-[73px] z-20 backdrop-blur-md bg-white/90">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Utensils className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Daily Meals & Bazar
          </h1>
          <p className="mt-1 text-sm text-gray-500">Manage daily counts and market costs.</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
          <Calendar className="h-4 w-4 text-gray-400 ml-2" />
          <input 
            type="date" 
            value={selectedDate}
            max={profile?.role === "admin" || profile?.role === "moderator" ? undefined : format(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border-0 bg-transparent text-sm font-medium focus:ring-0 dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Meal Entry */}
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-white/10">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-gray-500" />
                Meal Entries
              </h2>
              {isSubmittedForDate ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  ✓ Submitted
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Pending
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Member</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Breakfast</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Lunch</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Dinner</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider font-bold text-indigo-600">Total</th>
                  </tr>
                </thead>
                <motion.tbody 
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-gray-200 dark:divide-gray-700"
                >
                  {users.map(user => {
                    const meal = meals[user.id];
                    if (!meal) return null;
                    
                    const allowMemberEditing = settings?.allowMemberEditing !== undefined ? settings.allowMemberEditing : true;
                    let isEditable = false;
                    if (systemStartDate && selectedDate < systemStartDate) {
                      isEditable = false;
                    } else if (profile?.role === "admin" || profile?.role === "moderator") {
                      isEditable = true;
                    } else if (profile?.role === "member" && profile.id === user.id && allowMemberEditing) {
                      isEditable = true;
                    } else if (profile?.role === "visitor") {
                      isEditable = false;
                    }

                    return (
                      <motion.tr variants={item} key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" step="0.5" min="0" max="2" value={meal.breakfast} onChange={(e) => handleMealChange(user.id, "breakfast", Number(e.target.value) || 0)} disabled={!isEditable} className="w-16 rounded-lg border-gray-200 py-1 text-center text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" step="0.5" min="0" max="2" value={meal.lunch} onChange={(e) => handleMealChange(user.id, "lunch", Number(e.target.value) || 0)} disabled={!isEditable} className="w-16 rounded-lg border-gray-200 py-1 text-center text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" step="0.5" min="0" max="2" value={meal.dinner} onChange={(e) => handleMealChange(user.id, "dinner", Number(e.target.value) || 0)} disabled={!isEditable} className="w-16 rounded-lg border-gray-200 py-1 text-center text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50" />
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/10">
                          {meal.totalMeals}
                        </td>
                      </motion.tr>
                    )
                  })}
                </motion.tbody>
              </table>
             </div>
            {(profile?.role === "admin" || profile?.role === "moderator" || profile?.role === "member") && !(systemStartDate && selectedDate < systemStartDate) && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end border-t border-gray-100 dark:border-gray-700">
                <button 
                  onClick={handleSaveMeals} 
                  disabled={saving} 
                  className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-xl bg-indigo-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                >
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Daily Meals
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bazar Section */}
        <div className="space-y-6">
          {/* Add Bazar Form */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
              <ShoppingCart className="h-5 w-5 text-indigo-600" />
              Add Bazar Cost
            </h2>
            <form onSubmit={handleAddBazar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ({settings?.currencySymbol || "৳"})</label>
                <input 
                  type="number" 
                  required 
                  value={bazarAmount}
                  onChange={e => setBazarAmount(e.target.value)}
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
                  placeholder="e.g. 500"
                  disabled={systemStartDate !== "" && selectedDate < systemStartDate}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                <input 
                  type="text" 
                  value={bazarDesc}
                  onChange={e => setBazarDesc(e.target.value)}
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all disabled:opacity-50"
                  placeholder="e.g. Vegetables and Fish"
                  disabled={systemStartDate !== "" && selectedDate < systemStartDate}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Spender (Who paid?)</label>
                <select 
                  value={bazarSpenderId}
                  onChange={e => setBazarSpenderId(e.target.value)}
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all disabled:opacity-50"
                  required
                  disabled={systemStartDate !== "" && selectedDate < systemStartDate}
                >
                  <option value="" disabled>Select Member</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <button 
                type="submit" 
                disabled={saving || profile?.role === "visitor" || (systemStartDate !== "" && selectedDate < systemStartDate)}
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-200 dark:shadow-none hover:bg-green-700 disabled:opacity-50 transition-all hover:-translate-y-0.5"
              >
                <PlusCircle className="h-4 w-4" />
                Add Bazar Entry
              </button>
            </form>
          </div>

          {/* Bazar History Toggle & List */}
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 overflow-hidden">
            <button
              onClick={() => setShowBazarHistory(!showBazarHistory)}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-600" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  Bazar History ({format(new Date(selectedDate), "MMM yyyy")})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                  Total: {settings?.currencySymbol || "৳"}{formatCurrency(currentMonthBazarTotal)}
                </span>
                <motion.div
                  animate={{ rotate: showBazarHistory ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.div>
              </div>
            </button>

            {showBazarHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="border-t border-gray-100 dark:border-gray-700"
              >
                {bazarEntries.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400 italic">
                    No bazar entries for this month.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-50 dark:divide-gray-700/50">
                      <thead className="bg-gray-50/50 dark:bg-gray-900/30 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                          <th className="px-3 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Spender</th>
                          <th className="px-3 py-2 text-right text-[9px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                          <th className="px-3 py-2 text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                        {bazarEntries.map(entry => {
                          const dateObj = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
                          return (
                            <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                              <td className="px-3 py-2 text-[11px] font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                                {format(dateObj, "MMM dd")}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-gray-600 dark:text-gray-400">
                                {entry.spenderName || "Unknown"}
                                {entry.description && (
                                  <span className="block text-[9px] text-gray-400 italic">{entry.description}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-right font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                                {settings?.currencySymbol || "৳"}{formatCurrency(entry.amount)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {(profile?.role === "admin" || profile?.role === "moderator") && (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleEditBazar(entry)}
                                      className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                      title="Edit Bazar"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteBazar(entry.id)}
                                      disabled={saving}
                                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                      title="Delete Bazar"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Bazar Modal */}
      {editingBazar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Bazar Entry</h3>
              <button
                onClick={() => setEditingBazar(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ({settings?.currencySymbol || "৳"})</label>
                <input
                  type="number"
                  required
                  value={editBazarAmount}
                  onChange={e => setEditBazarAmount(e.target.value)}
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g. 500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={editBazarDesc}
                  onChange={e => setEditBazarDesc(e.target.value)}
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g. Vegetables and Fish"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Spender (Who paid?)</label>
                <select
                  value={editBazarSpenderId}
                  onChange={e => setEditBazarSpenderId(e.target.value)}
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                >
                  <option value="" disabled>Select Member</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingBazar(null)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateBazar}
                  disabled={saving || !editBazarAmount}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Update Entry"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.main>
  );
}
