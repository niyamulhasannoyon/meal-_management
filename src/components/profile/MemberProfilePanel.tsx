"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where, doc, getDoc, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile } from "@/context/AuthContext";
import { format, subMonths, addMonths } from "date-fns";
import { 
  Utensils, 
  Wallet, 
  ShoppingCart,
  Calendar,
  Clock,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  RotateCcw,
  Receipt
} from "lucide-react";
import { formatCurrency, getMonthStr } from "@/lib/utils";
import Avatar from "@/components/layout/Avatar";
import { motion, AnimatePresence } from "framer-motion";

import { useMonthlyLedger } from "@/hooks/useMonthlyLedger";

function safeParseDate(val: unknown): Date {
  if (!val) return new Date();
  if (typeof val === "object" && val !== null && "toDate" in val && typeof (val as { toDate?: Function }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) return val;
  const parsed = new Date(val as string | number);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatMonthLabel(monthStr: string): string {
  try {
    const [year, month] = monthStr.split("-").map(Number);
    if (!year || !month) return monthStr;
    const d = new Date(year, month - 1, 1);
    return format(d, "MMMM yyyy");
  } catch {
    return monthStr;
  }
}

interface MealEntry {
  id: string;
  userId: string;
  date: string;
  breakfast?: number;
  lunch?: number;
  dinner?: number;
  totalMeals?: number;
  count?: number;
}

function getMealCount(meal: MealEntry): number {
  if (meal.count !== undefined) return Number(meal.count) || 0;
  if (meal.totalMeals !== undefined) return Number(meal.totalMeals) || 0;
  return (Number(meal.breakfast) || 0) + (Number(meal.lunch) || 0) + (Number(meal.dinner) || 0);
}

interface PaymentEntry {
  id: string;
  userId: string;
  amount: number;
  paymentFor: string;
  paymentMethod: string;
  reference: string;
  date: unknown;
}

interface BazarEntry {
  id: string;
  date: unknown;
  amount: number;
  description: string;
  spenderId: string;
  spenderName: string;
}

interface MemberProfilePanelProps {
  userId: string | null;
  onClose: () => void;
  initialMonth?: string;
}

export default function MemberProfilePanel({ userId, onClose, initialMonth }: MemberProfilePanelProps) {
  const runningMonth = useMemo(() => format(new Date(), "yyyy-MM"), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || runningMonth);
  
  const [member, setMember] = useState<UserProfile | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [bazarContributions, setBazarContributions] = useState<BazarEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync with official monthly ledger calculation engine
  const { ledgerResult, loading: loadingLedger, availableMonths: ledgerMonths } = useMonthlyLedger(selectedMonth);

  // Sync initial month if prop changes when opening
  useEffect(() => {
    if (userId) {
      setSelectedMonth(initialMonth || runningMonth);
    }
  }, [userId, initialMonth, runningMonth]);

  // Fetch member core data
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

      // 2. Fetch meals for this user (up to 500)
      const mealsQuery = query(
        collection(db, "meals"),
        where("userId", "==", userId),
        limit(500)
      );
      const mealsSnap = await getDocs(mealsQuery);
      const mealsData: MealEntry[] = [];
      mealsSnap.forEach(d => {
        mealsData.push({ id: d.id, ...d.data() } as MealEntry);
      });
      mealsData.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setMeals(mealsData);

      // 3. Fetch payments/deposits for this user (up to 500)
      const paymentsQuery = query(
        collection(db, "payments"),
        where("userId", "==", userId),
        limit(500)
      );
      const paymentsSnap = await getDocs(paymentsQuery);
      const paymentsData: PaymentEntry[] = [];
      paymentsSnap.forEach(d => {
        paymentsData.push({ id: d.id, ...d.data() } as PaymentEntry);
      });
      paymentsData.sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());
      setPayments(paymentsData);

      // 4. Fetch bazar contributions where this member is the spender
      const bazarQuery = query(
        collection(db, "bazar_costs"),
        where("spenderId", "==", userId),
        limit(500)
      );
      const bazarSnap = await getDocs(bazarQuery);
      const bazarData: BazarEntry[] = [];
      bazarSnap.forEach(d => {
        bazarData.push({ id: d.id, ...d.data() } as BazarEntry);
      });
      bazarData.sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());
      setBazarContributions(bazarData);

    } catch (error) {
      console.error("Error fetching member profile:", error);
      setMember(null);
    } finally {
      setLoading(false);
    }
  };

  // Build available month options list
  const availableMonths = useMemo(() => {
    const setM = new Set<string>(ledgerMonths || []);
    setM.add(runningMonth);
    if (initialMonth) setM.add(initialMonth);

    meals.forEach(m => {
      const mStr = getMonthStr(m.date);
      if (mStr) setM.add(mStr);
    });
    payments.forEach(p => {
      const mStr = getMonthStr(p.date as any);
      if (mStr) setM.add(mStr);
    });
    bazarContributions.forEach(b => {
      const mStr = getMonthStr(b.date as any);
      if (mStr) setM.add(mStr);
    });

    // Add recent 6 months padding
    const today = new Date();
    for (let i = 0; i < 6; i++) {
      setM.add(format(subMonths(today, i), "yyyy-MM"));
    }

    return Array.from(setM).sort().reverse();
  }, [ledgerMonths, meals, payments, bazarContributions, runningMonth, initialMonth]);

  // Filtered data for selected month
  const filteredMeals = useMemo(() => {
    return meals.filter(m => getMonthStr(m.date) === selectedMonth);
  }, [meals, selectedMonth]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => getMonthStr(p.date as any) === selectedMonth && p.paymentFor === "meal");
  }, [payments, selectedMonth]);

  const filteredBazar = useMemo(() => {
    return bazarContributions.filter(b => getMonthStr(b.date as any) === selectedMonth);
  }, [bazarContributions, selectedMonth]);

  // Read official calculations from ledgerResult
  const userCalc = ledgerResult?.users.find((u) => u.id === userId);
  const currentMealRate = ledgerResult?.mealRate ?? 0;

  // Compute daily meals count sum
  const detailedMealsSum = filteredMeals.reduce((sum, m) => sum + getMealCount(m), 0);
  const totalMealsEaten = userCalc ? userCalc.totalMeals : detailedMealsSum;
  const estimatedMealCost = userCalc ? userCalc.mealCost : totalMealsEaten * currentMealRate;

  const directPaymentsTotal = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const bazarContributed = filteredBazar.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const totalDeposits = userCalc ? userCalc.deposits : (directPaymentsTotal + bazarContributed);
  const balance = userCalc ? userCalc.balance : (totalDeposits - estimatedMealCost);

  const isDue = balance < 0;
  const isExtra = balance > 0;

  // Month navigation helpers
  const handlePrevMonth = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx !== -1 && idx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[idx + 1]);
    } else {
      try {
        const [y, m] = selectedMonth.split("-").map(Number);
        const prev = subMonths(new Date(y, m - 1, 1), 1);
        setSelectedMonth(format(prev, "yyyy-MM"));
      } catch {
        // ignore
      }
    }
  };

  const handleNextMonth = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx > 0) {
      setSelectedMonth(availableMonths[idx - 1]);
    } else {
      try {
        const [y, m] = selectedMonth.split("-").map(Number);
        const next = addMonths(new Date(y, m - 1, 1), 1);
        setSelectedMonth(format(next, "yyyy-MM"));
      } catch {
        // ignore
      }
    }
  };

  const isRunningMonth = selectedMonth === runningMonth;

  return (
    <AnimatePresence>
      {userId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Centered Professional Modal Popup Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[88vh] my-auto"
          >
            {/* Modal Header */}
            <div className="bg-zinc-950 text-white p-5 sm:p-6 border-b border-zinc-800 relative overflow-hidden">
              {/* Subtle background glow decorative gradient */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <Sparkles className="w-3.5 h-3.5" /> Member Overview
                  </span>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {loading ? (
                <div className="py-6 flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                </div>
              ) : member ? (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Profile info */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar name={member.name} src={member.photoURL} size={56} />
                      <span className="absolute -bottom-1 -right-1 bg-emerald-500 w-4 h-4 rounded-full border-2 border-zinc-950" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white tracking-tight">{member.name}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="inline-flex items-center rounded-md bg-indigo-500/30 text-indigo-300 text-[10px] font-extrabold uppercase px-2 py-0.5 border border-indigo-500/30">
                          {member.role}
                        </span>
                        <span className="text-xs text-zinc-400">{member.email || "No Email"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Month Navigation Control Bar */}
                  <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800 shadow-inner">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="relative flex items-center">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent text-xs font-bold text-white px-2 py-1 cursor-pointer focus:outline-none appearance-none pr-5 text-center"
                      >
                        {availableMonths.map((m) => (
                          <option key={m} value={m} className="bg-zinc-900 text-white">
                            {formatMonthLabel(m)} {m === runningMonth ? "(Running)" : ""}
                          </option>
                        ))}
                      </select>
                      <span className="absolute right-1 text-zinc-400 pointer-events-none text-[10px]">▼</span>
                    </div>

                    <button
                      onClick={handleNextMonth}
                      className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {!isRunningMonth && (
                      <button
                        onClick={() => setSelectedMonth(runningMonth)}
                        className="ml-1 p-1.5 text-xs text-indigo-300 hover:text-white hover:bg-indigo-600/30 rounded-xl transition-colors flex items-center gap-1 font-semibold"
                        title="Jump to Running Month"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span className="hidden sm:inline text-[10px]">Current</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-zinc-50 dark:bg-zinc-950">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-3">
                  <div className="h-8 w-8 rounded-full border-3 border-indigo-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-zinc-400">Loading member ledger details...</p>
                </div>
              ) : !member ? (
                <div className="py-12 text-center text-zinc-400 text-sm">Member record not found.</div>
              ) : (
                <>
                  {/* Selected Month Status Indicator */}
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-500" />
                      Month Ledger: <strong className="text-zinc-900 dark:text-white">{formatMonthLabel(selectedMonth)}</strong>
                    </span>
                    {isRunningMonth ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                        Running Month
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
                        Historical Record
                      </span>
                    )}
                  </div>

                  {/* Top Stats Cards for Selected Month */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Total Meals */}
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Meals</span>
                        <Utensils className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div className="mt-2">
                        <span className="text-2xl font-black text-zinc-900 dark:text-white">{totalMealsEaten}</span>
                        {userCalc?.minMealAdjustment && userCalc.minMealAdjustment > 0 ? (
                          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                            (Inc. +{userCalc.minMealAdjustment} min. quota adj.)
                          </p>
                        ) : (
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            Rate: {loadingLedger ? "..." : `৳${currentMealRate.toFixed(2)}/meal`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Meal Cost */}
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Meal Cost</span>
                        <Receipt className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="mt-2">
                        <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                          ৳{formatCurrency(Math.round(estimatedMealCost))}
                        </span>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {totalMealsEaten} meals × ৳{currentMealRate.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Total Deposits (Direct Payments + Bazar) */}
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Deposits</span>
                        <Wallet className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="mt-2">
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                          ৳{formatCurrency(Math.round(totalDeposits))}
                        </span>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Bazar: ৳{formatCurrency(bazarContributed)} | Cash: ৳{formatCurrency(directPaymentsTotal)}
                        </p>
                      </div>
                    </div>

                    {/* Monthly Status / Month Extra / Month Due */}
                    <div className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between ${
                      isDue
                        ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                        : isExtra
                        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50"
                        : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          {isDue ? "Month Due" : isExtra ? "Month Extra" : "Status"}
                        </span>
                        <TrendingUp className={`w-4 h-4 ${
                          isDue ? "text-rose-500" : isExtra ? "text-emerald-500" : "text-zinc-400"
                        }`} />
                      </div>
                      <div className="mt-2">
                        <span className={`text-2xl font-black ${
                          isDue
                            ? "text-rose-600 dark:text-rose-400"
                            : isExtra
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-zinc-600 dark:text-zinc-400"
                        }`}>
                          {isDue
                            ? `৳${formatCurrency(Math.abs(Math.round(balance)))}`
                            : isExtra
                            ? `৳${formatCurrency(Math.round(balance))}`
                            : "Settled"}
                        </span>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Deposits - Meal Cost
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Daily Meal Log Table for Selected Month */}
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 flex items-center justify-between">
                      <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Utensils className="h-4 w-4 text-indigo-500" />
                        Daily Meal Log ({formatMonthLabel(selectedMonth)})
                      </h3>
                      <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 dark:border-indigo-900">
                        {filteredMeals.length} days recorded
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto">
                      {filteredMeals.length === 0 ? (
                        <div className="py-8 text-center text-zinc-400 italic text-xs">
                          No meal records found for {formatMonthLabel(selectedMonth)}.
                        </div>
                      ) : (
                        <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800">
                          <thead className="bg-zinc-50 dark:bg-zinc-950 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Date</th>
                              <th className="px-4 py-2 text-center text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Breakfast</th>
                              <th className="px-4 py-2 text-center text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Lunch</th>
                              <th className="px-4 py-2 text-center text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Dinner</th>
                              <th className="px-4 py-2 text-center text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                            {filteredMeals.map((meal) => (
                              <tr key={meal.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                <td className="px-4 py-2 text-[11px] font-semibold text-zinc-900 dark:text-white">
                                  {meal.date ? format(safeParseDate(meal.date), "MMM dd, yyyy") : "-"}
                                </td>
                                <td className="px-4 py-2 text-center text-[11px] text-zinc-600 dark:text-zinc-400">{meal.breakfast !== undefined ? meal.breakfast : "-"}</td>
                                <td className="px-4 py-2 text-center text-[11px] text-zinc-600 dark:text-zinc-400">{meal.lunch !== undefined ? meal.lunch : "-"}</td>
                                <td className="px-4 py-2 text-center text-[11px] text-zinc-600 dark:text-zinc-400">{meal.dinner !== undefined ? meal.dinner : "-"}</td>
                                <td className="px-4 py-2 text-center text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30">
                                  {getMealCount(meal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>



                  {/* Daily Bazar Contribution Table for Selected Month */}
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 flex items-center justify-between">
                      <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-amber-500" />
                        Bazar Cost Contributions ({formatMonthLabel(selectedMonth)})
                      </h3>
                      <span className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full font-bold border border-amber-100 dark:border-amber-900">
                        {filteredBazar.length} entries
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto">
                      {filteredBazar.length === 0 ? (
                        <div className="py-8 text-center text-zinc-400 italic text-xs">
                          No bazar contributions found for {formatMonthLabel(selectedMonth)}.
                        </div>
                      ) : (
                        <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800">
                          <thead className="bg-zinc-50 dark:bg-zinc-950 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Date</th>
                              <th className="px-4 py-2 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Description</th>
                              <th className="px-4 py-2 text-right text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                            {filteredBazar.map((entry) => {
                              const dateObj = safeParseDate(entry.date);
                              return (
                                <tr key={entry.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                  <td className="px-4 py-2 text-[11px] font-semibold text-zinc-900 dark:text-white">
                                    {format(dateObj, "MMM dd, yyyy")}
                                  </td>
                                  <td className="px-4 py-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                                    {entry.description || "—"}
                                  </td>
                                  <td className="px-4 py-2 text-right text-xs font-black text-amber-600 dark:text-amber-400">
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
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
