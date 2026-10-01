import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import express, { type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computePlan, ageFrom } from "../shared/nutrition";
import { EquipmentSchema, MealSchema, MenuSchema, PantrySchema, ProgramSchema, type ChatMessage, type Profile, type Program } from "../shared/types";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
// Re-runs a request declined by safety classifiers on Anthropic's recommended fallback model.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

const client = new Anthropic();
const app = express();
app.use(express.json({ limit: "12mb" }));

const GOALS = { lose: "снизить вес", maintain: "поддерживать вес и форму", gain: "набрать мышечную массу" };
const PLACES = { gym: "в зале", home: "дома", outdoor: "на улице" };
const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function trainingDays(p: Profile): number {
  return Math.max(1, Math.min(7, p.days?.length || p.workoutsPerWeek));
}

function describe(p: Profile): string {
  const plan = computePlan(p);
  return [
    `Имя: ${p.name || "не указано"}`,
    `Пол: ${p.gender}, возраст: ${ageFrom(p.birthDate)}`,
    `Рост: ${p.heightCm} см, вес: ${p.weightKg} кг, цель по весу: ${p.targetWeightKg} кг`,
    `Цель: ${GOALS[p.goal]}, темп: ${p.weeklyRateKg} кг/нед`,
    `Тренировок в неделю: ${trainingDays(p)}${p.days?.length ? ` (${p.days.map((d) => WEEKDAYS[d]).join(", ")})` : ""}, по ${p.sessionMin ?? 45} мин; уровень: ${p.experience}, где: ${PLACES[p.place]}`,
    `Инвентарь: ${p.equipment.join(", ") || "нет"}`,
    `Предпочтения в тренировках: ${p.preferences?.join(", ") || "—"}`,
    `Ограничения и чувствительные зоны: ${[...(p.limitations ?? []), p.limitationsNote].filter(Boolean).join(", ") || "нет"}`,
    `Питание: ${p.diet}; что мешает: ${p.obstacles.join(", ") || "—"}; хочет: ${p.accomplishments.join(", ") || "—"}`,
    `Норма: ${plan.calories} ккал, Б ${plan.protein} г, У ${plan.carbs} г, Ж ${plan.fat} г, вода ${plan.waterMl} мл`,
  ].join("\n");
}

const COACH_SYSTEM = `Ты — ИИ-помощник приложения Parri: раздел Parri Fit (тренировки) и Parri Food (питание и меню).
Отвечай на русском, дружелюбно и по делу, как опытный тренер. Опирайся на доказательную спортивную науку.
Пиши коротко: мобильный экран, 2–6 абзацев или компактный список. Без таблиц и заголовков крупнее жирного текста.
Если вопрос касается боли, травмы, болезни, беременности или лекарств — дай общую безопасную информацию и посоветуй обратиться к врачу.
Не ставь диагнозы и не обещай гарантированный результат. Не советуй экстремальные дефициты калорий (ниже 1200 ккал) и запрещённые препараты.
Калорийность блюд всегда называй приблизительной.`;

function foodProfile(p: Profile): string {
  return [
    `Бюджет на неделю: ${p.budgetWeek ? `${p.budgetWeek} ₽` : "не задан"}, человек в семье: ${p.household ?? 1}`,
    `Время на готовку в будни: до ${p.cookTimeMin ?? 30} мин`,
    `Тип питания: ${p.diet}; любит: ${p.tastes?.join(", ") || "—"}; не ест: ${p.dislikes || "—"}`,
    `Аллергии и исключения: ${p.allergies?.join(", ") || "нет"}`,
    `Есть дома: ${p.pantry?.join(", ") || "не указано"}`,
  ].join("\n");
}

function sendError(res: Response, err: unknown) {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    res.status(503).json({ error: "no_credentials" });
  } else if (err instanceof Anthropic.RateLimitError) {
    res.status(429).json({ error: "rate_limited" });
  } else if (err instanceof Anthropic.APIError) {
    console.error(`Claude API error ${err.status}:`, err.message);
    res.status(502).json({ error: "upstream", detail: err.message });
  } else {
    // Missing credentials or network failures: the client falls back to the on-device coach.
    console.error(err);
    res.status(503).json({ error: "unavailable" });
  }
}

app.get("/api/status", (_req, res) => {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  res.json({ ai: configured, model: MODEL });
});

