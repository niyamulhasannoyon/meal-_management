"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DASHBOARD ERROR]", error);
  }, [error]);

  return (
    <div className="p-6 sm:p-12 flex flex-col items-center justify-center text-center min-h-[60vh]">
      <div className="p-4 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 mb-4 border border-red-200 dark:border-red-900/50">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Something went wrong!</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
        {error.message || "An unexpected error occurred while rendering this page."}
      </p>
      <div className="mt-6 flex items-center space-x-3">
        <Button onClick={() => reset()} variant="primary" size="md">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reload Section
        </Button>
        <Button onClick={() => window.location.reload()} variant="outline" size="md">
          Refresh Page
        </Button>
      </div>
    </div>
  );
}
