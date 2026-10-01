// Offline recipe base and weekly menu builder, used when the AI server is unavailable.
import { checkIngredients } from "../../shared/allergens";
import { computePlan } from "../../shared/nutrition";
import type { Diet, Menu, MenuDay, PantryRecipe, PantryResult, Profile, Recipe } from "../../shared/types";

type Slot = "breakfast" | "lunch" | "dinner" | "snack";

interface Base {
  title: string;
  slots: Slot[];
  diet: Diet; // most restrictive diet this recipe satisfies
  timeMin: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  costRub: number; // per serving
  ingredients: [string, number, string, string][]; // name, qty per serving, unit, shopping category
  steps: string[];
  subs?: [string, string[]][];
  tags: string[];
}

const V = "Овощи и фрукты", M = "Мясо и рыба", D = "Молочное", G = "Бакалея";

export const RECIPES: Base[] = [
  { title: "Овсянка с бананом и орехами", slots: ["breakfast"], diet: "vegan", timeMin: 10, kcal: 420, protein: 12, carbs: 65, fat: 12, costRub: 55, tags: ["Быстро"],
    ingredients: [["Овсяные хлопья", 60, "г", G], ["Банан", 1, "шт", V], ["Грецкие орехи", 15, "г", G], ["Растительное молоко", 200, "мл", D]],
    steps: ["Залейте хлопья молоком и варите 5 минут", "Нарежьте банан", "Посыпьте орехами"], subs: [["Грецкие орехи", ["Семечки тыквы", "Без орехов"]]] },
  { title: "Омлет с овощами", slots: ["breakfast", "dinner"], diet: "vegetarian", timeMin: 12, kcal: 330, protein: 22, carbs: 8, fat: 23, costRub: 70, tags: ["Белок"],
    ingredients: [["Яйца", 3, "шт", D], ["Помидор", 1, "шт", V], ["Шпинат", 40, "г", V], ["Масло оливковое", 5, "мл", G]],
    steps: ["Взбейте яйца со щепоткой соли", "Обжарьте овощи 2 минуты", "Залейте яйцами и готовьте под крышкой 5 минут"], subs: [["Шпинат", ["Брокколи", "Кабачок"]]] },
  { title: "Сырники запечённые", slots: ["breakfast"], diet: "vegetarian", timeMin: 25, kcal: 380, protein: 28, carbs: 34, fat: 13, costRub: 95, tags: ["Белок"],
    ingredients: [["Творог 5%", 180, "г", D], ["Яйца", 1, "шт", D], ["Мука рисовая", 30, "г", G], ["Ягоды замороженные", 80, "г", V]],
    steps: ["Смешайте творог, яйцо и муку", "Сформируйте сырники", "Запекайте 20 минут при 190 °C", "Подавайте с ягодами"], subs: [["Мука рисовая", ["Овсяная мука", "Цельнозерновая мука"]]] },
  { title: "Греческий йогурт с гранолой", slots: ["breakfast", "snack"], diet: "vegetarian", timeMin: 3, kcal: 290, protein: 18, carbs: 35, fat: 8, costRub: 85, tags: ["Быстро"],
    ingredients: [["Греческий йогурт", 170, "г", D], ["Овсяные хлопья", 30, "г", G], ["Мёд", 10, "г", G], ["Яблоко", 0.5, "шт", V]],
    steps: ["Выложите йогурт", "Добавьте хлопья, яблоко и мёд"], subs: [["Мёд", ["Без сахара", "Корица"]]] },
  { title: "Тост с авокадо и фасолью", slots: ["breakfast", "snack"], diet: "vegan", timeMin: 8, kcal: 360, protein: 14, carbs: 42, fat: 15, costRub: 90, tags: ["Быстро"],
    ingredients: [["Цельнозерновой хлеб", 2, "шт", G], ["Авокадо", 0.5, "шт", V], ["Фасоль консервированная", 80, "г", G], ["Лимон", 0.25, "шт", V]],
    steps: ["Подсушите хлеб", "Разомните авокадо с лимоном", "Выложите авокадо и фасоль на тосты"] },
  { title: "Курица с гречкой и огурцами", slots: ["lunch", "dinner"], diet: "classic", timeMin: 30, kcal: 520, protein: 42, carbs: 55, fat: 12, costRub: 140, tags: ["Белок", "Бюджетно"],
    ingredients: [["Куриное филе", 150, "г", M], ["Гречка", 70, "г", G], ["Огурец", 1, "шт", V], ["Масло оливковое", 5, "мл", G]],
    steps: ["Отварите гречку 15 минут", "Обжарьте нарезанное филе 8–10 минут", "Подавайте с огурцом"], subs: [["Куриное филе", ["Индейка", "Нут"]]] },
  { title: "Паста с индейкой и томатами", slots: ["lunch", "dinner"], diet: "classic", timeMin: 25, kcal: 610, protein: 40, carbs: 72, fat: 15, costRub: 150, tags: ["Перед тренировкой"],
    ingredients: [["Макароны твёрдых сортов", 90, "г", G], ["Фарш индейки", 130, "г", M], ["Томаты в собственном соку", 150, "г", G], ["Лук", 0.5, "шт", V]],
    steps: ["Отварите пасту", "Обжарьте лук и фарш", "Добавьте томаты и тушите 10 минут", "Смешайте с пастой"], subs: [["Фарш индейки", ["Чечевица", "Говяжий фарш"]]] },
  { title: "Лосось с рисом и брокколи", slots: ["dinner", "lunch"], diet: "pescatarian", timeMin: 25, kcal: 560, protein: 36, carbs: 52, fat: 21, costRub: 290, tags: ["Омега-3"],
    ingredients: [["Филе лосося", 130, "г", M], ["Рис", 70, "г", G], ["Брокколи", 150, "г", V], ["Лимон", 0.25, "шт", V]],
    steps: ["Отварите рис", "Запеките лосось 15 минут при 200 °C", "Приготовьте брокколи на пару 5 минут"], subs: [["Филе лосося", ["Скумбрия", "Минтай"]]] },
  { title: "Минтай с картофелем и салатом", slots: ["dinner", "lunch"], diet: "pescatarian", timeMin: 30, kcal: 450, protein: 32, carbs: 48, fat: 11, costRub: 130, tags: ["Бюджетно"],
    ingredients: [["Филе минтая", 160, "г", M], ["Картофель", 200, "г", V], ["Капуста", 120, "г", V], ["Масло подсолнечное", 5, "мл", G]],
    steps: ["Отварите картофель", "Запеките минтай 15 минут", "Нашинкуйте капусту и заправьте маслом"] },
  { title: "Чечевичный суп", slots: ["lunch", "dinner"], diet: "vegan", timeMin: 35, kcal: 380, protein: 20, carbs: 55, fat: 7, costRub: 60, tags: ["Бюджетно", "Впрок"],
    ingredients: [["Красная чечевица", 80, "г", G], ["Морковь", 1, "шт", V], ["Лук", 0.5, "шт", V], ["Томатная паста", 15, "г", G]],
    steps: ["Обжарьте лук и морковь", "Добавьте чечевицу, пасту и 500 мл воды", "Варите 20 минут и пробейте блендером"] },
  { title: "Нут с овощами и булгуром", slots: ["lunch", "dinner"], diet: "vegan", timeMin: 25, kcal: 490, protein: 19, carbs: 78, fat: 11, costRub: 85, tags: ["Бюджетно"],
    ingredients: [["Нут консервированный", 120, "г", G], ["Булгур", 60, "г", G], ["Перец болгарский", 1, "шт", V], ["Кабачок", 0.5, "шт", V]],
    steps: ["Залейте булгур кипятком на 15 минут", "Обжарьте овощи", "Добавьте нут, прогрейте и смешайте с булгуром"], subs: [["Булгур", ["Киноа", "Рис"]]] },
  { title: "Тофу-стир-фрай с рисом", slots: ["dinner", "lunch"], diet: "vegan", timeMin: 20, kcal: 470, protein: 24, carbs: 58, fat: 15, costRub: 140, tags: ["Белок"],
    ingredients: [["Тофу", 150, "г", G], ["Рис", 70, "г", G], ["Овощная смесь замороженная", 150, "г", V], ["Соевый соус", 15, "мл", G]],
    steps: ["Отварите рис", "Обжарьте тофу до корочки", "Добавьте овощи и соус, готовьте 5 минут"] },
  { title: "Говядина с булгуром", slots: ["dinner", "lunch"], diet: "classic", timeMin: 40, kcal: 590, protein: 41, carbs: 50, fat: 22, costRub: 220, tags: ["Белок", "Впрок"],
    ingredients: [["Говядина", 140, "г", M], ["Булгур", 70, "г", G], ["Морковь", 1, "шт", V], ["Лук", 0.5, "шт", V]],
    steps: ["Нарежьте и обжарьте говядину", "Добавьте овощи и 200 мл воды, тушите 25 минут", "Отварите булгур"] },
  { title: "Куриный суп с лапшой", slots: ["lunch"], diet: "classic", timeMin: 40, kcal: 360, protein: 28, carbs: 35, fat: 10, costRub: 90, tags: ["Впрок", "Бюджетно"],
    ingredients: [["Куриное бедро", 120, "г", M], ["Лапша", 40, "г", G], ["Морковь", 1, "шт", V], ["Картофель", 100, "г", V]],
    steps: ["Варите курицу 20 минут", "Добавьте овощи на 10 минут", "Добавьте лапшу на 5 минут"] },
  { title: "Салат с тунцом и яйцом", slots: ["lunch", "dinner"], diet: "pescatarian", timeMin: 15, kcal: 390, protein: 34, carbs: 14, fat: 22, costRub: 150, tags: ["Быстро", "Белок"],
    ingredients: [["Тунец консервированный", 120, "г", M], ["Яйца", 2, "шт", D], ["Салат листовой", 80, "г", V], ["Огурец", 1, "шт", V]],
    steps: ["Отварите яйца 9 минут", "Нарежьте овощи", "Смешайте с тунцом"] },
  { title: "Творог с ягодами", slots: ["snack"], diet: "vegetarian", timeMin: 2, kcal: 210, protein: 26, carbs: 14, fat: 5, costRub: 75, tags: ["Белок", "После тренировки"],
    ingredients: [["Творог 5%", 150, "г", D], ["Ягоды замороженные", 70, "г", V]],
    steps: ["Смешайте творог с ягодами"] },
  { title: "Хумус с овощами", slots: ["snack"], diet: "vegan", timeMin: 5, kcal: 220, protein: 8, carbs: 22, fat: 11, costRub: 70, tags: ["Быстро"],
    ingredients: [["Хумус", 70, "г", G], ["Морковь", 1, "шт", V], ["Огурец", 1, "шт", V]],
    steps: ["Нарежьте овощи палочками", "Подавайте с хумусом"] },
  { title: "Банан и кефир", slots: ["snack"], diet: "vegetarian", timeMin: 1, kcal: 230, protein: 9, carbs: 38, fat: 5, costRub: 50, tags: ["Перед тренировкой"],
    ingredients: [["Кефир", 250, "мл", D], ["Банан", 1, "шт", V]],
    steps: ["Перекус за 40–60 минут до тренировки"] },
  { title: "Яблоко и миндаль", slots: ["snack"], diet: "vegan", timeMin: 1, kcal: 200, protein: 5, carbs: 22, fat: 11, costRub: 45, tags: ["Быстро"],
    ingredients: [["Яблоко", 1, "шт", V], ["Миндаль", 20, "г", G]],
    steps: ["Перекус между приёмами пищи"] },
];

