import {
  Apple, ArrowLeft, Bell, Building2, Check, Dumbbell, Flame, Heart, Home, Leaf, Mail, Moon, Rabbit,
  Salad, Sparkles, Sprout, Sun, Target, Trees, TrendingDown, TrendingUp, Turtle, Utensils, Zap, Fish, Minus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computePlan } from "../../shared/nutrition";
import type { Profile, Program } from "../../shared/types";
import { generateProgram } from "../api";
import { Wheel, Ruler } from "../components/pickers";
import { Ambient, Ring, Segmented, Sheet, haptic, toast } from "../components/ui";
import { getState, hash, setState, today, type Account, type UserData } from "../store";

type StepId =
  | "welcome" | "gender" | "workouts" | "source" | "experience" | "tried" | "longterm" | "body" | "birth"
  | "goal" | "target" | "realistic" | "speed" | "twice" | "place" | "equipment" | "obstacles" | "diet"
  | "accomplish" | "potential" | "notify" | "thanks" | "loading" | "result" | "account";

const DEFAULT: Profile = {
  name: "",
  gender: "male",
  birthDate: "2000-01-01",
  heightCm: 175,
  weightKg: 75,
  goal: "lose",
  targetWeightKg: 70,
  weeklyRateKg: 0.8,
  workoutsPerWeek: 3,
  experience: "beginner",
  place: "gym",
  equipment: [],
  obstacles: [],
  accomplishments: [],
  diet: "classic",
  source: "",
  units: "metric",
};

let pendingProgram: Promise<{ data: Program; ai: boolean }> | null = null;

