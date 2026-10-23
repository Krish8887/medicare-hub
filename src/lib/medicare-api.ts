/**
 * Shared fetch helpers for Medicare Hub frontend.
 * Always relative URLs (gateway handles routing) — never absolute URLs / ports.
 */

import { format, parseISO } from "date-fns";
import { useAuthStore, authHeaders, setSessionToken } from "@/lib/auth-store";

interface ErrorBody {
  error?: string;
}

/**
 * When any data API answers 401 the session is missing or expired — drop the
 * stored Bearer token and flip the auth store back to "unauthenticated" so
 * the sign-in screen takes over.
 */
function handleUnauthorized(status: number) {
  if (status === 401) {
    setSessionToken(null);
    useAuthStore.getState().setSession(null);
  }
}

export async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    handleUnauthorized(res.status);
    const message = (json as ErrorBody | null)?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

export async function sendJSON<T>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    handleUnauthorized(res.status);
    const message = (json as ErrorBody | null)?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

/* ------------------------------ date helpers ------------------------------ */

/**
 * Parse a date value into a local Date.
 * Plain "YYYY-MM-DD" strings are parsed as LOCAL midnight to avoid timezone shifts
 * (date-fns parseISO would treat them as UTC).
 */
export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseISO(`${value}T00:00:00`)
    : parseISO(value);
}

/** Format a date (ISO string or Date). Default pattern: "MMM d, yyyy". */
export function formatDate(value: string | Date, pattern = "MMM d, yyyy"): string {
  try {
    return format(toDate(value), pattern);
  } catch {
    return typeof value === "string" ? value : "";
  }
}

/** Short date for chart axes: "MMM d". */
export function formatShortDate(value: string | Date): string {
  return formatDate(value, "MMM d");
}

/** Format a money amount as USD, e.g. 1250.5 -> "$1,250.50". */
export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(value) ? (value as number) : 0);
}

/** "Dr. Jane Smith" -> "JS" (max 2 chars) for avatar fallbacks. */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
