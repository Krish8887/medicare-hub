"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarCheck2,
  Check,
  Copy,
  FileHeart,
  HeartPulse,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordInput as SharedPasswordInput } from "./password-input";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { sendJSON } from "@/lib/medicare-api";

type Mode = "signin" | "signup" | "forgot";

interface ForgotResponse {
  data?: { ok?: boolean; message?: string; demoCode?: string };
}

interface ResetResponse {
  success?: boolean;
  message?: string;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: CalendarCheck2,
    title: "Smart scheduling",
    text: "Book and manage appointments in seconds.",
  },
  {
    icon: Users,
    title: "Patient directory",
    text: "Complete profiles, history and contact details.",
  },
  {
    icon: FileHeart,
    title: "Medical records",
    text: "Diagnoses, prescriptions and treatments.",
  },
  {
    icon: ShieldCheck,
    title: "Secure sessions",
    text: "Password-protected accounts, signed sessions.",
  },
];

const PasswordInput = SharedPasswordInput;

const DEMO_ACCOUNTS = [
  {
    label: "Admin",
    email: "admin@medicarehub.com",
    hint: "full hospital workspace",
    icon: ShieldCheck,
  },
  {
    label: "Member",
    email: "user@medicarehub.com",
    hint: "personal My Health dashboard",
    icon: UserRound,
  },
] as const;

function BrandPanel() {
  return (
    <div className="relative hidden w-1/2 max-w-2xl flex-col justify-between overflow-hidden bg-emerald-900 p-10 text-white lg:flex xl:p-14">
      {/* Decorative blobs */}
      <div
        aria-hidden="true"
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/3 top-1/2 h-40 w-40 rounded-full bg-emerald-300/10 blur-2xl"
      />

      <div className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
          <HeartPulse className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-lg font-bold leading-tight">Medicare Hub</p>
          <p className="text-xs text-emerald-200">Healthcare Management</p>
        </div>
      </div>

      <div className="relative max-w-md space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold leading-tight xl:text-4xl">
            Your hospital, beautifully organized.
          </h2>
          <p className="text-emerald-100">
            One secure account for appointments, patients, records and
            everything in between.
          </p>
        </div>
        <ul className="space-y-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-emerald-200">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
        <p className="text-sm italic text-emerald-50">
          &ldquo;Compassionate care, powered by technology.&rdquo;
        </p>
        <p className="mt-1 text-xs text-emerald-200">
          &mdash; The Medicare Hub team
        </p>
      </div>
    </div>
  );
}

