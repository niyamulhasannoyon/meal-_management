import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, setDoc, query, where, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, mealsCol, bazarCostsCol, usersCol } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import type { MealEntry, BazarCost, UserProfile } from "@/lib/types/firestore";
import { logActivity } from "@/lib/activityLogger";
import { sortUsers } from "@/lib/utils";
import toast from "react-hot-toast";

export function useMealEntries(selectedDate: string) {
  const { profile, settings } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [meals, setMeals] = useState<Record<string, MealEntry>>({});
  const [bazarEntries, setBazarEntries] = useState<BazarCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSubmittedForDate, setIsSubmittedForDate] = useState(false);

  useEffect(() => {
    fetchUsersAndMeals();
  }, [selectedDate]);

  const fetchUsersAndMeals = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const usersSnap = await getDocs(usersCol);
      const usersData: UserProfile[] = [];
      usersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        usersData.push({ ...data, id: docSnap.id } as UserProfile);
      });
      const activeMembers = sortUsers(
        usersData.filter((u) => u.role !== "pending" && u.role !== "visitor")
      );
      setUsers(activeMembers);

      // 2. Fetch Meals for selectedDate
      const mealsQuery = query(mealsCol, where("date", "==", selectedDate));
      const mealsSnap = await getDocs(mealsQuery);
      const mealsMap: Record<string, MealEntry> = {};

      mealsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        mealsMap[data.userId] = { ...data, id: docSnap.id };
      });

      // Query previous day's meals as default for missing members
      const prevDateObj = new Date(`${selectedDate}T12:00:00`);
      prevDateObj.setDate(prevDateObj.getDate() - 1);
      const prevDateStr = format(prevDateObj, "yyyy-MM-dd");

      const prevMealsQuery = query(mealsCol, where("date", "==", prevDateStr));
      const prevMealsSnap = await getDocs(prevMealsQuery);
      const prevMealsMap: Record<string, any> = {};
      prevMealsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        prevMealsMap[data.userId] = data;
      });

      // Populate defaults for missing members using previous day's values
      activeMembers.forEach((u) => {
        if (!mealsMap[u.id]) {
          const prevEntry = prevMealsMap[u.id];
          const defaultCount = prevEntry
            ? Number(
                prevEntry.count !== undefined
                  ? prevEntry.count
                  : prevEntry.totalMeals !== undefined
                  ? prevEntry.totalMeals
                  : (prevEntry.breakfast || 0) + (prevEntry.lunch || 0) + (prevEntry.dinner || 0)
              )
            : 2;

          mealsMap[u.id] = {
            userId: u.id,
            userName: u.name,
            date: selectedDate,
            count: defaultCount,
            month: selectedDate.substring(0, 7),
          };
        }
      });
      setMeals(mealsMap);

      // Check submission status for date
      const submissionDoc = await getDoc(doc(db, "meal_submissions", selectedDate));
      setIsSubmittedForDate(submissionDoc.exists());

      // 3. Fetch Bazar costs for selectedDate
      const bazarQuery = query(bazarCostsCol, where("date", "==", selectedDate));
      const bazarSnap = await getDocs(bazarQuery);
      const bazarData: BazarCost[] = [];
      bazarSnap.forEach((docSnap) => {
        const data = docSnap.data();
        bazarData.push({ ...data, id: docSnap.id });
      });
      setBazarEntries(bazarData);
    } catch (error) {
      console.error("Error fetching meals and bazar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMealCountChange = (userId: string, count: number) => {
    setMeals((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        count: Math.max(0, count),
      },
    }));
  };

  const saveMeals = async () => {
    setSaving(true);
    try {
      for (const userId of Object.keys(meals)) {
        const entry = meals[userId];
        const docId = entry.id || `${selectedDate}_${userId}`;
        await setDoc(doc(db, "meals", docId), {
          userId: entry.userId,
          userName: entry.userName || users.find((u) => u.id === userId)?.name || "Member",
          date: selectedDate,
          count: Number(entry.count || 0),
          month: selectedDate.substring(0, 7),
        });
      }

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "UPDATE_MEALS",
        `Updated meal counts for date ${selectedDate}`,
        "meal"
      );

      toast.success("Meal entries saved successfully!");
      fetchUsersAndMeals();
    } catch (error) {
      console.error("Error saving meals:", error);
      toast.error("Failed to save meal entries.");
    } finally {
      setSaving(false);
    }
  };

  const addBazarEntry = async (amount: number, description: string, spenderId: string) => {
    if (amount <= 0 || !spenderId) {
      toast.error("Please enter a valid amount and select a spender.");
      return;
    }
    const spender = users.find((u) => u.id === spenderId);
    try {
      await addDoc(bazarCostsCol, {
        id: "",
        userId: spenderId,
        userName: spender?.name || "Member",
        amount,
        description,
        date: selectedDate,
        month: selectedDate.substring(0, 7),
      });

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "ADD_BAZAR",
        `Added bazar entry ৳${amount} for ${spender?.name || "Member"} on ${selectedDate}`,
        "bazar"
      );

      toast.success("Bazar cost added successfully!");
      fetchUsersAndMeals();
    } catch (error) {
      console.error("Error adding bazar entry:", error);
      toast.error("Failed to add bazar entry.");
    }
  };

  return {
    users,
    meals,
    bazarEntries,
    loading,
    saving,
    isSubmittedForDate,
    handleMealCountChange,
    saveMeals,
    addBazarEntry,
  };
}