const DIET_RANK: Record<Diet, number> = { vegan: 0, vegetarian: 1, pescatarian: 2, classic: 3 };

function allowed(r: Base, p: Profile) {
  if (DIET_RANK[r.diet] > DIET_RANK[p.diet]) return false;
  // pescatarian recipes are not vegetarian
  if (p.diet === "vegetarian" && r.diet === "pescatarian") return false;
  const dislikes = (p.dislikes ?? "").toLowerCase().split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const names = r.ingredients.map((i) => i[0]);
  if (dislikes.some((d) => names.some((n) => n.toLowerCase().includes(d)))) return false;
  if (checkIngredients(names, p.allergies ?? []).hits.length) return false;
  if (r.timeMin > (p.cookTimeMin ?? 30) + 15) return false;
  return true;
}

function toRecipe(b: Base, people: number, leftovers = false): Recipe {
  return {
    title: b.title,
    timeMin: leftovers ? 5 : b.timeMin,
    servings: people,
    kcal: b.kcal,
    protein: b.protein,
    carbs: b.carbs,
    fat: b.fat,
    costRub: leftovers ? 0 : b.costRub * people,
    ingredients: b.ingredients.map(([name, qty, unit]) => ({ name, qty: Math.round(qty * people * 10) / 10, unit })),
    steps: leftovers ? ["Разогрейте порцию, приготовленную накануне"] : b.steps,
    substitutions: (b.subs ?? []).map(([ingredient, options]) => ({ ingredient, options })),
    usesLeftovers: leftovers,
  };
}