export default function AuthScreen() {
  const { toast } = useToast();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Sign in
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Sign up
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");

  // Forgot password
  const [fpStep, setFpStep] = useState<"email" | "reset">("email");
  const [fpEmail, setFpEmail] = useState("");
  const [fpCode, setFpCode] = useState("");
  const [fpPassword, setFpPassword] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpDemoCode, setFpDemoCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function goMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setBusy(null);
    if (next === "forgot") {
      setFpStep("email");
      setFpDemoCode(null);
      setFpCode("");
      setFpPassword("");
      setFpConfirm("");
    }
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------------- handlers ------------------------------- */

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    void run("signin", async () => {
      const user = await signIn(siEmail.trim(), siPassword);
      toast({
        title: `Welcome back, ${user.name}!`,
        description: "You are signed in to Medicare Hub.",
      });
    });
  }

  function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (suName.trim().length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!EMAIL_RE.test(suEmail.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (suPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (suPassword !== suConfirm) {
      setError("Passwords do not match.");
      return;
    }
    void run("signup", async () => {
      const user = await signUp(suName.trim(), suEmail.trim(), suPassword);
      toast({
        title: `Welcome, ${user.name}!`,
        description: "Your Medicare Hub account has been created.",
      });
    });
  }

  function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(fpEmail.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    void run("forgot", async () => {
      const res = await sendJSON<ForgotResponse>("/api/auth/forgot-password", "POST", {
        email: fpEmail.trim(),
      });
      const code = res.data?.demoCode ?? null;
      setFpDemoCode(code);
      setFpCode(code ?? "");
      setError(null);
      setFpStep("reset");
    });
  }

  async function handleCopyCode() {
    if (!fpDemoCode) return;
    try {
      await navigator.clipboard.writeText(fpDemoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the code is still visible on screen.
    }
  }

  function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(fpCode.trim())) {
      setError("Enter the 6-digit reset code.");
      return;
    }
    if (fpPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (fpPassword !== fpConfirm) {
      setError("Passwords do not match.");
      return;
    }
    void run("reset", async () => {
      await sendJSON<ResetResponse>("/api/auth/reset-password", "POST", {
        email: fpEmail.trim(),
        code: fpCode.trim(),
        password: fpPassword,
      });
      setSiEmail(fpEmail.trim());
      setNotice("Your password has been updated. Sign in with your new password.");
      setMode("signin");
      setError(null);
      toast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
      });
    });
  }

  /* --------------------------------- view --------------------------------- */

  const header =
    mode === "forgot"
      ? fpStep === "email"
        ? {
            title: "Reset your password",
            description:
              "Enter your account email and we'll generate a 6-digit reset code.",
          }
        : {
            title: "Choose a new password",
            description: `Enter the code generated for ${fpEmail.trim()}, then set a new password.`,
          }
      : mode === "signin"
        ? {
            title: "Welcome back",
            description: "Sign in to your Medicare Hub account.",
          }
        : {
            title: "Create your account",
            description: "Join Medicare Hub in less than a minute.",
          };

  return (
    <div className="flex min-h-screen bg-background">
      <BrandPanel />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile brand banner */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-700 to-teal-600 px-4 py-3 text-white lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <HeartPulse className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Medicare Hub</p>
            <p className="text-xs text-emerald-100">Healthcare Management</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <Card className="shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold">{header.title}</CardTitle>
                <CardDescription>{header.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {mode === "forgot" ? (
                  /* ------------------------- forgot password ------------------------ */
                  fpStep === "email" ? (
                    <form onSubmit={handleSendCode} className="space-y-4" noValidate>
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder="you@hospital.com"
                          value={fpEmail}
                          onChange={(e) => setFpEmail(e.target.value)}
                          autoComplete="email"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          We&apos;ll generate a 6-digit reset code for your account.
                        </p>
                      </div>
                      <Button type="submit" className="w-full" disabled={busy !== null}>
                        {busy === "forgot" ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Mail className="h-4 w-4" aria-hidden="true" />
                        )}
                        {busy === "forgot" ? "Generating code…" : "Send reset code"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => goMode("signin")}
                      >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Back to sign in
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      {fpDemoCode && (
                        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                          <AlertDescription>
                            <span className="font-semibold">Demo mode:</span> no email
                            service is configured, so your reset code is shown here.
                            <span className="mt-1 flex items-center gap-2">
                              <span className="font-mono text-lg font-bold tracking-[0.35em]">
                                {fpDemoCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleCopyCode()}
                                aria-label="Copy reset code"
                                className="rounded p-1 transition-colors hover:bg-amber-200/60"
                              >
                                {copied ? (
                                  <Check className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <Copy className="h-4 w-4" aria-hidden="true" />
                                )}
                              </button>
                            </span>
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="reset-code">Reset code</Label>
                        <Input
                          id="reset-code"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6-digit code"
                          value={fpCode}
                          onChange={(e) => setFpCode(e.target.value.replace(/\D/g, ""))}
                          className="font-mono tracking-[0.3em]"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reset-password">New password</Label>
                        <PasswordInput
                          id="reset-password"
                          value={fpPassword}
                          onChange={(e) => setFpPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                        <p className="text-xs text-muted-foreground">
                          At least 8 characters.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reset-confirm">Confirm new password</Label>
                        <PasswordInput
                          id="reset-confirm"
                          value={fpConfirm}
                          onChange={(e) => setFpConfirm(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={busy !== null}>
                        {busy === "reset" ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                        )}
                        {busy === "reset" ? "Updating password…" : "Reset password"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setFpStep("email");
                          setError(null);
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Change email
                      </Button>
                    </form>
                  )
                ) : (
                  /* ------------------------- sign in / sign up ----------------------- */
                  <Tabs
                    value={mode}
                    onValueChange={(v) => goMode(v as Mode)}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="signin" className="gap-1.5">
                        <LogIn className="h-4 w-4" aria-hidden="true" />
                        Sign In
                      </TabsTrigger>
                      <TabsTrigger value="signup" className="gap-1.5">
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                        Sign Up
                      </TabsTrigger>
                    </TabsList>

                    {/* ------------------------------ sign in --------------------------- */}
                    <TabsContent value="signin" className="mt-6">
                      <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                        {notice && (
                          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                            <Check className="h-4 w-4" aria-hidden="true" />
                            <AlertDescription>{notice}</AlertDescription>
                          </Alert>
                        )}
                        {error && (
                          <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="signin-email">Email</Label>
                          <Input
                            id="signin-email"
                            type="email"
                            placeholder="you@hospital.com"
                            value={siEmail}
                            onChange={(e) => setSiEmail(e.target.value)}
                            autoComplete="email"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="signin-password">Password</Label>
                            <button
                              type="button"
                              onClick={() => goMode("forgot")}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Forgot password?
                            </button>
                          </div>
                          <PasswordInput
                            id="signin-password"
                            value={siPassword}
                            onChange={(e) => setSiPassword(e.target.value)}
                            autoComplete="current-password"
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={busy !== null}>
                          {busy === "signin" ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <LogIn className="h-4 w-4" aria-hidden="true" />
                          )}
                          {busy === "signin" ? "Signing in…" : "Sign in"}
                        </Button>
                        <div className="rounded-lg border border-dashed bg-muted/40 p-3">
                          <p className="text-xs font-semibold">Demo accounts · demo1234</p>
                          <div className="mt-2 space-y-1.5">
                            {DEMO_ACCOUNTS.map((acct) => {
                              const Icon = acct.icon;
                              return (
                                <div
                                  key={acct.email}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 truncate text-xs font-medium">
                                      <Icon
                                        className="h-3.5 w-3.5 shrink-0 text-primary"
                                        aria-hidden="true"
                                      />
                                      {acct.label}
                                      <span className="font-normal text-muted-foreground">
                                        · {acct.hint}
                                      </span>
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {acct.email}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 shrink-0 text-xs"
                                    onClick={() => {
                                      setSiEmail(acct.email);
                                      setSiPassword("demo1234");
                                      setError(null);
                                    }}
                                  >
                                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                    Fill
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </form>
                    </TabsContent>

                    {/* ------------------------------ sign up --------------------------- */}
                    <TabsContent value="signup" className="mt-6">
                      <form onSubmit={handleSignUp} className="space-y-4" noValidate>
                        {error && (
                          <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="signup-name">Full name</Label>
                          <Input
                            id="signup-name"
                            placeholder="Dr. Jane Smith"
                            value={suName}
                            onChange={(e) => setSuName(e.target.value)}
                            autoComplete="name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">Email</Label>
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="you@hospital.com"
                            value={suEmail}
                            onChange={(e) => setSuEmail(e.target.value)}
                            autoComplete="email"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">Password</Label>
                          <PasswordInput
                            id="signup-password"
                            value={suPassword}
                            onChange={(e) => setSuPassword(e.target.value)}
                            autoComplete="new-password"
                          />
                          <p className="text-xs text-muted-foreground">
                            At least 8 characters.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-confirm">Confirm password</Label>
                          <PasswordInput
                            id="signup-confirm"
                            value={suConfirm}
                            onChange={(e) => setSuConfirm(e.target.value)}
                            autoComplete="new-password"
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={busy !== null}>
                          {busy === "signup" ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <UserPlus className="h-4 w-4" aria-hidden="true" />
                          )}
                          {busy === "signup" ? "Creating account…" : "Create account"}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <footer className="pb-4 pt-0 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Medicare Hub. Compassionate care, powered by
            technology.
          </p>
        </footer>
      </div>
    </div>
  );
}
