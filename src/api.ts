import type { ChatMessage, EquipmentAnalysis, MealAnalysis, Menu, PantryResult, Profile, Program } from "../shared/types";
import { localMenu, localPantry } from "./data/recipes";
import { localMeal, localProgram, localReply } from "./data/localCoach";

export interface Result<T> {
  data: T;
  ai: boolean; // false when produced by the on-device fallback
}

async function post(url: string, body: unknown, timeoutMs = 60_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function generateProgram(profile: Profile, wish = "", log = "", useAi = true): Promise<Result<Program>> {
  if (!useAi) return { data: localProgram(profile), ai: false };
  try {
    const res = await post("/api/program", { profile, wish, log }, 120_000);
    if (res.ok) return { data: (await res.json()) as Program, ai: true };
  } catch {
    /* offline */
  }
  return { data: localProgram(profile), ai: false };
}

export async function analyzeMeal(input: {
  text?: string;
  image?: string;
  mediaType?: string;
  profile: Profile;
}): Promise<Result<MealAnalysis>> {
  try {
    const res = await post("/api/meal", input);
    if (res.ok) return { data: (await res.json()) as MealAnalysis, ai: true };
  } catch {
    /* offline */
  }
  return { data: localMeal(input.text ?? ""), ai: false };
}

/** Returns null when the AI is unavailable; the scanner then offers a manual machine list. */
export async function scanEquipment(input: {
  image: string;
  question?: string;
  profile: Profile;
  program: Program | null;
}): Promise<EquipmentAnalysis | null> {
  try {
    const res = await post("/api/equipment", { ...input, mediaType: "image/jpeg" });
    if (res.ok) return (await res.json()) as EquipmentAnalysis;
  } catch {
    /* offline */
  }
  return null;
}

export async function generateMenu(profile: Profile, schedule: number[], wish = "", useAi = true): Promise<Result<Menu>> {
  if (!useAi) return { data: localMenu(profile, schedule), ai: false };
  try {
    const res = await post("/api/menu", { profile, schedule, wish }, 180_000);
    if (res.ok) return { data: (await res.json()) as Menu, ai: true };
  } catch {
    /* offline */
  }
  return { data: localMenu(profile, schedule), ai: false };
}

/** Photo(s) or a typed list of products → recipes. null result = AI unavailable for photos. */
export async function scanPantry(input: {
  images: string[];
  text: string;
  profile: Profile;
  trainingToday?: boolean;
}): Promise<Result<PantryResult> | null> {
  try {
    const res = await post("/api/pantry", input, 120_000);
    if (res.ok) return { data: (await res.json()) as PantryResult, ai: true };
  } catch {
    /* offline */
  }
  if (input.images.length && !input.text.trim()) return null;
  const products = input.text.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  return { data: localPantry(products, input.profile, input.trainingToday), ai: false };
}

export async function chat(
  profile: Profile,
  messages: ChatMessage[],
  onText: (full: string) => void,
  log = "",
): Promise<boolean> {
  try {
    const res = await post("/api/chat", { profile, messages, log }, 120_000);
    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        onText(full);
      }
      if (full) return true;
    }
  } catch {
    /* offline */
  }
  // simulate streaming for the fallback reply
  const reply = localReply(profile, messages);
  for (let i = 0; i <= reply.length; i += 6) {
    onText(reply.slice(0, i));
    await new Promise((r) => setTimeout(r, 12));
  }
  onText(reply);
  return false;
}

/** Downscale an image file and return base64 (without prefix) + a small thumbnail. */
export async function prepareImage(file: File): Promise<{ base64: string; thumb: string }> {
  const bitmap = await createImageBitmap(file);
  const draw = (max: number, q: number) => {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  };
  return { base64: draw(1280, 0.85).split(",")[1], thumb: draw(240, 0.7) };
}
