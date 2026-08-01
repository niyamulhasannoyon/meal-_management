import * as React from "react";
import { FolderOpen } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = <FolderOpen className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 ${className}`}>
      <div className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800/80 mb-3">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h4>
      {description && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
