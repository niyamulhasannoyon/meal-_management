"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Calculator,
  Lock,
  Unlock,
  Search,
  ShoppingBag,
  Utensils,
  Plus,
  History,
  Download,
  Trash2,
  Edit3,
  CheckCircle,
} from "lucide-react";
import { collection, getDocs, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { useMonthlyLedger } from "@/hooks/useMonthlyLedger";
import { formatCurrency, getMonthStr } from "@/lib/utils";
import { logActivity } from "@/lib/activityLogger";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import MemberProfilePanel from "@/components/profile/MemberProfilePanel";
import { staggerContainer, fadeIn } from "@/lib/motion";

interface PaymentItem {
  id: string;
  userId: string;
  userName?: string;
  amount: number;
  paymentFor: string;
  paymentMethod: string;
  reference: string;
  date: any;
}

export default function LedgerPage() {
  const { profile, settings } = useAuth();
  const currencySymbol = settings?.currencySymbol || "৳";
  const { month, setMonth, availableMonths, ledgerResult, loading, isClosed, closeMonth, reopenMonth } = useMonthlyLedger();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const isSuperAdmin = profile?.role === "super_admin";

  // Add Deposit Modal State
  const [showDepositModal, setShowDepositModal] = useState<string | null>(null);
  const [depositUserId, setDepositUserId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("Cash");
  const [depositRef, setDepositRef] = useState("");
  const [depositDate, setDepositDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  // Payment Log Modal State
  const [showPaymentsLog, setShowPaymentsLog] = useState(false);
  const [paymentsList, setPaymentsList] = useState<PaymentItem[]>([]);
  const [editingPayment, setEditingPayment] = useState<PaymentItem | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("Cash");
  const [editRef, setEditRef] = useState("");

  useEffect(() => {
    if (showPaymentsLog) {
      fetchPaymentsList();
    }
  }, [showPaymentsLog, month]);

  const fetchPaymentsList = async () => {
    try {
      const paySnap = await getDocs(collection(db, "payments"));
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap: Record<string, string> = {};
      usersSnap.forEach((d) => {
        usersMap[d.id] = d.data().name || "Member";
      });

      const list: PaymentItem[] = [];
      paySnap.forEach((d) => {
        const data = d.data();
        if (data.paymentFor === "rent") return;
        const mStr = pMonth(data);
        if (mStr === month) {
          list.push({
            id: d.id,
            userId: data.userId,
            userName: usersMap[data.userId] || data.userName || "Member",
            amount: Number(data.amount || 0),
            paymentFor: data.paymentFor || "meal",
            paymentMethod: data.paymentMethod || "Cash",
            reference: data.reference || "",
            date: data.date,
          });
        }
      });

      list.sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
      setPaymentsList(list);
    } catch (err) {
      console.error("Error fetching payments log:", err);
    }
  };

  const pMonth = (data: any) => {
    return data.month || getMonthStr(data.date);
  };

  const safeDate = (val: any) => {
    if (!val) return new Date();
    if (typeof val === "object" && val.toDate) return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const handleOpenAddDeposit = (userId?: string) => {
    if (userId) {
      setDepositUserId(userId);
    } else if (ledgerResult?.users.length) {
      setDepositUserId(ledgerResult.users[0].id);
    }
    setDepositAmount("");
    setDepositMethod("Cash");
    setDepositRef("");
    setDepositDate(format(new Date(), "yyyy-MM-dd"));
    setShowDepositModal("open");
  };

  const handleSaveDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (!depositUserId || !amt || amt <= 0) return;

    setSaving(true);
    try {
      const pDate = depositDate ? new Date(`${depositDate}T12:00:00`) : new Date();
      await addDoc(collection(db, "payments"), {
        userId: depositUserId,
        amount: amt,
        paymentFor: "meal",
        paymentMethod: depositMethod,
        reference: depositRef || "",
        date: pDate,
        month,
        receivedBy: profile?.id,
      });

      const userToDeposit = ledgerResult?.users.find((u) => u.id === depositUserId);
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "ADDED_MEAL_DEPOSIT",
        `Added meal deposit of ${currencySymbol}${amt} via ${depositMethod} for ${userToDeposit?.name || "Member"}`,
        "payment"
      );

      toast.success("Deposit added successfully!");
      setShowDepositModal(null);
      window.location.reload();
    } catch (error) {
      console.error("Error adding deposit:", error);
      toast.error("Failed to add deposit.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this deposit entry?")) return;
    try {
      await deleteDoc(doc(db, "payments", id));
      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown",
        "DELETED_PAYMENT",
        "Deleted deposit payment record",
        "payment"
      );
      toast.success("Deposit deleted!");
      fetchPaymentsList();
    } catch (err) {
      toast.error("Failed to delete deposit");
    }
  };

  const handleExportCSV = () => {
    if (!ledgerResult) return;
    const headers = ["Member", "Total Meals", "Fine Meals", "Meal Cost (TK)", "Deposits (TK)", "Net Balance (TK)", "Status"];
    const rows = ledgerResult.users.map((u) => [
      `"${u.name}"`,
      u.totalMeals,
      u.fineMeals,
      Math.round(u.mealCost),
      Math.round(u.deposits),
      Math.round(u.balance),
      u.balance < 0 ? "Due" : u.balance > 0 ? "Extra" : "Settled",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mess_ledger_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMembers =
    ledgerResult?.users.filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase())) || [];

  return (
    <motion.main
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto"
    >
      {/* Header & Controls */}
      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-brand" />
            Monthly Meal Ledger
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Real-time balance calculations, meal costs, and deposit tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <Select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40 text-xs font-bold"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {format(new Date(`${m}-01`), "MMMM yyyy")}
              </option>
            ))}
            {!availableMonths.includes(month) && (
              <option value={month}>
                {format(new Date(`${month}-01`), "MMMM yyyy")}
              </option>
            )}
          </Select>

          {/* Actions */}
          <Button variant="outline" size="sm" onClick={() => handleOpenAddDeposit()}>
            <Plus className="w-4 h-4 mr-1 text-emerald-600" /> Deposit Money
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowPaymentsLog(true)}>
            <History className="w-4 h-4 mr-1 text-brand" /> Payments Log
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>

          {isSuperAdmin && (
            isClosed ? (
              <Button
                onClick={reopenMonth}
                variant="amber"
                size="sm"
              >
                <Unlock className="w-4 h-4 mr-1.5" /> Re-open Month (Super Admin)
              </Button>
            ) : (
              <Button
                onClick={() => setShowCloseDialog(true)}
                variant="danger"
                size="sm"
              >
                <Lock className="w-4 h-4 mr-1.5" /> Close Month (Super Admin)
              </Button>
            )
          )}
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={fadeIn} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Calculated Meal Rate"
          value={loading ? "..." : `৳${(ledgerResult?.mealRate || 0).toFixed(2)}`}
          subtitle="Total Bazar / Total Meals"
          variant="brand"
          icon={<Calculator className="w-5 h-5 text-brand" />}
        />
        <StatCard
          title="Total Bazar Cost"
          value={loading ? "..." : `৳${formatCurrency(ledgerResult?.totalBazar || 0)}`}
          subtitle="Shared food expenditure"
          variant="amber"
          icon={<ShoppingBag className="w-5 h-5 text-amberAccent-500" />}
        />
        <StatCard
          title="Total Meals Count"
          value={loading ? "..." : ledgerResult?.totalMeals || 0}
          subtitle="Regular meals + fines"
          variant="default"
          icon={<Utensils className="w-5 h-5 text-zinc-600" />}
        />
      </motion.div>

      {/* Filter & Search */}
      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search member name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex items-center space-x-2 text-xs text-zinc-500 font-medium">
          {isClosed && <Badge variant="warning">Frozen Ledger</Badge>}
          <span>Showing {filteredMembers.length} member(s) for {format(new Date(`${month}-01`), "MMMM yyyy")}</span>
        </div>
      </motion.div>

      {/* Minimum Guaranteed Meal Banner if Active */}
      {settings?.enableMinimumMealRule && (
        <motion.div
          variants={fadeIn}
          className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-100 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center space-x-2">
            <Utensils className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Minimum Meal Rule Active:</strong> Permanent members are billed for a minimum of{" "}
              <strong>{ledgerResult?.effectiveMinMeals ?? settings?.minimumMonthlyMeals ?? 12} meals</strong> this month
              (pro-rated mid-month if applicable). Deficits appear in <em>Min. Quota Adj.</em>
            </span>
          </div>
          <Badge variant="warning" className="text-[10px] shrink-0">
            {ledgerResult?.effectiveMinMeals ?? settings?.minimumMonthlyMeals ?? 12} Min. Meals
          </Badge>
        </motion.div>
      )}

      {/* Member Ledger Table */}
      <motion.div variants={fadeIn}>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-center">Meals</TableHead>
                <TableHead className="text-center">Fines</TableHead>
                {ledgerResult?.users.some((u) => u.minMealAdjustment && u.minMealAdjustment > 0) && (
                  <TableHead className="text-center text-brand">Min. Quota Adj.</TableHead>
                )}
                <TableHead className="text-right">Meal Cost</TableHead>
                <TableHead className="text-right">Total Deposits</TableHead>
                <TableHead className="text-right">Net Balance</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-zinc-400">
                    Computing ledger data...
                  </TableCell>
                </TableRow>
              ) : filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-zinc-400">
                    No members match search for {month}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => {
                  const isDue = member.balance < 0;
                  const isExtra = member.balance > 0;
                  const hasMinAdjCol = ledgerResult?.users.some((u) => u.minMealAdjustment && u.minMealAdjustment > 0);

                  return (
                    <TableRow key={member.id}>
                      <TableCell
                        className="font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer flex items-center gap-1.5"
                        onClick={() => setSelectedUserId(member.id)}
                      >
                        <span>{member.name}</span>
                        {member.isPermanent && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400">
                            Permanent
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold text-zinc-700 dark:text-zinc-300">
                        {member.regularMeals ?? (member.totalMeals - member.fineMeals - (member.minMealAdjustment || 0))}
                      </TableCell>
                      <TableCell className="text-center font-bold text-amberAccent-600">
                        {member.fineMeals > 0 ? `+${member.fineMeals}` : "0"}
                      </TableCell>
                      {hasMinAdjCol && (
                        <TableCell className="text-center font-black text-brand">
                          {member.minMealAdjustment && member.minMealAdjustment > 0 ? `+${member.minMealAdjustment}` : "0"}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium text-zinc-700 dark:text-zinc-300">
                        ৳{formatCurrency(member.mealCost)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                        ৳{formatCurrency(member.deposits)}
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-sm">
                        <span className={isDue ? "text-due" : isExtra ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}>
                          {isDue
                            ? `-৳${formatCurrency(Math.abs(member.balance))}`
                            : isExtra
                            ? `+৳${formatCurrency(member.balance)}`
                            : "৳0"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAddDeposit(member.id)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Deposit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Member Profile Modal */}
      <MemberProfilePanel userId={selectedUserId} onClose={() => setSelectedUserId(null)} initialMonth={month} />

      {/* Deposit Modal */}
      <Dialog
        isOpen={!!showDepositModal}
        onClose={() => setShowDepositModal(null)}
        title="Add Cash / Bank Deposit"
        description="Record a cash deposit or digital transfer for a member."
      >
        <form onSubmit={handleSaveDeposit} className="space-y-4 pt-2">
          <Select
            label="Member"
            value={depositUserId}
            onChange={(e) => setDepositUserId(e.target.value)}
            required
          >
            <option value="" disabled>Select Member</option>
            {ledgerResult?.users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>

          <Input
            label={`Deposit Amount (${currencySymbol})`}
            type="number"
            placeholder="e.g. 1000"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            required
          />

          <Select
            label="Payment Method"
            value={depositMethod}
            onChange={(e) => setDepositMethod(e.target.value)}
          >
            <option value="Cash">Cash</option>
            <option value="bKash">bKash</option>
            <option value="Nagad">Nagad</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Other">Other</option>
          </Select>

          <Input
            label="Reference / TrxID (Optional)"
            type="text"
            placeholder="e.g. TrxID 9A8B7C"
            value={depositRef}
            onChange={(e) => setDepositRef(e.target.value)}
          />

          <Input
            label="Deposit Date"
            type="date"
            value={depositDate}
            onChange={(e) => setDepositDate(e.target.value)}
            required
          />

          <div className="flex justify-end space-x-3 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowDepositModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={saving}>
              Save Deposit
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Payments Log Modal */}
      <Dialog
        isOpen={showPaymentsLog}
        onClose={() => setShowPaymentsLog(false)}
        title={`Deposit Transactions Log (${month})`}
        description="Audited record of all deposit entries submitted for this month."
        maxWidth="lg"
      >
        <div className="space-y-4 pt-2 max-h-96 overflow-y-auto">
          {paymentsList.length === 0 ? (
            <p className="text-xs text-zinc-400 italic text-center py-6">No deposit transactions logged for this month.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paymentsList.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{p.userName}</span>
                    <span className="block text-[10px] text-zinc-400">
                      {format(safeDate(p.date), "MMM dd, yyyy")} — {p.paymentMethod} {p.reference ? `(${p.reference})` : ""}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">৳{formatCurrency(p.amount)}</span>
                    {isSuperAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 p-1 h-auto"
                        onClick={() => handleDeletePayment(p.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>

      {/* Close Month Modal */}
      <Dialog
        isOpen={showCloseDialog}
        onClose={() => setShowCloseDialog(false)}
        title="Confirm Month Closure"
        description={`Are you sure you want to CLOSE the ledger for ${month}? This will lock the meal rate at ৳${(
          ledgerResult?.mealRate || 0
        ).toFixed(2)} and snapshot all member balances.`}
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
            ⚠️ Closing the month is an audited action. Once closed, no further edits to meals or bazar costs can be made for this period.
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCloseDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                closeMonth();
                setShowCloseDialog(false);
              }}
            >
              Confirm Close Month
            </Button>
          </div>
        </div>
      </Dialog>
    </motion.main>
  );
}
