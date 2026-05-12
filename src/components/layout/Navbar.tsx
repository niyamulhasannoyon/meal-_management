"use client";

import { useAuth } from "@/context/AuthContext";
import { Home, LogOut, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Navbar() {
  const { user, profile, signOut } = useAuth();

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 dark:bg-gray-900/80 dark:border-gray-800/50 transition-all">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="bg-indigo-600 p-2 rounded-xl group-hover:scale-110 transition-transform shadow-lg shadow-indigo-200 dark:shadow-none">
              <Home className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black text-gray-900 dark:text-white leading-tight">
                Meal Manager
              </h1>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Premium Dashboard</span>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900 dark:text-white">{profile?.name || user.email}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase tracking-tighter border border-indigo-100 dark:border-indigo-800">
                  <ShieldCheck className="h-3 w-3" /> {profile?.role || "Member"}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-medium">Logged in successfully</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={signOut}
              className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-red-50 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all border border-gray-100 dark:border-gray-700"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </motion.button>
          </div>
        </div>
      </div>
    </nav>
  );
}
