import {
  ArrowLeft, Bell, Building2, Check, Dumbbell, Flame, Heart, Home, Leaf, Mail, Rabbit,
  Salad, Sparkles, Sprout, Sun, Target, Trees, TrendingDown, TrendingUp, Turtle, Utensils, Zap, Fish, Minus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computePlan } from "../../shared/nutrition";
import type { Profile } from "../../shared/types";
import { Wheel, Ruler } from "../components/pickers";
import { Ambient, Ring, Segmented, Sheet, haptic, toast } from "../components/ui";
import { getState, hash, setState, today, type Account, type UserData } from "../store";

type StepId =
  | "welcome" | "gender" | "source" | "experience" | "schedule" | "body" | "birth" | "goal" | "target" | "speed"
  | "place" | "equipment" | "preferences" | "limitations" | "obstacles" | "foodIntro" | "diet" | "allergies" | "tastes"
  | "kitchen" | "link" | "reminders" | "howitworks" | "thanks" | "loading" | "result" | "account";

const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
}

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
  days: [0, 2, 4],
  sessionMin: 45,
  preferences: [],
  limitations: [],
  limitationsNote: "",
  reminders: true,
  reminderTime: "18:00",
  budgetWeek: 5000,
  cookTimeMin: 30,
  tastes: [],
  dislikes: "",
  allergies: [],
  household: 1,
  pantry: [],
  linkFitFood: true,
};


