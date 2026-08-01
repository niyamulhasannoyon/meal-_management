import * as React from "react";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: "default" | "brand" | "surplus" | "due" | "amber";
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  className = "",
}: StatCardProps) {
  const borderVariants = {
    default: "border-zinc-200 dark:border-zinc-800",
    brand: "border-brand/30 bg-brand/5 dark:bg-brand/10",
    surplus: "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20",
    due: "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20",
    amber: "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20",
  };

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 bg-card text-card-foreground shadow-card transition-shadow hover:shadow-card-hover ${borderVariants[variant]} ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {title}
        </span>
        {icon && <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              trend.isPositive
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      )}
    </div>
  );
}