export default function Onboarding() {
  const [p, setP] = useState<Profile>(DEFAULT);
  const [tried, setTried] = useState<boolean | null>(null);
  const [history, setHistory] = useState<StepId[]>(["welcome"]);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [signIn, setSignIn] = useState(false);
  const step = history[history.length - 1];
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));

  const flow = useMemo<StepId[]>(() => {
    const f: StepId[] = ["welcome", "gender", "workouts", "source", "experience", "tried", "longterm", "body", "birth", "goal"];
    if (p.goal !== "maintain") f.push("target", "realistic", "speed", "twice");
    f.push("place");
    if (p.place !== "gym") f.push("equipment");
    f.push("obstacles", "diet", "accomplish", "potential", "notify", "thanks", "loading", "result", "account");
    return f;
  }, [p.goal, p.place]);

  const next = () => {
    haptic();
    const i = flow.indexOf(step);
    setDir("fwd");
    setHistory((h) => [...h, flow[Math.min(flow.length - 1, i + 1)]]);
  };
  const back = () => {
    setDir("back");
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  };

  const progress = Math.max(0, flow.indexOf(step)) / (flow.indexOf("thanks") || 1);
  const diffKg = Math.abs(p.targetWeightKg - p.weightKg);

  if (step === "welcome") {
    return (
      <div className="ob">
        <Ambient />
        <div className="ob-body center" style={{ alignItems: "center", textAlign: "center" }}>
          <WelcomeHero />
          <h1 style={{ fontSize: 38, marginTop: 36 }}>Тренировки и питание с ИИ</h1>
          <p className="sub" style={{ maxWidth: 300 }}>Персональный план, подсчёт калорий по фото и тренер в кармане 24/7</p>
        </div>
        <div className="ob-foot">
          <button className="btn btn-primary" onClick={next}>Начать</button>
          <p className="caption" style={{ textAlign: "center", marginTop: 14, fontSize: 15 }}>
            Уже есть аккаунт?{" "}
            <button style={{ fontWeight: 700, color: "var(--label)" }} onClick={() => setSignIn(true)}>Войти</button>
          </p>
        </div>
        {signIn && <AuthSheet mode="signin" onClose={() => setSignIn(false)} />}
      </div>
    );
  }

  if (step === "loading") return <Loading profile={p} onDone={next} />;
  if (step === "result") return <Result profile={p} onNext={next} />;
  if (step === "account") return <AccountStep profile={p} onBack={back} />;

  const screens: Record<string, { title: string; sub?: string; body: ReactNode; ok?: boolean; cta?: string; center?: boolean }> = {
    gender: {
      title: "Выберите ваш пол",
      sub: "Это нужно для расчёта персонального плана.",
      ok: true,
      center: true,
      body: (
        <Options
          value={p.gender}
          onChange={(v) => set({ gender: v })}
          options={[
            { value: "male", label: "Мужской" },
            { value: "female", label: "Женский" },
            { value: "other", label: "Другой" },
          ]}
        />
      ),
    },
    workouts: {
      title: "Сколько тренировок в неделю вы делаете?",
      sub: "Это поможет точнее рассчитать энергозатраты.",
      ok: true,
      center: true,
      body: (
        <Options
          value={String(p.workoutsPerWeek <= 2 ? 2 : p.workoutsPerWeek <= 5 ? 4 : 6)}
          onChange={(v) => set({ workoutsPerWeek: Number(v) })}
          options={[
            { value: "2", label: "0–2", hint: "Изредка", icon: <Dot n={1} /> },
            { value: "4", label: "3–5", hint: "Несколько раз в неделю", icon: <Dot n={2} /> },
            { value: "6", label: "6+", hint: "Атлет", icon: <Dot n={3} /> },
          ]}
        />
      ),
    },
    source: {
      title: "Откуда вы о нас узнали?",
      ok: !!p.source,
      body: (
        <Options
          value={p.source}
          onChange={(v) => set({ source: v })}
          options={["Instagram", "TikTok", "YouTube", "Telegram", "App Store", "Google", "Друзья или семья", "Другое"].map((s) => ({ value: s, label: s }))}
        />
      ),
    },
    experience: {
      title: "Какой у вас опыт тренировок?",
      sub: "Программа будет соответствовать вашему уровню.",
      ok: true,
      center: true,
      body: (
        <Options
          value={p.experience}
          onChange={(v) => set({ experience: v })}
          options={[
            { value: "beginner", label: "Новичок", hint: "Меньше 6 месяцев", icon: <Sprout size={20} /> },
            { value: "intermediate", label: "Средний", hint: "6 месяцев – 2 года", icon: <Dumbbell size={20} /> },
            { value: "advanced", label: "Продвинутый", hint: "Больше 2 лет", icon: <Flame size={20} /> },
          ]}
        />
      ),
    },
    tried: {
      title: "Вы пробовали другие фитнес-приложения?",
      ok: tried !== null,
      center: true,
      body: (
        <Options
          value={tried === null ? "" : tried ? "yes" : "no"}
          onChange={(v) => setTried(v === "yes")}
          options={[
            { value: "yes", label: "Да", icon: <Check size={20} /> },
            { value: "no", label: "Нет", icon: <Minus size={20} /> },
          ]}
        />
      ),
    },
    longterm: {
      title: "Parri Fit даёт долгосрочный результат",
      ok: true,
      center: true,
      body: <LongTermChart />,
    },
    body: {
      title: "Рост и вес",
      sub: "Это нужно для расчёта вашего плана.",
      ok: true,
      center: true,
      body: <BodyPicker p={p} set={set} />,
    },
    birth: {
      title: "Когда вы родились?",
      sub: "Возраст влияет на расчёт обмена веществ.",
      ok: true,
      center: true,
      body: <BirthPicker value={p.birthDate} onChange={(birthDate) => set({ birthDate })} />,
    },
    goal: {
      title: "Какая у вас цель?",
      sub: "Мы подстроим план под неё.",
      ok: true,
      center: true,
      body: (
        <Options
          value={p.goal}
          onChange={(goal) =>
            set({
              goal,
              targetWeightKg: goal === "lose" ? Math.round(p.weightKg * 0.92) : goal === "gain" ? Math.round(p.weightKg * 1.06) : p.weightKg,
              weeklyRateKg: goal === "gain" ? 0.3 : goal === "lose" ? 0.8 : 0,
            })
          }
          options={[
            { value: "lose", label: "Похудеть", icon: <TrendingDown size={20} /> },
            { value: "maintain", label: "Поддерживать форму", icon: <Target size={20} /> },
            { value: "gain", label: "Набрать мышечную массу", icon: <TrendingUp size={20} /> },
          ]}
        />
      ),
    },
    target: {
      title: "Какой вес вы хотите?",
      ok: (p.goal === "lose" && p.targetWeightKg < p.weightKg) || (p.goal === "gain" && p.targetWeightKg > p.weightKg),
      center: true,
      body: (
        <div style={{ textAlign: "center" }}>
          <div className="caption" style={{ fontSize: 15 }}>{p.goal === "lose" ? "Похудеть" : "Набрать"}</div>
          <div className="big-num" style={{ fontSize: 56, margin: "10px 0 26px" }}>
            {fmtW(p.targetWeightKg, p.units)}
          </div>
          <Ruler
            min={p.goal === "lose" ? 35 : Math.round(p.weightKg)}
            max={p.goal === "lose" ? Math.round(p.weightKg) : 200}
            value={p.targetWeightKg}
            onChange={(targetWeightKg) => set({ targetWeightKg })}
          />
        </div>
      ),
    },
    realistic: {
      title: "",
      ok: true,
      center: true,
      cta: "Продолжить",
      body: (
        <div style={{ textAlign: "center" }} className="fade-in">
          <h1 style={{ marginTop: 0 }}>
            {p.goal === "lose" ? "Сбросить" : "Набрать"}{" "}
            <span style={{ color: "var(--orange)" }}>{fmtW(diffKg, p.units)}</span> — реалистичная цель. Это вполне по силам!
          </h1>
          <p className="sub">90% пользователей отмечают заметный результат уже через месяц с Parri Fit — и легко его удерживают.</p>
        </div>
      ),
    },
    speed: {
      title: "Как быстро вы хотите достичь цели?",
      ok: true,
      center: true,
      body: <SpeedPicker p={p} set={set} />,
    },
    twice: {
      title: `${p.goal === "lose" ? "Худейте" : "Растите"} в 2 раза эффективнее с Parri Fit`,
      ok: true,
      center: true,
      body: <TwiceChart goal={p.goal} />,
    },
    place: {
      title: "Где вы будете тренироваться?",
      sub: "ИИ подберёт упражнения под условия.",
      ok: true,
      center: true,
      body: (
        <Options
          value={p.place}
          onChange={(place) => set({ place })}
          options={[
            { value: "gym", label: "В зале", hint: "Тренажёры и свободные веса", icon: <Building2 size={20} /> },
            { value: "home", label: "Дома", hint: "Свой вес и минимум инвентаря", icon: <Home size={20} /> },
            { value: "outdoor", label: "На улице", hint: "Бег, турники, брусья", icon: <Trees size={20} /> },
          ]}
        />
      ),
    },
    equipment: {
      title: "Какой инвентарь у вас есть?",
      sub: "Можно выбрать несколько вариантов.",
      ok: true,
      body: (
        <Multi
          value={p.equipment}
          onChange={(equipment) => set({ equipment })}
          options={["Гантели", "Гиря", "Фитнес-резинки", "Турник", "Брусья", "Коврик", "Скакалка", "Велотренажёр"]}
        />
      ),
    },
    obstacles: {
      title: "Что мешает вам достичь цели?",
      ok: p.obstacles.length > 0,
      body: (
        <Multi
          value={p.obstacles}
          onChange={(obstacles) => set({ obstacles })}
          options={[
            ["Нет регулярности", <Zap size={20} key="z" />],
            ["Нездоровые пищевые привычки", <Utensils size={20} key="u" />],
            ["Нет поддержки", <Heart size={20} key="h" />],
            ["Мало времени", <Sun size={20} key="s" />],
            ["Не знаю, с чего начать", <Sparkles size={20} key="sp" />],
          ]}
        />
      ),
    },
    diet: {
      title: "Вы придерживаетесь какой-то диеты?",
      ok: true,
      center: true,
      body: (
        <Options
          value={p.diet}
          onChange={(diet) => set({ diet })}
          options={[
            { value: "classic", label: "Обычное питание", icon: <Utensils size={20} /> },
            { value: "pescatarian", label: "Пескетарианство", icon: <Fish size={20} /> },
            { value: "vegetarian", label: "Вегетарианство", icon: <Salad size={20} /> },
            { value: "vegan", label: "Веганство", icon: <Leaf size={20} /> },
          ]}
        />
      ),
    },
    accomplish: {
      title: "Чего бы вы хотели добиться?",
      ok: p.accomplishments.length > 0,
      body: (
        <Multi
          value={p.accomplishments}
          onChange={(accomplishments) => set({ accomplishments })}
          options={[
            ["Питаться здоровее", <Apple size={20} key="a" />],
            ["Больше энергии и лучше настроение", <Sun size={20} key="s" />],
            ["Стать сильнее и выносливее", <Dumbbell size={20} key="d" />],
            ["Уверенность в своём теле", <Sparkles size={20} key="sp" />],
            ["Лучше спать", <Moon size={20} key="m" />],
          ]}
        />
      ),
    },
    potential: {
      title: "У вас отличный потенциал, чтобы достичь цели",
      ok: true,
      center: true,
      body: <PotentialChart />,
    },
    notify: {
      title: "Достигайте целей с напоминаниями",
      ok: true,
      center: true,
      cta: "Продолжить",
      body: <NotifyMock />,
    },
    thanks: {
      title: "",
      ok: true,
      center: true,
      cta: "Создать мой план",
      body: (
        <div style={{ textAlign: "center" }} className="fade-in">
          <div className="glass" style={{ width: 150, height: 150, borderRadius: "50%", margin: "0 auto 30px", display: "grid", placeItems: "center" }}>
            <Heart size={64} fill="var(--pink)" color="var(--pink)" />
          </div>
          <div className="caption" style={{ fontSize: 15 }}>Всё готово!</div>
          <h1 style={{ marginTop: 8 }}>Спасибо, что доверяете нам</h1>
          <p className="sub">Теперь подготовим для вас персональный план питания и тренировок…</p>
          <div className="glass card" style={{ marginTop: 30, textAlign: "left", display: "flex", gap: 12 }}>
            <span className="icon-tile" style={{ background: "var(--fill)", color: "var(--label)" }}>🔒</span>
            <span>
              <b>Ваша приватность важна</b>
              <div className="caption">Данные хранятся на вашем устройстве. ИИ получает только то, что нужно для ответа.</div>
            </span>
          </div>
        </div>
      ),
    },
  };

  const s = screens[step];
  return (
    <div className="ob">
      <Ambient />
      <div className="ob-head">
        <button className="circle-btn glass" onClick={back} aria-label="Назад">
          <ArrowLeft size={22} />
        </button>
        <div className="ob-progress">
          <i style={{ width: `${Math.min(1, progress) * 100}%` }} />
        </div>
      </div>
      <div key={step} className={`ob-step ${dir === "back" ? "back" : ""}`}>
        {s.title && <h1>{s.title}</h1>}
        {s.sub && <p className="sub">{s.sub}</p>}
        <div className={`ob-body ${s.center ? "center" : ""}`}>{s.body}</div>
      </div>
      <div className="ob-foot">
        <button
          className="btn btn-primary"
          disabled={!s.ok}
          onClick={() => {
            if (step === "notify" && "Notification" in window && Notification.permission === "default") {
              Notification.requestPermission().catch(() => undefined);
            }
            if (step === "thanks") pendingProgram = generateProgram(p);
            next();
          }}
        >
          {s.cta ?? "Далее"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- building blocks ---------------- */

function Options<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string; icon?: ReactNode }[];
}) {
  return (
    <div>
      {options.map((o) => (
        <button key={o.value} className={`option ${value === o.value ? "on" : ""}`} onClick={() => (haptic(), onChange(o.value))}>
          {o.icon && <span className="opt-icon">{o.icon}</span>}
          <span>
            {o.label}
            {o.hint && <small>{o.hint}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}

function Multi({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: (string | [string, ReactNode])[];
}) {
  return (
    <div>
      {options.map((o) => {
        const [label, icon] = typeof o === "string" ? [o, null] : o;
        const on = value.includes(label);
        return (
          <button
            key={label}
            className={`option ${on ? "on" : ""}`}
            onClick={() => (haptic(), onChange(on ? value.filter((v) => v !== label) : [...value, label]))}
          >
            {icon && <span className="opt-icon">{icon}</span>}
            <span style={{ flex: 1 }}>{label}</span>
            {on && <Check size={20} />}
          </button>
        );
      })}
    </div>
  );
}

function Dot({ n }: { n: number }) {
  return (
    <span style={{ display: "grid", gap: 3, gridTemplateColumns: n > 1 ? "1fr 1fr" : "1fr" }}>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ width: 6, height: 6, borderRadius: 3, background: "currentColor", display: "block" }} />
      ))}
    </span>
  );
}

