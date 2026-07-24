"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Calculator, Home, Users, FileText, Activity, TrendingUp, ShoppingBag, Utensils, Scale, Clock, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, limit, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, startOfMonth, eachDayOfInterval, endOfMonth, isSameDay } from "date-fns";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ComposedChart,
  AreaChart, 
  Area 
} from 'recharts';

import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    mealRate: 0,
    totalMeals: 0,
    totalBazar: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const currentMonth = format(new Date(), "yyyy-MM");
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    let mealsRaw: any[] = [];
    let bazarRaw: any[] = [];
    let finesRaw: any[] = [];
    let isClosed = false;
    let closedStats = { mealRate: 0, totalMeals: 0, totalBazar: 0 };
    let membersList: string[] = [];
    let systemStartDate = "";

    const updateStats = () => {
      let currentMealRate = 0;
      let currentTotalMeals = 0;
      let currentTotalBazar = 0;

      if (isClosed) {
        currentMealRate = closedStats.mealRate;
        currentTotalMeals = closedStats.totalMeals;
        currentTotalBazar = closedStats.totalBazar;
      } else {
        const mealsMap: Record<string, number> = {};
        mealsRaw.forEach(m => {
          if (membersList.includes(m.userId) && (!systemStartDate || m.date >= systemStartDate)) {
            mealsMap[m.id] = m.totalMeals || 0;
          }
        });

        const totalRegularMeals = Object.values(mealsMap).reduce((a, b) => (a as number) + (b as number), 0);
        
        let totalFines = 0;
        finesRaw.forEach(f => {
          if (membersList.includes(f.userId) && (!systemStartDate || f.date >= systemStartDate)) {
            totalFines += f.amount;
          }
        });
        
        currentTotalMeals = totalRegularMeals + totalFines;
        
        bazarRaw.forEach(b => {
          if (!systemStartDate || b.date >= systemStartDate) {
            currentTotalBazar += b.amount;
          }
        });
        
        currentMealRate = currentTotalMeals > 0 ? currentTotalBazar / currentTotalMeals : 0;
      }

      setStats({
        mealRate: currentMealRate,
        totalMeals: currentTotalMeals,
        totalBazar: currentTotalBazar
      });

      let cumulativeMeals = 0;
      let cumulativeBazar = 0;

      const formattedChartData = days.map(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        let dayTotalMeals = 0;
        mealsRaw.forEach(m => {
          if (m.date === dateStr && membersList.includes(m.userId) && (!systemStartDate || m.date >= systemStartDate)) {
            dayTotalMeals += m.totalMeals || 0;
          }
        });

        let dayBazar = 0;
        bazarRaw.forEach(b => {
          if (b.date === dateStr && (!systemStartDate || b.date >= systemStartDate)) {
            dayBazar += b.amount || 0;
          }
        });

        cumulativeMeals += dayTotalMeals;
        cumulativeBazar += dayBazar;

        const dynamicRate = cumulativeMeals > 0 ? Number((cumulativeBazar / cumulativeMeals).toFixed(2)) : 0;

        return {
          name: format(day, "dd"),
          meals: dayTotalMeals,
          rate: isClosed ? Number(currentMealRate.toFixed(2)) : dynamicRate
        };
      }).filter(d => parseInt(d.name) <= parseInt(format(new Date(), "dd")));
      
      setChartData(formattedChartData);
      setLoading(false);
    };

    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const activeMembers: string[] = [];
      let pending = 0;
      snapshot.forEach(docSnap => {
        const uData = docSnap.data();
        if (uData.role === "pending") {
          pending++;
        } else if (uData.role === "member" || uData.role === "moderator") {
          activeMembers.push(docSnap.id);
        }
      });
      membersList = activeMembers;
      setPendingCount(pending);
      updateStats();
    });

    const unsubscribeSettings = onSnapshot(doc(db, "system_config", "settings"), (docSnap) => {
      if (docSnap.exists()) {
        systemStartDate = docSnap.data().systemStartDate || "";
      } else {
        systemStartDate = "";
      }
      updateStats();
    });

    const unsubscribeLedger = onSnapshot(doc(db, "monthly_ledgers", currentMonth), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.isClosed) {
          isClosed = true;
          closedStats = {
            mealRate: Number(data.mealRate) || 0,
            totalMeals: Number(data.totalMeals) || 0,
            totalBazar: Number(data.totalBazar) || 0
          };
        } else {
          isClosed = false;
        }
      } else {
        isClosed = false;
      }
      updateStats();
    });

    const unsubscribeMeals = onSnapshot(collection(db, "meals"), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => {
        if (doc.id.startsWith(currentMonth)) {
          data.push({ id: doc.id, ...doc.data() });
        }
      });
      mealsRaw = data;
      updateStats();
    });

    const unsubscribeBazar = onSnapshot(collection(db, "bazar_costs"), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => {
        const bData = doc.data();
        let dateStr = "";
        if (typeof bData.date === "string") dateStr = bData.date;
        else if (bData.date?.toDate) dateStr = format(bData.date.toDate(), "yyyy-MM-dd");

        if (dateStr && dateStr.startsWith(currentMonth)) {
          data.push({ amount: Number(bData.amount) || 0, date: dateStr });
        }
      });
      bazarRaw = data;
      updateStats();
    });

    const unsubscribeFines = onSnapshot(collection(db, "fines"), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(docSnap => {
        const bData = docSnap.data();
        const dateObj = bData.date?.toDate ? bData.date.toDate() : (bData.date ? new Date(bData.date) : new Date());
        const dateStr = format(dateObj, "yyyy-MM-dd");
        if (format(dateObj, "yyyy-MM") === currentMonth) {
          data.push({ id: docSnap.id, amount: Number(bData.amount) || 0, date: dateStr, userId: bData.userId });
        }
      });
      finesRaw = data;
      updateStats();
    });

    const unsubscribeActivity = onSnapshot(query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(5)), (snapshot) => {
      const logs: any[] = [];
      snapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
      setRecentLogs(logs);
    });

    return () => {
      unsubscribeMeals();
      unsubscribeBazar();
      unsubscribeFines();
      unsubscribeActivity();
      unsubscribeLedger();
      unsubscribeUsers();
      unsubscribeSettings();
    };
  }, []);

  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            Hi, {profile?.name?.split(' ')[0] || 'User'}! 👋
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Everything looks good today. Here's what's happening.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-700 dark:text-indigo-300 text-sm font-medium">
          <Clock className="h-4 w-4" />
          {format(new Date(), "EEEE, MMM dd, yyyy")}
        </div>
      </motion.div>

      {/* PENDING APPROVAL ALERT FOR ADMINS/MODERATORS */}
      {(profile?.role === "admin" || profile?.role === "moderator") && pendingCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white font-black shadow-md shadow-amber-500/30">
              <Clock className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-amber-950 dark:text-amber-200 text-base flex items-center gap-2">
                Pending Member Approvals
                <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-white">
                  {pendingCount} waiting
                </span>
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                New member accounts are registered and awaiting your approval to access the mess.
              </p>
            </div>
          </div>
          <Link
            href="/users"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-105 shrink-0"
          >
            Review & Approve Members
          </Link>
        </motion.div>
      )}

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-10"
      >
         {/* Stats Cards */}
         <motion.div variants={item} whileHover={{ scale: 1.02, y: -5 }} className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/20">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Meal Rate</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">৳ {stats.mealRate.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-purple-600 font-medium">
              Real-time calculation for {format(new Date(), 'MMMM')}
            </div>
         </motion.div>

         <motion.div variants={item} whileHover={{ scale: 1.02, y: -5 }} className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Bazar</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">৳ {stats.totalBazar}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-blue-600 font-medium">
              Total expenditure this month
            </div>
         </motion.div>

         <motion.div variants={item} whileHover={{ scale: 1.02, y: -5 }} className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-900/20">
                <Utensils className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Meals</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalMeals}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-green-600 font-medium">
              Total meals consumed across all members
            </div>
         </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Chart Section */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Daily Meal Trend
            </h3>
            <span className="text-xs text-gray-500">{format(new Date(), 'MMMM yyyy')}</span>
          </div>
          <div className="h-[300px] w-full relative overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="colorMeals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: '#9ca3af'}} 
                  dy={10}
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: '#9ca3af'}}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: '#10b981'}}
                />
                <Tooltip 
                  wrapperStyle={{ zIndex: 50 }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)'
                  }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="meals" 
                  name="Daily Meals"
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorMeals)" 
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rate"
                  name="Meal Rate"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Activity Mini List */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500" />
              Recent Activity
            </h3>
            <Link href="/activity" className="text-xs text-indigo-600 hover:underline">View All</Link>
          </div>
          <div className="space-y-4">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 group">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 group-hover:scale-150 transition-transform"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{log.description}</p>
                  <p className="text-[10px] text-gray-500">{log.userName} • {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'hh:mm a') : 'Just now'}</p>
                </div>
              </div>
            ))}
            {recentLogs.length === 0 && <p className="text-sm text-gray-500 italic">No recent activity.</p>}
          </div>
        </motion.div>
      </div>

      <motion.h2 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xl font-semibold text-gray-900 dark:text-white mb-6"
      >
        Quick Actions
      </motion.h2>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Link href="/meals" className="group block">
          <motion.div variants={item} whileHover={{ y: -5, scale: 1.02 }} className="relative flex flex-col rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 h-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/20 transition-colors group-hover:bg-purple-600 group-hover:text-white">
              <Calculator className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">Daily Meals</h3>
            <p className="mt-2 text-sm text-gray-500">Track and update daily meal counts for members.</p>
          </motion.div>
        </Link>

        <Link href="/ledger" className="group block">
          <motion.div variants={item} whileHover={{ y: -5, scale: 1.02 }} className="relative flex flex-col rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 h-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 transition-colors group-hover:bg-blue-600 group-hover:text-white">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">Monthly Ledger</h3>
            <p className="mt-2 text-sm text-gray-500">View overall meal costs, deposits, and balances.</p>
          </motion.div>
        </Link>

        <Link href="/rent" className="group block">
          <motion.div variants={item} whileHover={{ y: -5, scale: 1.02 }} className="relative flex flex-col rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 h-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-900/20 transition-colors group-hover:bg-green-600 group-hover:text-white">
              <Home className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-green-600 transition-colors">Rent Manager</h3>
            <p className="mt-2 text-sm text-gray-500">Manage house rent and shared utility bills.</p>
          </motion.div>
        </Link>

        {(profile?.role === 'admin' || profile?.role === 'moderator') && (
          <Link href="/users" className="group block">
            <motion.div variants={item} whileHover={{ y: -5, scale: 1.02 }} className="relative flex flex-col rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 h-full">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-900/20 transition-colors group-hover:bg-orange-600 group-hover:text-white">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 transition-colors">Members</h3>
              <p className="mt-2 text-sm text-gray-500">Manage mess members, roles, and status.</p>
            </motion.div>
          </Link>
        )}

        {profile?.role === 'admin' && (
          <Link href="/activity" className="group block">
            <motion.div variants={item} whileHover={{ y: -5, scale: 1.02 }} className="relative flex flex-col rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 h-full">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/20 transition-colors group-hover:bg-amber-600 group-hover:text-white">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">Activity Logs</h3>
              <p className="mt-2 text-sm text-gray-500">View recent administrative actions and logs.</p>
            </motion.div>
          </Link>
        )}
        
        <Link href="/rules" className="group block">
          <motion.div variants={item} whileHover={{ y: -5, scale: 1.02 }} className="relative flex flex-col rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 h-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/20 transition-colors group-hover:bg-red-600 group-hover:text-white">
              <Scale className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-red-600 transition-colors">Rules & Fines</h3>
            <p className="mt-2 text-sm text-gray-500">View house rules and manage member fines/penalties.</p>
          </motion.div>
        </Link>

        {profile?.role === 'admin' && (
          <Link href="/settings" className="group block">
            <motion.div variants={item} whileHover={{ y: -5, scale: 1.02 }} className="relative flex flex-col rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 h-full">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-600 dark:bg-slate-900/20 transition-colors group-hover:bg-slate-600 group-hover:text-white">
                <Settings className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-slate-600 transition-colors">Settings</h3>
              <p className="mt-2 text-sm text-gray-500">Configure system parameters and start dates.</p>
            </motion.div>
          </Link>
        )}
      </motion.div>
    </motion.main>
  );
}
