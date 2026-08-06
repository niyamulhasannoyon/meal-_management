/**
 * Core Calculation Engine for Meal Management System
 *
 * These are pure functions that implement the calculation logic
 * used across the ledger, dashboard, and member profile panels.
 *
 * Formulas:
 *   Meal Rate = Total Bazar Cost / Total Meals
 *   Individual Meal Cost = Member's Total Meals × Meal Rate
 *   Individual Balance = Individual Deposits - Individual Meal Cost
 *     (Negative = Due, Positive = Extra)
 */

export interface MemberCalculation {
  id: string;
  name: string;
  isPermanent?: boolean;
  regularMeals: number;
  fineMeals: number;
  minMealAdjustment: number;
  totalMeals: number;
  mealCost: number;
  deposits: number;
  balance: number;
}

export interface MinimumMealConfig {
  enabled: boolean;
  minimumMonthlyMeals: number;
  month: string; // YYYY-MM
  systemStartDate?: string; // YYYY-MM-DD
}

export interface CalculationInput {
  /** Regular meals eaten per user (userId → meal count) */
  userMeals: Record<string, number>;
  /** Fine amounts per user (userId → fine count, added to total meals) */
  userFines: Record<string, number>;
  /** Direct cash deposits per user (userId → amount) */
  userDirectDeposits: Record<string, number>;
  /** Bazar contributions per user (userId → amount spent on bazar, treated as deposit credit) */
  userBazarDeposits: Record<string, number>;
  /** Total bazar costs for the period */
  totalBazar: number;
  /** All users with their names and permanent status */
  users: { id: string; name: string; isPermanent?: boolean }[];
  /** Optional minimum meal rule configuration for permanent members */
  minimumMealConfig?: MinimumMealConfig;
}

export interface CalculationResult {
  /** The computed meal rate per meal unit */
  mealRate: number;
  /** Total meals across all members */
  totalMeals: number;
  /** Total bazar cost */
  totalBazar: number;
  /** Effective minimum meals quota for the month (pro-rated) */
  effectiveMinMeals?: number;
  /** Per-user breakdown */
  users: MemberCalculation[];
}

/**
 * Calculate the effective minimum meal quota for a month.
 * If the system start date is in the middle of the month, pro-rates the quota proportionally.
 */
export function calculateEffectiveMinimumMeals(
  minimumMonthlyMeals: number,
  monthStr?: string,
  systemStartDate?: string
): number {
  if (!minimumMonthlyMeals || minimumMonthlyMeals <= 0) return 0;
  if (!monthStr) return minimumMonthlyMeals;

  const parts = monthStr.split("-");
  if (parts.length < 2) return minimumMonthlyMeals;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1; // 0-indexed
  if (isNaN(year) || isNaN(monthIdx)) return minimumMonthlyMeals;

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  if (daysInMonth <= 0) return minimumMonthlyMeals;

  let activeDays = daysInMonth;
  if (systemStartDate) {
    const sysDate = new Date(systemStartDate);
    const sysYear = sysDate.getFullYear();
    const sysMonth = sysDate.getMonth();
    const sysDay = sysDate.getDate();

    if (sysYear === year && sysMonth === monthIdx) {
      // System started mid-month
      activeDays = Math.max(1, daysInMonth - sysDay + 1);
    } else if (sysYear > year || (sysYear === year && sysMonth > monthIdx)) {
      // System started after this month
      activeDays = 0;
    }
  }

  const ratio = activeDays / daysInMonth;
  return Math.round(minimumMonthlyMeals * ratio * 10) / 10;
}

/**
 * Calculate the meal rate.
 * Meal Rate = Total Bazar Cost / Total Meals
 * Returns 0 if total meals is 0 to avoid division by zero.
 */
export function calculateMealRate(totalBazar: number, totalMeals: number): number {
  if (totalMeals <= 0) return 0;
  return totalBazar / totalMeals;
}

/**
 * Calculate an individual's meal cost.
 * Individual Meal Cost = Total Meals × Meal Rate
 */
export function calculateIndividualMealCost(totalMeals: number, mealRate: number): number {
  return totalMeals * mealRate;
}

/**
 * Calculate total deposits for a user.
 * Total Deposits = Direct Deposits + Bazar Contributions
 */
export function calculateTotalDeposits(
  directDeposits: number,
  bazarContributions: number
): number {
  return directDeposits + bazarContributions;
}

/**
 * Calculate the balance for a user.
 * Balance = Deposits - Meal Cost
 * Negative balance = Due (member owes money)
 * Positive balance = Extra (member overpaid)
 */
