import { addDoc, serverTimestamp } from "firebase/firestore";
import { activityLogsCol } from "./firebase";
import { logger } from "./logger";

export const logActivity = async (
  userId: string,
  userName: string,
  action: string,
  details: string,
  category: "meal" | "bazar" | "payment" | "fine" | "rent" | "system" = "system"
): Promise<void> => {
  try {
    await addDoc(activityLogsCol, {
      id: "",
      userId,
      userName,
      action,
      details,
      category,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    logger.error("Error logging activity:", error);
  }
};
