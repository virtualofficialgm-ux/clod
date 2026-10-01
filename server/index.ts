import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import express, { type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computePlan, ageFrom } from "../shared/nutrition";
import { MealSchema, ProgramSchema, type ChatMessage, type Profile } from "../shared/types";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
// Re-runs a request declined by safety classifiers on Anthropic's recommended fallback model.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

const client = new Anthropic();
const app = express();
app.use(express.json({ limit: "12mb" }));

const GOALS = { lose: "снизить вес", maintain: "поддерживать вес и форму", gain: "набрать мышечную массу" };
const PLACES = { gym: "в зале", home: "дома", outdoor: "на улице" };

function describe(p: Profile): string {
  const plan = computePlan(p);
  return [
    `Имя: ${p.name || "не указано"}`,
    `Пол: ${p.gender}, возраст: ${ageFrom(p.birthDate)}`,
    `Рост: ${p.heightCm} см, вес: ${p.weightKg} кг, цель по весу: ${p.targetWeightKg} кг`,
    `Цель: ${GOALS[p.goal]}, темп: ${p.weeklyRateKg} кг/нед`,
    `Тренировок в неделю: ${p.workoutsPerWeek}, уровень: ${p.experience}, где: ${PLACES[p.place]}`,
    `Инвентарь: ${p.equipment.join(", ") || "нет"}`,
    `Питание: ${p.diet}; что мешает: ${p.obstacles.join(", ") || "—"}; хочет: ${p.accomplishments.join(", ") || "—"}`,
    `Норма: ${plan.calories} ккал, Б ${plan.protein} г, У ${plan.carbs} г, Ж ${plan.fat} г, вода ${plan.waterMl} мл`,
  ].join("\n");
}

const COACH_SYSTEM = `Ты — Pulse, персональный ИИ-тренер и нутрициолог в мобильном приложении.
Отвечай на русском, дружелюбно и по делу, как опытный тренер. Опирайся на доказательную спортивную науку.
Пиши коротко: мобильный экран, 2–6 абзацев или компактный список. Без таблиц и заголовков крупнее жирного текста.
Если вопрос касается боли, травмы, болезни, беременности или лекарств — дай общую безопасную информацию и посоветуй обратиться к врачу.
Не ставь диагнозы. Не советуй экстремальные дефициты калорий (ниже 1200 ккал) и запрещённые препараты.`;

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

Требования:
- Ровно ${Math.max(1, Math.min(7, profile.workoutsPerWeek))} тренировочных дней (days), учитывая место и инвентарь.
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

app.post("/api/chat", async (req, res) => {
  const { profile, messages } = req.body as { profile: Profile; messages: ChatMessage[] };
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
        { type: "text", text: `Профиль пользователя:\n${describe(profile)}` },
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
app.listen(port, () => console.log(`Pulse API on http://localhost:${port}`));
