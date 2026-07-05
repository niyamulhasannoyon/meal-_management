"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, getDoc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { format } from "date-fns";
import { Calculator, Lock, Unlock, FileText, PlusCircle, Search, Download, Printer, History } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { sortUsers, formatCurrency } from "@/lib/utils";
import Avatar from "@/components/layout/Avatar";
import toast from "react-hot-toast";
interface LedgerUser {
  id: string;
  name: string;
  totalMeals: number;
  fineMeals: number;
  mealCost: number;
  deposits: number;
  balance: number;
  isSettled?: boolean;
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

export default function LedgerPage() {
  const { profile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), "yyyy-MM"));
  const [ledgerUsers, setLedgerUsers] = useState<LedgerUser[]>([]);

  const [mealRate, setMealRate] = useState(0);
  const [totalMessMeals, setTotalMessMeals] = useState(0);
  const [totalBazar, setTotalBazar] = useState(0);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [isClosed, setIsClosed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Deposit state
  const [showDepositForm, setShowDepositForm] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [isEditingLedger, setIsEditingLedger] = useState(false);

  // New Deposit modal states
  const [showDepositModal, setShowDepositModal] = useState<string | null>(null);
  const [depositMethod, setDepositMethod] = useState("Cash");
  const [depositRef, setDepositRef] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Payment history log states
  const [showPaymentsLog, setShowPaymentsLog] = useState(false);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);

  const fetchPaymentsList = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, "system_config", "settings"));
      const systemStartDate = settingsDoc.exists() ? (settingsDoc.data().systemStartDate || "") : "";

      const paySnap = await getDocs(collection(db, "payments"));
      const list: any[] = [];
      paySnap.forEach(d => {
        const data = d.data();
        const dateObj = data.date?.toDate ? data.date.toDate() : (data.date ? new Date(data.date) : null);
        if (dateObj) {
          const dateStr = format(dateObj, "yyyy-MM-dd");
          if (format(dateObj, "yyyy-MM") === currentMonth && (!systemStartDate || dateStr >= systemStartDate)) {
            list.push({ id: d.id, ...data, date: dateObj });
          }
        }
      });
      list.sort((a, b) => b.date.getTime() - a.date.getTime());
      setPaymentsList(list);
    } catch (err) {
      console.error("Error fetching payments list:", err);
    }
  };

  useEffect(() => {
    if (showPaymentsLog) {
      fetchPaymentsList();
    }
  }, [showPaymentsLog, currentMonth]);

  const handleExportCSV = () => {
    const headers = ["Member", "Total Meals", "Meal Cost (TK)", "Deposits (TK)", "Due (TK)", "Extra (TK)"];
    const rows = ledgerUsers.map(u => [
      `"${u.name}"`,
      u.totalMeals,
      Math.round(u.mealCost),
      u.deposits,
      !u.isSettled && Math.round(u.balance) < 0 ? Math.abs(Math.round(u.balance)) : "-",
      Math.round(u.balance) > 0 ? Math.round(u.balance) : "-"
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ledger_${currentMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchLedger();
  }, [currentMonth]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const ledgerDoc = await getDoc(doc(db, "monthly_ledgers", currentMonth));

      if (ledgerDoc.exists()) {
        const data = ledgerDoc.data();
        if (data.isClosed) {
          // Month is closed, load frozen data
          setIsClosed(true);
          setMealRate(data.mealRate);
          setTotalMessMeals(data.totalMeals);
          setTotalBazar(data.totalBazar);
          setTotalDeposits(data.totalDeposits || (data.users || []).reduce((sum: number, u: any) => sum + (u.deposits || 0), 0));
          setLedgerUsers(data.users || []);
          setLoading(false);
          return;
        }
      }

      // 2. Real-time Calculation if not closed
      setIsClosed(false);

      // Fetch system start date
      const settingsDoc = await getDoc(doc(db, "system_config", "settings"));
      const systemStartDate = settingsDoc.exists() ? (settingsDoc.data().systemStartDate || "") : "";

      // Fetch all users
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers: UserProfile[] = [];
      usersSnap.forEach((d) => {
        const data = d.data();
        if (data.role === "member") {
          allUsers.push({ id: d.id, ...data } as UserProfile);
        }
      });

      // Fetch all meals
      const mealsSnap = await getDocs(collection(db, "meals"));
      let tMeals = 0;
      const userMealsCount: Record<string, number> = {};
      const userMealDeposits: Record<string, number> = {};
      mealsSnap.forEach(d => {
        const data = d.data();
        const dateStr = data.date || "";
        if (dateStr && dateStr.startsWith(currentMonth) && (!systemStartDate || dateStr >= systemStartDate)) {
          const meals = Number(data.totalMeals || 0);
          tMeals += meals;
          userMealsCount[data.userId] = (userMealsCount[data.userId] || 0) + meals;
          userMealDeposits[data.userId] = (userMealDeposits[data.userId] || 0) + Number(data.deposit || 0);
        }
      });

      // Fetch all bazar
      const bazarSnap = await getDocs(collection(db, "bazar_costs"));
      let tBazar = 0;
      const bazarDeposits: Record<string, number> = {};
      bazarSnap.forEach(d => {
        const data = d.data();
        const dateObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
        const dateStr = format(dateObj, "yyyy-MM-dd");
        if (format(dateObj, "yyyy-MM") === currentMonth && (!systemStartDate || dateStr >= systemStartDate)) {
          tBazar += Number(data.amount || 0);
          if (data.spenderId) {
            bazarDeposits[data.spenderId] = (bazarDeposits[data.spenderId] || 0) + Number(data.amount || 0);
          }
        }
      });

      // Fetch all deposits/payments
      const paySnap = await getDocs(collection(db, "payments"));
      const userDeposits: Record<string, number> = {};
      paySnap.forEach(d => {
        const data = d.data();
        const dateObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
        const dateStr = format(dateObj, "yyyy-MM-dd");
        if (format(dateObj, "yyyy-MM") === currentMonth && data.paymentFor === "meal" && (!systemStartDate || dateStr >= systemStartDate)) {
          userDeposits[data.userId] = (userDeposits[data.userId] || 0) + Number(data.amount || 0);
        }
      });

      // Fetch fines for the current month
      const finesSnap = await getDocs(collection(db, "fines"));
      const userFinesCount: Record<string, number> = {};
      finesSnap.forEach(d => {
        const data = d.data();
        const dateObj = data.date?.toDate ? data.date.toDate() : (data.date ? new Date(data.date) : new Date());
        const dateStr = format(dateObj, "yyyy-MM-dd");
        if (format(dateObj, "yyyy-MM") === currentMonth && (!systemStartDate || dateStr >= systemStartDate)) {
          const fineAmount = Number(data.amount || 0);
          userFinesCount[data.userId] = (userFinesCount[data.userId] || 0) + fineAmount;
          tMeals += fineAmount; // Add fines to total mess meals for accurate meal rate
        }
      });

      const rate = tMeals > 0 ? tBazar / tMeals : 0;

      // Check for manual overrides from the database
      const existingData = ledgerDoc.exists() ? ledgerDoc.data() : null;
      const manualUsersMap: Record<string, any> = {};
      if (existingData?.users) {
        existingData.users.forEach((u: any) => manualUsersMap[u.id] = u);
      }

      const calculatedUsers: LedgerUser[] = sortUsers(allUsers).map(u => {
        const uRegularMeals = userMealsCount[u.id] || 0;
        const uFines = userFinesCount[u.id] || 0;
        const uTotalMeals = uRegularMeals + uFines;

        const uCost = uTotalMeals * rate;
        const uDirectDep = userDeposits[u.id] || 0;
        const uBazarDep = bazarDeposits[u.id] || 0;
        const uMealDep = userMealDeposits[u.id] || 0;
        const totalDep = uDirectDep + uBazarDep + uMealDep;

        // If the month is NOT closed, we ALWAYS use the real-time calculated totalDep.
        // This ensures that adding money in meals/payments immediately reflects here.
        // If the month IS closed, we use the frozen value from the ledger document.
        const manualUser = manualUsersMap[u.id];
        const finalDeposits = isClosed ? (manualUser?.deposits ?? totalDep) : totalDep;

        // Use manual cost/meals ONLY if closed or if specifically overridden in the state (handled during editing)
        const finalCost = isClosed ? (manualUser?.mealCost ?? uCost) : uCost;
        const finalTotalMeals = isClosed ? (manualUser?.totalMeals ?? uTotalMeals) : uTotalMeals;

        return {
          id: u.id,
          name: u.name,
          totalMeals: finalTotalMeals,
          fineMeals: uFines,
          mealCost: finalCost,
          deposits: finalDeposits,
          balance: finalDeposits - finalCost,
          isSettled: manualUser?.isSettled || false
        };
      });

      setTotalMessMeals(tMeals);
      setTotalBazar(tBazar);
      setMealRate(rate);
      setLedgerUsers(calculatedUsers);
      setTotalDeposits(calculatedUsers.reduce((sum, u) => sum + u.deposits, 0));

    } catch (error) {
      console.error("Error fetching ledger:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseMonth = async () => {
    if (profile?.role === "member") return;
    if (!confirm(`Are you sure you want to CLOSE the meals for ${currentMonth}? This will freeze all calculations.`)) return;

    setSaving(true);
    try {
      await setDoc(doc(db, "monthly_ledgers", currentMonth), {
        isClosed: true,
        mealRate,
        totalMeals: totalMessMeals,
        totalBazar,
        totalDeposits,
        users: ledgerUsers,
        closedAt: new Date()
      });
      setIsClosed(true);

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "CLOSED_MEAL_MONTH",
        `Closed meals calculation for month: ${currentMonth}`
      );

      toast.success("Meal calculations closed for this month!");
    } catch (error) {
      console.error("Error closing month:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddDeposit = async (userId: string) => {
    if (!depositAmount || Number(depositAmount) <= 0) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "payments"), {
        userId,
        amount: Number(depositAmount),
        paymentFor: "meal",
        paymentMethod: depositMethod,
        reference: depositRef || "",
        date: new Date(), // using current date for deposit
        receivedBy: profile?.id
      });

      const userToDeposit = ledgerUsers.find(u => u.id === userId);
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "ADDED_MEAL_DEPOSIT",
        `Added meal deposit of ৳${depositAmount} via ${depositMethod} for ${userToDeposit?.name || "Member"}`
      );

      toast.success("Deposit added successfully!");
      setDepositAmount("");
      setDepositMethod("Cash");
      setDepositRef("");
      setShowDepositModal(null);
      fetchLedger(); // Refresh calculation
    } catch (error) {
      console.error("Error adding deposit:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSettleDue = async (userId: string) => {
    if (profile?.role === "member") return;
    if (!confirm("Are you sure you want to mark this due as Paid?")) return;

    setSaving(true);
    try {
      const updatedUsers = ledgerUsers.map(u => u.id === userId ? { ...u, isSettled: true } : u);

      await updateDoc(doc(db, "monthly_ledgers", currentMonth), {
        users: updatedUsers
      });

      setLedgerUsers(updatedUsers);

      const userToSettle = ledgerUsers.find(u => u.id === userId);
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "SETTLED_DUE",
        `Marked due as paid for ${userToSettle?.name || "Member"} in ${currentMonth}`
      );
    } catch (error) {
      console.error("Error settling due:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveManualEdits = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "monthly_ledgers", currentMonth), {
        isClosed: isClosed, // Preserve closed status
        mealRate,
        totalMeals: totalMessMeals,
        totalBazar,
        totalDeposits,
        users: ledgerUsers,
        updatedAt: new Date()
      }, { merge: true });
      setIsEditingLedger(false);
      toast.success("Manual edits saved successfully!");
    } catch (error) {
      console.error("Error saving manual edits:", error);
      toast.error("Failed to save edits.");
    } finally {
      setSaving(false);
    }
  };

  const handleLedgerUserChange = (id: string, field: keyof LedgerUser, value: number) => {
    setLedgerUsers(prev => prev.map(u => {
      if (u.id === id) {
        const updated = { ...u, [field]: value };
        updated.balance = updated.deposits - updated.mealCost;
        return updated;
      }
      return u;
    }));
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
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
            <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Monthly Meal Ledger
          </h1>
          <p className="mt-1 text-sm text-gray-500">Realtime calculation of everyone's meals, cost, and balance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 print:hidden">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="border-0 bg-transparent text-sm font-medium focus:ring-0 dark:text-white"
            />
          </div>
          <button
            onClick={() => setShowPaymentsLog(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 text-sm font-semibold dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 transition-all border border-gray-200 dark:border-gray-700"
          >
            <History className="h-4 w-4" />
            View Payments
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition-all shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-sm font-semibold transition-all shadow-sm"
          >
            <Printer className="h-4 w-4" />
            Print PDF
          </button>
          {profile?.role === "admin" && !isClosed && (
            <button
              onClick={handleCloseMonth}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 disabled:opacity-50 transition-all hover:-translate-y-0.5"
            >
              <Lock className="h-4 w-4" />
              Close Month
            </button>
          )}
          {profile?.role === "admin" && (
            <button
              onClick={() => {
                if (isEditingLedger) handleSaveManualEdits();
                else setIsEditingLedger(true);
              }}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 disabled:opacity-50 transition-all hover:-translate-y-0.5"
            >
              {isEditingLedger ? "Save Edits" : "Edit Ledger"}
            </button>
          )}
          {isClosed && (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
              <Lock className="h-4 w-4" /> Closed
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={item} className="overflow-hidden rounded-2xl bg-white px-4 py-5 shadow-sm sm:p-6 dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Mess Meals</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{formatCurrency(totalMessMeals)}</dd>
        </motion.div>
        <motion.div variants={item} className="overflow-hidden rounded-2xl bg-white px-4 py-5 shadow-sm sm:p-6 dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Bazar Cost</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">৳ {formatCurrency(totalBazar)}</dd>
        </motion.div>
        <motion.div variants={item} className="overflow-hidden rounded-2xl bg-white px-4 py-5 shadow-sm sm:p-6 dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Deposits</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">৳ {formatCurrency(ledgerUsers.reduce((sum, u) => sum + u.deposits, 0))}</dd>
        </motion.div>
        <motion.div variants={item} className="overflow-hidden rounded-2xl bg-indigo-600 px-4 py-5 shadow-lg shadow-indigo-200 dark:shadow-none sm:p-6">
          <dt className="truncate text-sm font-medium text-indigo-100">Final Meal Rate</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight text-white">৳ {formatCurrency(mealRate)}</dd>
        </motion.div>
      </motion.div>

      {/* Search Filter Bar */}
      <div className="flex items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 print:hidden">
        <div className="relative w-full">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ledger by member name..."
            className="w-full rounded-xl border-gray-200 pl-10 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
      </div>

      {/* Everyone's Ledger Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="py-4 pl-4 pr-3 text-left text-sm font-bold text-gray-900 uppercase tracking-wider sm:pl-6 dark:text-white">Member</th>
                <th className="px-3 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wider dark:text-white">Total Meals</th>
                <th className="px-3 py-4 text-right text-sm font-bold text-gray-900 uppercase tracking-wider dark:text-white">Meal Cost (৳)</th>
                <th className="px-3 py-4 text-right text-sm font-bold text-gray-900 uppercase tracking-wider dark:text-white">Deposits (৳)</th>
                <th className="px-3 py-4 text-right text-sm font-bold text-gray-900 uppercase tracking-wider dark:text-white font-bold text-red-600">Due (৳)</th>
                <th className="px-3 py-4 text-right text-sm font-bold text-gray-900 uppercase tracking-wider font-bold text-green-600">Extra (৳)</th>
                <th className="relative py-4 pl-3 pr-4 sm:pr-6 print:hidden"></th>
              </tr>
            </thead>
            <motion.tbody
              variants={container}
              initial="hidden"
              animate="show"
              className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800"
            >
              {ledgerUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).map((u) => (
                <motion.tr variants={item} key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-bold text-gray-900 sm:pl-6 dark:text-white flex items-center gap-3">
                    <Avatar name={u.name} size={32} />
                    <span>{u.name}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-gray-600 dark:text-gray-300">
                    {isEditingLedger ? (
                      <div className="flex gap-1 justify-center">
                        <input type="number" step="0.5" value={u.totalMeals} onChange={e => handleLedgerUserChange(u.id, "totalMeals", Number(e.target.value))} className="w-16 rounded-lg border-gray-200 px-1 py-0.5 dark:bg-gray-700 text-center" title="Total Meals" />
                        <input type="number" step="0.5" value={u.fineMeals} onChange={e => handleLedgerUserChange(u.id, "fineMeals", Number(e.target.value))} className="w-16 rounded-lg border-gray-200 px-1 py-0.5 dark:bg-gray-700 text-center text-red-500" title="Fine Meals" />
                      </div>
                    ) : (
                      <>{u.totalMeals > 0 ? (
                        <>{u.totalMeals} {u.fineMeals > 0 && <span className="text-red-500 font-bold ml-1">({u.fineMeals})</span>}</>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600 font-medium">-</span>
                      )}</>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-600 dark:text-gray-300">
                    {isEditingLedger ? (
                      <input type="number" value={u.mealCost} onChange={e => handleLedgerUserChange(u.id, "mealCost", Number(e.target.value))} className="w-20 rounded-lg border-gray-200 px-1 py-0.5 text-right dark:bg-gray-700" />
                    ) : (
                      u.mealCost > 0 ? formatCurrency(Math.round(u.mealCost)) : <span className="text-gray-400 dark:text-gray-600 font-medium">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-600 dark:text-gray-300 font-medium">
                    {isEditingLedger ? (
                      <input type="number" value={u.deposits} onChange={e => handleLedgerUserChange(u.id, "deposits", Number(e.target.value))} className="w-20 rounded-lg border-gray-200 px-1 py-0.5 text-right dark:bg-gray-700" />
                    ) : (
                      u.deposits > 0 ? formatCurrency(u.deposits) : <span className="text-gray-400 dark:text-gray-600 font-medium">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-bold text-red-600 dark:text-red-400 bg-red-50/10">
                    {!u.isSettled && Math.round(u.balance) < 0 ? formatCurrency(Math.abs(Math.round(u.balance))) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-bold text-green-600 dark:text-green-400 bg-green-50/10">
                    {Math.round(u.balance) > 0 ? formatCurrency(Math.round(u.balance)) : "-"}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 print:hidden">
                    {/* Actions if NOT closed */}
                    {profile?.role === "admin" && !isClosed && (
                      <button
                        onClick={() => { setShowDepositModal(u.id); setDepositAmount(""); setDepositMethod("Cash"); setDepositRef(""); }}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 justify-end w-full group"
                      >
                        <PlusCircle className="h-4 w-4 group-hover:scale-110 transition-transform" /> <span className="hidden sm:inline">Add Deposit</span>
                      </button>
                    )}

                    {/* Actions if CLOSED */}
                    {isClosed && Math.round(u.balance) < 0 && (
                      u.isSettled ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                          ✓ Settled
                        </span>
                      ) : (
                        profile?.role === "admin" ? (
                          <button
                            onClick={() => handleSettleDue(u.id)}
                            disabled={saving}
                            className="inline-flex items-center rounded-xl bg-red-50 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50"
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                            Pending Due
                          </span>
                        )
                      )
                    )}
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      </div>

      {/* Add Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Add Meal Deposit
            </h3>
            <p className="text-sm text-gray-500 mb-4 font-medium">
              Member: <span className="font-bold text-gray-900 dark:text-white">{ledgerUsers.find(u => u.id === showDepositModal)?.name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (৳)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                <select
                  value={depositMethod}
                  onChange={e => setDepositMethod(e.target.value)}
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reference ID / TxID (Optional)</label>
                <input
                  type="text"
                  value={depositRef}
                  onChange={e => setDepositRef(e.target.value)}
                  placeholder="e.g. Transaction ID or sender number"
                  className="w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowDepositModal(null)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddDeposit(showDepositModal)}
                  disabled={saving || !depositAmount}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Deposit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Log Modal */}
      {showPaymentsLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-500" />
                Payment & Deposit History ({format(new Date(currentMonth), 'MMMM yyyy')})
              </h3>
              <button
                onClick={() => setShowPaymentsLog(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="overflow-x-auto flex-1 max-h-[60vh] overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Member</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  {paymentsList.map(pay => {
                    const member = ledgerUsers.find(u => u.id === pay.userId);
                    return (
                      <tr key={pay.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                          {member?.name || "Deleted User"}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-green-600">
                          ৳ {formatCurrency(pay.amount)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                          {pay.paymentMethod || "Direct Deposit"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {pay.reference || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {pay.date ? format(pay.date, "dd MMM yyyy, hh:mm a") : "-"}
                        </td>
                      </tr>
                    );
                  })}
                  {paymentsList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">
                        No payments recorded for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-end pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowPaymentsLog(false)}
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-indigo-700"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.main>
  );
}
