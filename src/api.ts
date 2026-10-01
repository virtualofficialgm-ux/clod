import type { ChatMessage, MealAnalysis, Profile, Program } from "../shared/types";
import { localMeal, localProgram, localReply } from "./data/localCoach";

export interface Result<T> {
  data: T;
  ai: boolean; // false when produced by the on-device fallback
}

async function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function generateProgram(profile: Profile, wish = ""): Promise<Result<Program>> {
  try {
    const res = await post("/api/program", { profile, wish });
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

export async function chat(
  profile: Profile,
  messages: ChatMessage[],
  onText: (full: string) => void,
): Promise<boolean> {
  try {
    const res = await post("/api/chat", { profile, messages });
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
