"use client";

import { useState } from "react";
import { Users, Search, UserCheck, Shield, ShieldCheck, Trash2, Crown, Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { getRoleTheme } from "@/lib/theme";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import MemberProfilePanel from "@/components/profile/MemberProfilePanel";
import Avatar from "@/components/layout/Avatar";
import { staggerContainer, fadeIn } from "@/lib/motion";

export default function UsersPage() {
  const { profile } = useAuth();
  const { users, loading, updating, canManage, handleApproveVisitor, handleRoleChange, handleTogglePermanent, handleDeleteUser } = useUsers();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "meals" | "rent">("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === "super_admin";

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === "meals") {
      return u.role === "member";
    }
    if (activeTab === "rent") {
      return !!u.isPermanent || u.role === "member" || u.role === "admin" || u.role === "super_admin";
    }
    return true;
  });

  return (
    <motion.main
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-brand" />
            Mess Member Directory & Role Control
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Assign user roles (Super Admin, Admin, Moderator, Member, Visitor) and manage meal & rent permissions.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search member or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      </motion.div>

      {/* Tabs Filter */}
      <motion.div variants={fadeIn} className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <Tabs
          tabs={[
            { id: "all", label: `All Users (${users.length})` },
            { id: "meals", label: `Meals Members (${users.filter((u) => u.role === "member").length})` },
            { id: "rent", label: `Rent Members (${users.filter((u) => !!u.isPermanent || u.role === "member").length})` },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as any)}
        />
        {isSuperAdmin && (
          <Badge variant="warning" className="hidden sm:inline-flex items-center gap-1 font-bold">
            <Crown className="w-3.5 h-3.5 text-amber-500" /> Super Admin Access Active
          </Badge>
        )}
      </motion.div>

      {/* Users Table */}
      <motion.div variants={fadeIn}>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member Name</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead className="text-center">Role Theme</TableHead>
                <TableHead className="text-center">Rent Member</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-zinc-400">
                    Loading member directory...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-zinc-400">
                    No users match search or tab filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const roleTheme = getRoleTheme(user.role);
                  const isPending = user.role === "pending" || user.role === "visitor";

                  return (
                    <TableRow key={user.id}>
                      <TableCell
                        className="font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} src={user.photoURL} size={32} />
                          <div className="flex items-center gap-2">
                            {user.name}
                            {user.id === profile?.id && <Badge variant="info">You</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-500 dark:text-zinc-400 text-xs">
                        {user.email || "No Email"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] uppercase border ${roleTheme.badgeBg} ${roleTheme.badgeText} ${roleTheme.badgeBorder}`}>
                          {user.role === "super_admin" && <Crown className="w-3 h-3 text-amber-500" />}
                          {user.role === "admin" && <ShieldCheck className="w-3 h-3 text-red-500" />}
                          {user.role === "moderator" && <Shield className="w-3 h-3 text-teal-500" />}
                          {user.role === "member" && <Star className="w-3 h-3 text-brand" />}
                          {roleTheme.label}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant={user.isPermanent ? "amber" : "outline"}
                          size="sm"
                          disabled={!canManage}
                          onClick={() => handleTogglePermanent(user.id, !!user.isPermanent)}
                        >
                          {user.isPermanent ? "Permanent" : "Non-permanent"}
                        </Button>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="inline-flex items-center space-x-2">
                          {isPending && canManage && (
                            <Button
                              variant="amber"
                              size="sm"
                              isLoading={updating === user.id}
                              onClick={() => handleApproveVisitor(user.id, "member")}
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1" /> Approve Member
                            </Button>
                          )}

                          {canManage && user.id !== profile?.id && (
                            <Select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              className="w-32 text-xs py-1 px-2 font-bold"
                            >
                              <option value="member">Member (Eats Meals)</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                              <option value="visitor">Visitor</option>
                            </Select>
                          )}

                          {canManage && user.id !== profile?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Member Profile Drawer */}
      <MemberProfilePanel userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </motion.main>
  );
}
