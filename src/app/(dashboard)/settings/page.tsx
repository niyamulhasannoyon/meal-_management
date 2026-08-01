"use client";

import { useState } from "react";
import { Settings, Save, ShieldAlert, Building, DollarSign, UtensilsCrossed } from "lucide-react";
import { useMessSettings } from "@/hooks/useMessSettings";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { staggerContainer, fadeIn } from "@/lib/motion";

export default function SettingsPage() {
  const { settings, loading, saving, saveSettings, isAdmin } = useMessSettings();
  const [formData, setFormData] = useState(settings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(formData);
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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand" />
            Mess System Configuration
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Configure mess details, default meal portions, and operational preferences.
          </p>
        </div>

        {isAdmin && (
          <Button type="submit" form="settings-form" variant="primary" size="sm" isLoading={saving}>
            <Save className="w-4 h-4 mr-1.5" /> Save Changes
          </Button>
        )}
      </motion.div>

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
                  disabled={!isAdmin}
                  required
                />
                <Input
                  label="Currency Symbol"
                  value={formData.currencySymbol || "৳"}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  disabled={!isAdmin}
                  required
                />
              </div>

              <Input
                label="System Start Date"
                type="date"
                value={formData.systemStartDate || ""}
                onChange={(e) => setFormData({ ...formData, systemStartDate: e.target.value })}
                disabled={!isAdmin}
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
                  disabled={!isAdmin}
                />
                <Input
                  label="Lunch Default"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.defaultLunch ?? 1.0}
                  onChange={(e) => setFormData({ ...formData, defaultLunch: parseFloat(e.target.value) || 0 })}
                  disabled={!isAdmin}
                />
                <Input
                  label="Dinner Default"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.defaultDinner ?? 1.0}
                  onChange={(e) => setFormData({ ...formData, defaultDinner: parseFloat(e.target.value) || 0 })}
                  disabled={!isAdmin}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </form>
    </motion.main>
  );
}
