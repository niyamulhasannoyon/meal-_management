"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Utensils, ShoppingBag, Plus, Save, Calendar, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMealEntries } from "@/hooks/useMealEntries";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { MealCutoffBanner } from "@/components/meals/MealCutoffBanner";
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

export default function MealsPage() {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const {
    users,
    meals,
    bazarEntries,
    loading,
    saving,
    isSubmittedForDate,
    handleMealCountChange,
    saveMeals,
    addBazarEntry,
  } = useMealEntries(selectedDate);

  // Bazar form modal state
  const [showBazarDialog, setShowBazarDialog] = useState(false);
  const [bazarAmount, setBazarAmount] = useState("");
  const [bazarDesc, setBazarDesc] = useState("");
  const [bazarSpenderId, setBazarSpenderId] = useState(profile?.id || "");

  const totalDailyMeals = Object.values(meals).reduce((sum, m) => sum + Number(m.count || 0), 0);
  const totalDailyBazar = bazarEntries.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const handleAddBazarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(bazarAmount);
    if (!amt || amt <= 0 || !bazarSpenderId) return;
    addBazarEntry(amt, bazarDesc, bazarSpenderId);
    setBazarAmount("");
    setBazarDesc("");
    setShowBazarDialog(false);
  };

  return (
    <motion.main
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Utensils className="w-6 h-6 text-brand" />
            Daily Meal & Bazar Management
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Log meal counts for members and record daily bazar expenditures.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44 text-xs font-semibold"
          />
          <Button variant="outline" size="sm" onClick={() => setShowBazarDialog(true)}>
            <Plus className="w-4 h-4 mr-1.5 text-amberAccent-500" />
            Add Bazar Cost
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={saving}
            onClick={saveMeals}
          >
            <Save className="w-4 h-4 mr-1.5" />
            Save Meals
          </Button>
        </div>
      </motion.div>

      {/* 10 PM Cutoff Banner */}
      <motion.div variants={fadeIn}>
        <MealCutoffBanner />
      </motion.div>

      {/* Daily Summary Cards */}
      <motion.div variants={fadeIn} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card p-4 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Today's Total Meals</span>
            <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{totalDailyMeals}</p>
          </div>
          <div className="p-3 rounded-xl bg-brand/10 text-brand">
            <Utensils className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card p-4 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Today's Bazar Expenditure</span>
            <p className="text-2xl font-black text-amberAccent-600 mt-1">৳{formatCurrency(totalDailyBazar)}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amberAccent-500">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>
      </motion.div>

      {/* Meals Table */}
      <motion.div variants={fadeIn}>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member Name</TableHead>
                <TableHead className="text-center">Meal Count for {selectedDate}</TableHead>
                <TableHead className="text-right">Quick Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-zinc-400">
                    Loading meal records...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-zinc-400">
                    No active members found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const entry = meals[user.id] || { count: 2 };

                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {user.name}
                        {user.id === profile?.id && <Badge variant="info" className="ml-2">You</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMealCountChange(user.id, (entry.count || 0) - 0.5)}
                          >
                            -
                          </Button>
                          <span className="w-12 text-center text-sm font-extrabold tabular-nums">
                            {entry.count ?? 0}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMealCountChange(user.id, (entry.count || 0) + 0.5)}
                          >
                            +
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          {[0, 1, 1.5, 2].map((cnt) => (
                            <button
                              key={cnt}
                              onClick={() => handleMealCountChange(user.id, cnt)}
                              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                                entry.count === cnt
                                  ? "bg-brand text-white shadow-xs"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                              }`}
                            >
                              {cnt}
                            </button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Bazar Entries List */}
      {bazarEntries.length > 0 && (
        <motion.div variants={fadeIn} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card p-5 shadow-card space-y-3">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <span>Bazar Receipts for {selectedDate}</span>
            <Badge variant="warning">{bazarEntries.length} entries</Badge>
          </h3>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {bazarEntries.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">{item.userName}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">{item.description || "Bazar cost"}</p>
                </div>
                <span className="font-extrabold text-sm text-amberAccent-600">৳{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Add Bazar Modal */}
      <Dialog
        isOpen={showBazarDialog}
        onClose={() => setShowBazarDialog(false)}
        title="Add Bazar Expenditure"
        description={`Record a new bazar expenditure for ${selectedDate}.`}
      >
        <form onSubmit={handleAddBazarSubmit} className="space-y-4 pt-2">
          <Select
            label="Spender / Member"
            value={bazarSpenderId}
            onChange={(e) => setBazarSpenderId(e.target.value)}
            required
          >
            <option value="" disabled>Select member who paid...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>

          <Input
            label="Amount (৳)"
            type="number"
            step="1"
            min="1"
            placeholder="e.g. 450"
            value={bazarAmount}
            onChange={(e) => setBazarAmount(e.target.value)}
            required
          />

          <Input
            label="Description"
            type="text"
            placeholder="e.g. Chicken, Rice, Spices"
            value={bazarDesc}
            onChange={(e) => setBazarDesc(e.target.value)}
          />

          <div className="flex justify-end space-x-3 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowBazarDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Add Expenditure
            </Button>
          </div>
        </form>
      </Dialog>
    </motion.main>
  );
}
