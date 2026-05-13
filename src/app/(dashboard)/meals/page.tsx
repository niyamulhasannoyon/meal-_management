"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, query, where, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { format, subDays } from "date-fns";
import { Calculator, ShoppingCart, Utensils, Calendar, Users as UsersIcon, PlusCircle, Save } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { sortUsers } from "@/lib/utils";
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
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meals, setMeals] = useState<Record<string, MealEntry>>({});
  const [isSubmittedForDate, setIsSubmittedForDate] = useState(false);
  
  // Bazar state
  const [bazarAmount, setBazarAmount] = useState("");
  const [bazarDesc, setBazarDesc] = useState("");
  const [bazarSpenderId, setBazarSpenderId] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsersAndMeals();
  }, [selectedDate]);

  useEffect(() => {
    // Automated submission trigger at 22:00 (10 PM)
    const checkAutoSubmit = () => {
      const now = new Date();
      const hours = now.getHours();
      const todayStr = format(new Date(), "yyyy-MM-dd");
      
      if (hours >= 22 && selectedDate === todayStr && !isSubmittedForDate && !loading && Object.keys(meals).length > 0) {
        console.log("Auto-submitting meals at 10 PM...");
        handleSaveMeals();
      }
    };

    const interval = setInterval(checkAutoSubmit, 60000); // Check every minute
    checkAutoSubmit(); // Check immediately on mount

    return () => clearInterval(interval);
  }, [selectedDate, isSubmittedForDate, loading, meals]);

  const fetchUsersAndMeals = async () => {
    setLoading(true);
    try {
      // Fetch all users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersData: UserProfile[] = [];
      usersSnap.forEach((doc) => {
        const data = doc.data();
        if (data.role !== "visitor") {
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

      // Populate default meals if not exist (will be overwritten by previous day's data if available)
      usersData.forEach(u => {
        if (!mealsData[u.id]) {
          mealsData[u.id] = {
            userId: u.id,
            date: selectedDate,
            breakfast: 0.5,
            lunch: 1,
            dinner: 1,
            totalMeals: 2.5
          };
        }
      });

      // If no meals submitted for this date, try to copy previous day's meals as defaults
      if (!hasSubmitted) {
        const prevDate = format(subDays(new Date(selectedDate), 1), "yyyy-MM-dd");
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

      if (usersData.length > 0 && !bazarSpenderId) {
        setBazarSpenderId(profile?.id || usersData[0].id);
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
        `Added bazar cost: ৳${bazarAmount} (Spender: ${spender?.name || "Unknown"})`
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
                    
                    let isEditable = false;
                    if (profile?.role === "admin" || profile?.role === "moderator") {
                      isEditable = true;
                    } else if (profile?.role === "member" && profile.id === user.id) {
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
            {(profile?.role === "admin" || profile?.role === "moderator" || profile?.role === "member") && (
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

        {/* Bazar Entry */}
        <div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
              <ShoppingCart className="h-5 w-5 text-indigo-600" />
              Add Bazar Cost
            </h2>
            <form onSubmit={handleAddBazar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (৳)</label>
                <input 
                  type="number" 
                  required 
                  value={bazarAmount}
                  onChange={e => setBazarAmount(e.target.value)}
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
                  placeholder="e.g. 500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                <input 
                  type="text" 
                  value={bazarDesc}
                  onChange={e => setBazarDesc(e.target.value)}
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
                  placeholder="e.g. Vegetables and Fish"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Spender (Who paid?)</label>
                <select 
                  value={bazarSpenderId}
                  onChange={e => setBazarSpenderId(e.target.value)}
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
                  required
                >
                  <option value="" disabled>Select Member</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <button 
                type="submit" 
                disabled={saving || profile?.role === "visitor"}
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-200 dark:shadow-none hover:bg-green-700 disabled:opacity-50 transition-all hover:-translate-y-0.5"
              >
                <PlusCircle className="h-4 w-4" />
                Add Bazar Entry
              </button>
            </form>
          </div>
        </div>

      </div>
    </motion.main>
  );
}