export function fmtW(kg: number, units: Profile["units"]) {
  return units === "imperial" ? `${Math.round(kg * 2.20462)} lb` : `${(Math.round(kg * 10) / 10).toString().replace(".", ",")} кг`;
}

function BodyPicker({ p, set }: { p: Profile; set: (x: Partial<Profile>) => void }) {
  const cm = range(120, 220);
  const kg = range(35, 200);
  const ft = range(3, 7);
  const inch = range(0, 11);
  const lb = range(80, 440);
  const totalIn = Math.round(p.heightCm / 2.54);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
        <div style={{ width: 240 }}>
          <Segmented
            value={p.units}
            onChange={(units) => set({ units })}
            options={[
              { value: "imperial", label: "Imperial" },
              { value: "metric", label: "Метрическая" },
            ]}
          />
        </div>
      </div>
      <div className="row" style={{ justifyContent: "space-around", fontWeight: 600, marginBottom: 8 }}>
        <span>Рост</span>
        <span>Вес</span>
      </div>
      {p.units === "metric" ? (
        <div className="wheels">
          <Wheel items={cm} value={Math.round(p.heightCm)} onChange={(heightCm) => set({ heightCm })} format={(v) => `${v} см`} />
          <Wheel items={kg} value={Math.round(p.weightKg)} onChange={(weightKg) => set({ weightKg })} format={(v) => `${v} кг`} />
        </div>
      ) : (
        <div className="wheels">
          <Wheel items={ft} value={Math.floor(totalIn / 12)} onChange={(f) => set({ heightCm: Math.round((f * 12 + (totalIn % 12)) * 2.54) })} format={(v) => `${v} ft`} />
          <Wheel items={inch} value={totalIn % 12} onChange={(i) => set({ heightCm: Math.round((Math.floor(totalIn / 12) * 12 + i) * 2.54) })} format={(v) => `${v} in`} />
          <Wheel items={lb} value={Math.round(p.weightKg * 2.20462)} onChange={(l) => set({ weightKg: Math.round((l / 2.20462) * 10) / 10 })} format={(v) => `${v} lb`} />
        </div>
      )}
    </div>
  );
}

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function BirthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [y, m, d] = value.split("-").map(Number);
  const year = new Date().getFullYear();
  const days = range(1, new Date(y, m, 0).getDate());
  const emit = (Y: number, M: number, D: number) => {
    const max = new Date(Y, M, 0).getDate();
    onChange(`${Y}-${String(M).padStart(2, "0")}-${String(Math.min(D, max)).padStart(2, "0")}`);
  };
  return (
    <div className="wheels">
      <Wheel items={range(1, 12)} value={m} onChange={(M) => emit(y, M, d)} format={(v) => MONTHS[v - 1]} />
      <Wheel items={days} value={d} onChange={(D) => emit(y, m, D)} />
      <Wheel items={range(year - 90, year - 13)} value={y} onChange={(Y) => emit(Y, m, d)} />
    </div>
  );
}

