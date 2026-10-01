// On-device fallback used when the AI server is unreachable or has no API key.
import type { ChatMessage, MealAnalysis, Profile, Program, WorkoutDay } from "../../shared/types";
import { computePlan } from "../../shared/nutrition";
import { EXERCISES, type ExerciseInfo } from "./exercises";

const SPLITS: Record<number, { title: string; focus: string; kinds: ExerciseInfo["kind"][] }[]> = {
  1: [{ title: "Всё тело", focus: "Базовые движения на все группы", kinds: ["legs", "push", "pull", "core", "full"] }],
  2: [
    { title: "Всё тело A", focus: "Ноги, грудь, спина", kinds: ["legs", "push", "pull", "core", "legs"] },
    { title: "Всё тело B", focus: "Ягодицы, плечи, пресс", kinds: ["legs", "pull", "push", "core", "full"] },
  ],
  3: [
    { title: "Верх тела", focus: "Грудь, спина, плечи, руки", kinds: ["push", "pull", "push", "pull", "core"] },
    { title: "Низ тела", focus: "Ноги, ягодицы, пресс", kinds: ["legs", "legs", "legs", "core", "core"] },
    { title: "Всё тело + кардио", focus: "Силовая выносливость", kinds: ["full", "legs", "push", "pull", "cardio"] },
  ],
  4: [
    { title: "Верх A", focus: "Акцент на грудь и плечи", kinds: ["push", "pull", "push", "push", "core"] },
    { title: "Низ A", focus: "Акцент на квадрицепсы", kinds: ["legs", "legs", "legs", "core", "cardio"] },
    { title: "Верх B", focus: "Акцент на спину и руки", kinds: ["pull", "push", "pull", "pull", "core"] },
    { title: "Низ B", focus: "Акцент на ягодицы", kinds: ["legs", "legs", "full", "core", "cardio"] },
  ],
};

function splitFor(n: number) {
  if (n <= 4) return SPLITS[Math.max(1, n)];
  const extra = { title: "Кардио и мобильность", focus: "Выносливость и восстановление", kinds: ["cardio", "full", "core", "cardio"] as ExerciseInfo["kind"][] };
  return [...SPLITS[4], ...Array.from({ length: Math.min(3, n - 4) }, () => extra)];
}

// Exercises skipped for each sensitive area the user reports.
const AVOID: Record<string, RegExp> = {
  "Колени": /присед|выпад|берпи|прыжк|бег|сплит|жим ногами|скалолаз/i,
  "Поясница": /становая|приседания со штангой|махи гирей|супермен|тяга .* наклон|гребн/i,
  "Плечи": /жим гантелей сидя|брусь|жим лёжа|разведения|французский/i,
  "Запястья": /отжиман|планка|берпи|скалолаз/i,
  "Шея": /подтягиван|скручиван/i,
  "Давление / сердце": /берпи|бег интервал|махи гирей|прыжк/i,
  "Беременность": /скручиван|планка|берпи|прыжк|становая|бег интервал|подъёмы ног/i,
};

