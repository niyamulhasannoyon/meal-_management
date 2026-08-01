"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Calculator,
  Lock,
  Unlock,
  Download,
  Search,
  PlusCircle,
  TrendingUp,
  CreditCard,
  Utensils,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMonthlyLedger } from "@/hooks/useMonthlyLedger";
import { formatCurrency } from "@/lib/utils";
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
import MemberProfilePanel from "@/components/profile/MemberProfilePanel";
import { staggerContainer, fadeIn } from "@/lib/motion";

export default function LedgerPage() {
  const { profile } = useAuth();
  const { month, setMonth, ledgerResult, loading, isClosed, closeMonth } = useMonthlyLedger();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const filteredMembers = ledgerResult?.users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40 text-xs font-semibold"
          />

          {profile?.role === "admin" && (
            <Button
              onClick={() => setShowCloseDialog(true)}
              disabled={isClosed}
              variant={isClosed ? "outline" : "danger"}
              size="sm"
            >
              {isClosed ? (
                <>
                  <Lock className="w-4 h-4 mr-1.5" /> Month Closed
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 mr-1.5" /> Close Month
                </>
              )}
            </Button>
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
        <div className="text-xs text-zinc-500 font-medium">
          Showing {filteredMembers.length} member(s)
        </div>
      </motion.div>

      {/* Member Ledger Table */}
      <motion.div variants={fadeIn}>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-center">Meals</TableHead>
                <TableHead className="text-center">Fines</TableHead>
                <TableHead className="text-right">Meal Cost</TableHead>
                <TableHead className="text-right">Total Deposits</TableHead>
                <TableHead className="text-right">Net Balance</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-zinc-400">
                    Computing ledger data...
                  </TableCell>
                </TableRow>
              ) : filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-zinc-400">
                    No members match search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => {
                  const isDue = member.balance < 0;
                  const isExtra = member.balance > 0;

                  return (
                    <TableRow
                      key={member.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedUserId(member.id)}
                    >
                      <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {member.name}
                      </TableCell>
                      <TableCell className="text-center font-bold text-zinc-700 dark:text-zinc-300">
                        {member.totalMeals - member.fineMeals}
                      </TableCell>
                      <TableCell className="text-center font-bold text-amberAccent-600">
                        {member.fineMeals > 0 ? `+${member.fineMeals}` : "0"}
                      </TableCell>
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
                        {isDue ? (
                          <Badge variant="danger">Due</Badge>
                        ) : isExtra ? (
                          <Badge variant="success">Extra</Badge>
                        ) : (
                          <Badge variant="default">Settled</Badge>
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

      {/* Member Profile Drawer */}
      <MemberProfilePanel userId={selectedUserId} onClose={() => setSelectedUserId(null)} />

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
