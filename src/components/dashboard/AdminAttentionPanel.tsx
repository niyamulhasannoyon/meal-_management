"use client";

import * as React from "react";
import { AlertCircle, UserCheck, AlertTriangle, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface AttentionItem {
  id: string;
  type: "pending_user" | "deep_due" | "unlogged_meals";
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
}

export interface AdminAttentionPanelProps {
  items: AttentionItem[];
}

export function AdminAttentionPanel({ items }: AdminAttentionPanelProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-4 sm:p-5 shadow-card space-y-3">
      <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        <h3 className="text-sm font-bold tracking-tight">Admin Attention Required ({items.length})</h3>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-card border border-amber-200/80 dark:border-zinc-800 gap-3"
          >
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                {item.type === "pending_user" && <UserCheck className="w-3.5 h-3.5 text-brand" />}
                {item.type === "deep_due" && <AlertTriangle className="w-3.5 h-3.5 text-due" />}
                {item.type === "unlogged_meals" && <Clock className="w-3.5 h-3.5 text-amberAccent-500" />}
                {item.title}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.description}</p>
            </div>

            {item.actionHref ? (
              <Link href={item.actionHref} className="shrink-0">
                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs">
                  {item.actionText || "Resolve"} <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            ) : item.onAction ? (
              <Button onClick={item.onAction} variant="outline" size="sm" className="shrink-0 text-xs">
                {item.actionText || "Resolve"}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
