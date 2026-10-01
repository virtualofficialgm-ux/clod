import { z } from "zod";

export type Gender = "male" | "female" | "other";
export type Goal = "lose" | "maintain" | "gain";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Place = "gym" | "home" | "outdoor";
export type Diet = "classic" | "pescatarian" | "vegetarian" | "vegan";

export interface Profile {
  name: string;
  gender: Gender;
  birthDate: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  goal: Goal;
  targetWeightKg: number;
  weeklyRateKg: number;
  workoutsPerWeek: number;
  experience: Experience;
  place: Place;
  equipment: string[];
  obstacles: string[];
  accomplishments: string[];
  diet: Diet;
  source: string;
  units: "metric" | "imperial";
}

export interface NutritionPlan {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  healthScore: number; // 1..10
  targetDate: string; // ISO date the target weight is reached
}

export const ExerciseSchema = z.object({
  name: z.string().describe("Название упражнения на русском"),
  sets: z.number().int(),
  reps: z.string().describe("Повторы или время, например «8–10» или «40 сек»"),
  restSec: z.number().int(),
  muscle: z.string().describe("Основная мышечная группа"),
  tip: z.string().describe("Короткая подсказка по технике"),
});

export const WorkoutDaySchema = z.object({
  title: z.string(),
  focus: z.string(),
  durationMin: z.number().int(),
  intensity: z.enum(["low", "medium", "high"]),
  warmup: z.array(z.string()),
  exercises: z.array(ExerciseSchema),
  cooldown: z.array(z.string()),
});

export const ProgramSchema = z.object({
  name: z.string(),
  summary: z.string(),
  weeks: z.number().int(),
  days: z.array(WorkoutDaySchema),
  tips: z.array(z.string()),
});

export const MealSchema = z.object({
  name: z.string().describe("Название блюда на русском"),
  calories: z.number().int(),
  protein: z.number().int(),
  carbs: z.number().int(),
  fat: z.number().int(),
  healthScore: z.number().int().describe("Полезность от 1 до 10"),
  items: z.array(
    z.object({ name: z.string(), grams: z.number().int(), calories: z.number().int() }),
  ),
  comment: z.string().describe("Одно-два предложения: оценка блюда относительно цели пользователя"),
});

export type Exercise = z.infer<typeof ExerciseSchema>;
export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;
export type Program = z.infer<typeof ProgramSchema>;
export type MealAnalysis = z.infer<typeof MealSchema>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
