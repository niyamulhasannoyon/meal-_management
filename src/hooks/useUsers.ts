import { useState, useEffect } from "react";
import { onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { usersCol, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { UserProfile, UserRole } from "@/lib/types/firestore";
import { logActivity } from "@/lib/activityLogger";
import { sortUsers } from "@/lib/utils";
import toast from "react-hot-toast";

export function useUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === "super_admin";
  const canManage = isSuperAdmin;
  const canGrantAccess = isSuperAdmin;

  useEffect(() => {
    const unsub = onSnapshot(
      usersCol,
      (snapshot) => {
        const usersData: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          usersData.push({ ...data, id: docSnap.id } as UserProfile);
        });
        setUsers(sortUsers(usersData));
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to users:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleApproveVisitor = async (
    userId: string,
    targetRole: UserRole = "member"
  ) => {
    if (!isSuperAdmin) {
      return toast.error("Only Super Admin can grant access to users");
    }
    setUpdating(userId);
    try {
      const userToApprove = users.find((u) => u.id === userId);
      await updateDoc(doc(db, "users", userId), { role: targetRole });

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "APPROVED_MEMBER",
        `Approved ${userToApprove?.name || "Unknown"} as ${targetRole}`,
        "system"
      );

      toast.success(`${userToApprove?.name || "User"} approved as ${targetRole.toUpperCase()}!`);
    } catch (error) {
      console.error("Error approving user:", error);
      toast.error("Failed to approve user");
    } finally {
      setUpdating(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!isSuperAdmin) {
      return toast.error("Only Super Admin can change user roles");
    }

    setUpdating(userId);
    try {
      const userToUpdate = users.find((u) => u.id === userId);
      await updateDoc(doc(db, "users", userId), { role: newRole });

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "UPDATED_ROLE",
        `Changed role of ${userToUpdate?.name || "Unknown"} to ${newRole}`,
        "system"
      );

      toast.success(`Role updated to ${newRole.toUpperCase()}`);
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  const handleTogglePermanent = async (userId: string, currentStatus: boolean) => {
    if (!isSuperAdmin) {
      return toast.error("Only Super Admin can change permanent member status");
    }
    setUpdating(userId);
    try {
      await updateDoc(doc(db, "users", userId), { isPermanent: !currentStatus });
      toast.success(`Permanent status set to ${!currentStatus}`);
    } catch (error) {
      console.error("Error updating permanent status:", error);
      toast.error("Failed to update permanent status");
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isSuperAdmin) {
      return toast.error("Only Super Admin can delete users");
    }
    if (!confirm("Are you sure you want to delete this account?")) return;

    setUpdating(userId);
    try {
      const userToDelete = users.find((u) => u.id === userId);
      await deleteDoc(doc(db, "users", userId));

      await logActivity(
        profile?.id || "unknown",
        profile?.name || "Unknown User",
        "DELETED_USER",
        `Deleted user ${userToDelete?.name || "Unknown"}`,
        "system"
      );

      toast.success("User deleted successfully");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    } finally {
      setUpdating(null);
    }
  };

  return {
    users,
    loading,
    updating,
    isSuperAdmin,
    canManage,
    canGrantAccess,
    handleApproveVisitor,
    handleRoleChange,
    handleTogglePermanent,
    handleDeleteUser,
  };
}
