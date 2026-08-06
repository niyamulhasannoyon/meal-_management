"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  Calculator,
  Users,
  FileText,
  Activity,
  ShoppingBag,
  Utensils,
  Scale,
  Settings,
  CreditCard,
  Building,
  Crown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { MealCalendarHeatmap } from "@/components/dashboard/MealCalendarHeatmap";
import { AdminAttentionPanel, type AttentionItem } from "@/components/dashboard/AdminAttentionPanel";
import { calculateLedger } from "@/lib/calculations";
import { formatCurrency, getMonthStr } from "@/lib/utils";
import { getRoleTheme } from "@/lib/theme";
import { staggerContainer, fadeIn } from "@/lib/motion";

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    mealRate: 0,
    totalMeals: 0,
    totalBazar: 0,
    todayMeals: 0,
  });
  const [myBalance, setMyBalance] = useState<{ amount: number; isDue: boolean } | null>(null);
  const [mealEntries, setMealEntries] = useState<Record<string, { breakfast: number; lunch: number; dinner: number }>>({});
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const roleTheme = getRoleTheme(profile?.role);
  const isManagement = profile?.role === "super_admin" || profile?.role === "admin" || profile?.role === "moderator";

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const currentMonth = format(new Date(), "yyyy-MM");

      // 1. Fetch Users (ONLY role === 'member' for meal calculations)
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList: { id: string; name: string }[] = [];
      const activeMemberIds = new Set<string>();
      let pendingUsersCount = 0;

      usersSnap.forEach((d) => {
        const data = d.data();
        if (data.role === "member") {
          usersList.push({ id: d.id, name: data.name || "Member" });
          activeMemberIds.add(d.id);
        } else if (data.role === "pending" || data.role === "visitor") {
          pendingUsersCount++;
        }
      });

      // 2. Fetch Meals for current month
      const mealsSnap = await getDocs(collection(db, "meals"));
      const userMeals: Record<string, number> = {};
      const heatMapData: Record<string, { breakfast: number; lunch: number; dinner: number }> = {};
      let loggedTodayCount = 0;
      let todayMealsSum = 0;
      const todayStr = format(new Date(), "yyyy-MM-dd");

      mealsSnap.forEach((d) => {
        const data = d.data();
        const mStr = getMonthStr(data.date || data.month);

        if (activeMemberIds.has(data.userId)) {
          const total = Number(
            data.totalMeals !== undefined
              ? data.totalMeals
              : data.count !== undefined
              ? data.count
              : (data.breakfast || 0) + (data.lunch || 0) + (data.dinner || 0)
          );

          if (mStr === currentMonth) {
            userMeals[data.userId] = (userMeals[data.userId] || 0) + total;

            if (data.userId === profile?.id) {
              heatMapData[data.date] = {
                breakfast: Number(data.breakfast || (total > 0 ? 0.5 : 0)),
                lunch: Number(data.lunch || (total > 0 ? 1 : 0)),
                dinner: Number(data.dinner || (total > 0 ? 1 : 0)),
              };
            }
          }

          if (data.date === todayStr) {
            todayMealsSum += total;
            if (data.isSubmitted !== false) {
              loggedTodayCount++;
            }
          }
        }
      });

      // 3. Fetch Fines for current month
      const finesSnap = await getDocs(collection(db, "fines"));
      const userFines: Record<string, number> = {};
      finesSnap.forEach((d) => {
        const data = d.data();
        const mStr = getMonthStr(data.date || data.month);
        if (mStr === currentMonth && activeMemberIds.has(data.userId)) {
          userFines[data.userId] = (userFines[data.userId] || 0) + Number(data.amount || 0);
        }
      });

      // 4. Fetch Bazar Costs for current month
      const bazarSnap = await getDocs(collection(db, "bazar_costs"));
      const userBazarDeposits: Record<string, number> = {};
      let totalBazar = 0;
      bazarSnap.forEach((d) => {
        const data = d.data();
        const mStr = getMonthStr(data.date || data.month);
        const spenderId = data.spenderId || data.userId;
        if (mStr === currentMonth && spenderId && activeMemberIds.has(spenderId)) {
          const amt = Number(data.amount ?? data.cost ?? 0);
          totalBazar += amt;
          userBazarDeposits[spenderId] = (userBazarDeposits[spenderId] || 0) + amt;
        }
      });

      // 5. Fetch Direct Payments for current month (excluding rent)
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const userDirectDeposits: Record<string, number> = {};
      paymentsSnap.forEach((d) => {
        const data = d.data();
        if (data.paymentFor === "rent") return;
        const mStr = data.month || getMonthStr(data.date);
        if (mStr === currentMonth && activeMemberIds.has(data.userId)) {
          userDirectDeposits[data.userId] = (userDirectDeposits[data.userId] || 0) + Number(data.amount || 0);
        }
      });

      // Compute Ledger Math
      const ledgerResult = calculateLedger({
        userMeals,
        userFines,
        userDirectDeposits,
        userBazarDeposits,
        totalBazar,
        users: usersList,
      });

      setStats({
        mealRate: ledgerResult.mealRate,
        totalMeals: ledgerResult.totalMeals,
        totalBazar: ledgerResult.totalBazar,
        todayMeals: todayMealsSum,
      });

      setMealEntries(heatMapData);

      // Personal balance
      if (profile?.id) {
        const myCalc = ledgerResult.users.find((u) => u.id === profile.id);
        if (myCalc) {
          setMyBalance({
            amount: Math.abs(myCalc.balance),
            isDue: myCalc.balance < 0,
          });
        }
      }

      // Attention items for Admin & Super Admin
      if (isManagement) {
        const alerts: AttentionItem[] = [];

        if (pendingUsersCount > 0) {
          alerts.push({
            id: "pending_users",
            type: "pending_user",
            title: "Pending Member Approvals",
            description: `${pendingUsersCount} new member(s) waiting for account approval.`,
            actionText: "Review Directory",
            actionHref: "/users",
          });
        }

        const deepDueMembers = ledgerResult.users.filter((u) => u.balance < -1500);
        if (deepDueMembers.length > 0) {
          alerts.push({
            id: "deep_due",
            type: "deep_due",
            title: "Members in Deep Due (> ৳1,500)",
            description: `${deepDueMembers.length} member(s) owe substantial balance for this month.`,
            actionText: "Open Ledger",
            actionHref: "/ledger",
          });
        }

        const activeMembersCount = usersList.length;
        if (loggedTodayCount < activeMembersCount) {
          alerts.push({
            id: "unlogged_meals",
            type: "unlogged_meals",
            title: "Today's Meal Logging",
            description: `${activeMembersCount - loggedTodayCount} active member(s) have not logged meals today.`,
            actionText: "Log Meals",
            actionHref: "/meals",
          });
        }

        setAttentionItems(alerts);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const quickLinks = [
    { name: "Meals (.5/1/1)", href: "/meals", icon: Utensils, color: "bg-orange-500/10 text-orange-600" },
    { name: "Ledger Math", href: "/ledger", icon: Calculator, color: "bg-blue-500/10 text-blue-600" },
    { name: "Rent & Utility", href: "/rent", icon: Building, color: "bg-emerald-500/10 text-emerald-600" },
    { name: "House Rules", href: "/rules", icon: Scale, color: "bg-red-500/10 text-red-600" },
    { name: "Member Directory", href: "/users", icon: Users, color: "bg-purple-500/10 text-purple-600" },
    { name: "Settings", href: "/settings", icon: Settings, color: "bg-zinc-500/10 text-zinc-600" },
  ];

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Welcome back, {profile?.name || "Member"} 👋
            </h1>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] uppercase border ${roleTheme.badgeBg} ${roleTheme.badgeText} ${roleTheme.badgeBorder}`}>
              {profile?.role === "super_admin" && <Crown className="w-3 h-3 text-amber-500" />}
              {roleTheme.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Real-time mess overview for {format(new Date(), "MMMM yyyy")}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link href="/meals">
            <Button variant="primary" size="sm">
              <Utensils className="w-4 h-4 mr-1.5" />
              Manage Today's Meals
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Admin Attention Panel */}
      {isManagement && (
        <motion.div variants={fadeIn}>
          <AdminAttentionPanel items={attentionItems} />
        </motion.div>
      )}

      {/* Key Metric Cards */}
      <motion.div variants={fadeIn} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Current Meal Rate"
          value={loading ? "..." : `৳${stats.mealRate.toFixed(2)}`}
          subtitle="Total Bazar / Total Meals"
          variant="brand"
          icon={<Calculator className="w-5 h-5 text-brand" />}
        />
        <StatCard
          title="Month-to-Date Bazar"
          value={loading ? "..." : `৳${formatCurrency(stats.totalBazar)}`}
          subtitle="Spent on mess food supplies"
          variant="amber"
          icon={<ShoppingBag className="w-5 h-5 text-amberAccent-500" />}
        />
        <StatCard
          title="Total Meals Eaten"
          value={loading ? "..." : stats.totalMeals}
          subtitle={loading ? "..." : `Today: ${stats.todayMeals} meals | Month total`}
          variant="default"
          icon={<Utensils className="w-5 h-5 text-brand" />}
        />
        <StatCard
          title="Personal Balance"
          value={
            loading
              ? "..."
              : myBalance
              ? `${myBalance.isDue ? "-" : "+"}৳${formatCurrency(myBalance.amount)}`
              : "৳0"
          }
          subtitle={myBalance?.isDue ? "Amount due for this month" : "Surplus overpayment"}
          variant={myBalance?.isDue ? "due" : "surplus"}
          icon={<CreditCard className="w-5 h-5" />}
        />
      </motion.div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Heatmap & Quick Access */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div variants={fadeIn}>
            <MealCalendarHeatmap mealEntries={mealEntries} />
          </motion.div>

          <motion.div variants={fadeIn} className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-card p-5 shadow-card">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4">Quick Navigation</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {quickLinks.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link key={item.name} href={item.href}>
                    <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all text-center group cursor-pointer">
                      <div className={`p-2.5 rounded-xl ${item.color} mb-2 group-hover:scale-110 transition-transform`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Right 1 Column: Information & Activity Link */}
        <motion.div variants={fadeIn} className="space-y-6">
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-card p-5 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span>Mess Operational Summary</span>
              <Activity className="w-4 h-4 text-brand" />
            </h3>
            <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <div className="pt-2 flex justify-between">
                <span>Active Period</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{format(new Date(), "MMMM yyyy")}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span>Daily Cutoff</span>
                <span className="font-semibold text-amberAccent-600">10:00 PM</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span>Your Role</span>
                <span className={`font-extrabold uppercase ${roleTheme.headerAccent}`}>{roleTheme.label}</span>
              </div>
            </div>
            <Link href="/activity" className="block pt-2">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <Activity className="w-3.5 h-3.5 mr-1.5" />
                View Audit History
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.main>
  );
}
