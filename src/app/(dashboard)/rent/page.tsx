"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { format, subMonths, addMonths } from "date-fns";
import { 
  Home, 
  Receipt, 
  Users as UsersIcon, 
  PlusCircle, 
  Save, 
  Lock, 
  Unlock, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight, 
  Wallet, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  History,
  Calendar,
  Sparkles,
  Zap
} from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { sortUsers, formatCurrency, getMonthStr } from "@/lib/utils";
import Avatar from "@/components/layout/Avatar";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { staggerContainer, fadeIn } from "@/lib/motion";

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

interface PaymentLogItem {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  date: any;
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
  const [rentPaymentLogs, setRentPaymentLogs] = useState<PaymentLogItem[]>([]);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentRef, setPaymentRef] = useState("");

  const canManageRent = profile?.role === "super_admin" || profile?.role === "admin" || profile?.role === "moderator";

  useEffect(() => {
    fetchRentAndUsers();
  }, [currentMonth]);

  const fetchRentAndUsers = async () => {
    setLoading(true);
    try {
      // 1. Fetch permanent members
      const usersSnap = await getDocs(collection(db, "users"));
      const pUsers: UserProfile[] = [];
      const usersNameMap: Record<string, string> = {};

      usersSnap.forEach((d) => {
        const data = d.data();
        usersNameMap[d.id] = data.name || "Member";
        if (data.isPermanent === true && data.role === "member") {
          pUsers.push({ id: d.id, ...data } as UserProfile);
        }
      });
      const sortedPermanent = sortUsers(pUsers);
      setPermanentUsers(sortedPermanent);

      // 2. Fetch rent structure for current month
      const rentDoc = await getDoc(doc(db, "monthly_rent", currentMonth));
      if (rentDoc.exists()) {
        const data = rentDoc.data() as MonthlyRent;
        const total = (data.houseRent || 0) + (data.gas || 0) + (data.service || 0) + 
                      (data.maid || 0) + (data.wifi || 0) + (data.electricity || 0) + (data.others || 0);
        const pCount = sortedPermanent.length || 1;
        setRentData({
          ...data,
          totalRent: total,
          perPersonRent: total / pCount,
        });
      } else {
        setRentData({ ...defaultRent });
      }

      // 3. Fetch rent payments for current month
      const settingsDoc = await getDoc(doc(db, "system_config", "settings"));
      const systemStartDate = settingsDoc.exists() ? (settingsDoc.data().systemStartDate || "") : "";

      const paySnap = await getDocs(collection(db, "payments"));
      const deposits: Record<string, number> = {};
      const logs: PaymentLogItem[] = [];

      paySnap.forEach(d => {
        const data = d.data();
        const mStr = getMonthStr(data.date || data.month || data.createdAt);
        if (mStr === currentMonth && data.paymentFor === "rent") {
          const amt = Number(data.amount || 0);
          deposits[data.userId] = (deposits[data.userId] || 0) + amt;
          logs.push({
            id: d.id,
            userId: data.userId,
            userName: usersNameMap[data.userId] || "Member",
            amount: amt,
            paymentMethod: data.paymentMethod || "Cash",
            reference: data.reference || "",
            date: data.date || data.createdAt,
          });
        }
      });

      setUserRentDeposits(deposits);
      setRentPaymentLogs(logs);

    } catch (error) {
      console.error("Error fetching rent data:", error);
      toast.error("Failed to load rent details.");
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
      
      const pCount = permanentUsers.length || 1;
      updated.perPersonRent = updated.totalRent / pCount;
      
      return updated;
    });
  };

  const handleSaveRent = async () => {
    if (!canManageRent) {
      toast.error("Only admins and moderators can save rent parameters.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...rentData,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.id,
      };
      await setDoc(doc(db, "monthly_rent", currentMonth), payload);
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "SAVED_RENT_STRUCTURE",
        `Updated rent structure for month: ${currentMonth} (Total: ৳${rentData.totalRent})`
      );
      
      toast.success(`Rent structure for ${currentMonth} saved successfully!`);
    } catch (error) {
      console.error("Error saving rent:", error);
      toast.error("Failed to save rent structure.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseMonth = async () => {
    if (!canManageRent) {
      toast.error("Only admins can close rent calculations.");
      return;
    }
    if (!confirm(`Are you sure you want to CLOSE rent calculations for ${currentMonth}? No further edits will be allowed.`)) return;
    
    setSaving(true);
    try {
      const updatedRent = { ...rentData, isClosed: true, closedAt: new Date().toISOString() };
      await setDoc(doc(db, "monthly_rent", currentMonth), updatedRent);
      setRentData(updatedRent);
      
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "CLOSED_RENT_MONTH",
        `Closed rent calculations for month: ${currentMonth}`
      );
      
      toast.success("Rent month closed successfully!");
    } catch (error) {
      console.error("Error closing month:", error);
      toast.error("Failed to close month.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async (userId: string) => {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "payments"), {
        userId,
        amount: Number(paymentAmount),
        paymentFor: "rent",
        paymentMethod: paymentMethod,
        reference: paymentRef || "",
        date: new Date(),
        receivedBy: profile?.id
      });
      
      const userToDeposit = permanentUsers.find(u => u.id === userId);
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "ADDED_RENT_PAYMENT",
        `Added rent payment of ৳${paymentAmount} via ${paymentMethod} for ${userToDeposit?.name || "Member"}`
      );
      
      toast.success(`Rent payment of ৳${paymentAmount} added successfully!`);
      setPaymentAmount("");
      setPaymentMethod("Cash");
      setPaymentRef("");
      setShowPaymentModal(null);
      fetchRentAndUsers();
    } catch (error) {
      console.error("Error adding payment:", error);
      toast.error("Failed to save rent payment.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrevMonth = () => {
    try {
      const [y, m] = currentMonth.split("-").map(Number);
      const prev = subMonths(new Date(y, m - 1, 1), 1);
      setCurrentMonth(format(prev, "yyyy-MM"));
    } catch {
      // ignore
    }
  };

  const handleNextMonth = () => {
    try {
      const [y, m] = currentMonth.split("-").map(Number);
      const next = addMonths(new Date(y, m - 1, 1), 1);
      setCurrentMonth(format(next, "yyyy-MM"));
    } catch {
      // ignore
    }
  };

  // Calculations for summary stats
  const totalCollected = permanentUsers.reduce((sum, u) => sum + (userRentDeposits[u.id] || 0), 0);
  const totalRemainingDue = Math.max(0, rentData.totalRent - totalCollected);
  const paidMembersCount = permanentUsers.filter(u => (userRentDeposits[u.id] || 0) >= Math.round(rentData.perPersonRent || 0)).length;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-8 w-8 rounded-full border-4 border-brand border-t-transparent"
        />
      </div>
    );
  }

  return (
    <motion.main 
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6"
    >
      {/* Header Bar */}
      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Home className="h-6 w-6 text-brand" />
            House Rent & Utility Manager
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Configure monthly house rent, utilities breakdown, and track member rent payments & dues.
          </p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <input 
            type="month" 
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="border-0 bg-transparent text-xs font-bold focus:ring-0 text-zinc-900 dark:text-zinc-100 cursor-pointer"
          />

          <button
            onClick={handleNextMonth}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Summary Stat Cards */}
      <motion.div variants={fadeIn} className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Required Rent"
          value={`৳ ${formatCurrency(rentData.totalRent)}`}
          subtitle={`For ${currentMonth} (${permanentUsers.length} members)`}
          icon={<Receipt className="w-5 h-5 text-indigo-500" />}
          variant="brand"
        />
        <StatCard
          title="Total Collected (Mot Pelam)"
          value={`৳ ${formatCurrency(totalCollected)}`}
          subtitle={`${paidMembersCount} of ${permanentUsers.length} members paid`}
          icon={<Wallet className="w-5 h-5 text-emerald-500" />}
          variant="surplus"
        />
        <StatCard
          title="Total Remaining Due (Baki)"
          value={`৳ ${formatCurrency(totalRemainingDue)}`}
          subtitle={totalRemainingDue > 0 ? "Pending collection" : "All rent collected!"}
          icon={<TrendingDown className="w-5 h-5 text-rose-500" />}
          variant={totalRemainingDue > 0 ? "due" : "surplus"}
        />
        <StatCard
          title="Per Person Rent"
          value={`৳ ${formatCurrency(Math.round(rentData.perPersonRent || 0))}`}
          subtitle="Fixed share per permanent member"
          icon={<UsersIcon className="w-5 h-5 text-amber-500" />}
          variant="amber"
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Costs Structure Form (2 columns) */}
        <motion.div variants={fadeIn} className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand" />
                Monthly Costs Structure ({currentMonth})
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Enter monthly house rent and shared utility breakdown below.
              </p>
            </div>

            {canManageRent && (
              <Button
                onClick={handleSaveRent}
                isLoading={saving}
                disabled={rentData.isClosed}
                variant="primary"
                size="sm"
              >
                <Save className="w-4 h-4 mr-1.5" />
                {rentData.isClosed ? "Locked" : "Save Rent Structure"}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="House Rent (৳)"
              type="number"
              disabled={rentData.isClosed || !canManageRent}
              value={rentData.houseRent || ""}
              onChange={(e) => handleInputChange("houseRent", Number(e.target.value))}
              placeholder="e.g. 9000"
            />
            <Input
              label="Gas Bill (৳)"
              type="number"
              disabled={rentData.isClosed || !canManageRent}
              value={rentData.gas || ""}
              onChange={(e) => handleInputChange("gas", Number(e.target.value))}
              placeholder="e.g. 1080"
            />
            <Input
              label="Service Charge (৳)"
              type="number"
              disabled={rentData.isClosed || !canManageRent}
              value={rentData.service || ""}
              onChange={(e) => handleInputChange("service", Number(e.target.value))}
              placeholder="e.g. 500"
            />
            <Input
              label="Maid Bill (৳)"
              type="number"
              disabled={rentData.isClosed || !canManageRent}
              value={rentData.maid || ""}
              onChange={(e) => handleInputChange("maid", Number(e.target.value))}
              placeholder="e.g. 2500"
            />
            <Input
              label="WiFi / Internet (৳)"
              type="number"
              disabled={rentData.isClosed || !canManageRent}
              value={rentData.wifi || ""}
              onChange={(e) => handleInputChange("wifi", Number(e.target.value))}
              placeholder="e.g. 500"
            />
            <Input
              label="Electricity (Variable) (৳)"
              type="number"
              disabled={rentData.isClosed || !canManageRent}
              value={rentData.electricity || ""}
              onChange={(e) => handleInputChange("electricity", Number(e.target.value))}
              placeholder="e.g. 1440"
            />
            <div className="sm:col-span-2">
              <Input
                label="Others (৳)"
                type="number"
                disabled={rentData.isClosed || !canManageRent}
                value={rentData.others || ""}
                onChange={(e) => handleInputChange("others", Number(e.target.value))}
                placeholder="e.g. 0"
              />
            </div>
          </div>

          {/* Action Buttons Footer */}
          {canManageRent && (
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Total Rent: <strong className="text-zinc-900 dark:text-white">৳{formatCurrency(rentData.totalRent)}</strong> | Per Person: <strong className="text-emerald-600 dark:text-emerald-400">৳{formatCurrency(Math.round(rentData.perPersonRent || 0))}</strong>
              </div>

              <div className="flex items-center gap-2">
                {!rentData.isClosed && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleCloseMonth}
                    isLoading={saving}
                  >
                    <Lock className="w-3.5 h-3.5 mr-1" /> Close Month
                  </Button>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveRent}
                  isLoading={saving}
                  disabled={rentData.isClosed}
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {rentData.isClosed ? "Month Closed" : "Save Rent Structure"}
                </Button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Side Cost Summary Card */}
        <motion.div variants={fadeIn} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Receipt className="h-5 w-5 text-brand" />
              Rent Cost Summary
            </h3>
            
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1">
                <dt className="text-zinc-500 dark:text-zinc-400">House Rent</dt>
                <dd className="font-bold text-zinc-900 dark:text-zinc-100">৳{formatCurrency(rentData.houseRent)}</dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-zinc-500 dark:text-zinc-400">Gas Bill</dt>
                <dd className="font-bold text-zinc-900 dark:text-zinc-100">৳{formatCurrency(rentData.gas)}</dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-zinc-500 dark:text-zinc-400">Service Charge</dt>
                <dd className="font-bold text-zinc-900 dark:text-zinc-100">৳{formatCurrency(rentData.service)}</dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-zinc-500 dark:text-zinc-400">Maid Bill</dt>
                <dd className="font-bold text-zinc-900 dark:text-zinc-100">৳{formatCurrency(rentData.maid)}</dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-zinc-500 dark:text-zinc-400">WiFi / Internet</dt>
                <dd className="font-bold text-zinc-900 dark:text-zinc-100">৳{formatCurrency(rentData.wifi)}</dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-zinc-500 dark:text-zinc-400">Electricity</dt>
                <dd className="font-bold text-zinc-900 dark:text-zinc-100">৳{formatCurrency(rentData.electricity)}</dd>
              </div>
              {rentData.others > 0 && (
                <div className="flex items-center justify-between py-1">
                  <dt className="text-zinc-500 dark:text-zinc-400">Others</dt>
                  <dd className="font-bold text-zinc-900 dark:text-zinc-100">৳{formatCurrency(rentData.others)}</dd>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <dt className="font-bold text-zinc-900 dark:text-white">Total Rent Calculation</dt>
                <dd className="text-base font-black text-brand">৳{formatCurrency(rentData.totalRent)}</dd>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <dt className="font-bold text-zinc-900 dark:text-white">Per Person Rent Share</dt>
                <dd className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  ৳{formatCurrency(Math.round(rentData.perPersonRent || 0))}
                </dd>
              </div>
            </dl>
          </div>
        </motion.div>
      </div>

      {/* Member Payment Status & Collection Breakdown */}
      <motion.div variants={fadeIn} className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-emerald-500" />
              Member Rent Collection & Due Breakdown ({currentMonth})
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Detailed record of member payments, amount received, and remaining dues.
            </p>
          </div>
          <Badge variant="outline" className="font-bold">
            {paidMembersCount}/{permanentUsers.length} Fully Paid
          </Badge>
        </div>

        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member Name</TableHead>
                <TableHead className="text-center">Required Rent</TableHead>
                <TableHead className="text-center">Total Paid (Rec)</TableHead>
                <TableHead className="text-center">Due / Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permanentUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-zinc-400">
                    No permanent members designated for rent.
                  </TableCell>
                </TableRow>
              ) : (
                permanentUsers.map((user) => {
                  const required = Math.round(rentData.perPersonRent || 0);
                  const paid = userRentDeposits[user.id] || 0;
                  const balance = paid - required;
                  const isFullyPaid = balance >= 0;

                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-semibold text-zinc-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} src={user.photoURL} size={32} />
                          <div>
                            <span>{user.name}</span>
                            <span className="block text-[10px] text-zinc-400">{user.email || "Permanent Member"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-zinc-900 dark:text-white">
                        ৳{formatCurrency(required)}
                      </TableCell>
                      <TableCell className="text-center font-extrabold text-emerald-600 dark:text-emerald-400">
                        ৳{formatCurrency(paid)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                            ✓ Paid {balance > 0 ? `(+৳${formatCurrency(balance)})` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                            Due: ৳{formatCurrency(Math.abs(balance))}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageRent && !rentData.isClosed && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowPaymentModal(user.id);
                              setPaymentAmount("");
                              setPaymentMethod("Cash");
                              setPaymentRef("");
                            }}
                          >
                            <PlusCircle className="w-3.5 h-3.5 mr-1" /> Pay Rent
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Add Rent Payment Modal */}
      <Dialog
        isOpen={!!showPaymentModal}
        onClose={() => setShowPaymentModal(null)}
        title="Record Member Rent Payment"
        description={`Add rent / utility deposit for ${
          permanentUsers.find((u) => u.id === showPaymentModal)?.name || "Member"
        } (${currentMonth})`}
      >
        <div className="space-y-4 pt-2">
          <Input
            label="Payment Amount (৳)"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="e.g. 2503"
            required
          />

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 px-3 text-xs focus:ring-2 focus:ring-brand dark:text-white"
            >
              <option value="Cash">Cash</option>
              <option value="bKash">bKash</option>
              <option value="Nagad">Nagad</option>
              <option value="Rocket">Rocket</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          <Input
            label="Reference ID / TrxID (Optional)"
            type="text"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="e.g. TrxID 9B8A7C"
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPaymentModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={saving}
              disabled={!paymentAmount}
              onClick={() => showPaymentModal && handleAddPayment(showPaymentModal)}
            >
              Save Payment
            </Button>
          </div>
        </div>
      </Dialog>
    </motion.main>
  );
}
