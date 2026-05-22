/**
 * useDailyRate.ts
 *
 * Fetches daily-rate settings from the backend and exposes a cost-computation
 * function that mirrors the server-side computeDailyRateCost logic exactly.
 *
 * Usage:
 *   const { dailyRateEnabled, dailyRates, computeCost, loading } =
 *     useDailyRate(venueType, venueId);
 *
 *   const { totalAmount, breakdown } = computeCost(startDate, endDate);
 */

import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance from "../../api/axios";

// ── Types (mirrors backend IDailyRateSlot) ────────────────────────────────────

export interface DailyRateSlot {
  _id:      string;
  label:    string;
  fromTime: string; // "HH:MM"
  toTime:   string; // "HH:MM" — "00:00" means end-of-day (midnight)
  price:    number;
}

export interface SlotBreakdown {
  label:       string;
  fromTime:    string;
  toTime:      string;
  price:       number;
  repetitions: number;
  charged:     number;
}

export interface DailyRateCostResult {
  totalAmount: number;
  breakdown:   SlotBreakdown[];
}

export type VenueType = "parking" | "garage" | "residence";

// ── Internal helpers ──────────────────────────────────────────────────────────

function toMins(hhmm: string, asEnd = false): number {
  const [h, m] = hhmm.split(":").map(Number);
  const v = h * 60 + m;
  return asEnd && v === 0 ? 1440 : v;
}

function dateMins(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

// ── Core pricing engine (must stay in sync with backend dailyRate.schema.ts) ──

export function computeDailyRateCost(
  bookingFrom: Date,
  bookingTo:   Date,
  slots:       DailyRateSlot[],
): DailyRateCostResult {

  if (!slots || slots.length === 0) {
    return { totalAmount: 0, breakdown: [] };
  }

  const sorted = [...slots].sort((a, b) => toMins(a.fromTime) - toMins(b.fromTime));

  const lastSlot    = sorted[sorted.length - 1];
  const lastDurMins = toMins(lastSlot.toTime, true) - toMins(lastSlot.fromTime);

  const chargeMap = new Map<string, SlotBreakdown>();

  const charge = (slot: DailyRateSlot) => {
    const existing = chargeMap.get(slot._id);
    if (existing) {
      existing.repetitions += 1;
      existing.charged     += slot.price;
    } else {
      chargeMap.set(slot._id, {
        label:       slot.label,
        fromTime:    slot.fromTime,
        toTime:      slot.toTime,
        price:       slot.price,
        repetitions: 1,
        charged:     slot.price,
      });
    }
  };

  const totalDays = Math.ceil(
    (bookingTo.getTime() - bookingFrom.getTime()) / 86_400_000
  ) + 2;
  const maxIter = (sorted.length + 10) * (totalDays + 1);

  let cursor = new Date(bookingFrom);
  let iter   = 0;

  while (cursor < bookingTo && iter++ < maxIter) {

    const dayAnchor = new Date(cursor);
    dayAnchor.setHours(0, 0, 0, 0);

    const cursorMins = dateMins(cursor);

    // ── 1. Cursor falls inside a defined slot ────────────────────────────────
    const matched = sorted.find((s) => {
      const sf = toMins(s.fromTime);
      const st = toMins(s.toTime, true);
      return cursorMins >= sf && cursorMins < st;
    });

    if (matched) {
      const slotEnd = new Date(
        dayAnchor.getTime() + toMins(matched.toTime, true) * 60_000
      );
      charge(matched);
      cursor = slotEnd < bookingTo ? slotEnd : bookingTo;
      continue;
    }

    // ── 2. Gap before a later slot today ─────────────────────────────────────
    const nextSlot = sorted.find((s) => toMins(s.fromTime) > cursorMins);

    if (nextSlot) {
      const nextStart = new Date(
        dayAnchor.getTime() + toMins(nextSlot.fromTime) * 60_000
      );
      cursor = nextStart < bookingTo ? nextStart : bookingTo;
      continue;
    }

    // ── 3. Past all defined slots — repeat last slot from cursor position ────
    const windowEnd = new Date(cursor.getTime() + lastDurMins * 60_000);
    charge(lastSlot);
    cursor = windowEnd < bookingTo ? windowEnd : bookingTo;
  }

  const totalAmount = [...chargeMap.values()].reduce(
    (sum, e) => sum + e.charged,
    0
  );

  return { totalAmount, breakdown: [...chargeMap.values()] };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseDailyRateResult {
  dailyRateEnabled: boolean;
  dailyRates:       DailyRateSlot[];
  loading:          boolean;
  error:            string | null;
  computeCost:      (from: Date, to: Date) => DailyRateCostResult;
}

export function useDailyRate(
  venueType: VenueType | null | undefined,
  venueId:   string    | null | undefined,
): UseDailyRateResult {
  const [dailyRateEnabled, setDailyRateEnabled] = useState(false);
  const [dailyRates,       setDailyRates]       = useState<DailyRateSlot[]>([]);
  const [loading,          setLoading]           = useState(false);
  const [error,            setError]             = useState<string | null>(null);

  const ratesRef = useRef<DailyRateSlot[]>([]);
  ratesRef.current = dailyRates;

  useEffect(() => {
    if (!venueType || !venueId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    axiosInstance
      .get(`/merchants/daily-rate-settings/${venueType}/${venueId}`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        setDailyRateEnabled(data?.dailyRateEnabled ?? false);
        setDailyRates(data?.dailyRates ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[useDailyRate] fetch failed:", err?.message);
        setError(err?.message ?? "Failed to fetch daily rate settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [venueType, venueId]);

  const computeCost = useCallback(
    (from: Date, to: Date): DailyRateCostResult => {
      if (!dailyRateEnabled || ratesRef.current.length === 0) {
        return { totalAmount: 0, breakdown: [] };
      }
      return computeDailyRateCost(from, to, ratesRef.current);
    },
    [dailyRateEnabled],
  );

  return { dailyRateEnabled, dailyRates, loading, error, computeCost };
}