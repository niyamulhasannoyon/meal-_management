import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { calculateLedger, CalculationResult } from "@/lib/calculations";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { getMonthStr, getDateStr, sortUsers } from "@/lib/utils";
import toast from "react-hot-toast";

export function useMonthlyLedger(targetMonth?: string) {
  const { profile } = useAuth();
  const [month, setMonth] = useState<string>(targetMonth || format(new Date(), "yyyy-MM"));
  const [ledgerResult, setLedgerResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isClosed, setIsClosed] = useState<boolean>(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    fetchLedgerData();
  }, [month]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      // Fetch system start date and minimum meal settings if exists
      const settingsDoc = await getDoc(doc(db, "system_config", "settings"));
      const settingsData = settingsDoc.exists() ? settingsDoc.data() : {};
      const systemStartDate = settingsData?.systemStartDate || "";
      const enableMinimumMealRule = !!settingsData?.enableMinimumMealRule;
      const minimumMonthlyMeals = Number(settingsData?.minimumMonthlyMeals ?? 12);

      // 1. Fetch all users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList: { id: string; name: string; isPermanent?: boolean }[] = [];
      const activeMemberIds: string[] = [];

      usersSnap.forEach((d) => {
        const u = d.data();
        // ONLY users set as 'Member (Eats Meals)' (role === 'member') are included in meal calculations
        if (u.role === "member") {
          usersList.push({ id: d.id, name: u.name || "Member", isPermanent: u.isPermanent === true });
          activeMemberIds.push(d.id);
        }
      });
      const activeMemberSet = new Set(activeMemberIds);
      const sortedUsersList = sortUsers(usersList);

      // Helper function to check if an entry date predates systemStartDate
      const isBeforeSystemStart = (dateVal: any) => {
        if (!systemStartDate) return false;
        const entryDateStr = getDateStr(dateVal);
        if (!entryDateStr) return false;
        return entryDateStr < systemStartDate;
      };

      // 2. Check if month is already closed in monthly_ledgers
      const ledgerDoc = await getDoc(doc(db, "monthly_ledgers", month));
      const existingData = ledgerDoc.exists() ? ledgerDoc.data() : null;
      const monthIsClosed = !!(existingData?.isClosed || existingData?.closed);

      setIsClosed(monthIsClosed);

      if (monthIsClosed && existingData) {
        // Return frozen closed ledger data
        const savedMealRate = Number(existingData.mealRate ?? existingData.calculatedMealRate ?? 0);
        const savedTotalMeals = Number(existingData.totalMeals ?? existingData.totalMealsCount ?? 0);
        const savedTotalBazar = Number(existingData.totalBazar ?? existingData.totalBazarCost ?? 0);

        const savedUsersList = (existingData.users || existingData.memberSummaries || []).map((u: any) => ({
          id: u.id || u.userId,
          name: u.name || u.userName || "Member",
          isPermanent: u.isPermanent,
          regularMeals: Number(u.regularMeals ?? u.mealsCount ?? u.totalMeals ?? 0),
          fineMeals: Number(u.fineMeals ?? u.finesCount ?? 0),
          minMealAdjustment: Number(u.minMealAdjustment ?? 0),
          totalMeals: Number(u.totalMeals || 0),
          mealCost: Number(u.mealCost || 0),
          deposits: Number(u.deposits ?? u.totalDeposits ?? 0),
          balance: Number(u.balance ?? u.netBalance ?? 0),
        }));

        setLedgerResult({
          mealRate: savedMealRate,
          totalMeals: savedTotalMeals,
          totalBazar: savedTotalBazar,
          effectiveMinMeals: existingData.effectiveMinMeals,
          users: savedUsersList,
        });

        setLoading(false);
        return;
      }

      // 3. Real-time Calculation for Open Month
      // Fetch meals (ONLY for active meal members)
      const mealsSnap = await getDocs(collection(db, "meals"));
      const userMeals: Record<string, number> = {};
      const foundMonths = new Set<string>();

      mealsSnap.forEach((d) => {
        const m = d.data();
        const mStr = getMonthStr(m.date || m.month || m.createdAt);
        if (mStr) foundMonths.add(mStr);

        if (mStr === month && activeMemberSet.has(m.userId)) {
          if (!isBeforeSystemStart(m.date || m.createdAt)) {
            const count = Number(
              m.count !== undefined
                ? m.count
                : m.totalMeals !== undefined
                ? m.totalMeals
                : (m.breakfast || 0) + (m.lunch || 0) + (m.dinner || 0)
            );
            userMeals[m.userId] = (userMeals[m.userId] || 0) + count;
          }
        }
      });

      // Fetch fines (ONLY for active meal members)
      const finesSnap = await getDocs(collection(db, "fines"));
      const userFines: Record<string, number> = {};
      finesSnap.forEach((d) => {
        const f = d.data();
        const fMonth = getMonthStr(f.date || f.month || f.createdAt);
        if (fMonth) foundMonths.add(fMonth);

        if (fMonth === month && activeMemberSet.has(f.userId)) {
          if (!isBeforeSystemStart(f.date || f.createdAt)) {
            userFines[f.userId] = (userFines[f.userId] || 0) + Number(f.amount || 0);
          }
        }
      });

      // Fetch bazar costs (ONLY for active meal members)
      const bazarSnap = await getDocs(collection(db, "bazar_costs"));
      const userBazarDeposits: Record<string, number> = {};
      let totalBazar = 0;

      bazarSnap.forEach((d) => {
        const b = d.data();
        const bMonth = getMonthStr(b.date || b.month || b.createdAt);
        if (bMonth) foundMonths.add(bMonth);

        const spenderId = b.spenderId || b.userId;
        if (bMonth === month && spenderId && activeMemberSet.has(spenderId)) {
          if (!isBeforeSystemStart(b.date || b.createdAt)) {
            const amt = Number(b.amount ?? b.cost ?? 0);
            totalBazar += amt;
            userBazarDeposits[spenderId] = (userBazarDeposits[spenderId] || 0) + amt;
          }
        }
      });

      // Fetch direct payments / deposits (excluding rent payments, ONLY for active meal members)
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const userDirectDeposits: Record<string, number> = {};

      paymentsSnap.forEach((d) => {
        const p = d.data();
        // Skip payments designated for house rent
        if (p.paymentFor === "rent") return;

        const pMonth = getMonthStr(p.date || p.month || p.createdAt);
        if (pMonth) foundMonths.add(pMonth);

        if (pMonth === month && activeMemberSet.has(p.userId)) {
          if (!isBeforeSystemStart(p.date || p.createdAt)) {
            userDirectDeposits[p.userId] = (userDirectDeposits[p.userId] || 0) + Number(p.amount || 0);
          }
        }
      });

      // Always include current month and month parameter in available months
      foundMonths.add(format(new Date(), "yyyy-MM"));
      foundMonths.add(month);

      const sortedMonths = Array.from(foundMonths).sort().reverse();
      setAvailableMonths(sortedMonths);

      // Compute pure ledger math
      const result = calculateLedger({
        userMeals,
        userFines,
        userDirectDeposits,
        userBazarDeposits,
        totalBazar,
        users: sortedUsersList,
        minimumMealConfig: {
          enabled: enableMinimumMealRule,
          minimumMonthlyMeals: minimumMonthlyMeals,
          month,
          systemStartDate: systemStartDate,
        },
      });

      setLedgerResult(result);
    } catch (error) {
      console.error("Error computing ledger:", error);
    } finally {
      setLoading(false);
    }
  };

  const closeMonth = async () => {
    if (profile?.role !== "super_admin") {
      toast.error("Only Super Admin can close monthly ledgers.");
      return;
    }
    if (!ledgerResult) return;

    try {
      await setDoc(doc(db, "monthly_ledgers", month), {
        id: month,
        month,
        closed: true,
        isClosed: true,
        closedAt: new Date().toISOString(),
        closedBy: profile.id,
        mealRate: ledgerResult.mealRate,
        totalBazar: ledgerResult.totalBazar,
        totalMeals: ledgerResult.totalMeals,
        totalBazarCost: ledgerResult.totalBazar,
        totalMealsCount: ledgerResult.totalMeals,
        calculatedMealRate: ledgerResult.mealRate,
        users: ledgerResult.users.map((u) => ({
          id: u.id,
          userId: u.id,
          name: u.name,
          userName: u.name,
          totalMeals: u.totalMeals,
          fineMeals: u.fineMeals,
          mealCost: u.mealCost,
          deposits: u.deposits,
          balance: u.balance,
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

  const reopenMonth = async () => {
    if (profile?.role !== "super_admin") {
      toast.error("Only Super Admin can re-open monthly ledgers.");
      return;
    }

    try {
      await setDoc(
        doc(db, "monthly_ledgers", month),
        {
          closed: false,
          isClosed: false,
          reopenedAt: new Date().toISOString(),
          reopenedBy: profile.id,
        },
        { merge: true }
      );

      await logActivity(
        profile.id,
        profile.name,
        "REOPEN_LEDGER",
        `Re-opened ledger for month ${month}`,
        "system"
      );

      setIsClosed(false);
      toast.success(`Ledger for ${month} re-opened successfully!`);
    } catch (error) {
      console.error("Error reopening ledger:", error);
      toast.error("Failed to re-open ledger.");
    }
  };

  return {
    month,
    setMonth,
    availableMonths,
    ledgerResult,
    loading,
    isClosed,
    isSuperAdmin: profile?.role === "super_admin",
    closeMonth,
    reopenMonth,
  };
}