function SpeedPicker({ p, set }: { p: Profile; set: (x: Partial<Profile>) => void }) {
  const max = p.goal === "gain" ? 0.7 : 1.5;
  const v = p.weeklyRateKg;
  const level = v < max * 0.35 ? 0 : v < max * 0.75 ? 1 : 2;
  const icons = [<Turtle key="t" size={30} />, <Rabbit key="r" size={30} />, <Zap key="z" size={30} />];
  const notes = ["Медленно и стабильно", "Рекомендуемый темп", "Быстро — может быть тяжело"];
  return (
    <div style={{ textAlign: "center" }}>
      <div className="caption" style={{ fontSize: 15 }}>
        {p.goal === "lose" ? "Скорость снижения веса в неделю" : "Скорость набора веса в неделю"}
      </div>
      <div className="big-num" style={{ margin: "10px 0 30px" }}>
        {fmtW(v, p.units)}
      </div>
      <div className="row" style={{ justifyContent: "space-between", padding: "0 6px", marginBottom: 16 }}>
        {icons.map((ic, i) => (
          <span key={i} style={{ color: i === level ? "var(--orange)" : "var(--label-3)", transition: "color .3s, transform .3s", transform: i === level ? "scale(1.2)" : "none" }}>
            {ic}
          </span>
        ))}
      </div>
      <input
        className="slider"
        type="range"
        min={0.1}
        max={max}
        step={0.1}
        value={v}
        onChange={(e) => (haptic(3), set({ weeklyRateKg: Number(e.target.value) }))}
      />
      <div className="row caption" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <span>{fmtW(0.1, p.units)}</span>
        <span>{fmtW(max / 2, p.units)}</span>
        <span>{fmtW(max, p.units)}</span>
      </div>
      <div className="glass card" style={{ marginTop: 28, padding: 14, fontWeight: 600 }}>{notes[level]}</div>
    </div>
  );
}

