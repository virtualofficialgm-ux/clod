import { useSyncExternalStore } from "react";
import type { ChatMessage, EquipmentAnalysis, MealAnalysis, NutritionPlan, Profile, Program } from "../shared/types";

export interface Account {
  email: string;
  name: string;
  provider: "apple" | "google" | "email";
  passHash?: string;
}

export interface MealEntry extends MealAnalysis {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  photo?: string; // small data URL thumbnail
}

export interface WorkoutLog {
  id: string;
  date: string;
  title: string;
  durationMin: number;
  sets: number;
  calories: number;
}

export interface EquipmentScan {
  id: string;
  date: string;
  photo?: string;
  result: EquipmentAnalysis;
}

export interface UserData {
  profile: Profile;
  plan: NutritionPlan;
  program: Program | null;
  meals: MealEntry[];
  workouts: WorkoutLog[];
  weights: { date: string; kg: number }[];
  water: Record<string, number>;
  chat: ChatMessage[];
  scans?: EquipmentScan[];
  createdAt: string;
}

interface State {
  session: string | null; // email of the signed-in account
  accounts: Record<string, Account>;
  data: Record<string, UserData>;
  theme: "system" | "light" | "dark";
}

const KEY = "pulse:v1";

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* storage unavailable — start fresh */
  }
  return { session: null, accounts: {}, data: {}, theme: "system" };
}

let state = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded or private mode — keep in memory */
  }
}

export function setState(update: (s: State) => State) {
  state = update(state);
  persist();
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}

export function useUser(): UserData | null {
  return useStore((s) => (s.session ? (s.data[s.session] ?? null) : null));
}

export function updateUser(fn: (d: UserData) => UserData) {
  setState((s) => {
    if (!s.session || !s.data[s.session]) return s;
    return { ...s, data: { ...s.data, [s.session]: fn(s.data[s.session]) } };
  });
}

export async function hash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pulse:${text}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function today(d = new Date()): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
