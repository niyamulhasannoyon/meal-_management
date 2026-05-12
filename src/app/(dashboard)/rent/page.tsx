"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { format } from "date-fns";
import { Home, Receipt, Users as UsersIcon, PlusCircle } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { sortUsers } from "@/lib/utils";
import toast from "react-hot-toast";

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

interface MonthlyRent {
  houseRent: number;
  gas: number;
  service: number;
  maid: number;
  wifi: number;
  electricity: number;
  others: number;
  totalRent: number;
  perPersonRent: number;
  isClosed: boolean;
}

const defaultRent: MonthlyRent = {
  houseRent: 0,
  gas: 0,
  service: 0,
  maid: 0,
  wifi: 0,
  electricity: 0,
  others: 0,
  totalRent: 0,
  perPersonRent: 0,
  isClosed: false
};

export default function RentPage() {
  const { profile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), "yyyy-MM"));
  const [rentData, setRentData] = useState<MonthlyRent>(defaultRent);
  const [permanentUsers, setPermanentUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRentDeposits, setUserRentDeposits] = useState<Record<string, number>>({});
  
  // Payment state
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  useEffect(() => {
    fetchRentAndUsers();
  }, [currentMonth]);

  const fetchRentAndUsers = async () => {
    setLoading(true);
    try {
      // Fetch permanent users
      const usersQuery = query(collection(db, "users"), where("isPermanent", "==", true));
      const usersSnap = await getDocs(usersQuery);
      const pUsers: UserProfile[] = [];
      usersSnap.forEach((doc) => pUsers.push({ id: doc.id, ...doc.data() } as UserProfile));
      setPermanentUsers(sortUsers(pUsers));

      // Fetch rent for current month
      const rentDoc = await getDoc(doc(db, "monthly_rent", currentMonth));
      if (rentDoc.exists()) {
        setRentData(rentDoc.data() as MonthlyRent);
      } else {
        // If no rent data exists for this month, start with default
        setRentData({ ...defaultRent });
      }
      // Fetch rent payments for current month
      const paySnap = await getDocs(collection(db, "payments"));
      const deposits: Record<string, number> = {};
      paySnap.forEach(d => {
        const data = d.data();
        const dateObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
        if (format(dateObj, "yyyy-MM") === currentMonth && data.paymentFor === "rent") {
          deposits[data.userId] = (deposits[data.userId] || 0) + Number(data.amount || 0);
        }
      });
      setUserRentDeposits(deposits);

    } catch (error) {
      console.error("Error fetching rent data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof MonthlyRent, value: number) => {
    setRentData(prev => {
      const updated = { ...prev, [field]: value };
      updated.totalRent = 
        updated.houseRent + updated.gas + updated.service + 
        updated.maid + updated.wifi + updated.electricity + updated.others;
      
      const pCount = permanentUsers.length || 1; // Avoid division by zero
      updated.perPersonRent = updated.totalRent / pCount;
      
      return updated;
    });
  };

  const handleSaveRent = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "monthly_rent", currentMonth), rentData);
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "SAVED_RENT_STRUCTURE",
        `Updated rent structure for month: ${currentMonth}`
      );
      
      toast.success("Rent data saved successfully!");
    } catch (error) {
      console.error("Error saving rent:", error);
      toast.error("Failed to save rent.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseMonth = async () => {
    if (!confirm(`Are you sure you want to CLOSE the month of ${currentMonth}? You won't be able to edit this rent structure anymore.`)) return;
    setSaving(true);
    try {
      const updatedRent = { ...rentData, isClosed: true };
      await setDoc(doc(db, "monthly_rent", currentMonth), updatedRent);
      setRentData(updatedRent);
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "CLOSED_RENT_MONTH",
        `Closed rent calculations for month: ${currentMonth}`
      );
      
      toast.success("Month closed successfully!");
    } catch (error) {
      console.error("Error closing month:", error);
      toast.error("Failed to close month.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async (userId: string) => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "payments"), {
        userId,
        amount: Number(paymentAmount),
        paymentFor: "rent",
        date: new Date(),
        receivedBy: profile?.id
      });
      
      const userToDeposit = permanentUsers.find(u => u.id === userId);
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "ADDED_RENT_PAYMENT",
        `Added rent payment of ৳${paymentAmount} for ${userToDeposit?.name || "Member"}`
      );
      
      toast.success("Rent payment added successfully!");
      setPaymentAmount("");
      setShowPaymentForm(null);
      fetchRentAndUsers(); // Refresh calculation
    } catch (error) {
      console.error("Error adding payment:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-8 w-8 rounded-full border-4 border-green-500 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <motion.main 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Home className="h-6 w-6 text-green-600 dark:text-green-400" />
            Rent Manager
          </h1>
          <p className="mt-1 text-sm text-gray-500">Manage house rent and shared utility bills.</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
          <input 
            type="month" 
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="border-0 bg-transparent text-sm font-medium focus:ring-0 dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rent Form */}
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="lg:col-span-2 overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50"
        >
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
              Monthly Costs Structure
            </h3>
            
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              <motion.div variants={item}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">House Rent</label>
                <input type="number" disabled={rentData.isClosed} value={rentData.houseRent} onChange={(e) => handleInputChange("houseRent", Number(e.target.value))} className="mt-1 block w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50" />
              </motion.div>
              <motion.div variants={item}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gas Bill</label>
                <input type="number" disabled={rentData.isClosed} value={rentData.gas} onChange={(e) => handleInputChange("gas", Number(e.target.value))} className="mt-1 block w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50" />
              </motion.div>
              <motion.div variants={item}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Service Charge</label>
                <input type="number" disabled={rentData.isClosed} value={rentData.service} onChange={(e) => handleInputChange("service", Number(e.target.value))} className="mt-1 block w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50" />
              </motion.div>
              <motion.div variants={item}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Maid Bill</label>
                <input type="number" disabled={rentData.isClosed} value={rentData.maid} onChange={(e) => handleInputChange("maid", Number(e.target.value))} className="mt-1 block w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50" />
              </motion.div>
              <motion.div variants={item}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">WiFi / Internet</label>
                <input type="number" disabled={rentData.isClosed} value={rentData.wifi} onChange={(e) => handleInputChange("wifi", Number(e.target.value))} className="mt-1 block w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50" />
              </motion.div>
              <motion.div variants={item}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Electricity (Variable)</label>
                <input type="number" disabled={rentData.isClosed} value={rentData.electricity} onChange={(e) => handleInputChange("electricity", Number(e.target.value))} className="mt-1 block w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50" />
              </motion.div>
              <motion.div variants={item} className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Others</label>
                <input type="number" disabled={rentData.isClosed} value={rentData.others} onChange={(e) => handleInputChange("others", Number(e.target.value))} className="mt-1 block w-full rounded-xl border-gray-200 py-2.5 px-4 text-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50" />
              </motion.div>
            </div>

            {(profile?.role === "admin" || profile?.role === "moderator") && (
              <div className="mt-8 flex flex-col sm:flex-row justify-end gap-4">
                {!rentData.isClosed && (
                  <button
                    type="button"
                    onClick={handleCloseMonth}
                    disabled={saving}
                    className="rounded-xl bg-red-50 px-6 py-2.5 text-sm font-bold text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50 transition-all"
                  >
                    {saving ? "Processing..." : "Close Month"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveRent}
                  disabled={saving || rentData.isClosed}
                  className="rounded-xl bg-green-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-200 dark:shadow-none hover:bg-green-700 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                >
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
                  ) : rentData.isClosed ? "Month Closed" : "Save Structure"}
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Calculation Summary */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
              <Receipt className="h-5 w-5 text-indigo-500" />
              Cost Summary
            </h3>
            <dl className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Total Calculation</dt>
                <dd className="font-bold text-gray-900 dark:text-white">৳ {rentData.totalRent}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700">
                <dt className="flex items-center text-gray-500 dark:text-gray-400">
                  <UsersIcon className="h-4 w-4 mr-2" />
                  Permanent Members
                </dt>
                <dd className="font-bold text-gray-900 dark:text-white">{permanentUsers.length}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700">
                <dt className="text-base font-bold text-gray-900 dark:text-white">Per Person Rent</dt>
                <dd className="text-2xl font-black text-green-600 dark:text-green-400">৳ {Math.round(rentData.perPersonRent || 0)}</dd>
              </div>
            </dl>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700/50"
          >
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
              Payment Status
            </h3>
            <ul className="divide-y divide-gray-50 dark:divide-gray-700 text-sm">
              {permanentUsers.map(user => {
                const required = Math.round(rentData.perPersonRent || 0);
                const paid = userRentDeposits[user.id] || 0;
                const balance = paid - required;

                return (
                  <li key={user.id} className="py-4 flex flex-col gap-2 group">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-900 font-bold dark:text-white group-hover:text-indigo-600 transition-colors">{user.name}</span>
                      <div className="flex items-center gap-2">
                        {balance >= 0 ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            ✓ Paid {balance > 0 ? `(+৳${balance})` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Due: ৳{Math.abs(balance)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                      <span>Rent: ৳{required} | Rec: ৳{paid}</span>
                      {(profile?.role === "admin" || profile?.role === "moderator") && !rentData.isClosed && (
                        showPaymentForm === user.id ? (
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              value={paymentAmount}
                              onChange={e => setPaymentAmount(e.target.value)}
                              placeholder="৳"
                              className="w-16 rounded-lg border-gray-200 px-2 py-1 text-[10px] dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            />
                            <button onClick={() => handleAddPayment(user.id)} disabled={saving} className="text-green-600 hover:text-green-900 font-bold">Save</button>
                            <button onClick={() => setShowPaymentForm(null)} className="text-gray-400 hover:text-gray-600">×</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setShowPaymentForm(user.id); setPaymentAmount(""); }}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 font-bold flex items-center gap-1 group/btn"
                          >
                            <PlusCircle className="h-3 w-3 group-hover/btn:scale-125 transition-transform" /> Pay
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
              {permanentUsers.length === 0 && (
                <li className="py-4 text-gray-500 italic text-center">No permanent members found.</li>
              )}
            </ul>
          </motion.div>
        </div>
      </div>
    </motion.main>
  );
}
