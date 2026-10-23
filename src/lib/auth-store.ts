"use client";

import { create } from "zustand";

export type UserRole = "ADMIN" | "USER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole | string;
  createdAt?: string;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  setSession: (user: AuthUser | null) => void;
  fetchSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (name: string, email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<AuthUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

/** Server may hand back a Bearer session token alongside the user. */
type AuthPayloadUser = AuthUser & { sessionToken?: string };

interface AuthPayload {
  data?: AuthPayloadUser;
  error?: string;
  message?: string;
}

/* ------------------------- Bearer token persistence ----------------------- */
/**
 * The preview panel embeds the app inside a cross-site iframe, where browsers
 * block SameSite=Lax cookies — sign-in would 200 but every later request
 * would 401 and bounce back to the login screen. Storing the session token
 * in localStorage and sending it as an Authorization header is immune to
 * cookie policies, while the HttpOnly cookie still works for normal visits.
 */
const TOKEN_KEY = "mh_session_token";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode etc.) — cookie-only fallback.
  }
}

/** Authorization headers to merge into every API request. */
export function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(res: Response): Promise<never> {
  const json: AuthPayload | null = await res.json().catch(() => null);
  throw new Error(json?.error ?? `Request failed (${res.status})`);
}

/**
 * Global auth session store.
 *
 * `status` starts as "loading" and is resolved once by AuthGate via
 * fetchSession(). All other modules can flip the session with setSession()
 * (e.g. medicare-api.ts on any 401 response).
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",

  setSession: (user) =>
    set({ user, status: user ? "authenticated" : "unauthenticated" }),

  fetchSession: async () => {
    try {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        headers: authHeaders(),
      });
      if (!res.ok) {
        setSessionToken(null);
        set({ user: null, status: "unauthenticated" });
        return;
      }
      const json = (await res.json()) as AuthPayload;
      if (json.data) {
        set({ user: json.data, status: "authenticated" });
      } else {
        setSessionToken(null);
        set({ user: null, status: "unauthenticated" });
      }
    } catch {
      set({ user: null, status: "unauthenticated" });
    }
  },

  signIn: async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) await parseError(res);
    const json = (await res.json()) as AuthPayload;
    const user = json.data;
    if (!user) throw new Error("Unexpected response from server");
    setSessionToken(user.sessionToken ?? null);
    set({ user, status: "authenticated" });
    return user;
  },

  signUp: async (name, email, password) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) await parseError(res);
    const json = (await res.json()) as AuthPayload;
    const user = json.data;
    if (!user) throw new Error("Unexpected response from server");
    setSessionToken(user.sessionToken ?? null);
    set({ user, status: "authenticated" });
    return user;
  },

  signOut: async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: authHeaders(),
      });
    } catch {
      // Ignore network errors — clear the local session regardless.
    }
    setSessionToken(null);
    set({ user: null, status: "unauthenticated" });
  },

  /** Update the signed-in user's display name (persists via /api/auth/profile). */
  updateName: async (name) => {
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) await parseError(res);
    const json = (await res.json()) as AuthPayload;
    const user = json.data;
    if (!user) throw new Error("Unexpected response from server");
    set({ user });
    return user;
  },

  /** Change the signed-in user's password (persists via /api/auth/password). */
  changePassword: async (currentPassword, newPassword) => {
    const res = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) await parseError(res);
  },
}));
