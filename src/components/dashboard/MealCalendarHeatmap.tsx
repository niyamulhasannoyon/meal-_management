"use client";

import * as React from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from "date-fns";

export interface DayMealData {
  date: Date;
  dateStr: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  total: number;
}

export interface MealCalendarHeatmapProps {
  monthDate?: Date;
  mealEntries: Record<string, { breakfast: number; lunch: number; dinner: number }>; // dateStr -> counts
}

export function MealCalendarHeatmap({
  monthDate = new Date(),
  mealEntries,
}: MealCalendarHeatmapProps) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = getDay(monthStart);

  const getHeatmapColor = (total: number) => {
    if (total === 0) return "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400";
    if (total <= 1) return "bg-brand/20 text-brand-700 dark:text-brand-300 border border-brand/30";
    if (total <= 2) return "bg-brand/50 text-white font-bold";
    return "bg-brand text-white font-black shadow-xs";
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card p-4 sm:p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          Meal Attendance ({format(monthDate, "MMMM yyyy")})
        </h3>
        <div className="flex items-center space-x-2 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-zinc-200 dark:bg-zinc-800"></span> 0
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-brand/30"></span> 1
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-brand"></span> 2+
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center mb-1">
        {weekDays.map((day) => (
          <div key={day} className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {/* Empty padding cells for starting day */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10 sm:h-12 rounded-lg bg-transparent" />
        ))}

        {daysInMonth.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const entry = mealEntries[dateStr] || { breakfast: 0, lunch: 0, dinner: 0 };
          const total = (entry.breakfast || 0) + (entry.lunch || 0) + (entry.dinner || 0);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dateStr}
              className={`h-10 sm:h-12 rounded-lg flex flex-col items-center justify-center transition-all ${getHeatmapColor(
                total
              )} ${isToday ? "ring-2 ring-amberAccent-500 ring-offset-1 dark:ring-offset-zinc-900" : ""}`}
              title={`${format(day, "MMM dd")}: B: ${entry.breakfast || 0}, L: ${entry.lunch || 0}, D: ${entry.dinner || 0} (${total} total)`}
            >
              <span className="text-[10px] font-medium opacity-80">{format(day, "d")}</span>
              <span className="text-xs font-extrabold">{total > 0 ? total : "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
