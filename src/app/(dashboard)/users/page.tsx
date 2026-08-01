"use client";

import { useState } from "react";
import { Users, Search, UserCheck, Shield, Trash2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { staggerContainer, fadeIn } from "@/lib/motion";

export default function UsersPage() {
  const { profile } = useAuth();
  const { users, loading, updating, handleApproveVisitor, handleRoleChange, handleDeleteUser } = useUsers();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getRoleBadgeVariant = (role: string) => {
    if (role === "admin") return "danger";
    if (role === "moderator") return "warning";
    if (role === "member") return "success";
    return "default";
  };

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
            Mess Member Directory
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Manage roles, pending approvals, and member profile records.
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

      {/* Users Table */}
      <motion.div variants={fadeIn}>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member Name</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-zinc-400">
                    Loading directory...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-zinc-400">
                    No members match search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const isPending = user.role === "pending" || user.role === "visitor";

                  return (
                    <TableRow key={user.id}>
                      <TableCell
                        className="font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        {user.name}
                        {user.id === profile?.id && <Badge variant="info" className="ml-2">You</Badge>}
                      </TableCell>
                      <TableCell className="text-zinc-500 dark:text-zinc-400 text-xs">
                        {user.email || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center space-x-2">
                          {isPending && profile?.role === "admin" && (
                            <Button
                              variant="amber"
                              size="sm"
                              isLoading={updating === user.id}
                              onClick={() => handleApproveVisitor(user.id, "member")}
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                          )}

                          {profile?.role === "admin" && user.id !== profile.id && (
                            <Select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              className="w-28 text-xs py-1 px-2"
                            >
                              <option value="member">Member</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                              <option value="visitor">Visitor</option>
                            </Select>
                          )}

                          {profile?.role === "admin" && user.id !== profile.id && (
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