export default function Onboarding() {
  const [p, setP] = useState<Profile>(DEFAULT);
  const [history, setHistory] = useState<StepId[]>(["welcome"]);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [signIn, setSignIn] = useState(false);
  const step = history[history.length - 1];
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));

  const flow = useMemo<StepId[]>(() => {
    const f: StepId[] = ["welcome", "gender", "source", "experience", "schedule", "body", "birth", "goal"];
    if (p.goal !== "maintain") f.push("target", "speed");
    f.push("place");
    if (p.place !== "gym") f.push("equipment");
    f.push("preferences", "limitations", "obstacles", "foodIntro", "diet", "allergies", "tastes", "kitchen", "link", "reminders", "howitworks", "thanks", "loading", "result", "account");
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

  if (step === "welcome") {
    return (
      <div className="ob">
        <Ambient />
        <div className="ob-body center" style={{ alignItems: "center", textAlign: "center" }}>
          <WelcomeHero />
          <div className="wordmark" style={{ marginTop: 34 }}>
            parri<span>fit · food</span>
          </div>
          <h1 style={{ fontSize: 34, marginTop: 14 }}>Цель → реалистичный план</h1>
          <p className="sub" style={{ maxWidth: 320 }}>Тренировки под ваш опыт, оборудование и расписание. Меню под бюджет и вкусы. Один план вместо нескольких дневников.</p>
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
    speed: {
      title: "Как быстро вы хотите достичь цели?",
      ok: true,
      center: true,
      body: <SpeedPicker p={p} set={set} />,
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
    schedule: {
      title: "Когда вам удобно тренироваться?",
      sub: "Выберите дни и сколько времени есть на одно занятие.",
      ok: (p.days?.length ?? 0) > 0,
      body: (
        <div>
          <div className="week-pick">
            {WEEK.map((d, i) => {
              const on = p.days?.includes(i);
              return (
                <button
                  key={d}
                  className={`option ${on ? "on" : ""}`}
                  onClick={() => {
                    haptic();
                    const days = on ? (p.days ?? []).filter((x) => x !== i) : [...(p.days ?? []), i].sort();
                    set({ days, workoutsPerWeek: Math.max(1, days.length) });
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="caption" style={{ margin: "10px 4px 22px" }}>
            {(p.days?.length ?? 0) > 0 ? `${p.days!.length} ${plural(p.days!.length, "тренировка", "тренировки", "тренировок")} в неделю` : "Выберите хотя бы один день"}
          </div>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Длительность занятия</div>
          <Options
            value={String(p.sessionMin ?? 45)}
            onChange={(v) => set({ sessionMin: Number(v) })}
            options={[
              { value: "20", label: "20 минут", hint: "Коротко, но регулярно" },
              { value: "45", label: "45 минут", hint: "Оптимально для большинства" },
              { value: "60", label: "60+ минут", hint: "Полноценная тренировка в зале" },
            ]}
          />
        </div>
      ),
    },
    preferences: {
      title: "Что вам нравится в тренировках?",
      sub: "Программа будет ближе к тому, что вам по душе.",
      ok: true,
      body: (
        <Multi
          value={p.preferences ?? []}
          onChange={(preferences) => set({ preferences })}
          options={[
            ["Силовые", <Dumbbell size={20} key="d" />],
            ["Кардио", <Heart size={20} key="h" />],
            ["Функциональные и круговые", <Zap size={20} key="z" />],
            ["Растяжка и мобильность", <Sprout size={20} key="s" />],
            ["Короткие интенсивные", <Flame size={20} key="f" />],
          ]}
        />
      ),
    },
    limitations: {
      title: "Есть ли ограничения?",
      sub: "Мы не будем включать упражнения, которые их нагружают. Это не медицинская оценка — при болях проконсультируйтесь с врачом.",
      ok: true,
      body: (
        <div>
          <Multi
            value={p.limitations ?? []}
            onChange={(limitations) => set({ limitations })}
            options={["Колени", "Поясница", "Плечи", "Запястья", "Шея", "Давление / сердце", "Беременность"]}
          />
          <textarea
            id="ob-limits"
            className="field"
            rows={2}
            style={{ marginTop: 12 }}
            placeholder="Другое (необязательно)"
            value={p.limitationsNote ?? ""}
            onChange={(e) => set({ limitationsNote: e.target.value })}
          />
        </div>
      ),
    },
    foodIntro: {
      title: "",
      ok: true,
      center: true,
      cta: "Настроить питание",
      body: (
        <div style={{ textAlign: "center" }} className="fade-in">
          <div className="brand-mark" style={{ margin: "0 auto 26px" }}>
            <Utensils size={44} />
          </div>
          <div className="caption" style={{ fontSize: 15, fontWeight: 600 }}>PARRI FOOD</div>
          <h1 style={{ marginTop: 6 }}>Теперь — меню на неделю</h1>
          <p className="sub">Подберём рецепты под бюджет, вкусы и время на готовку и соберём список покупок.</p>
        </div>
      ),
    },
    allergies: {
      title: "Аллергии и исключения",
      sub: "Проверяем состав каждого продукта. Если состав неизвестен, попросим уточнить.",
      ok: true,
      body: (
        <div>
          <Multi
            value={p.allergies ?? []}
            onChange={(allergies) => set({ allergies })}
            options={["Глютен", "Молочное", "Яйца", "Орехи", "Арахис", "Рыба", "Морепродукты", "Соя", "Кунжут"]}
          />
          <input
            id="ob-dislikes"
            className="field"
            style={{ marginTop: 12 }}
            placeholder="Не ем (через запятую): грибы, печень…"
            value={p.dislikes ?? ""}
            onChange={(e) => set({ dislikes: e.target.value })}
          />
        </div>
      ),
    },
    tastes: {
      title: "Что вы любите есть?",
      ok: true,
      body: (
        <Multi
          value={p.tastes ?? []}
          onChange={(tastes) => set({ tastes })}
          options={["Домашняя русская кухня", "Средиземноморская", "Азиатская", "Кавказская", "Мексиканская", "Простые блюда из 3–5 продуктов", "Супы", "Выпечка без сахара"]}
        />
      ),
    },
    kitchen: {
      title: "Бюджет и время на готовку",
      ok: true,
      body: <KitchenStep p={p} set={set} />,
    },
    link: {
      title: "Связать тренировки и питание?",
      sub: "Отдельное согласие. Его можно отозвать в профиле в любой момент.",
      ok: true,
      center: true,
      body: (
        <div>
          <div className="glass card stack" style={{ gap: 10 }}>
            {[
              ["🗓️", "Parri Food увидит дни тренировок и добавит в эти дни больше белка и углеводов"],
              ["🎯", "Общие цели: один план вместо нескольких дневников"],
              ["🔒", "Передаются только расписание и цель — не дневник и не медицинские данные"],
            ].map(([e, t]) => (
              <div key={t} className="row" style={{ alignItems: "flex-start" }}>
                <span style={{ fontSize: 22 }}>{e}</span>
                <span style={{ lineHeight: 1.35 }}>{t}</span>
              </div>
            ))}
          </div>
          <Options
            value={p.linkFitFood ? "yes" : "no"}
            onChange={(v) => set({ linkFitFood: v === "yes" })}
            options={[
              { value: "yes", label: "Да, согласовать Fit и Food", icon: <Check size={20} /> },
              { value: "no", label: "Нет, вести отдельно", icon: <Minus size={20} /> },
            ]}
          />
        </div>
      ),
    },
    reminders: {
      title: "Напоминания о тренировках",
      sub: "Напомним в дни занятий. Уведомление придёт, если приложение установлено на экран «Домой».",
      ok: true,
      center: true,
      body: (
        <div>
          <Options
            value={p.reminders === false ? "off" : "on"}
            onChange={(v) => set({ reminders: v === "on" })}
            options={[
              { value: "on", label: "Напоминать", icon: <Bell size={20} /> },
              { value: "off", label: "Не нужно", icon: <Minus size={20} /> },
            ]}
          />
          {p.reminders !== false && (
            <div className="glass card row" style={{ marginTop: 16 }}>
              <b>Время</b>
              <span className="spacer" />
              <input
                id="ob-reminder-time"
                type="time"
                className="field"
                style={{ width: 150, height: 44, textAlign: "center" }}
                value={p.reminderTime ?? "18:00"}
                onChange={(e) => set({ reminderTime: e.target.value })}
              />
            </div>
          )}
        </div>
      ),
    },
    howitworks: {
      title: "Как работает Parri",
      ok: true,
      body: (
        <div className="stack">
          {[
            ["1", "План", "ИИ составит программу под опыт, оборудование, расписание и ограничения"],
            ["2", "Дневник", "Записывайте подходы и как прошла тренировка — это займёт секунды"],
            ["3", "Корректировка", "Нагрузка меняется по фактическому выполнению: легко — прибавим, тяжело — оставим, больно — заменим"],
            ["4", "Питание", "Меню, рецепты и список покупок под ваш бюджет"],
          ].map(([n, t, d]) => (
            <div key={n} className="glass card row" style={{ alignItems: "flex-start" }}>
              <span className="step-num">{n}</span>
              <span>
                <b>{t}</b>
                <div className="caption" style={{ fontSize: 15, lineHeight: 1.35 }}>{d}</div>
              </span>
            </div>
          ))}
          <p className="caption" style={{ textAlign: "center", lineHeight: 1.4 }}>
            Parri помогает держать режим, но не ставит диагнозы и не гарантирует результат.
          </p>
        </div>
      ),
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
            if (step === "reminders" && p.reminders !== false && "Notification" in window && Notification.permission === "default") {
              Notification.requestPermission().catch(() => undefined);
            }
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
  const items = ["Калории и БЖУ", "Расписание тренировок", "Программа под ограничения", "Меню на неделю", "Список покупок", "Проверка аллергенов"];
  const stage = pct < 25 ? "Рассчитываем норму…" : pct < 55 ? "ИИ составляет тренировки…" : pct < 85 ? "Подбираем рецепты под бюджет…" : "Собираем список покупок…";
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
          <h1 style={{ fontSize: 30 }}>Ваш план готов</h1>
          {profile.goal !== "maintain" && (
            <>
              <div style={{ fontWeight: 600, marginTop: 14 }}>Ориентир при выбранном темпе:</div>
              <div className="glass" style={{ display: "inline-block", marginTop: 10, padding: "8px 16px", borderRadius: 20, fontWeight: 600 }}>
                {profile.goal === "lose" ? "−" : "+"}
                {fmtW(Math.abs(profile.targetWeightKg - profile.weightKg), profile.units)} примерно к {date}
              </div>
              <div className="caption" style={{ marginTop: 8 }}>Это оценка, а не гарантия: темп зависит от многих факторов.</div>
            </>
          )}
        </div>
        <div className="grid-2" style={{ marginTop: 22 }}>
          <div className="glass card" style={{ padding: 16 }}>
            <div className="caption" style={{ fontWeight: 700, letterSpacing: ".04em" }}>PARRI FIT</div>
            <div className="mid-num" style={{ marginTop: 6 }}>{profile.days?.length ?? profile.workoutsPerWeek}×{profile.sessionMin ?? 45} мин</div>
            <div className="caption">{(profile.days ?? []).map((d) => WEEK[d]).join(", ") || "в неделю"}</div>
          </div>
          <div className="glass card" style={{ padding: 16, marginTop: 0 }}>
            <div className="caption" style={{ fontWeight: 700, letterSpacing: ".04em" }}>PARRI FOOD</div>
            <div className="mid-num" style={{ marginTop: 6 }}>{(profile.budgetWeek ?? 5000).toLocaleString("ru-RU")} ₽</div>
            <div className="caption">в неделю · {profile.household ?? 1} чел.</div>
          </div>
        </div>
        <div className="glass card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Ориентир на день</div>
          <div className="caption">Приблизительный расчёт, можно изменить в любое время</div>
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
          <b>Что дальше:</b>
          {[
            ["💪", "Тренируйтесь по плану и отмечайте подходы — нагрузка подстроится"],
            ["🛒", "Купите продукты по списку на неделю"],
            ["🥩", `Ориентир по белку — ${plan.protein} г в день`],
            ["🔔", profile.reminders === false ? "Напоминания выключены" : `Напомним в дни тренировок в ${profile.reminderTime ?? "18:00"}`],
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
      <p className="sub">Создайте аккаунт Parri — один на тренировки и питание.</p>
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

const PANTRY = ["Крупы", "Макароны", "Яйца", "Курица", "Картофель", "Лук и морковь", "Консервы", "Замороженные овощи", "Молочное"];

function KitchenStep({ p, set }: { p: Profile; set: (x: Partial<Profile>) => void }) {
  const people = p.household ?? 1;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="glass card row">
        <b style={{ flex: 1 }}>Сколько человек питается</b>
        <button className="circle-btn" style={{ background: "var(--fill)", width: 38, height: 38 }} onClick={() => set({ household: Math.max(1, people - 1) })} aria-label="Меньше">
          <Minus size={18} />
        </button>
        <b className="mid-num" style={{ width: 28, textAlign: "center" }}>{people}</b>
        <button className="circle-btn" style={{ background: "var(--ink)", color: "var(--on-ink)", width: 38, height: 38 }} onClick={() => set({ household: Math.min(8, people + 1) })} aria-label="Больше">
          +
        </button>
      </div>
      <div>
        <div className="row" style={{ marginBottom: 10 }}>
          <b>Бюджет на продукты в неделю</b>
          <span className="spacer" />
          <span className="mid-num" style={{ whiteSpace: "nowrap" }}>{(p.budgetWeek ?? 5000).toLocaleString("ru-RU")} ₽</span>
        </div>
        <input
          id="ob-budget"
          className="slider"
          type="range"
          min={1500}
          max={25000}
          step={500}
          value={p.budgetWeek ?? 5000}
          onChange={(e) => (haptic(3), set({ budgetWeek: Number(e.target.value) }))}
        />
        <div className="caption" style={{ marginTop: 6 }}>≈ {Math.round((p.budgetWeek ?? 5000) / 7 / people)} ₽ в день на человека</div>
      </div>
      <div>
        <b>Время на готовку в будни</b>
        <div className="chips" style={{ marginTop: 10 }}>
          {[15, 30, 45, 60].map((m) => (
            <button key={m} className={`chip ${(p.cookTimeMin ?? 30) === m ? "on" : ""}`} onClick={() => set({ cookTimeMin: m })}>
              до {m} мин
            </button>
          ))}
        </div>
      </div>
      <div>
        <b>Что уже есть дома</b>
        <div className="caption" style={{ margin: "2px 0 10px" }}>Используем в меню и не добавим в список покупок</div>
        <div className="chips" style={{ flexWrap: "wrap", margin: 0, padding: 0 }}>
          {PANTRY.map((x) => {
            const on = p.pantry?.includes(x);
            return (
              <button key={x} className={`chip ${on ? "on" : ""}`} onClick={() => set({ pantry: on ? p.pantry!.filter((y) => y !== x) : [...(p.pantry ?? []), x] })}>
                {x}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
