"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Settings, Calendar, Trash2, AlertTriangle, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation"; // Use standard next navigation

export default function SettingsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemStartDate, setSystemStartDate] = useState("");
  const [confirmResetText, setConfirmResetText] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const settingsDoc = await getDoc(doc(db, "system_config", "settings"));
      if (settingsDoc.exists()) {
        setSystemStartDate(settingsDoc.data().systemStartDate || "");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== "admin") {
      toast.error("Only admins can modify system settings.");
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, "system_config", "settings"), {
        systemStartDate
      }, { merge: true });

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "UPDATE_SETTINGS",
        `Updated system start date to ${systemStartDate || "None (disabled)"}`
      );

      toast.success("Settings updated successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetSystem = async () => {
    if (profile?.role !== "admin") {
      toast.error("Only admins can reset the system.");
      return;
    }
    if (confirmResetText !== "RESET") {
      toast.error("Please type RESET to confirm.");
      return;
    }
    
    const confirmDouble = window.confirm(
      "WARNING: This is a destructive operation. All meals, bazars, payments, rents, and monthly ledger records will be deleted forever. Do you want to continue?"
    );
    if (!confirmDouble) return;

    setResetting(true);
    toast.loading("Resetting database. Please wait...", { id: "reset-toast" });

    try {
      // 1. Delete meals
      const mealsSnap = await getDocs(collection(db, "meals"));
      for (const d of mealsSnap.docs) {
        await deleteDoc(d.ref);
      }
      
      // 2. Delete bazar_costs
      const bazarSnap = await getDocs(collection(db, "bazar_costs"));
      for (const d of bazarSnap.docs) {
        await deleteDoc(d.ref);
      }

      // 3. Delete payments
      const paymentsSnap = await getDocs(collection(db, "payments"));
      for (const d of paymentsSnap.docs) {
        await deleteDoc(d.ref);
      }

      // 4. Delete fines
      const finesSnap = await getDocs(collection(db, "fines"));
      for (const d of finesSnap.docs) {
        await deleteDoc(d.ref);
      }

      // 5. Delete monthly_ledgers
      const ledgersSnap = await getDocs(collection(db, "monthly_ledgers"));
      for (const d of ledgersSnap.docs) {
        await deleteDoc(d.ref);
      }

      // 6. Delete monthly_rent
      const rentSnap = await getDocs(collection(db, "monthly_rent"));
      for (const d of rentSnap.docs) {
        await deleteDoc(d.ref);
      }

      // 7. Reset currentBalance for all users
      const usersSnap = await getDocs(collection(db, "users"));
      for (const d of usersSnap.docs) {
        await updateDoc(d.ref, {
          currentBalance: 0
        });
      }

      // 8. Reset start date setting
      await setDoc(doc(db, "system_config", "settings"), {
        systemStartDate: ""
      }, { merge: true });
      setSystemStartDate("");

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "RESET_SYSTEM",
        "Wiped database collections and reset all member balances to 0"
      );

      toast.success("Database has been reset completely!", { id: "reset-toast" });
      setConfirmResetText("");
    } catch (error) {
      console.error("Error resetting database:", error);
      toast.error("Failed to reset database.", { id: "reset-toast" });
    } finally {
      setResetting(false);
    }
  };

  if (profile?.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4 animate-pulse" />
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-gray-500 max-w-md">
          Only system administrators can access settings. Please contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8"
    >
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-6 dark:border-gray-800">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-white flex items-center gap-3">
            <Settings className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            System Settings
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 font-medium">
            Configure calendar start constraints and perform clean slate resets.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card 1: Start Date Configuration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/30">
                <Calendar className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  System Start Date
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Specify a date from which all calculations should begin. Any meals, bazars, payments, or fines recorded before this date will be fully ignored.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Meal Start Date
                </label>
                <input
                  type="date"
                  value={systemStartDate}
                  onChange={e => setSystemStartDate(e.target.value)}
                  className="max-w-md w-full rounded-xl border-gray-200 py-3 px-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
                <span className="block mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Leave empty to calculate from the very beginning of time.
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Card 2: Reset System (Danger Zone) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-red-100 bg-red-50/10 p-6 dark:border-red-900/30 dark:bg-red-950/5"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="rounded-xl bg-red-100 p-3 dark:bg-red-950/30">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900 dark:text-red-400">
                  Danger Zone: Reset Database
                </h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                  This will permanently delete all records of daily meals, bazar costs, rent configurations, deposit payments, fines, and closed ledger snapshots. All user balances will be reset back to 0. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-red-900 dark:text-red-400 mb-2">
                  Please type <span className="font-extrabold underline">RESET</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmResetText}
                  onChange={e => setConfirmResetText(e.target.value)}
                  placeholder="Type RESET"
                  className="max-w-md w-full rounded-xl border-red-200 py-3 px-4 text-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-800 dark:border-red-700 dark:text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleResetSystem}
                  disabled={resetting || confirmResetText !== "RESET"}
                  className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-750 disabled:opacity-30 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {resetting ? "Resetting Database..." : "Reset System Database"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.main>
  );
}