export function calculateBalance(deposits: number, mealCost: number): number {
  return deposits - mealCost;
}

/**
 * Get the due amount (positive number) or 0 if the member is not in due.
 */
export function getDueAmount(balance: number): number {
  return balance < 0 ? Math.abs(balance) : 0;
}

/**
 * Get the extra amount (positive number) or 0 if the member has no extra.
 */
export function getExtraAmount(balance: number): number {
  return balance > 0 ? balance : 0;
}

/**
 * Determine if the user has a due balance.
 */
export function isDue(balance: number): boolean {
  return balance < 0;
}

/**
 * Determine if the user has extra balance (overpaid).
 */
export function isExtra(balance: number): boolean {
  return balance > 0;
}

/**
 * Determine if the user is settled (balance is zero).
 */
export function isSettled(balance: number): boolean {
  return balance === 0;
}

/**
 * Get the human-readable status string.
 */
export function getBalanceStatus(balance: number): "due" | "extra" | "settled" {
  if (balance < 0) return "due";
  if (balance > 0) return "extra";
  return "settled";
}

/**
 * Run the full calculation for a set of members.
 *
 * Steps:
 * 1. Calculate effective minimum meal quota (pro-rated if mid-month).
 * 2. Calculate user total meals = regular + fines + minMealAdjustment (for permanent members).
 * 3. Compute meal rate = total bazar / sum(all member total meals).
 * 4. For each user: meal cost = total meals × rate.
 * 5. For each user: deposits = direct + bazar contributions.
 * 6. For each user: balance = deposits - meal cost.
 *
 * @returns The meal rate, total meals, total bazar, and per-user breakdown.
 */
export function calculateLedger(input: CalculationInput): CalculationResult {
  const { userMeals, userFines, userDirectDeposits, userBazarDeposits, totalBazar, users, minimumMealConfig } = input;

  let effectiveMinMeals = 0;
  if (minimumMealConfig?.enabled) {
    effectiveMinMeals = calculateEffectiveMinimumMeals(
      minimumMealConfig.minimumMonthlyMeals,
      minimumMealConfig.month,
      minimumMealConfig.systemStartDate
    );
  }

  let totalMeals = 0;
  const userTotalMeals: Record<string, number> = {};
  const userRegularMeals: Record<string, number> = {};
  const userFineMeals: Record<string, number> = {};
  const userMinAdjustments: Record<string, number> = {};

  for (const user of users) {
    const regular = userMeals[user.id] || 0;
    const fines = userFines[user.id] || 0;
    let minMealAdj = 0;

    // Apply Minimum Guaranteed Meals ONLY for Permanent Members if rule is enabled
    if (minimumMealConfig?.enabled && user.isPermanent && effectiveMinMeals > 0) {
      const eatenPlusFines = regular + fines;
      if (eatenPlusFines < effectiveMinMeals) {
        minMealAdj = Math.round((effectiveMinMeals - eatenPlusFines) * 10) / 10;
      }
    }

    const total = regular + fines + minMealAdj;
    userRegularMeals[user.id] = regular;
    userFineMeals[user.id] = fines;
    userMinAdjustments[user.id] = minMealAdj;
    userTotalMeals[user.id] = total;
    totalMeals += total;
  }

  // 2. Calculate meal rate
  const mealRate = calculateMealRate(totalBazar, totalMeals);

  // 3-5. Calculate per-user details
  const calculatedUsers: MemberCalculation[] = users.map((user) => {
    const uTotalMeals = userTotalMeals[user.id] || 0;
    const uMealCost = calculateIndividualMealCost(uTotalMeals, mealRate);
    const uDirect = userDirectDeposits[user.id] || 0;
    const uBazar = userBazarDeposits[user.id] || 0;
    const uDeposits = calculateTotalDeposits(uDirect, uBazar);
    const uBalance = calculateBalance(uDeposits, uMealCost);

    return {
      id: user.id,
      name: user.name,
      isPermanent: user.isPermanent,
      regularMeals: userRegularMeals[user.id] || 0,
      fineMeals: userFineMeals[user.id] || 0,
      minMealAdjustment: userMinAdjustments[user.id] || 0,
      totalMeals: uTotalMeals,
      mealCost: uMealCost,
      deposits: uDeposits,
      balance: uBalance,
    };
  });

  return {
    mealRate,
    totalMeals,
    totalBazar,
    effectiveMinMeals,
    users: calculatedUsers,
  };
}
