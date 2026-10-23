"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getJSON, sendJSON } from "@/lib/medicare-api";
import type { AppointmentSlot, Doctor } from "@/lib/medicare-types";
import { TIME_SLOTS } from "@/lib/medicare-types";
import { cn } from "@/lib/utils";

/**
 * ADMIN — "provide slot": publish bookable consultation windows per doctor and
 * date. Members can only request slots that exist here, so this grid is the
 * single source of the clinic's availability.
 */

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

type CellState = "published" | "booked" | "missing";

export default function SlotsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayISO());

  const doctorsQ = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => getJSON<{ data: Doctor[] }>("/api/doctors"),
  });
  const doctors = doctorsQ.data?.data ?? [];

  // Pre-select the first doctor once loaded.
  const effectiveDoctorId = doctorId || doctors[0]?.id || "";

  const slotsQ = useQuery({
    queryKey: ["slots", effectiveDoctorId, date],
    queryFn: () =>
      getJSON<{ data: AppointmentSlot[] }>(
        `/api/slots?doctorId=${encodeURIComponent(effectiveDoctorId)}&date=${encodeURIComponent(date)}`
      ),
    enabled: Boolean(effectiveDoctorId && date),
  });

  const slotByTime = useMemo(() => {
    const map = new Map<string, AppointmentSlot>();
    for (const slot of slotsQ.data?.data ?? []) map.set(slot.timeSlot, slot);
    return map;
  }, [slotsQ.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["slots"] });
    queryClient.invalidateQueries({ queryKey: ["my-slots"] });
  };

  const addMutation = useMutation({
    mutationFn: (timeSlots: string[]) =>
      sendJSON<{ data: { created: number; skipped: number } }>("/api/slots", "POST", {
        doctorId: effectiveDoctorId,
        date,
        timeSlots,
      }),
    onSuccess: ({ data }) => {
      if (data.created > 0) {
        toast({
          title:
            data.created === 1 ? "Slot published" : `${data.created} slots published`,
          description:
            data.skipped > 0
              ? `${data.skipped} already existed and were skipped.`
              : "Members can now request these times.",
        });
      } else {
        toast({ title: "Nothing to add", description: "Those slots already exist." });
      }
      invalidate();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not publish slots",
        description: error.message,
        variant: "destructive",
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      sendJSON<{ success: boolean }>(`/api/slots/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Slot removed", description: "The time is no longer offered." });
      invalidate();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not remove slot",
        description: error.message,
        variant: "destructive",
      }),
  });

  const cellState = (timeSlot: string): CellState => {
    const slot = slotByTime.get(timeSlot);
    if (!slot) return "missing";
    return slot.isBooked ? "booked" : "published";
  };

  const counts = useMemo(() => {
    let published = 0;
    let booked = 0;
    for (const slot of slotsQ.data?.data ?? []) {
      if (slot.isBooked) booked += 1;
      else published += 1;
    }
    return { published, booked };
  }, [slotsQ.data]);

  const missingSlots = TIME_SLOTS.filter((t) => cellState(t) === "missing");
  const selectedDoctor = doctors.find((d) => d.id === effectiveDoctorId);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
            Publish appointment slots
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Doctor</Label>
            <Select value={effectiveDoctorId} onValueChange={setDoctorId}>
              <SelectTrigger className="w-full" aria-label="Select doctor">
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctorsQ.isLoading ? (
                  <SelectItem value="__loading" disabled>
                    Loading doctors…
                  </SelectItem>
                ) : (
                  doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name} — {doctor.specialty}
                      {doctor.availability !== "Available"
                        ? ` (${doctor.availability})`
                        : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slot-date">Date</Label>
            <Input
              id="slot-date"
              type="date"
              min={todayISO()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Matrix */}
      {selectedDoctor && date ? (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">
                {selectedDoctor.name} · {format(new Date(`${date}T00:00:00`), "EEEE, MMM d, yyyy")}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {counts.published} open · {counts.booked} booked ·{" "}
                {missingSlots.length} not offered
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={missingSlots.length === 0 || addMutation.isPending}
              onClick={() => addMutation.mutate([...missingSlots])}
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              Publish all missing
            </Button>
          </CardHeader>
          <CardContent>
            {slotsQ.isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TIME_SLOTS.map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TIME_SLOTS.map((timeSlot) => {
                  const state = cellState(timeSlot);
                  const slot = slotByTime.get(timeSlot);
                  const disabled =
                    state === "booked" ||
                    (state === "missing" ? addMutation.isPending : removeMutation.isPending);
                  return (
                    <button
                      key={timeSlot}
                      type="button"
                      disabled={disabled}
                      aria-label={
                        state === "booked"
                          ? `${timeSlot} — booked`
                          : state === "published"
                            ? `${timeSlot} — open, click to remove`
                            : `${timeSlot} — not offered, click to publish`
                      }
                      onClick={() => {
                        if (state === "missing") addMutation.mutate([timeSlot]);
                        else if (state === "published" && slot)
                          removeMutation.mutate(slot.id);
                      }}
                      className={cn(
                        "flex h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-center transition-colors",
                        state === "booked" &&
                          "cursor-not-allowed border-emerald-200 bg-emerald-500/10 dark:border-emerald-900",
                        state === "published" &&
                          "border-teal-200 bg-teal-500/10 hover:border-destructive/50 hover:bg-destructive/10 dark:border-teal-900",
                        state === "missing" &&
                          "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      <span className="flex items-center gap-1 text-xs font-medium">
                        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {timeSlot}
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-1 text-[11px]",
                          state === "booked" && "text-emerald-700 dark:text-emerald-400",
                          state === "published" && "text-teal-700 dark:text-teal-400",
                          state === "missing" && "text-muted-foreground/80"
                        )}
                      >
                        {state === "booked" && (
                          <>
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Booked
                          </>
                        )}
                        {state === "published" && (
                          <>
                            <Trash2 className="h-3 w-3" aria-hidden="true" /> Open — click to remove
                          </>
                        )}
                        {state === "missing" && (
                          <>
                            <CalendarDays className="h-3 w-3" aria-hidden="true" /> Not offered — click to add
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <Alert className="mt-4">
              <AlertDescription className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">How it works:</span>{" "}
                members can only request times that are published here. Booking a
                slot marks it <span className="font-medium">Booked</span>; cancelling
                the appointment releases it again.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Select a doctor to manage their availability.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
