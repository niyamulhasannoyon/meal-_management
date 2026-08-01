import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase
vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn().mockResolvedValue({ id: "log-123" }),
  serverTimestamp: vi.fn().mockReturnValue("MOCK_TIMESTAMP"),
  collection: vi.fn(),
}));

vi.mock("../firebase", () => ({
  activityLogsCol: {},
}));

vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { logActivity } from "../activityLogger";
import { addDoc } from "firebase/firestore";

describe("activityLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should add a document to activity_logs collection", async () => {
    await logActivity("user-1", "Niloy", "MEAL_UPDATE", "Updated meals for today", "meal");

    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-1",
        userName: "Niloy",
        action: "MEAL_UPDATE",
        details: "Updated meals for today",
        category: "meal",
      })
    );
  });
});
