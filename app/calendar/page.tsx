"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useHairAIStore } from "@/lib/store";
import { useCalendarStore, type CareEventType } from "@/lib/calendarStore";
import { dateFnsLocale, getCareEventLabel } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { useTranslation } from "@/lib/useTranslation";
import { useRequirePaidAccess } from "@/lib/useRequirePaidAccess";
import { BottomNav } from "@/components/ui/BottomNav";

const TYPES: CareEventType[] = ["lavage", "masque", "huile", "soin", "coupe"];

const CALENDAR_WEEKDAYS: Record<Locale, string[]> = {
  en: ["M", "T", "W", "T", "F", "S", "S"],
  fr: ["L", "M", "M", "J", "V", "S", "D"],
};

export default function CalendarPage() {
  const allowed = useRequirePaidAccess();
  const { locale, t } = useTranslation();
  const { answers } = useHairAIStore();
  const { events, addEvent, removeEvent, generateFromRoutine } = useCalendarStore();
  const dfLocale = dateFnsLocale(locale);
  const weekdays = CALENDAR_WEEKDAYS[locale];

  const [visibleMonth, setVisibleMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newType, setNewType] = useState<CareEventType>("lavage");
  const [note, setNote] = useState("");

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [visibleMonth]);

  if (!allowed) return null;

  const selectedKey = format(selectedDate, "yyyy-MM-dd");
  const dayEvents = events
    .filter((e) => e.date === selectedKey)
    .sort((a, b) => a.type.localeCompare(b.type));

  function eventsFor(date: Date) {
    const key = format(date, "yyyy-MM-dd");
    return events.filter((e) => e.date === key);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    addEvent({ date: selectedKey, type: newType, note: note.trim() || undefined });
    setNote("");
  }

  return (
    <main className="min-h-screen bg-ink-radial px-6 pb-28 pt-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper">
            ← {t("common.dashboard")}
          </Link>
          <span className="font-display text-lg italic text-cream">{t("calendar.title")}</span>
        </div>

        <button
          onClick={() => generateFromRoutine(answers.washFrequency, t("calendar.generatedFromRoutine"))}
          className="mb-6 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-copper/30 bg-copper/10 font-body text-sm text-copper-light transition hover:bg-copper/20"
        >
          <Wand2 size={15} />
          {t("calendar.generateFromRoutine")}
        </button>

        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setVisibleMonth((d) => subMonths(d, 1))}
            aria-label={t("calendar.prevMonth")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-cream/70 hover:border-copper/50"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-display text-lg capitalize text-cream">
            {format(visibleMonth, "MMMM yyyy", { locale: dfLocale })}
          </span>
          <button
            onClick={() => setVisibleMonth((d) => addMonths(d, 1))}
            aria-label={t("calendar.nextMonth")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-cream/70 hover:border-copper/50"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1 text-center">
          {weekdays.map((d, i) => (
            <span key={i} className="font-mono text-[10px] uppercase text-muted">
              {d}
            </span>
          ))}
        </div>

        <div className="mb-8 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const inMonth = isSameMonth(day, visibleMonth);
            const selected = isSameDay(day, selectedDate);
            const dayEvts = eventsFor(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition ${
                  selected
                    ? "bg-copper-gradient text-ink font-semibold"
                    : isToday(day)
                      ? "border border-copper/50 text-cream"
                      : inMonth
                        ? "text-cream/80 hover:bg-hairline/10"
                        : "text-muted/40"
                }`}
              >
                {format(day, "d")}
                <span className="flex gap-0.5">
                  {dayEvts.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={`h-1 w-1 rounded-full ${selected ? "bg-ink/70" : "bg-copper"}`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <h2 className="mb-3 font-display text-lg text-cream capitalize">
          {format(selectedDate, "EEEE d MMMM", { locale: dfLocale })}
        </h2>

        <div className="mb-4 flex flex-col gap-2">
          {dayEvents.length === 0 && (
            <p className="font-body text-sm text-muted">{t("calendar.noEvents")}</p>
          )}
          {dayEvents.map((e) => (
            <div key={e.id} className="glass flex items-center justify-between rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <Sparkles size={15} className="text-copper-light" />
                <div>
                  <p className="font-body text-sm text-cream">{getCareEventLabel(locale, e.type)}</p>
                  {e.note && <p className="mt-0.5 font-body text-xs text-muted">{e.note}</p>}
                </div>
              </div>
              <button
                onClick={() => removeEvent(e.id)}
                aria-label={t("calendar.delete")}
                className="text-muted transition hover:text-copper-light"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="glass rounded-3xl p-5">
          <span className="mb-3 block font-mono text-[10px] uppercase tracking-widest text-muted">
            {t("calendar.addEvent")}
          </span>
          <div className="mb-3 flex flex-wrap gap-2">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setNewType(type)}
                className={`rounded-full px-3 py-1.5 font-body text-xs transition ${
                  newType === type ? "bg-copper-gradient font-semibold text-ink" : "border border-line text-cream/70"
                }`}
              >
                {getCareEventLabel(locale, type)}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("calendar.notePlaceholder")}
            className="mb-3 h-11 w-full rounded-xl border border-line bg-surface px-4 font-body text-sm text-cream placeholder:text-muted focus:border-copper/60 focus:outline-none"
          />
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink transition active:scale-[0.98]"
          >
            {t("calendar.add")}
          </button>
        </form>
      </div>
      <BottomNav />
    </main>
  );
}
