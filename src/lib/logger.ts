/**
 * Environment-gated logger utility for production readiness.
 * Suppresses debug & info logs in production unless NEXT_PUBLIC_DEBUG is enabled.
 */

const isDev = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG === "true";

export const logger = {
  info: (...args: unknown[]) => {
    if (isDev) {
      console.log("[INFO]", ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn("[WARN]", ...args);
    }
  },
  error: (...args: unknown[]) => {
    // Errors are always logged
    console.error("[ERROR]", ...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug("[DEBUG]", ...args);
    }
  },
};
