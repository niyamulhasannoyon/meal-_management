"use client";

import { useState, useEffect } from "react";
import { Settings, Save, ShieldAlert, Building, Crown, Lock, UtensilsCrossed, Trash2 } from "lucide-react";
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

        {/* Minimum Guaranteed Meals Card (Permanent Members Only) */}
        <motion.div variants={fadeIn}>
          <Card className="border-amber-500/30 dark:border-amber-900/50">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="w-5 h-5 text-amber-500" /> Permanent Member Minimum Meal Guarantee
                </CardTitle>
                {formData.enableMinimumMealRule && (
                  <Badge variant="warning" className="text-xs font-bold">
                    Active System ({formData.minimumMonthlyMeals || 12} Meals Minimum / Full Month)
                  </Badge>
                )}
              </div>
              <CardDescription>
                Exclusively for Permanent Members (<code className="text-brand font-mono text-[11px]">isPermanent == true</code>).
                If a permanent member consumes fewer meals than the monthly minimum (pro-rated for mid-month starts), they are billed up to the minimum quota. Non-permanent members are exempt.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                <div>
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 block">
                    Enable Minimum Guaranteed Meal Rule
                  </span>
                  <span className="text-xs text-zinc-500">
                    Automatically adjust permanent members' calculated meals up to the minimum quota.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={!!formData.enableMinimumMealRule}
                  onChange={(e) => setFormData({ ...formData, enableMinimumMealRule: e.target.checked })}
                  disabled={!isSuperAdmin}
                  className="w-5 h-5 rounded accent-brand cursor-pointer disabled:opacity-50"
                />
              </div>

              {formData.enableMinimumMealRule && (
                <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Monthly Minimum Meals Quota (Full Month)"
                      type="number"
                      step="1"
                      min="1"
                      value={formData.minimumMonthlyMeals ?? 12}
                      onChange={(e) =>
                        setFormData({ ...formData, minimumMonthlyMeals: Math.max(1, parseInt(e.target.value) || 12) })
                      }
                      disabled={!isSuperAdmin}
                      helperText="Default quota for a complete full month (e.g. 12 meals)."
                    />

                    {/* Pro-Rating Explanation Box */}
                    <div className="p-3.5 rounded-xl bg-brand/5 border border-brand/20 text-xs space-y-1">
                      <span className="font-bold text-brand block flex items-center gap-1">
                        <UtensilsCrossed className="w-3.5 h-3.5" /> Pro-Rated Mid-Month Rule
                      </span>
                      <p className="text-zinc-600 dark:text-zinc-300">
                        If the mess started mid-month (e.g. 15th of a 30-day month), the minimum quota for that month will automatically scale:
                      </p>
                      <div className="font-mono text-[11px] font-bold text-brand bg-brand/10 p-1.5 rounded mt-1">
                        {formData.minimumMonthlyMeals || 12} meals × (Active Days / Total Days)
                      </div>
                    </div>
                  </div>

                  {/* Super Admin Delete / Purge Button */}
                  {isSuperAdmin && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:bg-red-50 border-red-200 dark:border-red-900/50"
                        onClick={() => {
                          if (confirm("Are you sure you want to disable and delete the Minimum Guaranteed Meal Rule system?")) {
                            setFormData({ ...formData, enableMinimumMealRule: false, minimumMonthlyMeals: 12 });
                            saveSettings({ enableMinimumMealRule: false, minimumMonthlyMeals: 12 });
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" /> Delete / Disable Minimum Meal System
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </form>
    </motion.main>
  );
}
