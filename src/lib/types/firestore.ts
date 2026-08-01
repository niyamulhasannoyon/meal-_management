import { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "member" | "moderator" | "visitor" | "pending";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  roomNumber?: string;
  bKashNumber?: string;
  nagadNumber?: string;
  isManager?: boolean;
  active?: boolean;
  createdAt?: Timestamp | Date | string;
}

export interface MealEntry {
  id?: string;
  userId: string;
  userName?: string;
  date: string; // YYYY-MM-DD
  count: number; // 0, 0.5, 1, 1.5, 2, etc.
  month: string; // YYYY-MM
  updatedAt?: Timestamp | Date | string;
  updatedBy?: string;
}

export interface BazarCost {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  description?: string;
  receiptUrl?: string; // Phase 3 photo attachment
  createdAt?: Timestamp | Date | string;
}

export type PaymentMethod = "cash" | "bKash" | "Nagad" | "bank" | "other";
export type PaymentStatus = "approved" | "pending" | "rejected";

export interface PaymentEntry {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  notes?: string;
  method?: PaymentMethod;
  transactionId?: string; // Phase 3 bKash/Nagad reference
  status?: PaymentStatus; // Phase 3 claim + confirm flow
  approvedBy?: string;
  createdAt?: Timestamp | Date | string;
}

export interface FineEntry {
  id: string;
  userId: string;
  userName: string;
  amount: number; // Fine amount in taka or meal count representation
  reason: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  createdAt?: Timestamp | Date | string;
}

export interface FixedCostItem {
  id: string;
  name: string;
  amount: number;
}

export interface MonthlyRent {
  id: string; // Month ID YYYY-MM
  month: string; // YYYY-MM
  totalHouseRent: number;
  wifiBill: number;
  maidBill: number;
  electricityBill: number;
  gasBill: number;
  otherCosts: FixedCostItem[];
  closed: boolean;
  closedAt?: Timestamp | Date | string;
}

export interface UserLedgerSummary {
  userId: string;
  userName: string;
  totalMeals: number;
  fineMeals: number;
  mealCost: number;
  directDeposits: number;
  bazarDeposits: number;
  totalDeposits: number;
  netBalance: number; // Positive = extra, Negative = due
  rentShare?: number;
  finalPayable?: number;
}

export interface MonthlyLedger {
  id: string; // Month ID YYYY-MM
  month: string; // YYYY-MM
  closed: boolean;
  closedAt?: Timestamp | Date | string;
  closedBy?: string;
  totalBazarCost: number;
  totalMealsCount: number;
  calculatedMealRate: number;
  memberSummaries: UserLedgerSummary[];
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: Timestamp | Date | string;
  category?: "meal" | "bazar" | "payment" | "fine" | "rent" | "system";
}
