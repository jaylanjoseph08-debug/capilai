"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, formatISO, startOfDay } from "date-fns";
import { STORAGE_KEYS } from "./appConfig";

export type CareEventType = "lavage" | "masque" | "huile" | "soin" | "coupe";

export const CARE_EVENT_LABEL: Record<CareEventType, string> = {
  lavage: "Lavage",
  masque: "Masque",
  huile: "Huile",
  soin: "Soin",
  coupe: "Coupe",
};

export interface CareEvent {
  id: string;
  /** ISO date, day precision (yyyy-MM-dd) */
  date: string;
  type: CareEventType;
  note?: string;
}

interface CalendarState {
  events: CareEvent[];
  addEvent: (event: Omit<CareEvent, "id">) => void;
  removeEvent: (id: string) => void;
  generateFromRoutine: (washFrequency: string | number | string[] | undefined, note?: string) => void;
}

function dayKey(date: Date) {
  return formatISO(startOfDay(date), { representation: "date" });
}

// Maps the onboarding wash-frequency answer to a wash interval in days.
const WASH_INTERVAL: Record<string, number> = {
  quotidien: 1,
  "2_3_semaine": 3,
  hebdo: 7,
  moins: 14,
};

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      events: [],
      addEvent: (event) =>
        set((state) => ({
          events: [...state.events, { ...event, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
        })),
      removeEvent: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
      generateFromRoutine: (washFrequency, note = "Generated from your routine") => {
        const interval = WASH_INTERVAL[String(washFrequency)] ?? 7;
        const existing = get().events;
        const existingKeys = new Set(existing.map((e) => `${e.date}:${e.type}`));
        const seeded: CareEvent[] = [];
        const today = startOfDay(new Date());

        for (let i = 0; i < 28; i += interval) {
          const date = dayKey(addDays(today, i));
          const key = `${date}:lavage`;
          if (!existingKeys.has(key)) {
            seeded.push({ id: `seed-${key}`, date, type: "lavage", note });
          }
        }
        for (let i = 3; i < 28; i += 7) {
          const date = dayKey(addDays(today, i));
          const key = `${date}:masque`;
          if (!existingKeys.has(key)) {
            seeded.push({ id: `seed-${key}`, date, type: "masque", note });
          }
        }

        if (seeded.length > 0) {
          set((state) => ({ events: [...state.events, ...seeded] }));
        }
      },
    }),
    { name: STORAGE_KEYS.calendar }
  )
);
