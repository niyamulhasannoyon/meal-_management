"use client";

import { useEffect, useState } from "react";
import { getDocs, query, orderBy, limit } from "firebase/firestore";
import { activityLogsCol } from "@/lib/firebase";
import { History, User, Clock, Activity as ActivityIcon } from "lucide-react";
import { format } from "date-fns";
import type { ActivityLog } from "@/lib/types/firestore";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { x: -20, opacity: 0 },
  show: { x: 0, opacity: 1 },
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(activityLogsCol, orderBy("timestamp", "desc"), limit(100));
        const querySnapshot = await getDocs(q);
        const logsData: ActivityLog[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          logsData.push({ ...data, id: docSnap.id } as ActivityLog);
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

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("ADDED") || action.includes("APPROVED")) return "success";
    if (action.includes("DELETED") || action.includes("REJECTED")) return "danger";
    if (action.includes("UPDATED") || action.includes("EDIT")) return "info";
    if (action.includes("CLOSED")) return "warning";
    return "default";
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <History className="h-6 w-6 text-brand" />
            System Activity Logs
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">A detailed audit history of all system events.</p>
        </div>
        <div className="text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
          Last 100 events
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-0 h-full w-0.5 bg-zinc-200 dark:bg-zinc-800 sm:left-6"></div>

        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
          {logs.map((log) => {
            const rawTs = log.timestamp as { toDate?: () => Date } | string | Date;
            const date = typeof rawTs === "object" && rawTs !== null && "toDate" in rawTs && typeof rawTs.toDate === "function"
              ? rawTs.toDate()
              : new Date();

            return (
              <motion.div variants={item} key={log.id} className="relative pl-10 sm:pl-14 group">
                <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-card ring-4 ring-zinc-100 dark:ring-zinc-900 sm:h-12 sm:w-12 shadow-sm transition-all group-hover:scale-110 text-brand">
                  <ActivityIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>

                <div className="rounded-2xl bg-card p-5 border border-zinc-200 dark:border-zinc-800 shadow-card hover:shadow-card-hover transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                      <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-brand" />
                        {log.userName}
                      </h3>
                    </div>
                    <time className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Clock className="h-3.5 w-3.5" />
                      {format(date, "MMM dd, yyyy • hh:mm a")}
                    </time>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                    {log.details || (log as unknown as { description?: string }).description}
                  </p>
                </div>
              </motion.div>
            );
          })}

          {logs.length === 0 && (
            <EmptyState
              icon={<History className="h-10 w-10 text-zinc-400" />}
              title="No activity logs found"
              description="System activities will appear here as actions are performed."
            />
          )}
        </motion.div>
      </div>
    </motion.main>
  );
}
