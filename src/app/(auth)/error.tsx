"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AUTH ROUTE ERROR]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md text-center p-8 rounded-2xl border border-red-200 dark:border-red-900/40 bg-card space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Authentication Error</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {error.message || "An unexpected error occurred during authentication."}
        </p>
        <Button onClick={() => reset()} variant="primary" size="md">
          Try again
        </Button>
      </div>
    </div>
  );
}
