"use client";

import { useState, useEffect } from "react";
import { Settings, Save, ShieldAlert, Building, Crown, Lock, UtensilsCrossed } from "lucide-react";
import { useMessSettings } from "@/hooks/useMessSettings";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { staggerContainer, fadeIn } from "@/lib/motion";

export default function SettingsPage() {
  const { settings, loading, saving, saveSettings, isSuperAdmin } = useMessSettings();
  const [formData, setFormData] = useState(settings);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperAdmin) {
      saveSettings(formData);
    }
  };

  return (
    <motion.main
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Settings className="w-6 h-6 text-brand" />
              Mess System Configuration
            </h1>
            {isSuperAdmin && (
              <Badge variant="warning" className="flex items-center gap-1 font-bold">
                <Crown className="w-3.5 h-3.5 text-amber-500" /> Super Admin Access
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Configure mess workspace name, currency symbol, default meal portions, and operational preferences.
          </p>
        </div>

        {isSuperAdmin ? (
          <Button type="submit" form="settings-form" variant="primary" size="sm" isLoading={saving}>
            <Save className="w-4 h-4 mr-1.5" /> Save Changes
          </Button>
        ) : (
          <Badge variant="outline" className="flex items-center gap-1 py-1.5 px-3 text-xs font-semibold text-zinc-500">
            <Lock className="w-3.5 h-3.5 text-amber-500" /> Read-Only (Super Admin Exclusive)
          </Badge>
        )}
      </motion.div>

      {!isSuperAdmin && (
        <motion.div variants={fadeIn} className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
          <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-bold block text-sm mb-0.5">Super Admin Permission Required</span>
            Only the <strong>Super Admin</strong> is authorized to edit and save Mess System Configuration. You are viewing these settings in read-only mode.
          </div>
        </motion.div>
      )}

      <form id="settings-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Mess Information Card */}
        <motion.div variants={fadeIn}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="w-5 h-5 text-brand" /> General Workspace
              </CardTitle>
              <CardDescription>Name and currency symbol displayed across the dashboard and reports.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Mess Workspace Name"
                  value={formData.messName || ""}
                  onChange={(e) => setFormData({ ...formData, messName: e.target.value })}
                  disabled={!isSuperAdmin}
                  required
                />
                <Input
                  label="Currency Symbol"
                  value={formData.currencySymbol || "৳"}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  disabled={!isSuperAdmin}
                  required
                />
              </div>

              <Input
                label="System Start Date"
                type="date"
                value={formData.systemStartDate || ""}
                onChange={(e) => setFormData({ ...formData, systemStartDate: e.target.value })}
                disabled={!isSuperAdmin}
                helperText="Only meals and costs on or after this date will be included in ledger calculations."
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Meal Defaults Card */}
        <motion.div variants={fadeIn}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UtensilsCrossed className="w-5 h-5 text-amberAccent-500" /> Default Portion Settings
              </CardTitle>
              <CardDescription>Default meal counts automatically assigned when members log attendance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Breakfast Default"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.defaultBreakfast ?? 0.5}
                  onChange={(e) => setFormData({ ...formData, defaultBreakfast: parseFloat(e.target.value) || 0 })}
                  disabled={!isSuperAdmin}
                />
                <Input
                  label="Lunch Default"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.defaultLunch ?? 1.0}
                  onChange={(e) => setFormData({ ...formData, defaultLunch: parseFloat(e.target.value) || 0 })}
                  disabled={!isSuperAdmin}
                />
                <Input
                  label="Dinner Default"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.defaultDinner ?? 1.0}
                  onChange={(e) => setFormData({ ...formData, defaultDinner: parseFloat(e.target.value) || 0 })}
                  disabled={!isSuperAdmin}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </form>
    </motion.main>
  );
}
