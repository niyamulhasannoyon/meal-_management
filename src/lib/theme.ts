/**
 * Theme & Color Tokens for Mess & Rent Manager
 * Warm, appetite-appropriate terracotta + amber accent + rich slate/charcoal darks
 */

import { UserRole } from "./types/firestore";

export const THEME_COLORS = {
  primary: {
    50: "#fdf8f6",
    100: "#f2e8e5",
    200: "#e6d1cb",
    300: "#d3b2a8",
    400: "#c28d7e",
    500: "#dc5638", // Terracotta Primary
    600: "#c74528",
    700: "#a5351c",
    800: "#862c19",
    900: "#6e2919",
    950: "#3b120a",
  },
  accent: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b", // Warm Amber
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },
  surplus: {
    50: "#ecfdf5",
    100: "#d1fae5",
    500: "#10b981", // Mint Emerald for extra/positive balance
    700: "#047857",
  },
  due: {
    50: "#fef2f2",
    100: "#fee2e2",
    500: "#ef4444", // Crimson for due/negative balance
    700: "#b91c1c",
  },
  neutral: {
    lightBg: "#fcfbf9",
    lightCard: "#ffffff",
    darkBg: "#09090b",
    darkCard: "#18181b",
    darkBorder: "#27272a",
  },
};

export interface RoleThemeConfig {
  role: UserRole;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  gradientBg?: string;
  headerAccent: string;
  avatarRing: string;
}

export function getRoleTheme(role?: UserRole | string): RoleThemeConfig {
  switch (role) {
    case "super_admin":
      return {
        role: "super_admin",
        label: "SUPER ADMIN",
        badgeBg: "bg-amber-500/15 dark:bg-amber-950/40",
        badgeText: "text-amber-600 dark:text-amber-400 font-extrabold",
        badgeBorder: "border-amber-400/40 dark:border-amber-700/60 shadow-xs shadow-amber-500/20",
        gradientBg: "bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600",
        headerAccent: "text-amber-500 dark:text-amber-400",
        avatarRing: "ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-900",
      };
    case "admin":
      return {
        role: "admin",
        label: "ADMIN",
        badgeBg: "bg-red-500/15 dark:bg-red-950/40",
        badgeText: "text-red-600 dark:text-red-400 font-bold",
        badgeBorder: "border-red-400/30 dark:border-red-800/50",
        headerAccent: "text-red-500 dark:text-red-400",
        avatarRing: "ring-2 ring-red-500",
      };
    case "moderator":
      return {
        role: "moderator",
        label: "MODERATOR",
        badgeBg: "bg-teal-500/15 dark:bg-teal-950/40",
        badgeText: "text-teal-600 dark:text-teal-400 font-bold",
        badgeBorder: "border-teal-400/30 dark:border-teal-800/50",
        headerAccent: "text-teal-500 dark:text-teal-400",
        avatarRing: "ring-2 ring-teal-500",
      };
    case "member":
      return {
        role: "member",
        label: "MEMBER",
        badgeBg: "bg-orange-500/15 dark:bg-orange-950/40",
        badgeText: "text-brand font-bold",
        badgeBorder: "border-brand/30 dark:border-brand/50",
        headerAccent: "text-brand",
        avatarRing: "ring-2 ring-brand",
      };
    default:
      return {
        role: "visitor",
        label: (role || "VISITOR").toUpperCase(),
        badgeBg: "bg-zinc-500/15 dark:bg-zinc-800/60",
        badgeText: "text-zinc-600 dark:text-zinc-400 font-medium",
        badgeBorder: "border-zinc-300 dark:border-zinc-700",
        headerAccent: "text-zinc-500",
        avatarRing: "ring-1 ring-zinc-400",
      };
  }
}
