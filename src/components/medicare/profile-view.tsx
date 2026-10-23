"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  KeyRound,
  Loader2,
  LogOut,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PasswordInput } from "./password-input";
import { useAuthStore } from "@/lib/auth-store";
import { useMedicareStore } from "@/lib/medicare-store";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getInitials } from "@/lib/medicare-api";

/**
 * Client-side profile page for the signed-in account.
 * Works for both ADMIN and USER roles — shows identity, lets the user edit
 * their display name, change their password, and sign out.
 */

function RoleBadge({ role }: { role: string }) {
  if (role === "ADMIN") {
    return (
      <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        Administrator
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-teal-500/15 text-teal-700 dark:text-teal-400">
      <UserRound className="h-3 w-3" aria-hidden="true" />
      Member
    </Badge>
  );
}

export default function ProfileView() {
  const user = useAuthStore((s) => s.user);
  const updateName = useAuthStore((s) => s.updateName);
  const changePassword = useAuthStore((s) => s.changePassword);
  const signOut = useAuthStore((s) => s.signOut);
  const setActiveView = useMedicareStore((s) => s.setActiveView);
  const { toast } = useToast();

  /* ---- edit display name (initialized from the store; remounts on nav) ---- */
  const [name, setName] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  /* ----------------------------- change password --------------------------- */
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    if (trimmed === user?.name) {
      toast({ title: "No changes", description: "The name is already up to date." });
      return;
    }
    setSavingName(true);
    try {
      await updateName(trimmed);
      toast({
        title: "Profile updated",
        description: "Your display name has been saved.",
      });
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    if (newPw === currentPw) {
      setPwError("The new password must be different from the current one.");
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(currentPw, newPw);
      setPwSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      toast({
        title: "Password updated",
        description: "Use your new password the next time you sign in.",
      });
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSavingPw(false);
    }
  };

  const handleSignOut = () => {
    setActiveView("dashboard");
    toast({
      title: "Signed out",
      description: "You have been safely signed out.",
    });
    void signOut();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
              {getInitials(user?.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold">{user?.name}</h2>
                <RoleBadge role={user?.role ?? "USER"} />
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {user?.email}
              </p>
              {user?.createdAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Member since {formatDate(user.createdAt)}
                </p>
              )}
            </div>
          </div>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "You have administrator access — the full hospital workspace (patients, doctors, records, billing, departments) is available from the sidebar."
              : "You have a member account — your personal dashboard shows your own appointments, medical records and invoices."}
          </p>
        </Card>
      </motion.div>

      {/* Edit profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
            Edit profile
          </CardTitle>
          <CardDescription>
            Update how your name appears across Medicare Hub.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="space-y-4" noValidate>
            {nameError && (
              <Alert variant="destructive">
                <AlertDescription>{nameError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="profile-name">Display name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email (read-only)</Label>
              <Input id="profile-email" value={user?.email ?? ""} disabled />
              <p className="text-xs text-muted-foreground">
                Your email links your account to your patient record — contact the
                front desk to change it.
              </p>
            </div>
            <Button type="submit" disabled={savingName}>
              {savingName ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {savingName ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
            Change password
          </CardTitle>
          <CardDescription>
            Choose a strong password with at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
            {pwError && (
              <Alert variant="destructive">
                <AlertDescription>{pwError}</AlertDescription>
              </Alert>
            )}
            {pwSuccess && (
              <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Password updated</AlertTitle>
                <AlertDescription>
                  Use your new password the next time you sign in.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="pw-current">Current password</Label>
              <PasswordInput
                id="pw-current"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pw-new">New password</Label>
                <PasswordInput
                  id="pw-new"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-confirm">Confirm new password</Label>
                <PasswordInput
                  id="pw-confirm"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <Button type="submit" disabled={savingPw}>
              {savingPw ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              )}
              {savingPw ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Session */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
          <CardDescription>
            Sign out of Medicare Hub on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