function LongTermChart() {
  return (
    <div className="glass card fade-in">
      <div style={{ fontWeight: 600, marginBottom: 12 }}>Ваш вес</div>
      <svg viewBox="0 0 300 160" width="100%">
        <path d="M10 40 C 80 45, 110 120, 150 120 S 230 50, 290 30" fill="none" stroke="var(--red)" strokeWidth="3" strokeLinecap="round" />
        <path d="M10 40 C 80 50, 140 110, 290 128" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M10 40 C 80 50, 140 110, 290 128 L290 160 L10 160 Z" fill="var(--fill)" />
        <circle cx="10" cy="40" r="6" fill="var(--bg-elevated)" stroke="var(--ink)" strokeWidth="3" />
        <circle cx="290" cy="128" r="6" fill="var(--bg-elevated)" stroke="var(--ink)" strokeWidth="3" />
        <text x="200" y="26" fontSize="12" fill="var(--red)">Обычная диета</text>
        <text x="16" y="150" fontSize="12" fill="var(--label-2)">Месяц 1</text>
        <text x="236" y="150" fontSize="12" fill="var(--label-2)">Месяц 6</text>
      </svg>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <span className="badge" style={{ background: "var(--ink)", color: "var(--on-ink)" }}>Parri Fit</span>
        <span className="caption">80% пользователей Parri Fit сохраняют результат даже через 6 месяцев</span>
      </div>
    </div>
  );
}

