"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "admin" | "moderator" | "member" | "visitor";
  isPermanent: boolean;
  currentBalance: number;
}

export interface SystemSettings {
  systemStartDate: string;
  messName: string;
  currencySymbol: string;
  defaultBreakfast: number;
  defaultLunch: number;
  defaultDinner: number;
  allowMemberEditing: boolean;
  autoSubmitEnabled: boolean;
  autoSubmitHour: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  settings: SystemSettings | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  settings: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "system_config", "settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          systemStartDate: data.systemStartDate || "",
          messName: data.messName || "Meal Manager",
          currencySymbol: data.currencySymbol || "৳",
          defaultBreakfast: data.defaultBreakfast !== undefined ? Number(data.defaultBreakfast) : 0.5,
          defaultLunch: data.defaultLunch !== undefined ? Number(data.defaultLunch) : 1.0,
          defaultDinner: data.defaultDinner !== undefined ? Number(data.defaultDinner) : 1.0,
          allowMemberEditing: data.allowMemberEditing !== undefined ? Boolean(data.allowMemberEditing) : true,
          autoSubmitEnabled: data.autoSubmitEnabled !== undefined ? Boolean(data.autoSubmitEnabled) : true,
          autoSubmitHour: data.autoSubmitHour !== undefined ? Number(data.autoSubmitHour) : 22,
        });
      } else {
        setSettings({
          systemStartDate: "",
          messName: "Meal Manager",
          currencySymbol: "৳",
          defaultBreakfast: 0.5,
          defaultLunch: 1.0,
          defaultDinner: 1.0,
          allowMemberEditing: true,
          autoSubmitEnabled: true,
          autoSubmitHour: 22,
        });
      }
    });

    return () => unsubSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            const adminEmails = ["niyamulhasanbd@gmail.com", "niyamulhasan1089@gmail.com"];
            
            // Promote to admin if email matches
            if (adminEmails.includes(currentUser.email || "") && data.role !== "admin") {
              await updateDoc(docRef, { role: "admin" });
              data.role = "admin";
            }

            setProfile({
              id: currentUser.uid,
              name: data.name || currentUser.displayName || "Unknown",
              email: data.email || currentUser.email || "",
              role: data.role || "visitor",
              isPermanent: data.isPermanent || false,
              currentBalance: data.currentBalance || 0,
            } as UserProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, settings, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
