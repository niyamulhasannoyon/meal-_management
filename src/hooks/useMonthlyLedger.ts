import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { calculateLedger, CalculationResult } from "@/lib/calculations";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import toast from "react-hot-toast";

export function useMonthlyLedger(targetMonth?: string) {
  const { profile } = useAuth();
  const [month, setMonth] = useState<string>(targetMonth || format(new Date(), "yyyy-MM"));
  const [ledgerResult, setLedgerResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isClosed, setIsClosed] = useState<boolean>(false);

  useEffect(() => {
    fetchLedgerData();
  }, [month]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      // 1. Check if month is already closed in monthly_ledgers
      const closedDoc = await getDoc(doc(db, "monthly_ledgers", month));
      if (closedDoc.exists()) {
        const data = closedDoc.data();
        setIsClosed(data.closed || false);
      } else {
        setIsClosed(false);
      }

      // 2. Fetch users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList: { id: string; name: string }[] = [];
      usersSnap.forEach((d) => {
        const u = d.data();
        if (u.role === "member" || u.role === "admin" || u.role === "moderator") {
          usersList.push({ id: d.id, name: u.name || "Member" });
        }
      });

      // 3. Fetch meals for month
      const mealsSnap = await getDocs(collection(db, "meals"));
      const userMeals: Record<string, number> = {};
      mealsSnap.forEach((d) => {
        const m = d.data();
        if (m.date && m.date.startsWith(month)) {
          userMeals[m.userId] = (userMeals[m.userId] || 0) + Number(m.count || m.totalMeals || 0);
        }
      });

      // 4. Fetch fines for month
      const finesSnap = await getDocs(collection(db, "fines"));
      const userFines: Record<string, number> = {};
      finesSnap.forEach((d) => {
        const f = d.data();
        if (f.date && f.date.startsWith(month)) {
          userFines[f.userId] = (userFines[f.userId] || 0) + Number(f.amount || 0);
        }
      });

      // 5. Fetch bazar costs for month
      const bazarSnap = await getDocs(collection(db, "bazar_costs"));
      const userBazarDeposits: Record<string, number> = {};
      let totalBazar = 0;
      bazarSnap.forEach((d) => {
        const b = d.data();
        if (b.date && b.date.startsWith(month)) {
          const amt = Number(b.amount || 0);
          totalBazar += amt;
          if (b.spenderId) {
            userBazarDeposits[b.spenderId] = (userBazarDeposits[b.spenderId] || 0) + amt;
          }
        }
      });

      // 6. Fetch payments for month
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const userDirectDeposits: Record<string, number> = {};
      paymentsSnap.forEach((d) => {
        const p = d.data();
        if (p.date && (p.date.startsWith(month) || p.month === month)) {
          userDirectDeposits[p.userId] = (userDirectDeposits[p.userId] || 0) + Number(p.amount || 0);
        }
      });

      // Calculate pure ledger math
      const result = calculateLedger({
        userMeals,
        userFines,
        userDirectDeposits,
        userBazarDeposits,
        totalBazar,
        users: usersList,
      });

      setLedgerResult(result);
    } catch (error) {
      console.error("Error computing ledger:", error);
    } finally {
      setLoading(false);
    }
  };

  const closeMonth = async () => {
    if (profile?.role !== "admin") {
      toast.error("Only admins can close monthly ledgers.");
      return;
    }
    if (!ledgerResult) return;

    try {
      await setDoc(doc(db, "monthly_ledgers", month), {
        id: month,
        month,
        closed: true,
        closedAt: new Date().toISOString(),
        closedBy: profile.id,
        totalBazarCost: ledgerResult.totalBazar,
        totalMealsCount: ledgerResult.totalMeals,
        calculatedMealRate: ledgerResult.mealRate,
        memberSummaries: ledgerResult.users.map((u) => ({
          userId: u.id,
          userName: u.name,
          totalMeals: u.totalMeals,
          fineMeals: u.fineMeals,
          mealCost: u.mealCost,
          deposits: u.deposits,
          netBalance: u.balance,
        })),
      });

      await logActivity(
        profile.id,
        profile.name,
        "CLOSE_LEDGER",
        `Closed ledger for month ${month} at meal rate ৳${ledgerResult.mealRate.toFixed(2)}`,
        "system"
      );

      setIsClosed(true);
      toast.success(`Ledger for ${month} closed successfully!`);
    } catch (error) {
      console.error("Error closing ledger:", error);
      toast.error("Failed to close ledger.");
    }
  };

  return {
    month,
    setMonth,
    ledgerResult,
    loading,
    isClosed,
    closeMonth,
  };
}