function TwiceChart({ goal }: { goal: Profile["goal"] }) {
  return (
    <div className="glass card fade-in">
      <div className="grid-2" style={{ alignItems: "end", height: 220, padding: "0 10px" }}>
        {[
          { label: "Без Parri Fit", h: 30, v: "20%", ink: false },
          { label: "С Parri Fit", h: 70, v: "2X", ink: true },
        ].map((b) => (
          <div key={b.label} style={{ textAlign: "center", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>{b.label}</div>
            <div
              style={{
                height: `${b.h}%`,
                borderRadius: 18,
                background: b.ink ? "var(--ink)" : "var(--fill-2)",
                color: b.ink ? "var(--on-ink)" : "var(--label)",
                display: "grid",
                placeItems: "end center",
                paddingBottom: 14,
                fontWeight: 700,
                fontSize: 20,
                animation: "rise .8s var(--ease) both",
              }}
            >
              {b.v}
            </div>
          </div>
        ))}
      </div>
      <p className="caption" style={{ textAlign: "center", marginTop: 16, fontSize: 15 }}>
        Parri Fit помогает {goal === "lose" ? "худеть" : "прогрессировать"} легче и держит вас в тонусе.
      </p>
    </div>
  );
}

function PotentialChart() {
  return (
    <div className="glass card fade-in">
      <div style={{ fontWeight: 600 }}>Динамика результата</div>
      <svg viewBox="0 0 300 170" width="100%" style={{ marginTop: 10 }}>
        <defs>
          <linearGradient id="pg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--orange)" stopOpacity=".45" />
            <stop offset="1" stopColor="var(--orange)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M20 140 C 70 138, 90 120, 120 112 S 200 60, 280 22 L280 150 L20 150 Z" fill="url(#pg)" />
        <path d="M20 140 C 70 138, 90 120, 120 112 S 200 60, 280 22" fill="none" stroke="var(--orange)" strokeWidth="3.5" strokeLinecap="round" />
        {[
          [20, 140],
          [120, 112],
          [200, 70],
          [280, 22],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="6" fill="var(--bg-elevated)" stroke="var(--orange)" strokeWidth="3" />
        ))}
        <text x="10" y="166" fontSize="12" fill="var(--label-2)">3 дня</text>
        <text x="106" y="166" fontSize="12" fill="var(--label-2)">7 дней</text>
        <text x="236" y="166" fontSize="12" fill="var(--label-2)">30 дней</text>
      </svg>
      <p className="caption" style={{ fontSize: 15, marginTop: 10 }}>
        Исходя из данных, результаты обычно приходят с задержкой, но после 7 дней вы начнёте замечать прогресс!
      </p>
    </div>
  );
}

function NotifyMock() {
  return (
    <div className="fade-in" style={{ display: "grid", placeItems: "center" }}>
      <div className="glass strong" style={{ width: 280, borderRadius: 28, overflow: "hidden", textAlign: "center" }}>
        <div style={{ padding: "22px 18px 16px" }}>
          <Bell size={28} style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 600, fontSize: 17 }}>Parri Fit хочет отправлять вам уведомления</div>
          <div className="caption" style={{ marginTop: 6 }}>Напоминания о тренировках, воде и приёмах пищи</div>
        </div>
        <div className="grid-2" style={{ gap: 0, borderTop: "0.5px solid var(--separator)" }}>
          <div style={{ padding: 14, color: "var(--label-2)", borderRight: "0.5px solid var(--separator)" }}>Не разрешать</div>
          <div style={{ padding: 14, fontWeight: 600, background: "var(--ink)", color: "var(--on-ink)" }}>Разрешить</div>
        </div>
      </div>
      <div style={{ fontSize: 40, marginTop: 14, animation: "rise .8s var(--spring) both" }}>👆</div>
    </div>
  );
}

