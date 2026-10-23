"use client";

import { create } from "zustand";

export type MedicareView =
  | "dashboard"
  | "my-appointments"
  | "appointments"
  | "slots"
  | "doctors"
  | "patients"
  | "records"
  | "billing"
  | "departments"
  | "articles"
  | "profile";

interface MedicareStore {
  activeView: MedicareView;
  setActiveView: (v: MedicareView) => void;
}

export const useMedicareStore = create<MedicareStore>((set) => ({
  activeView: "dashboard",
  setActiveView: (activeView) => set({ activeView }),
}));
