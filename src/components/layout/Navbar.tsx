"use client";

import { useAuth } from "@/context/AuthContext";
import { LogOut, ShieldCheck, Users, Settings, Crown, Shield, Star, User, Eye } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Avatar from "./Avatar";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getRoleTheme } from "@/lib/theme";

export default function Navbar() {
  const { user, profile, settings, signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const roleTheme = getRoleTheme(profile?.role);
  const isManagement = profile?.role === "super_admin" || profile?.role === "admin" || profile?.role === "moderator";

  useEffect(() => {
    if (isManagement) {
      const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
        let count = 0;
        snapshot.forEach((d) => {
          if (d.data().role === "pending" || d.data().role === "visitor") count++;
        });
        setPendingCount(count);
      });
      return () => unsub();
    }
  }, [isManagement]);

  if (!user) return null;

  const renderRoleIcon = () => {
    switch (profile?.role) {
      case "super_admin":
        return <Crown className="h-3.5 w-3.5 text-amber-500 animate-pulse" />;
      case "admin":
        return <ShieldCheck className="h-3.5 w-3.5 text-red-500" />;
      case "moderator":
        return <Shield className="h-3.5 w-3.5 text-teal-500" />;
      case "member":
        return <User className="h-3.5 w-3.5 text-brand" />;
      default:
        return <Eye className="h-3.5 w-3.5 text-zinc-500" />;
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-zinc-200/80 dark:bg-zinc-950/85 dark:border-zinc-800/80 transition-all">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-1 rounded-xl group-hover:scale-105 transition-transform">
              <img src="/logo-icon.png" alt="Logo" className="h-9 w-9 object-contain" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
                {settings?.messName || "Meal Manager"}
              </h1>
              <span className={`text-[10px] font-black uppercase tracking-widest ${roleTheme.headerAccent}`}>
                {roleTheme.label} DASHBOARD
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-3">
              <div className={roleTheme.avatarRing}>
                <Avatar name={profile?.name || user.email || "User"} size={36} />
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{profile?.name || user.email}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider border ${roleTheme.badgeBg} ${roleTheme.badgeText} ${roleTheme.badgeBorder}`}>
                    {renderRoleIcon()} {roleTheme.label}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 font-medium">Logged in active</span>
              </div>
            </div>

            {isManagement && (
              <Link 
                href="/users" 
                className="relative p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center gap-1.5 font-bold text-xs"
                title="Manage Members & Approvals"
              >
                <Users className="h-5 w-5" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white shadow-md animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </Link>
            )}

            {(profile?.role === "super_admin" || profile?.role === "admin") && (
              <Link href="/settings" className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-all" title="Settings">
                <Settings className="h-5 w-5" />
              </Link>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={signOut}
              className="flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-all border border-zinc-200 dark:border-zinc-800"
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