export function localProgram(p: Profile): Program {
  const level = p.experience === "beginner" ? 1 : p.experience === "intermediate" ? 2 : 3;
  const avoid = (p.limitations ?? []).map((l) => AVOID[l]).filter(Boolean);
  const pool = EXERCISES.filter((e) => e.places.includes(p.place) && e.level <= level && !avoid.some((re) => re.test(e.name)));
  const used = new Set<string>();
  const reps = p.goal === "gain" ? "8–10" : p.goal === "lose" ? "12–15" : "10–12";
  const sets = level === 1 ? 3 : 4;

  const perSession = (p.sessionMin ?? 45) <= 25 ? 3 : (p.sessionMin ?? 45) >= 60 ? 6 : 5;
  const days: WorkoutDay[] = splitFor(p.days?.length || p.workoutsPerWeek).map((d, di) => {
    const kinds = [...d.kinds, ...d.kinds].slice(0, perSession);
    const exercises = kinds.map((kind, i) => {
      const options = pool.filter((e) => e.kind === kind);
      const pick = options.find((e) => !used.has(e.name + di)) ?? options[(di + i) % Math.max(1, options.length)] ?? pool[i % pool.length];
      used.add(pick.name + di);
      const timed = pick.kind === "cardio" || pick.name.includes("Планка");
      return {
        name: pick.name,
        sets: timed ? 3 : sets,
        reps: timed ? (pick.name.includes("Бег") ? "10 мин" : "40 сек") : reps,
        restSec: timed ? 30 : p.goal === "gain" ? 90 : 60,
        muscle: pick.muscle,
        tip: pick.steps[pick.steps.length - 1],
      };
    });
    // de-duplicate names within a day
    const seen = new Set<string>();
    return {
      title: d.title,
      focus: d.focus,
      durationMin: p.sessionMin ?? 35 + exercises.length * 5,
      intensity: (level === 1 ? "low" : level === 2 ? "medium" : "high") as WorkoutDay["intensity"],
      warmup: ["5 минут лёгкого кардио", "Вращения в суставах", "Разминочный подход первого упражнения"],
      exercises: exercises.filter((e) => (seen.has(e.name) ? false : (seen.add(e.name), true))),
      cooldown: ["Растяжка работавших мышц 5–7 минут", "Спокойное дыхание"],
    };
  });

  const plan = computePlan(p);
  return {
    name: p.goal === "lose" ? "Жиросжигание" : p.goal === "gain" ? "Набор мышечной массы" : "Форма и тонус",
    summary: `${days.length} тренировки в неделю ${p.place === "gym" ? "в зале" : p.place === "home" ? "дома" : "на улице"} с прогрессией нагрузки. Каждую неделю добавляйте 1–2 повтора или немного веса.`,
    weeks: 6,
    days,
    tips: [
      `Ешьте около ${plan.protein} г белка в день — это сохранит и нарастит мышцы.`,
      "Спите 7–9 часов: восстановление важнее лишней тренировки.",
      `Пейте около ${(plan.waterMl / 1000).toFixed(1)} л воды в день.`,
      "Если упражнение вызывает боль (не усталость) — отметьте это после тренировки: мы снизим нагрузку. При повторной боли обратитесь к врачу.",
    ],
  };
}

const FOODS: { re: RegExp; name: string; per100: [number, number, number, number]; grams: number }[] = [
  { re: /кур|грудк/i, name: "Куриная грудка", per100: [165, 31, 0, 4], grams: 150 },
  { re: /рис/i, name: "Рис отварной", per100: [130, 3, 28, 0], grams: 150 },
  { re: /греч/i, name: "Гречка отварная", per100: [110, 4, 21, 1], grams: 150 },
  { re: /овсян|каша/i, name: "Овсяная каша", per100: [88, 3, 15, 2], grams: 250 },
  { re: /яйц|омлет/i, name: "Яйца", per100: [155, 13, 1, 11], grams: 110 },
  { re: /творог/i, name: "Творог 5%", per100: [121, 17, 2, 5], grams: 200 },
  { re: /банан/i, name: "Банан", per100: [89, 1, 23, 0], grams: 120 },
  { re: /яблок/i, name: "Яблоко", per100: [52, 0, 14, 0], grams: 180 },
  { re: /салат|овощ/i, name: "Овощной салат", per100: [45, 1, 6, 2], grams: 200 },
  { re: /пицц/i, name: "Пицца", per100: [266, 11, 33, 10], grams: 250 },
  { re: /бургер/i, name: "Бургер", per100: [254, 13, 24, 12], grams: 220 },
  { re: /лосос|рыб/i, name: "Лосось", per100: [208, 20, 0, 13], grams: 150 },
  { re: /макарон|паст/i, name: "Паста", per100: [158, 6, 31, 1], grams: 200 },
  { re: /хлеб|тост/i, name: "Хлеб", per100: [265, 9, 49, 3], grams: 60 },
  { re: /йогурт/i, name: "Йогурт", per100: [70, 5, 8, 2], grams: 150 },
  { re: /суп|борщ/i, name: "Суп", per100: [50, 3, 5, 2], grams: 300 },
  { re: /протеин|коктейл/i, name: "Протеиновый коктейль", per100: [380, 75, 8, 5], grams: 30 },
];