export function localMenu(p: Profile, schedule: number[] = []): Menu {
  const people = Math.max(1, p.household ?? 1);
  const pool = RECIPES.filter((r) => allowed(r, p));
  const pick = (slot: Slot, i: number, prefer?: string) => {
    const opts = pool.filter((r) => r.slots.includes(slot));
    if (!opts.length) return null;
    const pref = prefer ? opts.filter((r) => r.tags.includes(prefer)) : [];
    const list = pref.length ? pref : opts;
    // cheaper options first when the budget is tight
    const sorted = p.budgetWeek && p.budgetWeek / people < 2500 ? [...list].sort((a, b) => a.costRub - b.costRub) : list;
    return sorted[i % sorted.length];
  };

  const days: MenuDay[] = [];
  let prevDinner: Base | null = null;
  for (let d = 0; d < 7; d++) {
    const training = schedule.includes(d);
    const meals: MenuDay["meals"] = [];
    const b = pick("breakfast", d);
    if (b) meals.push({ slot: "breakfast", recipe: toRecipe(b, people) });
    // cook-once-eat-twice: yesterday's dinner becomes today's lunch every other day
    if (prevDinner && d % 2 === 1 && prevDinner.slots.includes("lunch")) {
      meals.push({ slot: "lunch", recipe: toRecipe(prevDinner, people, true) });
    } else {
      const l = pick("lunch", d + 1, training ? "Перед тренировкой" : undefined);
      if (l) meals.push({ slot: "lunch", recipe: toRecipe(l, people) });
    }
    const s = pick("snack", d, training ? "После тренировки" : undefined);
    if (s) meals.push({ slot: "snack", recipe: toRecipe(s, people) });
    const dn = pick("dinner", d + 3, training ? "Белок" : undefined);
    if (dn) meals.push({ slot: "dinner", recipe: toRecipe(dn, people) });
    prevDinner = dn;
    days.push({ training, meals });
  }

  // shopping list: aggregate, skip what is already at home
  const pantry = (p.pantry ?? []).map((x) => x.toLowerCase());
  const shop = new Map<string, { name: string; qty: number; unit: string; category: string; costRub: number }>();
  days.forEach((day) =>
    day.meals.forEach(({ recipe }) => {
      if (recipe.usesLeftovers) return;
      const base = RECIPES.find((r) => r.title === recipe.title)!;
      base.ingredients.forEach(([name, , unit, category], idx) => {
        const qty = recipe.ingredients[idx].qty;
        const share = Math.round(recipe.costRub / base.ingredients.length);
        if (pantry.some((x) => name.toLowerCase().includes(x) || x.includes(name.toLowerCase()))) return;
        const cur = shop.get(name) ?? { name, qty: 0, unit, category, costRub: 0 };
        cur.qty = Math.round((cur.qty + qty) * 10) / 10;
        cur.costRub += share;
        shop.set(name, cur);
      });
    }),
  );
  const shopping = [...shop.values()].sort((a, b) => a.category.localeCompare(b.category));
  const totalRub = shopping.reduce((a, i) => a + i.costRub, 0);
  const plan = computePlan(p);
  const notes = [
    `Ориентир — около ${plan.calories} ккал и ${plan.protein} г белка в день. Калорийность блюд приблизительная.`,
    "Ужин через день готовится с запасом и становится обедом — меньше готовки и отходов.",
  ];
  if (p.budgetWeek && totalRub > p.budgetWeek) notes.push(`Меню дороже бюджета на ~${totalRub - p.budgetWeek} ₽ — замените рыбу и мясо на бобовые.`);
  return { days, shopping, totalRub, notes, clarify: [] };
}

