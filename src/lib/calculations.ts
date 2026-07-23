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
  totalMeals: number;
  fineMeals: number;
  mealCost: number;
  deposits: number;
  balance: number;
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
  /** All users with their names */
  users: { id: string; name: string }[];
}

export interface CalculationResult {
  /** The computed meal rate per meal unit */
  mealRate: number;
  /** Total meals across all members */
  totalMeals: number;
  /** Total bazar cost */
  totalBazar: number;
  /** Per-user breakdown */
  users: MemberCalculation[];
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
 * This replicates the logic used in the ledger page:
 * 1. Compute total meals (regular meals + fines)
 * 2. Compute meal rate = total bazar / total meals
 * 3. For each user: meal cost = total meals × rate
 * 4. For each user: deposits = direct + bazar contributions
 * 5. For each user: balance = deposits - meal cost
 *
 * @returns The meal rate, total meals, total bazar, and per-user breakdown.
 */
export function calculateLedger(input: CalculationInput): CalculationResult {
  const { userMeals, userFines, userDirectDeposits, userBazarDeposits, totalBazar, users } = input;

  // 1. Calculate total meals (regular + fines)
  let totalMeals = 0;
  const userTotalMeals: Record<string, number> = {};

  for (const user of users) {
    const regular = userMeals[user.id] || 0;
    const fines = userFines[user.id] || 0;
    const total = regular + fines;
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
      totalMeals: uTotalMeals,
      fineMeals: userFines[user.id] || 0,
      mealCost: uMealCost,
      deposits: uDeposits,
      balance: uBalance,
    };
  });

  return {
    mealRate,
    totalMeals,
    totalBazar,
    users: calculatedUsers,
  };
}
