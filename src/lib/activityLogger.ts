import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const logActivity = async (
  userId: string,
  userName: string,
  action: string,
  description: string
) => {
  try {
    await addDoc(collection(db, "activity_logs"), {
      userId,
      userName,
      action,
      description,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};