function WelcomeHero() {
  return (
    <div style={{ position: "relative", width: 250, height: 300 }}>
      <div className="glass strong" style={{ position: "absolute", inset: 0, borderRadius: 44, padding: 22, textAlign: "left", transform: "rotate(-4deg)", animation: "rise .8s var(--ease) both" }}>
        <div className="caption">Сегодня</div>
        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <div className="big-num" style={{ fontSize: 36 }}>1 840</div>
            <div className="caption">ккал осталось</div>
          </div>
          <div className="spacer" />
          <Ring value={0.62} size={74} stroke={8}>
            <Flame size={22} />
          </Ring>
        </div>
        <div className="grid-3" style={{ marginTop: 16, gap: 6 }}>
          {[
            ["Белки", "var(--protein)", 0.7],
            ["Углев.", "var(--carbs)", 0.45],
            ["Жиры", "var(--fat)", 0.55],
          ].map(([l, c, v]) => (
            <div key={l as string} style={{ textAlign: "center" }}>
              <Ring value={v as number} size={52} stroke={6} color={c as string} />
              <div className="caption" style={{ fontSize: 11, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
        <div className="glass" style={{ marginTop: 16, borderRadius: 18, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <span className="icon-tile" style={{ background: "var(--orange)" }}>
            <Dumbbell size={18} />
          </span>
          <div style={{ fontSize: 13 }}>
            <b>Верх тела</b>
            <div className="caption" style={{ fontSize: 12 }}>45 мин · 6 упражнений</div>
          </div>
        </div>
      </div>
      <div className="glass strong" style={{ position: "absolute", right: -30, bottom: -14, borderRadius: 22, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center", animation: "rise .8s .2s var(--spring) both" }}>
        <Sparkles size={18} color="var(--purple)" />
        <b style={{ fontSize: 14 }}>ИИ-тренер</b>
      </div>
    </div>
  );
}

function Loading({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const done = useRef(false);
  const cb = useRef(onDone);
  cb.current = onDone;
  useEffect(() => {
    const start = performance.now();
    const DURATION = 6500;
    let raf = 0;
    const tick = (t: number) => {
      const x = Math.min(1, (t - start) / DURATION);
      const eased = 1 - Math.pow(1 - x, 2.2);
      setPct(Math.round(eased * 100));
      if (x < 1) raf = requestAnimationFrame(tick);
      else if (!done.current) {
        done.current = true;
        setTimeout(() => cb.current(), 500);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const items = ["Калории", "Углеводы", "Белки", "Жиры", "Индекс здоровья", "Программа тренировок"];
  const stage = pct < 25 ? "Применяем BMR-формулу…" : pct < 55 ? "Рассчитываем БЖУ…" : pct < 85 ? "ИИ составляет тренировки…" : "Завершаем результаты…";
  return (
    <div className="ob">
      <Ambient />
      <div className="ob-body center" style={{ textAlign: "center" }}>
        <div className="big-num" style={{ fontSize: 72 }}>{pct}%</div>
        <h1 style={{ fontSize: 26, marginTop: 14 }}>Мы готовим всё для вас</h1>
        <div className="bar" style={{ height: 8, margin: "18px 10px 10px" }}>
          <i style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--red), var(--purple), var(--blue))" }} />
        </div>
        <div className="caption" style={{ fontSize: 15 }}>{stage}</div>
        <div className="glass card" style={{ marginTop: 34, textAlign: "left" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Рекомендации на день для {profile.name || "вас"}</div>
          {items.map((it, i) => {
            const ok = pct >= ((i + 1) / items.length) * 100 - 4;
            return (
              <div key={it} className="row" style={{ padding: "5px 0", color: ok ? "var(--label)" : "var(--label-3)", transition: "color .3s" }}>
                <span>• {it}</span>
                <span className="spacer" />
                {ok ? <Check size={18} /> : <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Result({ profile, onNext }: { profile: Profile; onNext: () => void }) {
  const plan = computePlan(profile);
  const date = new Date(plan.targetDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const tiles = [
    { label: "Калории", v: plan.calories, unit: "", color: "var(--ink)", icon: <Flame size={16} /> },
    { label: "Углеводы", v: plan.carbs, unit: "г", color: "var(--carbs)", icon: "🌾" },
    { label: "Белки", v: plan.protein, unit: "г", color: "var(--protein)", icon: "🍗" },
    { label: "Жиры", v: plan.fat, unit: "г", color: "var(--fat)", icon: "🥑" },
  ];
  return (
    <div className="ob">
      <Ambient />
      <div className="ob-body stagger" style={{ paddingTop: 30 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--ink)", color: "var(--on-ink)", display: "grid", placeItems: "center", margin: "0 auto" }}>
            <Check size={24} />
          </div>
          <h1 style={{ fontSize: 30 }}>Поздравляем, ваш персональный план готов!</h1>
          {profile.goal !== "maintain" && (
            <>
              <div style={{ fontWeight: 600, marginTop: 14 }}>Вы должны {profile.goal === "lose" ? "сбросить" : "набрать"}:</div>
              <div className="glass" style={{ display: "inline-block", marginTop: 10, padding: "8px 16px", borderRadius: 20, fontWeight: 600 }}>
                {fmtW(Math.abs(profile.targetWeightKg - profile.weightKg), profile.units)} к {date}
              </div>
            </>
          )}
        </div>
        <div className="glass card" style={{ marginTop: 26 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Рекомендация на день</div>
          <div className="caption">Вы можете изменить это в любое время</div>
          <div className="grid-2" style={{ marginTop: 14 }}>
            {tiles.map((t, i) => (
              <div key={t.label} className="glass" style={{ borderRadius: 20, padding: 14 }}>
                <div className="row" style={{ gap: 6, fontWeight: 600, fontSize: 15 }}>
                  <span>{t.icon}</span>
                  {t.label}
                </div>
                <div style={{ display: "grid", placeItems: "center", marginTop: 8 }}>
                  <Ring value={0.55 + i * 0.1} size={92} stroke={8} color={t.color}>
                    <span className="mid-num">
                      {t.v}
                      <span style={{ fontSize: 14 }}>{t.unit}</span>
                    </span>
                  </Ring>
                </div>
              </div>
            ))}
          </div>
          <div className="glass" style={{ borderRadius: 20, padding: 14, marginTop: 12 }}>
            <div className="row">
              <span className="icon-tile" style={{ background: "var(--pink)" }}>
                <Heart size={18} />
              </span>
              <b>Индекс здоровья</b>
              <span className="spacer" />
              <b>{plan.healthScore}/10</b>
            </div>
            <div className="bar" style={{ marginTop: 10 }}>
              <i style={{ width: `${plan.healthScore * 10}%`, background: "var(--green)" }} />
            </div>
          </div>
        </div>
        <div className="glass card" style={{ marginTop: 12 }}>
          <b>Как достичь цели:</b>
          {[
            ["💪", "Следуйте программе тренировок от ИИ"],
            ["📸", "Фотографируйте еду — ИИ посчитает калории"],
            ["🥩", `Ешьте ${plan.protein} г белка в день`],
            ["💧", `Пейте ${(plan.waterMl / 1000).toFixed(1).replace(".", ",")} л воды`],
          ].map(([e, t]) => (
            <div key={t} className="row" style={{ marginTop: 10 }}>
              <span style={{ fontSize: 22 }}>{e}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ob-foot">
        <button className="btn btn-primary" onClick={onNext}>Начнём!</button>
      </div>
    </div>
  );
}

function AccountStep({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  return (
    <div className="ob">
      <Ambient />
      <div className="ob-head">
        <button className="circle-btn glass" onClick={onBack} aria-label="Назад">
          <ArrowLeft size={22} />
        </button>
        <div className="ob-progress">
          <i style={{ width: "100%" }} />
        </div>
      </div>
      <h1>Сохраните свой прогресс</h1>
      <p className="sub">Создайте аккаунт, чтобы план, тренировки и история питания всегда были с вами.</p>
      <AuthForm mode="signup" profile={profile} />
    </div>
  );
}

function AuthSheet({ mode, onClose }: { mode: "signin" | "signup"; onClose: () => void }) {
  return (
    <Sheet title={mode === "signin" ? "Вход" : "Регистрация"} onClose={onClose}>
      <AuthForm mode={mode} />
    </Sheet>
  );
}

function AuthForm({ mode, profile }: { mode: "signin" | "signup"; profile?: Profile }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState(profile?.name ?? "");
  const [emailMode, setEmailMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = (account: Account) => {
    const s = getState();
    if (mode === "signup") {
      if (!profile) return;
      const prof = { ...profile, name: account.name };
      const data: UserData = {
        profile: prof,
        plan: computePlan(prof),
        program: null,
        meals: [],
        workouts: [],
        weights: [{ date: today(), kg: prof.weightKg }],
        water: {},
        chat: [],
        createdAt: new Date().toISOString(),
      };
      setState((st) => ({ ...st, session: account.email, accounts: { ...st.accounts, [account.email]: account }, data: { ...st.data, [account.email]: data } }));
      const email = account.email;
      pendingProgram?.then(({ data: program }) =>
        setState((st) => (st.data[email] ? { ...st, data: { ...st.data, [email]: { ...st.data[email], program } } } : st)),
      );
      toast("Аккаунт создан 🎉");
    } else {
      if (!s.data[account.email]) {
        toast("Аккаунт не найден");
        return;
      }
      setState((st) => ({ ...st, session: account.email }));
    }
  };

  const social = (provider: "apple" | "google") => {
    haptic();
    const s = getState();
    if (mode === "signin") {
      const existing = Object.values(s.accounts).find((a) => a.provider === provider);
      if (!existing) {
        toast("Аккаунт не найден — пройдите регистрацию");
        return;
      }
      finish(existing);
      return;
    }
    if (!name.trim()) {
      toast("Введите имя");
      return;
    }
    // Local-only identity. Wire real OAuth (Sign in with Apple / Google Identity) here for production.
    finish({ email: `${provider}-${Date.now().toString(36)}@pulse.local`, name: name.trim(), provider });
  };

  const submitEmail = async () => {
    const key = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(key) || pass.length < 6) {
      toast("Проверьте email и пароль (от 6 символов)");
      return;
    }
    setBusy(true);
    const h = await hash(pass);
    setBusy(false);
    const s = getState();
    if (mode === "signin") {
      const acc = s.accounts[key];
      if (!acc || acc.passHash !== h) {
        toast("Неверный email или пароль");
        return;
      }
      finish(acc);
    } else {
      if (s.accounts[key]) {
        toast("Такой email уже зарегистрирован");
        return;
      }
      if (!name.trim()) {
        toast("Введите имя");
        return;
      }
      finish({ email: key, name: name.trim(), provider: "email", passHash: h });
    }
  };

  return (
    <div className="ob-body" style={{ justifyContent: "flex-end", padding: mode === "signin" ? "8px 0" : undefined }}>
      {mode === "signup" && (
        <input className="field" placeholder="Как вас зовут?" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 18 }} autoComplete="given-name" />
      )}
      {!emailMode ? (
        <div className="stack">
          <button className="btn btn-primary" onClick={() => social("apple")}>
            <AppleLogo /> {mode === "signin" ? "Войти" : "Продолжить"} с Apple
          </button>
          <button className="btn glass strong" onClick={() => social("google")}>
            <GoogleLogo /> {mode === "signin" ? "Войти" : "Продолжить"} с Google
          </button>
          <button className="btn glass strong" onClick={() => setEmailMode(true)}>
            <Mail size={20} /> {mode === "signin" ? "Войти" : "Продолжить"} с email
          </button>
        </div>
      ) : (
        <div className="stack fade-in">
          <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input
            className="field"
            type="password"
            placeholder="Пароль"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            onKeyDown={(e) => e.key === "Enter" && submitEmail()}
          />
          <button className="btn btn-primary" onClick={submitEmail} disabled={busy}>
            {mode === "signin" ? "Войти" : "Создать аккаунт"}
          </button>
          <button className="btn btn-plain" onClick={() => setEmailMode(false)}>Другие способы</button>
        </div>
      )}
      <p className="caption" style={{ textAlign: "center", marginTop: 16 }}>
        Продолжая, вы соглашаетесь с Условиями использования и Политикой конфиденциальности
      </p>
    </div>
  );
}

function AppleLogo() {
  return (
    <svg width="18" height="20" viewBox="0 0 814 1000" fill="currentColor" aria-hidden>
      <path d="M788 340c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-58-156-128C44 788 0 668 0 554 0 371 119 274 236 274c62 0 114 41 153 41 37 0 95-43 166-43 27 0 124 2 188 94zM554 160c29-35 50-83 50-131 0-7-1-14-2-19-48 2-104 32-138 72-27 30-52 79-52 127 0 7 1 15 2 17 3 1 8 1 13 1 43 0 97-29 127-67z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
