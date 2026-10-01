// Adaptive load: suggests the next working weight/reps from what the user actually did.
export type Feedback = "easy" | "ok" | "hard" | "pain";

export interface SetLog {
  weight: number; // kg, 0 for bodyweight
  reps: number;
}

export interface ExerciseEntry {
  date: string;
  sets: SetLog[];
  feedback: Feedback;
}

export interface Suggestion {
  weight: number;
  reps: number;
  note: string;
  caution?: boolean;
}

/** Upper bound of a rep range like "8–10" or "12"; null for timed sets ("40 сек"). */
export function repTarget(reps: string): { low: number; high: number } | null {
  if (/сек|мин/i.test(reps)) return null;
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return null;
  return { low: nums[0], high: nums[nums.length - 1] };
}

const round = (kg: number) => Math.round(kg / 2.5) * 2.5;

export function suggest(plannedReps: string, history: ExerciseEntry[] | undefined): Suggestion | null {
  const target = repTarget(plannedReps);
  if (!target) return null;
  const last = history?.[history.length - 1];
  if (!last || !last.sets.length) {
    return { weight: 0, reps: target.low, note: "Первый раз: подберите вес, с которым последние 2 повтора даются тяжело." };
  }
  const weight = Math.max(...last.sets.map((s) => s.weight));
  const minReps = Math.min(...last.sets.map((s) => s.reps));

  if (last.feedback === "pain") {
    return {
      weight: round(weight * 0.8),
      reps: target.low,
      note: "В прошлый раз был дискомфорт: снизили вес на 20%. Если боль повторится — замените упражнение и обратитесь к врачу.",
      caution: true,
    };
  }
  if (last.feedback === "hard" || minReps < target.low) {
    return { weight, reps: target.low, note: "Прошлый раз дался тяжело — повторяем вес и закрепляем технику." };
  }
  if (minReps >= target.high) {
    if (weight === 0) return { weight: 0, reps: target.high + 2, note: "Все повторы выполнены — добавили 2 повтора." };
    const step = last.feedback === "easy" ? 1.075 : 1.05;
    return { weight: Math.max(weight + 2.5, round(weight * step)), reps: target.low, note: "Верхняя граница повторов взята — увеличиваем вес." };
  }
  return { weight, reps: Math.min(target.high, minReps + 1), note: "Тот же вес, цель — на 1 повтор больше в каждом подходе." };
}
