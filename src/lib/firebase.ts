import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  type CollectionReference,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import type {
  UserProfile,
  MealEntry,
  BazarCost,
  PaymentEntry,
  FineEntry,
  MonthlyRent,
  MonthlyLedger,
  ActivityLog,
} from "@/lib/types/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Generic Firestore Data Converter
export const createConverter = <T extends { id?: string }>(): FirestoreDataConverter<T> => ({
  toFirestore: (data: T): DocumentData => {
    const { id, ...rest } = data;
    return rest;
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot): T => {
    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as T;
  },
});

// Typed collection references
export const usersCol = collection(db, "users").withConverter(createConverter<UserProfile>());
export const mealsCol = collection(db, "meals").withConverter(createConverter<MealEntry>());
export const bazarCostsCol = collection(db, "bazar_costs").withConverter(createConverter<BazarCost>());
export const paymentsCol = collection(db, "payments").withConverter(createConverter<PaymentEntry>());
export const finesCol = collection(db, "fines").withConverter(createConverter<FineEntry>());
export const monthlyRentCol = collection(db, "monthly_rent").withConverter(createConverter<MonthlyRent>());
export const monthlyLedgersCol = collection(db, "monthly_ledgers").withConverter(createConverter<MonthlyLedger>());
export const activityLogsCol = collection(db, "activity_logs").withConverter(createConverter<ActivityLog>());

export { app, db, auth, googleProvider };
