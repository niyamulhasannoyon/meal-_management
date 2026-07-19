"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, getDoc, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile } from "@/context/AuthContext";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Utensils, 
  Wallet, 
  ShoppingCart,
  Calendar,
  Clock,
  TrendingUp,
  X
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Avatar from "@/components/layout/Avatar";
import { motion, AnimatePresence } from "framer-motion";

interface MealEntry {
  id: string;
  userId: string;
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  totalMeals: number;
}

interface PaymentEntry {
  id: string;
  userId: string;
  amount: number;
  paymentFor: string;
  paymentMethod: string;
  reference: string;
  date: any;
}

interface BazarEntry {
  id: string;
  date: any;
  amount: number;
  description: string;
  spenderId: string;
  spenderName: string;
}

interface MemberProfilePanelProps {
  userId: string | null;
  onClose: () => void;
}

export default function MemberProfilePanel({ userId, onClose }: MemberProfilePanelProps) {
  const [member, setMember] = useState<UserProfile | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [bazarContributions, setBazarContributions] = useState<BazarEntry[]>([]);
  const [mealRate, setMealRate] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchMemberData();
  }, [userId]);

  const fetchMemberData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Fetch user profile
      const userDoc = await getDoc(doc(db, "users", userId));
      if (!userDoc.exists()) {
        setLoading(false);
        return;
      }
      setMember({ id: userDoc.id, ...userDoc.data() } as UserProfile);

      // 2. Fetch meals for this user (last 200) - sorted client-side to avoid composite index requirement
      const mealsQuery = query(
        collection(db, "meals"),
        where("userId", "==", userId),
        limit(200)
      );
      const mealsSnap = await getDocs(mealsQuery);
      const mealsData: MealEntry[] = [];
      mealsSnap.forEach(d => {
        mealsData.push({ id: d.id, ...d.data() } as MealEntry);
      });
      // Sort client-side by date descending
      mealsData.sort((a, b) => b.date.localeCompare(a.date));
      setMeals(mealsData);

      // 3. Fetch payments/deposits for this user (last 200) - sorted client-side
      const paymentsQuery = query(
        collection(db, "payments"),
        where("userId", "==", userId),
        limit(200)
      );
      const paymentsSnap = await getDocs(paymentsQuery);
      const paymentsData: PaymentEntry[] = [];
      paymentsSnap.forEach(d => {
        paymentsData.push({ id: d.id, ...d.data() } as PaymentEntry);
      });
      // Sort client-side by date descending
      paymentsData.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setPayments(paymentsData);

      // 4. Fetch bazar contributions where this member is the spender
      const bazarQuery = query(
        collection(db, "bazar_costs"),
        where("spenderId", "==", userId),
        limit(200)
      );
      const bazarSnap = await getDocs(bazarQuery);
      const bazarData: BazarEntry[] = [];
      bazarSnap.forEach(d => {
        bazarData.push({ id: d.id, ...d.data() } as BazarEntry);
      });
      bazarData.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      setBazarContributions(bazarData);

      // 5. Fetch current month's meal rate for status calculation
      const currentMonth = format(new Date(), "yyyy-MM");
      const ledgerDoc = await getDoc(doc(db, "monthly_ledgers", currentMonth));
      if (ledgerDoc.exists()) {
        const ledgerData = ledgerDoc.data();
        setMealRate(ledgerData.mealRate || 0);
      } else {
        // Calculate meal rate on-the-fly from raw data
        const bazarAllSnap = await getDocs(collection(db, "bazar_costs"));
        let totalBazar = 0;
        bazarAllSnap.forEach(d => {
          const data = d.data();
          const dateObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
          if (format(dateObj, "yyyy-MM") === currentMonth) {
            totalBazar += Number(data.amount || 0);
          }
        });

        const mealsAllSnap = await getDocs(collection(db, "meals"));
        let totalMeals = 0;
        mealsAllSnap.forEach(d => {
          const data = d.data();
          if (data.date && data.date.startsWith(currentMonth)) {
            totalMeals += Number(data.totalMeals || 0);
          }
        });

        setMealRate(totalMeals > 0 ? totalBazar / totalMeals : 0);
      }

    } catch (error) {
      console.error("Error fetching member profile:", error);
      setMember(null);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalMealsEaten = meals.reduce((sum, m) => sum + m.totalMeals, 0);
  const mealDeposits = payments
    .filter(p => p.paymentFor === "meal")
    .reduce((sum, p) => sum + p.amount, 0);
  const bazarContributed = bazarContributions.reduce((sum, b) => sum + b.amount, 0);

  // Status calculation
  const estimatedMealCost = totalMealsEaten * mealRate;
  const totalDeposited = mealDeposits + bazarContributed;
  const balance = totalDeposited - estimatedMealCost;
  const isDue = balance < 0;
  const isExtra = balance > 0;

  return (
    <AnimatePresence>
      {userId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-2xl bg-gray-50 dark:bg-gray-950 shadow-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent"
                />
              </div>
            ) : !member ? (
              <div className="p-8 text-center text-gray-500">Member not found.</div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Profile Header */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-5">
                  <Avatar name={member.name} size={56} />
                  <div className="min-w-0">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white truncate">{member.name}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase tracking-wider border border-indigo-100 dark:border-indigo-800">
                        {member.role}
                      </span>
                      <span className="text-xs text-gray-400">{member.email}</span>
                    </div>
                  </div>
                </div>

                {/* Top Summary Card: Total Meals, Total Deposited, Total Bazar, Status */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center gap-1 mb-1">
                      <Utensils className="h-3 w-3 text-indigo-500" />
                    </div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Meals</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5">{totalMealsEaten}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center gap-1 mb-1">
                      <Wallet className="h-3 w-3 text-green-500" />
                    </div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Deposited</p>
                    <p className="text-lg font-black text-green-600 dark:text-green-400 mt-0.5">৳{formatCurrency(mealDeposits)}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center gap-1 mb-1">
                      <ShoppingCart className="h-3 w-3 text-orange-500" />
                    </div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Bazar Cost</p>
                    <p className="text-lg font-black text-orange-600 dark:text-orange-400 mt-0.5">৳{formatCurrency(bazarContributed)}</p>
                  </div>
                  <div className={`rounded-xl p-3 shadow-sm border ${
                    isDue
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
                      : isExtra
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700/50"
                  }`}>
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className={`h-3 w-3 ${
                        isDue ? "text-red-500" : isExtra ? "text-green-500" : "text-gray-400"
                      }`} />
                    </div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      {isDue ? "Due" : isExtra ? "Extra" : "Settled"}
                    </p>
                    <p className={`text-lg font-black mt-0.5 ${
                      isDue
                        ? "text-red-600 dark:text-red-400"
                        : isExtra
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}>
                      {isDue ? "৳" + formatCurrency(Math.abs(Math.round(balance))) : isExtra ? "৳" + formatCurrency(Math.round(balance)) : "—"}
                    </p>
                  </div>
                </div>

                {/* Daily Meal Log */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-indigo-500" />
                      Daily Meal Log
                    </h3>
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                      {meals.length} days
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {meals.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 italic text-xs">No meal records.</div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-50 dark:divide-gray-700/50">
                        <thead className="bg-gray-50/30 dark:bg-gray-900/20 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                            <th className="px-4 py-2 text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">B</th>
                            <th className="px-4 py-2 text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">L</th>
                            <th className="px-4 py-2 text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">D</th>
                            <th className="px-4 py-2 text-center text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                          {meals.map(meal => (
                            <tr key={meal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                              <td className="px-4 py-2 text-[11px] font-semibold text-gray-900 dark:text-white">
                                {meal.date ? format(new Date(meal.date), "MMM dd") : "-"}
                              </td>
                              <td className="px-4 py-2 text-center text-[11px] text-gray-600 dark:text-gray-400">{meal.breakfast || "-"}</td>
                              <td className="px-4 py-2 text-center text-[11px] text-gray-600 dark:text-gray-400">{meal.lunch || "-"}</td>
                              <td className="px-4 py-2 text-center text-[11px] text-gray-600 dark:text-gray-400">{meal.dinner || "-"}</td>
                              <td className="px-4 py-2 text-center text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/10">{meal.totalMeals}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Deposit History */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-500" />
                      Daily Deposit History
                    </h3>
                    <span className="text-[10px] bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">
                      {payments.filter(p => p.paymentFor === "meal").length} payments
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {payments.filter(p => p.paymentFor === "meal").length === 0 ? (
                      <div className="p-6 text-center text-gray-400 italic text-xs">No deposit records.</div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-50 dark:divide-gray-700/50">
                        <thead className="bg-gray-50/30 dark:bg-gray-900/20 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Method</th>
                            <th className="px-4 py-2 text-right text-[9px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                          {payments.filter(p => p.paymentFor === "meal").map(payment => {
                            let dateObj: Date;
                            try {
                              dateObj = payment.date?.toDate ? payment.date.toDate() : (payment.date ? new Date(payment.date) : new Date());
                              if (isNaN(dateObj.getTime())) dateObj = new Date();
                            } catch {
                              dateObj = new Date();
                            }
                            return (
                              <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-4 py-2 text-[11px] font-semibold text-gray-900 dark:text-white">
                                  {format(dateObj, "MMM dd, yyyy")}
                                </td>
                                <td className="px-4 py-2">
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                    {payment.paymentMethod || "Direct Deposit"}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right text-sm font-black text-green-600 dark:text-green-400">
                                  ৳{formatCurrency(payment.amount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Bazar Contribution Log */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-orange-500" />
                      Daily Bazar Contribution
                    </h3>
                    <span className="text-[10px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full font-bold">
                      {bazarContributions.length} entries
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {bazarContributions.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 italic text-xs">No bazar contributions.</div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-50 dark:divide-gray-700/50">
                        <thead className="bg-gray-50/30 dark:bg-gray-900/20 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Description</th>
                            <th className="px-4 py-2 text-right text-[9px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                          {bazarContributions.map(entry => {
                            const dateObj = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
                            return (
                              <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-4 py-2 text-[11px] font-semibold text-gray-900 dark:text-white">
                                  {format(dateObj, "MMM dd, yyyy")}
                                </td>
                                <td className="px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400 italic">
                                  {entry.description || "—"}
                                </td>
                                <td className="px-4 py-2 text-right text-sm font-black text-orange-600 dark:text-orange-400">
                                  ৳{formatCurrency(entry.amount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
