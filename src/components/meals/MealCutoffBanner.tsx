"use client";

import * as React from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface MealCutoffBannerProps {
  cutoffHour?: number; // Default 22 (10 PM)
}

export function MealCutoffBanner({ cutoffHour = 22 }: MealCutoffBannerProps) {
  const [timeLeft, setTimeLeft] = React.useState<string>("");
  const [isPastCutoff, setIsPastCutoff] = React.useState<boolean>(false);

  React.useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setHours(cutoffHour, 0, 0, 0);

      if (now.getTime() >= cutoff.getTime()) {
        setIsPastCutoff(true);
        setTimeLeft("00h 00m 00s");
        return;
      }

      const diffMs = cutoff.getTime() - now.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setIsPastCutoff(false);
      setTimeLeft(
        `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(
          2,
          "0"
        )}s`
      );
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [cutoffHour]);

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isPastCutoff
          ? "border-red-200 dark:border-red-950 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-300"
          : "border-amber-200 dark:border-amber-950 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300"
      }`}
    >
      <div className="flex items-center space-x-3">
        {isPastCutoff ? (
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
        ) : (
          <Clock className="w-6 h-6 text-amber-600 shrink-0" />
        )}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider">
            {isPastCutoff ? "Cutoff Time Passed (10:00 PM)" : "10:00 PM Cutoff Countdown"}
          </h4>
          <p className="text-xs opacity-80 mt-0.5">
            {isPastCutoff
              ? "Meal updates for today are closed. Contact an admin to adjust counts."
              : "Please submit or update your meal entries before the 10 PM daily cutoff."}
          </p>
        </div>
      </div>

      {!isPastCutoff && (
        <div className="flex items-center space-x-2 bg-card px-3.5 py-2 rounded-lg border border-amber-300 dark:border-amber-800 shrink-0 self-start sm:self-center">
          <span className="text-xs font-bold text-zinc-500 uppercase">Time Left:</span>
          <span className="text-sm font-extrabold text-amberAccent-600 font-mono tracking-tight">{timeLeft}</span>
        </div>
      )}
    </div>
  );
}
