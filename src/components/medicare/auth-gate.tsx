"use client";

import { useEffect } from "react";
import { HeartPulse } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import AuthScreen from "./auth-screen";

/**
 * Client-side auth gate:
 * - "loading"          → branded full-screen loader (resolves via /api/auth/me)
 * - "unauthenticated"  → AuthScreen (sign in / sign up / forgot password)
 * - "authenticated"    → the actual app (children)
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const fetchSession = useAuthStore((s) => s.fetchSession);

  useEffect(() => {
    if (status === "loading") {
      void fetchSession();
    }
  }, [status, fetchSession]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div
          className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"
          aria-hidden="true"
        >
          <HeartPulse className="h-7 w-7" />
        </div>
        <p className="text-sm text-muted-foreground">Loading Medicare Hub…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <AuthScreen />;
  }

  return <>{children}</>;
}
