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
  /** Training days, 0 = Monday … 6 = Sunday. workoutsPerWeek mirrors its length. */
  days?: number[];
  sessionMin?: number;
  preferences?: string[];
  limitations?: string[];
  limitationsNote?: string;
  reminders?: boolean;
  reminderTime?: string; // HH:MM
  // Parri Food
  budgetWeek?: number; // ₽ per week for the household
  cookTimeMin?: number; // max minutes per meal on weekdays
  tastes?: string[];
  dislikes?: string;
  allergies?: string[];
  household?: number;
  pantry?: string[];
  /** Separate consent: lets Fit and Food share schedule and goals. */
  linkFitFood?: boolean;
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

export const EquipmentSchema = z.object({
  recognized: z.boolean().describe("false, если на фото нет спортивного тренажёра или снаряда"),
  name: z.string().describe("Название тренажёра на русском"),
  muscles: z.array(z.string()).describe("Целевые мышцы"),
  description: z.string().describe("Одно-два предложения: что это за тренажёр и для чего он"),
  setup: z.array(z.string()).describe("Как настроить под рост пользователя: сиденье, валики, рукояти, вес"),
  steps: z.array(z.string()).describe("Техника выполнения по шагам"),
  mistakes: z.array(z.string()),
  safety: z.string(),
  planMatch: z.object({
    inPlan: z.boolean().describe("true, если упражнение на этом тренажёре уже есть в программе пользователя"),
    dayTitle: z.string().describe("Название дня программы, куда это относится, или пустая строка"),
    exercise: z.string().describe("Какое упражнение делать на тренажёре"),
    sets: z.number().int(),
    reps: z.string(),
    restSec: z.number().int(),
    weightTip: z.string().describe("С какого веса начать и как его подбирать"),
  }),
  alternatives: z.array(z.object({ name: z.string(), how: z.string() })).describe("Другие упражнения на этом тренажёре"),
  coachNote: z.string().describe("Короткий персональный совет с учётом цели и уровня пользователя"),
});

export type EquipmentAnalysis = z.infer<typeof EquipmentSchema>;

export const IngredientSchema = z.object({
  name: z.string(),
  qty: z.number(),
  unit: z.string().describe("г, мл, шт, ст. л. и т. п."),
});

export const RecipeSchema = z.object({
  title: z.string(),
  timeMin: z.number().int(),
  servings: z.number().int(),
  kcal: z.number().int().describe("Приблизительно на порцию"),
  protein: z.number().int(),
  carbs: z.number().int(),
  fat: z.number().int(),
  costRub: z.number().int().describe("Примерная стоимость всего блюда в рублях"),
  ingredients: z.array(IngredientSchema),
  steps: z.array(z.string()),
  substitutions: z.array(z.object({ ingredient: z.string(), options: z.array(z.string()) })),
  usesLeftovers: z.boolean().describe("Использует остатки предыдущих блюд или продукты, которые уже есть дома"),
});

export const MenuDaySchema = z.object({
  training: z.boolean().describe("День тренировки по расписанию пользователя"),
  meals: z.array(z.object({ slot: z.enum(["breakfast", "lunch", "dinner", "snack"]), recipe: RecipeSchema })),
});

export const MenuSchema = z.object({
  days: z.array(MenuDaySchema).describe("Ровно 7 дней, с понедельника"),
  shopping: z.array(
    z.object({ name: z.string(), qty: z.number(), unit: z.string(), category: z.string(), costRub: z.number().int() }),
  ),
  totalRub: z.number().int(),
  notes: z.array(z.string()),
  clarify: z.array(z.string()).describe("Ингредиенты с неизвестным составом, которые надо уточнить из-за аллергий"),
});

export type Ingredient = z.infer<typeof IngredientSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type MenuDay = z.infer<typeof MenuDaySchema>;
export type Menu = z.infer<typeof MenuSchema>;