export function localMeal(text: string): MealAnalysis {
  const matches = FOODS.filter((f) => f.re.test(text));
  const items = (matches.length ? matches : [{ name: text || "Приём пищи", per100: [150, 8, 18, 5] as [number, number, number, number], grams: 250 }]).map((f) => ({
    name: f.name,
    grams: f.grams,
    calories: Math.round((f.per100[0] * f.grams) / 100),
    p: (f.per100[1] * f.grams) / 100,
    c: (f.per100[2] * f.grams) / 100,
    f: (f.per100[3] * f.grams) / 100,
  }));
  const sum = (k: "calories" | "p" | "c" | "f") => Math.round(items.reduce((a, i) => a + i[k], 0));
  const protein = sum("p");
  const calories = sum("calories");
  return {
    name: text ? text[0].toUpperCase() + text.slice(1) : "Приём пищи",
    calories,
    protein,
    carbs: sum("c"),
    fat: sum("f"),
    healthScore: Math.max(3, Math.min(9, Math.round(5 + (protein * 4) / Math.max(calories, 1) * 10 - (calories > 800 ? 2 : 0)))),
    items: items.map(({ name, grams, calories }) => ({ name, grams, calories })),
    comment: "Приблизительная оценка без ИИ. Подключите ИИ-сервер для анализа по фото.",
  };
}

const TOPICS: { re: RegExp; answer: (p: Profile) => string }[] = [
  {
    re: /белк|протеин/i,
    answer: (p) => `Ваша норма белка — около **${computePlan(p).protein} г в день**. Распределите её на 3–5 приёмов по 25–40 г: мясо, рыба, яйца, творог, бобовые. Протеиновый коктейль — удобная добавка, но не обязательная.`,
  },
  {
    re: /калор|похуд|дефицит|жир/i,
    answer: (p) => `Ваша дневная норма — **${computePlan(p).calories} ккал**. Для снижения веса важен стабильный умеренный дефицит, достаточный белок и сон. Взвешивайтесь утром натощак и смотрите на среднее за неделю, а не на отдельные дни.`,
  },
  {
    re: /масс|набор|мышц/i,
    answer: () => "Для набора мышц нужны: профицит 200–300 ккал, 1.6–2.2 г белка на кг веса, прогрессия нагрузки (больше веса или повторов каждую неделю) и 7–9 часов сна. Работайте в диапазоне 6–12 повторов, оставляя 1–2 повтора в запасе.",
  },
  {
    re: /сон|восстанов|устал/i,
    answer: () => "Восстановление — часть тренировки. Спите 7–9 часов, делайте хотя бы 1–2 дня отдыха в неделю, а при сильной усталости снизьте объём на 30–40% на неделю (разгрузка).",
  },
  {
    re: /болит|боль|травм/i,
    answer: () => "Мышечная крепатура через 24–48 часов — норма. Но острая боль в суставе, онемение или боль, которая усиливается, — повод прекратить упражнение и обратиться к врачу. Я не могу ставить диагнозы.",
  },
  {
    re: /кардио|бег|выносл/i,
    answer: () => "Для здоровья достаточно 150 минут умеренного кардио в неделю. Для жиросжигания хорошо работает ходьба 8–10 тысяч шагов в день плюс 1–2 интервальные тренировки.",
  },
];

export function localReply(p: Profile, history: ChatMessage[]): string {
  const last = history[history.length - 1]?.content ?? "";
  const topic = TOPICS.find((t) => t.re.test(last));
  if (topic) return topic.answer(p);
  if (/бюджет|дешев|эконом|остатк|покуп/i.test(last)) {
    return "Чтобы уложиться в бюджет: готовьте ужин с запасом на обед, покупайте крупы и бобовые как основу, сезонные овощи и замороженные ягоды. Во вкладке **Food** можно указать остатки — меню их использует.";
  }
  return `Я сейчас работаю в офлайн-режиме, поэтому отвечаю коротко. Спросите меня про **белок**, **калории**, **набор массы**, **кардио** или **восстановление** — или подключите ИИ-сервер (переменная ANTHROPIC_API_KEY), и я смогу ответить на любой вопрос.`;
}
