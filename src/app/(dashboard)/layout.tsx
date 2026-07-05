"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent"
        />
      </div>
    );
  }

  // Page-level lock for new/unapproved users (visitors)
  if (profile?.role === "visitor") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
        <Navbar />
        <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-3xl bg-white p-8 shadow-xl dark:bg-gray-900 border border-gray-100 dark:border-gray-700/50 max-w-md w-full"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-950/20 dark:text-amber-400 mb-6">
              <Clock className="h-8 w-8 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-gray-950 dark:text-white mb-3">Pending Approval</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Welcome to the mess, <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{profile.name}</span>! Your account has been registered successfully.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
              Please contact your mess administrator or moderator to activate your account as a member.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
