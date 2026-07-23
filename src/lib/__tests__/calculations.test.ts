import { describe, it, expect } from 'vitest';
import {
  calculateMealRate,
  calculateIndividualMealCost,
  calculateTotalDeposits,
  calculateBalance,
  getDueAmount,
  getExtraAmount,
  isDue,
  isExtra,
  isSettled,
  getBalanceStatus,
  calculateLedger,
  CalculationInput,
} from '../calculations';

// ---------------------------------------------------------------------------
// calculateMealRate
// ---------------------------------------------------------------------------
describe('calculateMealRate', () => {
  it('computes rate as totalBazar / totalMeals', () => {
    expect(calculateMealRate(1000, 200)).toBe(5);
  });

  it('returns 0 when totalMeals is 0 to prevent division by zero', () => {
    expect(calculateMealRate(500, 0)).toBe(0);
  });

  it('returns 0 when totalMeals is negative', () => {
    expect(calculateMealRate(500, -10)).toBe(0);
  });

  it('handles fractional rates correctly', () => {
    const result = calculateMealRate(100, 3);
    expect(result).toBeCloseTo(33.333, 2);
  });

  it('returns 0 when both values are 0', () => {
    expect(calculateMealRate(0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateIndividualMealCost
// ---------------------------------------------------------------------------
describe('calculateIndividualMealCost', () => {
  it('computes cost as meals * rate', () => {
    expect(calculateIndividualMealCost(50, 5)).toBe(250);
  });

  it('returns 0 when the user ate 0 meals', () => {
    expect(calculateIndividualMealCost(0, 5)).toBe(0);
  });

  it('handles fractional meal counts', () => {
    expect(calculateIndividualMealCost(3.5, 10)).toBe(35);
  });

  it('handles fractional rates', () => {
    const result = calculateIndividualMealCost(10, 33.33);
    expect(result).toBeCloseTo(333.3, 1);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalDeposits
// ---------------------------------------------------------------------------
describe('calculateTotalDeposits', () => {
  it('sums direct deposits and bazar contributions', () => {
    expect(calculateTotalDeposits(500, 300)).toBe(800);
  });

  it('works with only direct deposits', () => {
    expect(calculateTotalDeposits(1000, 0)).toBe(1000);
  });

  it('works with only bazar contributions', () => {
    expect(calculateTotalDeposits(0, 750)).toBe(750);
  });

  it('returns 0 when both are 0', () => {
    expect(calculateTotalDeposits(0, 0)).toBe(0);
  });

  it('handles fractional values', () => {
    expect(calculateTotalDeposits(100.5, 200.25)).toBeCloseTo(300.75, 2);
  });
});

// ---------------------------------------------------------------------------
// calculateBalance
// ---------------------------------------------------------------------------
describe('calculateBalance', () => {
  it('positive balance when deposits exceed cost', () => {
    expect(calculateBalance(1000, 800)).toBe(200);
  });

  it('negative balance when cost exceeds deposits (due)', () => {
    expect(calculateBalance(800, 1000)).toBe(-200);
  });

  it('zero balance when deposits equal cost (settled)', () => {
    expect(calculateBalance(1000, 1000)).toBe(0);
  });

  it('handles zero deposits', () => {
    expect(calculateBalance(0, 500)).toBe(-500);
  });

  it('handles zero cost', () => {
    expect(calculateBalance(500, 0)).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// getDueAmount / getExtraAmount
// ---------------------------------------------------------------------------
describe('getDueAmount', () => {
  it('returns absolute value for negative balance', () => {
    expect(getDueAmount(-200)).toBe(200);
  });

  it('returns 0 for positive balance', () => {
    expect(getDueAmount(150)).toBe(0);
  });

  it('returns 0 for zero balance', () => {
    expect(getDueAmount(0)).toBe(0);
  });
});

describe('getExtraAmount', () => {
  it('returns positive balance', () => {
    expect(getExtraAmount(200)).toBe(200);
  });

  it('returns 0 for negative balance', () => {
    expect(getExtraAmount(-150)).toBe(0);
  });

  it('returns 0 for zero balance', () => {
    expect(getExtraAmount(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
describe('isDue', () => {
  it('returns true when balance is negative', () => {
    expect(isDue(-1)).toBe(true);
    expect(isDue(-100)).toBe(true);
  });

  it('returns false when balance is zero or positive', () => {
    expect(isDue(0)).toBe(false);
    expect(isDue(50)).toBe(false);
  });
});

describe('isExtra', () => {
  it('returns true when balance is positive', () => {
    expect(isExtra(1)).toBe(true);
    expect(isExtra(100)).toBe(true);
  });

  it('returns false when balance is zero or negative', () => {
    expect(isExtra(0)).toBe(false);
    expect(isExtra(-50)).toBe(false);
  });
});

describe('isSettled', () => {
  it('returns true when balance is exactly zero', () => {
    expect(isSettled(0)).toBe(true);
  });

  it('returns false when balance is not zero', () => {
    expect(isSettled(1)).toBe(false);
    expect(isSettled(-1)).toBe(false);
    expect(isSettled(0.0001)).toBe(false);
  });
});

describe('getBalanceStatus', () => {
  it('returns "due" for negative balance', () => {
    expect(getBalanceStatus(-1)).toBe('due');
    expect(getBalanceStatus(-500)).toBe('due');
  });

  it('returns "extra" for positive balance', () => {
    expect(getBalanceStatus(1)).toBe('extra');
    expect(getBalanceStatus(500)).toBe('extra');
  });

  it('returns "settled" for zero balance', () => {
    expect(getBalanceStatus(0)).toBe('settled');
  });
});

// ---------------------------------------------------------------------------
// calculateLedger (integration-style)
// ---------------------------------------------------------------------------
describe('calculateLedger', () => {
  const users = [
    { id: 'user-1', name: 'Alice' },
    { id: 'user-2', name: 'Bob' },
    { id: 'user-3', name: 'Charlie' },
  ];

  it('performs a full ledger calculation with multiple members', () => {
    const input: CalculationInput = {
      users,
      totalBazar: 3000,
      userMeals: {
        'user-1': 40,
        'user-2': 35,
        'user-3': 25,
      },
      userFines: { 'user-1': 5, 'user-2': 0, 'user-3': 2 },
      userDirectDeposits: { 'user-1': 500, 'user-2': 1000, 'user-3': 600 },
      userBazarDeposits: { 'user-1': 300, 'user-2': 200, 'user-3': 100 },
    };

    const result = calculateLedger(input);

    // Total meals = 40 + 5 + 35 + 0 + 25 + 2 = 107
    expect(result.totalMeals).toBe(107);
    expect(result.totalBazar).toBe(3000);

    // Meal rate = 3000 / 107 ≈ 28.037
    expect(result.mealRate).toBeCloseTo(28.037, 2);

    // Alice: meals = 45, cost = 45 * 28.037 ≈ 1261.68
    //        deposits = 500 + 300 = 800
    //        balance = 800 - 1261.68 = -461.68 (due)
    const alice = result.users.find((u) => u.name === 'Alice')!;
    expect(alice).toBeDefined();
    expect(alice.totalMeals).toBe(45);
    expect(alice.fineMeals).toBe(5);
    expect(alice.mealCost).toBeCloseTo(1261.68, 1);
    expect(alice.deposits).toBe(800);
    expect(alice.balance).toBeCloseTo(-461.68, 1);

    // Bob: meals = 35, cost = 35 * 28.037 ≈ 981.31
    //       deposits = 1000 + 200 = 1200
    //       balance = 1200 - 981.31 = 218.69 (extra)
    const bob = result.users.find((u) => u.name === 'Bob')!;
    expect(bob).toBeDefined();
    expect(bob.totalMeals).toBe(35);
    expect(bob.fineMeals).toBe(0);
    expect(bob.mealCost).toBeCloseTo(981.31, 1);
    expect(bob.deposits).toBe(1200);
    expect(bob.balance).toBeCloseTo(218.69, 1);

    // Charlie: meals = 27, cost = 27 * 28.037 ≈ 757.01
    //          deposits = 600 + 100 = 700
    //          balance = 700 - 757.01 = -57.01 (due)
    const charlie = result.users.find((u) => u.name === 'Charlie')!;
    expect(charlie).toBeDefined();
    expect(charlie.totalMeals).toBe(27);
    expect(charlie.fineMeals).toBe(2);
    expect(charlie.mealCost).toBeCloseTo(757.01, 1);
    expect(charlie.deposits).toBe(700);
    expect(charlie.balance).toBeCloseTo(-57.01, 1);

    // Verify total users returned
    expect(result.users).toHaveLength(3);
  });

  it('handles a scenario with no bazar and no meals', () => {
    const input: CalculationInput = {
      users,
      totalBazar: 0,
      userMeals: {},
      userFines: {},
      userDirectDeposits: {},
      userBazarDeposits: {},
    };

    const result = calculateLedger(input);

    expect(result.mealRate).toBe(0);
    expect(result.totalMeals).toBe(0);
    expect(result.totalBazar).toBe(0);
    expect(result.users).toHaveLength(3);

    // Everyone should have zero values
    for (const user of result.users) {
      expect(user.totalMeals).toBe(0);
      expect(user.fineMeals).toBe(0);
      expect(user.mealCost).toBe(0);
      expect(user.deposits).toBe(0);
      expect(user.balance).toBe(0);
    }
  });

  it('handles a member with data but no meals', () => {
    const input: CalculationInput = {
      users,
      totalBazar: 1000,
      userMeals: { 'user-1': 50 },
      userFines: {},
      userDirectDeposits: { 'user-1': 1000, 'user-2': 500 },
      userBazarDeposits: {},
    };

    const result = calculateLedger(input);

    // Total meals = 50 (only Alice has meals)
    expect(result.totalMeals).toBe(50);
    expect(result.mealRate).toBe(20); // 1000 / 50

    // Alice has deposits and meals → settled
    const alice = result.users.find((u) => u.name === 'Alice')!;
    expect(alice.totalMeals).toBe(50);
    expect(alice.mealCost).toBe(1000);
    expect(alice.deposits).toBe(1000);
    expect(alice.balance).toBe(0);

    // Bob has deposits but no meals → extra
    const bob = result.users.find((u) => u.name === 'Bob')!;
    expect(bob.totalMeals).toBe(0);
    expect(bob.mealCost).toBe(0);
    expect(bob.deposits).toBe(500);
    expect(bob.balance).toBe(500);

    // Charlie has nothing
    const charlie = result.users.find((u) => u.name === 'Charlie')!;
    expect(charlie.totalMeals).toBe(0);
    expect(charlie.mealCost).toBe(0);
    expect(charlie.deposits).toBe(0);
    expect(charlie.balance).toBe(0);
  });

  it('handles fractional meal counts correctly', () => {
    const input: CalculationInput = {
      users: [{ id: 'u1', name: 'Test' }],
      totalBazar: 250,
      userMeals: { 'u1': 10.5 },
      userFines: { 'u1': 1.5 },
      userDirectDeposits: { 'u1': 200 },
      userBazarDeposits: {},
    };

    const result = calculateLedger(input);

    // Total meals = 10.5 + 1.5 = 12
    expect(result.totalMeals).toBe(12);
    // Meal rate = 250 / 12 ≈ 20.833
    expect(result.mealRate).toBeCloseTo(20.833, 2);

    const user = result.users[0];
    expect(user.totalMeals).toBe(12);
    expect(user.fineMeals).toBe(1.5);
    expect(user.mealCost).toBeCloseTo(250, 0); // 12 * 20.833 ≈ 250
    expect(user.deposits).toBe(200);
    expect(user.balance).toBeCloseTo(-50, 0); // 200 - 250 ≈ -50
  });

  it('handles large numbers without overflow issues', () => {
    const input: CalculationInput = {
      users: [
        { id: 'u1', name: 'High Meals' },
        { id: 'u2', name: 'High Deposits' },
      ],
      totalBazar: 100000,
      userMeals: { 'u1': 1000, 'u2': 500 },
      userFines: {},
      userDirectDeposits: { 'u1': 20000, 'u2': 50000 },
      userBazarDeposits: {},
    };

    const result = calculateLedger(input);

    expect(result.totalMeals).toBe(1500);
    expect(result.mealRate).toBeCloseTo(66.667, 2);

    const u1 = result.users[0];
    expect(u1.mealCost).toBeCloseTo(66666.67, 1); // 1000 * 66.667
    expect(u1.balance).toBeCloseTo(-46666.67, 1); // 20000 - 66666.67

    const u2 = result.users[1];
    expect(u2.mealCost).toBeCloseTo(33333.33, 1); // 500 * 66.667
    expect(u2.balance).toBeCloseTo(16666.67, 1); // 50000 - 33333.33
  });

  it('includes bazar contributions as deposit credits', () => {
    const input: CalculationInput = {
      users: [{ id: 'u1', name: 'Bazar Spender' }],
      totalBazar: 500,
      userMeals: { 'u1': 20 },
      userFines: {},
      userDirectDeposits: {},
      userBazarDeposits: { 'u1': 300 }, // spent 300 on bazar
    };

    const result = calculateLedger(input);

    // Meal rate = 500 / 20 = 25
    expect(result.mealRate).toBe(25);
    // Cost = 20 * 25 = 500
    expect(result.users[0].mealCost).toBe(500);
    // Deposits = 0 + 300 = 300
    expect(result.users[0].deposits).toBe(300);
    // Balance = 300 - 500 = -200 (due)
    expect(result.users[0].balance).toBe(-200);
  });

  it('handles an empty users array gracefully', () => {
    const input: CalculationInput = {
      users: [],
      totalBazar: 0,
      userMeals: {},
      userFines: {},
      userDirectDeposits: {},
      userBazarDeposits: {},
    };

    const result = calculateLedger(input);

    expect(result.mealRate).toBe(0);
    expect(result.totalMeals).toBe(0);
    expect(result.totalBazar).toBe(0);
    expect(result.users).toEqual([]);
  });
});
