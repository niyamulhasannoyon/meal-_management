import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import toast from "react-hot-toast";

export interface MessSettings {
  systemStartDate: string;
  messName: string;
  currencySymbol: string;
  defaultBreakfast: number;
  defaultLunch: number;
  defaultDinner: number;
  allowMemberEditing: boolean;
  autoSubmitEnabled: boolean;
  autoSubmitHour: number;
}

export function useMessSettings() {
  const { profile, settings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formState, setFormState] = useState<MessSettings>({
    systemStartDate: "",
    messName: "Meal Manager",
    currencySymbol: "৳",
    defaultBreakfast: 0.5,
    defaultLunch: 1.0,
    defaultDinner: 1.0,
    allowMemberEditing: true,
    autoSubmitEnabled: true,
    autoSubmitHour: 22,
  });

  useEffect(() => {
    if (settings) {
      setFormState({
        systemStartDate: settings.systemStartDate || "",
        messName: settings.messName || "Meal Manager",
        currencySymbol: settings.currencySymbol || "৳",
        defaultBreakfast: settings.defaultBreakfast !== undefined ? settings.defaultBreakfast : 0.5,
        defaultLunch: settings.defaultLunch !== undefined ? settings.defaultLunch : 1.0,
        defaultDinner: settings.defaultDinner !== undefined ? settings.defaultDinner : 1.0,
        allowMemberEditing: settings.allowMemberEditing !== undefined ? settings.allowMemberEditing : true,
        autoSubmitEnabled: settings.autoSubmitEnabled !== undefined ? settings.autoSubmitEnabled : true,
        autoSubmitHour: settings.autoSubmitHour !== undefined ? settings.autoSubmitHour : 22,
      });
      setLoading(false);
    }
  }, [settings]);

  const saveSettings = async (updatedSettings: Partial<MessSettings>) => {
    if (profile?.role !== "admin") {
      toast.error("Only admins can modify system settings.");
      return;
    }
    setSaving(true);
    try {
      const newState = { ...formState, ...updatedSettings };
      await setDoc(
        doc(db, "system_config", "settings"),
        {
          ...newState,
          defaultBreakfast: Number(newState.defaultBreakfast),
          defaultLunch: Number(newState.defaultLunch),
          defaultDinner: Number(newState.defaultDinner),
          autoSubmitHour: Number(newState.autoSubmitHour),
        },
        { merge: true }
      );

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "UPDATE_SETTINGS",
        `Updated system settings for ${newState.messName}`,
        "system"
      );

      setFormState(newState);
      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return {
    settings: formState,
    loading,
    saving,
    saveSettings,
    isAdmin: profile?.role === "admin",
  };
}