/** Other recipes for the same meal slot that fit the user's diet, allergies and time. */
export function alternativesFor(slot: Slot, p: Profile, exclude: string): Recipe[] {
  const people = Math.max(1, p.household ?? 1);
  return RECIPES.filter((r) => r.slots.includes(slot) && r.title !== exclude && allowed(r, p)).map((r) => toRecipe(r, people));
}

const stem = (s: string) => s.toLowerCase().replace(/ё/g, "е").slice(0, 5);

/** Offline "what can I cook": ranks recipes by how many of their ingredients the user already has. */
export function localPantry(products: string[], p: Profile, trainingToday?: boolean): PantryResult {
  const have = products.map(stem).filter(Boolean);
  const has = (name: string) => have.some((h) => stem(name).includes(h) || name.toLowerCase().includes(h));
  const people = Math.max(1, p.household ?? 1);
  const purposeOf = (b: Base): PantryRecipe["purpose"] =>
    b.tags.includes("Перед тренировкой") ? "pre_workout" : b.tags.includes("После тренировки") || b.tags.includes("Белок") ? "post_workout" : b.tags.includes("Бюджетно") ? "rest_day" : "any";
  const why: Record<PantryRecipe["purpose"], string> = {
    pre_workout: "Углеводы и немного белка — энергия на тренировку без тяжести.",
    post_workout: "Много белка для восстановления мышц после нагрузки.",
    rest_day: "Сытно и умеренно по калориям — подходит для дня отдыха.",
    any: "Сбалансированное блюдо на любой день.",
  };
  const ranked = RECIPES.filter((r) => allowed(r, p))
    .map((r) => {
      const missing = r.ingredients.map((i) => i[0]).filter((n) => !has(n));
      return { r, missing, score: r.ingredients.length - missing.length };
    })
    .filter((x) => x.score > 0 && x.missing.length <= 3)
    .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length);
  const prefer = trainingToday === undefined ? null : trainingToday ? ["pre_workout", "post_workout"] : ["rest_day", "any"];
  const sorted = prefer ? [...ranked].sort((a, b) => Number(prefer.includes(purposeOf(b.r))) - Number(prefer.includes(purposeOf(a.r)))) : ranked;
  const recipes: PantryRecipe[] = sorted.slice(0, 6).map(({ r, missing }) => ({
    ...toRecipe(r, people),
    usesLeftovers: true,
    purpose: purposeOf(r),
    why: why[purposeOf(r)],
    missing,
  }));
  return {
    products: products.map((name) => ({ name, amount: "" })),
    recipes,
    advice: trainingToday
      ? "Сегодня тренировка: за 1–2 часа до неё — углеводы и немного белка, после — 25–40 г белка."
      : "День отдыха: делайте упор на белок и овощи, углеводы — умеренно.",
    clarify: [],
  };
}
