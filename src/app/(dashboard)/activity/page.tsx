"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { History, User, Clock, Activity as ActivityIcon } from "lucide-react";
import { format } from "date-fns";

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  description: string;
  timestamp: any;
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
  hidden: { x: -20, opacity: 0 },
  show: { x: 0, opacity: 1 }
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(
          collection(db, "activity_logs"),
          orderBy("timestamp", "desc"),
          limit(100)
        );
        const querySnapshot = await getDocs(q);
        const logsData: ActivityLog[] = [];
        querySnapshot.forEach((doc) => {
          logsData.push({ id: doc.id, ...doc.data() } as ActivityLog);
        });
        setLogs(logsData);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    if (action.includes("ADDED")) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200";
    if (action.includes("DELETED")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200";
    if (action.includes("UPDATED")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200";
    if (action.includes("CLOSED")) return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200";
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
      className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            System Activity Logs
          </h1>
          <p className="mt-1 text-sm text-gray-500">A detailed history of all actions performed.</p>
        </div>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
          Showing last 100 events
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-0 h-full w-0.5 bg-gray-100 dark:bg-gray-700 sm:left-6"></div>

        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {logs.map((log) => {
            const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date();
            
            return (
              <motion.div variants={item} key={log.id} className="relative pl-10 sm:pl-14 group">
                <div className={`absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-4 ring-gray-50 dark:bg-gray-900 dark:ring-gray-800 sm:h-12 sm:w-12 shadow-sm transition-all group-hover:scale-110 ${
                  log.action.includes("DELETED") ? "text-red-500" : 
                  log.action.includes("ADDED") ? "text-green-500" : "text-indigo-500"
                }`}>
                  <ActivityIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50 hover:shadow-lg hover:shadow-indigo-500/5 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-tighter border ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                        <User className="h-3 w-3 text-indigo-400" />
                        {log.userName}
                      </h3>
                    </div>
                    <time className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                      <Clock className="h-3 w-3" />
                      {format(date, "MMM dd, yyyy • hh:mm a")}
                    </time>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                    {log.description}
                  </p>
                </div>
              </motion.div>
            );
          })}

          {logs.length === 0 && (
            <motion.div variants={item} className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-100 dark:bg-gray-800 dark:border-gray-700/50">
              <History className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No activity logs found</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.main>
  );
}