app.post("/api/program", async (req, res) => {
  const profile = req.body.profile as Profile;
  const wish = typeof req.body.wish === "string" ? req.body.wish.slice(0, 500) : "";
  const log = typeof req.body.log === "string" ? req.body.log.slice(0, 4000) : "";
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(ProgramSchema) },
      system: COACH_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Составь персональную недельную программу тренировок для этого человека.

${describe(profile)}
${wish ? `\nПожелание пользователя: ${wish}` : ""}
${log ? `\nФактическое выполнение и обратная связь за последние тренировки:\n${log}\nСкорректируй нагрузку: где было легко — прибавь, где тяжело — оставь, где была боль — замени упражнение на безопасный аналог.` : ""}

Требования:
- Ровно ${trainingDays(profile)} тренировочных дней (days), каждый примерно на ${profile.sessionMin ?? 45} минут, учитывая место и инвентарь.
- Не включай упражнения, которые нагружают перечисленные ограничения; учитывай предпочтения.
- Для каждого дня 4–7 упражнений с подходами, повторами, отдыхом, мышечной группой и подсказкой по технике.
- Учитывай уровень подготовки и цель; прогрессия рассчитана на weeks недель (4–8).
- 3–5 практичных советов (tips) по восстановлению и питанию под цель.
- Все тексты на русском.`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      res.status(422).json({ error: "refused" });
      return;
    }
    res.json(response.parsed_output);
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/meal", async (req, res) => {
  const { image, mediaType, text, profile } = req.body as {
    image?: string;
    mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    text?: string;
    profile?: Profile;
  };
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (image) {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType ?? "image/jpeg", data: image } });
  }
  content.push({
    type: "text",
    text: `Оцени калорийность и БЖУ ${image ? "блюда на фото" : "этого приёма пищи"}${
      text ? `: «${text.slice(0, 500)}»` : ""
    }. Разбей на ингредиенты с примерным весом. Оцени полезность от 1 до 10.${
      profile ? `\n\nПрофиль пользователя:\n${describe(profile)}` : ""
    }`,
  });
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(MealSchema) },
      system: "Ты — нутрициолог, который точно оценивает калорийность еды по фото и описанию. Все тексты на русском.",
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      res.status(422).json({ error: "refused" });
      return;
    }
    res.json(response.parsed_output);
  } catch (err) {
    sendError(res, err);
  }
});

function describeProgram(program: Program | null | undefined): string {
  if (!program) return "Программа тренировок ещё не составлена.";
  return program.days
    .map((d, i) => `День ${i + 1} «${d.title}»: ${d.exercises.map((e) => `${e.name} ${e.sets}×${e.reps}, отдых ${e.restSec} с`).join("; ")}`)
    .join("\n");
}

app.post("/api/equipment", async (req, res) => {
  const { image, mediaType, question, profile, program } = req.body as {
    image: string;
    mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    question?: string;
    profile: Profile;
    program?: Program | null;
  };
  if (!image) {
    res.status(400).json({ error: "no_image" });
    return;
  }
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 6000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(EquipmentSchema) },
      system: COACH_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType ?? "image/jpeg", data: image } },
            {
              type: "text",
              text: `Пользователь сфотографировал тренажёр в зале. Определи, что это, и объясни, как на нём заниматься именно ему.

Профиль:
${describe(profile)}

Его программа:
${describeProgram(program)}
${question ? `\nВопрос пользователя: «${question.slice(0, 500)}»` : ""}

Правила:
- Если упражнение на этом тренажёре (или его прямой аналог) есть в программе, укажи день и возьми подходы/повторы/отдых из программы (planMatch.inPlan = true).
- Если нет — предложи, как вписать его в программу под цель и уровень пользователя (inPlan = false, dayTitle — самый подходящий день).
- Настройку тренажёра объясняй с учётом роста ${profile.heightCm} см.
- Если на фото не тренажёр, recognized = false, остальные поля заполни кратко.`,
            },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      res.status(422).json({ error: "refused" });
      return;
    }
    res.json(response.parsed_output);
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/menu", async (req, res) => {
  const { profile, wish, schedule } = req.body as { profile: Profile; wish?: string; schedule?: number[] };
  const plan = computePlan(profile);
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(MenuSchema) },
      system: COACH_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Составь меню на неделю (7 дней с понедельника) для этой семьи.

${foodProfile(profile)}
Ориентир для пользователя: ${plan.calories} ккал, белок ${plan.protein} г в день (цель: ${GOALS[profile.goal]}).
${schedule?.length ? `Тренировки по дням: ${schedule.map((d) => WEEKDAYS[d]).join(", ")} — в эти дни training = true, больше углеводов и белка вокруг тренировки.` : "Расписание тренировок не передано."}
${wish ? `Пожелание: «${String(wish).slice(0, 500)}»` : ""}

Требования:
- 3–4 приёма пищи в день; рецепты простые, в пределах времени на готовку.
- Укладывайся в бюджет; повторно используй ингредиенты и остатки (например, ужин → обед следующего дня), отмечай usesLeftovers.
- Используй продукты, которые уже есть дома, и не добавляй их в список покупок.
- Строго исключи аллергены и нелюбимые продукты. Если у продукта может быть неизвестный состав (соусы, готовые смеси), добавь его в clarify.
- Для 1–2 ингредиентов в рецепте дай варианты замены.
- Список покупок сгруппируй по категориям (Овощи и фрукты, Мясо и рыба, Молочное, Бакалея, Прочее) с ценами в рублях.
- Количество ингредиентов указывай на всю семью. Калории — приблизительно, на порцию.`,
        },
      ],
    });
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      res.status(422).json({ error: "refused" });
      return;
    }
    const text = final.content.find((b) => b.type === "text");
    const parsed = text && text.type === "text" ? MenuSchema.safeParse(JSON.parse(text.text)) : null;
    if (!parsed?.success) {
      res.status(502).json({ error: "bad_output" });
      return;
    }
    res.json(parsed.data);
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/pantry", async (req, res) => {
  const { images, text, profile, trainingToday } = req.body as {
    images?: string[];
    text?: string;
    profile: Profile;
    trainingToday?: boolean;
  };
  const plan = computePlan(profile);
  const content: Anthropic.Beta.BetaContentBlockParam[] = (images ?? [])
    .slice(0, 3)
    .map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } }));
  content.push({
    type: "text",
    text: `${content.length ? "На фото — продукты пользователя (холодильник, полка или стол)." : "Список продуктов пользователя:"}${text ? ` ${String(text).slice(0, 600)}` : ""}

Определи продукты и предложи 4–6 блюд, которые можно приготовить в основном из них.

${foodProfile(profile)}
Цель: ${GOALS[profile.goal]}. Ориентир: ${plan.calories} ккал, белок ${plan.protein} г в день.
${trainingToday === undefined ? "" : trainingToday ? "Сегодня день тренировки: нужны блюда до тренировки (углеводы, немного белка, мало жира) и после (белок + углеводы)." : "Сегодня день отдыха: больше белка и овощей, умеренно углеводов."}

Правила:
- У каждого блюда укажи purpose (pre_workout, post_workout, rest_day или any) и почему оно подходит.
- Строго исключи аллергены и нелюбимые продукты; сомнительные по составу — в clarify.
- missing — только если не хватает 1–3 простых продуктов.
- Калорийность приблизительная, на порцию; количество ингредиентов — на ${profile.household ?? 1} чел.`,
  });
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(PantrySchema) },
      system: COACH_SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      res.status(422).json({ error: "refused" });
      return;
    }
    res.json(response.parsed_output);
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/chat", async (req, res) => {
  const { profile, messages, log } = req.body as { profile: Profile; messages: ChatMessage[]; log?: string };
  const history: Anthropic.Beta.BetaMessageParam[] = messages
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  let headersSent = false;
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      ...FALLBACK,
      output_config: { effort: "low" },
      system: [
        { type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: `Профиль пользователя:\n${describe(profile)}\n${foodProfile(profile)}${log ? `\n\nПоследние тренировки:\n${String(log).slice(0, 3000)}` : ""}`,
        },
      ],
      messages: history,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        if (!headersSent) {
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
          headersSent = true;
        }
        res.write(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (!headersSent) {
      if (final.stop_reason === "refusal") {
        res.status(422).json({ error: "refused" });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end();
  } catch (err) {
    if (headersSent) res.end();
    else sendError(res, err);
  }
});

// Production: serve the built PWA from the same origin.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`Parri Fit API on http://localhost:${port}`));
