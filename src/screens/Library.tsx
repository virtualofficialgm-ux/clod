import { Calculator, Clock, HeartPulse, Scale, Search, Weight } from "lucide-react";
import { useMemo, useState } from "react";
import { ageFrom, bmi } from "../../shared/nutrition";
import { Md, Page, Row, ScreenWithTitle, Sheet, haptic } from "../components/ui";
import { ARTICLES, CATEGORIES, type Article } from "../data/articles";
import { EXERCISES, MUSCLES, type ExerciseInfo, type Muscle } from "../data/exercises";
import { useUser } from "../store";

export default function Library() {
  const [cat, setCat] = useState<Article["category"] | "Все">("Все");
  const [article, setArticle] = useState<Article | null>(null);
  const [exercises, setExercises] = useState(false);
  const [tool, setTool] = useState<"bmi" | "orm" | "hr" | null>(null);
  const list = ARTICLES.filter((a) => cat === "Все" || a.category === cat);
  const featured = ARTICLES[1];

  return (
    <>
      <ScreenWithTitle title="Знания" kicker="Спорт и питание">
        <div className="stagger">
          <button className="hero-img" style={{ width: "100%", background: featured.gradient, textAlign: "left", placeItems: "end start", padding: 20 }} onClick={() => setArticle(featured)}>
            <span style={{ position: "absolute", right: 18, top: 14, fontSize: 64 }}>{featured.emoji}</span>
            <span>
              <span className="badge" style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}>Рекомендуем</span>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8, maxWidth: 230, lineHeight: 1.15, textShadow: "0 1px 12px rgba(0,0,0,.15)" }}>{featured.title}</div>
            </span>
          </button>

          <div className="section-title">Инструменты</div>
          <div className="list glass">
            <Row icon={<Search size={18} />} color="var(--blue)" title="Библиотека упражнений" subtitle={`${EXERCISES.length} упражнений с техникой`} onClick={() => setExercises(true)} />
            <Row icon={<Scale size={18} />} color="var(--green)" title="Индекс массы тела" onClick={() => setTool("bmi")} />
            <Row icon={<Weight size={18} />} color="var(--orange)" title="Калькулятор 1ПМ" subtitle="Максимум на одно повторение" onClick={() => setTool("orm")} />
            <Row icon={<HeartPulse size={18} />} color="var(--red)" title="Пульсовые зоны" onClick={() => setTool("hr")} />
          </div>

          <div className="section-title">Статьи</div>
          <div className="chips" style={{ marginBottom: 12 }}>
            {(["Все", ...CATEGORIES] as const).map((c) => (
              <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => (haptic(), setCat(c))}>
                {c}
              </button>
            ))}
          </div>
          <div className="stack">
            {list.map((a) => (
              <button key={a.id} className="glass row" style={{ borderRadius: 24, padding: 12, textAlign: "left", width: "100%" }} onClick={() => setArticle(a)}>
                <span style={{ width: 70, height: 70, borderRadius: 18, background: a.gradient, display: "grid", placeItems: "center", fontSize: 34, flex: "none" }}>{a.emoji}</span>
                <span style={{ minWidth: 0 }}>
                  <div className="caption" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>{a.category}</div>
                  <div style={{ fontWeight: 600, lineHeight: 1.25, margin: "2px 0" }}>{a.title}</div>
                  <div className="caption">
                    <Clock size={11} style={{ verticalAlign: -1 }} /> {a.minutes} мин
                  </div>
                </span>
              </button>
            ))}
          </div>
        </div>
      </ScreenWithTitle>

      {article && (
        <Page title={article.title} onBack={() => setArticle(null)}>
          <div className="hero-img fade-in" style={{ background: article.gradient, marginTop: 52, fontSize: 96 }}>{article.emoji}</div>
          <div className="caption" style={{ margin: "18px 4px 0", fontWeight: 600, textTransform: "uppercase" }}>
            {article.category} · {article.minutes} мин чтения
          </div>
          <h1 style={{ fontSize: 28, letterSpacing: "-0.03em", margin: "6px 4px 6px", lineHeight: 1.15 }}>{article.title}</h1>
          <p className="muted" style={{ margin: "0 4px 18px", fontSize: 17 }}>{article.lead}</p>
          <div className="glass card" style={{ fontSize: 17, lineHeight: 1.5 }}>
            <Md text={article.body} />
          </div>
        </Page>
      )}
      {exercises && <ExerciseLibrary onBack={() => setExercises(false)} />}
      {tool && <ToolSheet tool={tool} onClose={() => setTool(null)} />}
    </>
  );
}

function ExerciseLibrary({ onBack }: { onBack: () => void }) {
  const [muscle, setMuscle] = useState<Muscle | "Все">("Все");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<ExerciseInfo | null>(null);
  const list = useMemo(
    () => EXERCISES.filter((e) => (muscle === "Все" || e.muscle === muscle) && e.name.toLowerCase().includes(q.toLowerCase())),
    [muscle, q],
  );
  const PLACE = { gym: "Зал", home: "Дом", outdoor: "Улица" };
  return (
    <Page title="Упражнения" onBack={onBack}>
      <h1 className="large-title">Упражнения</h1>
      <div className="glass row" style={{ borderRadius: 14, padding: "0 12px", height: 44, marginBottom: 12 }}>
        <Search size={18} className="muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" style={{ flex: 1, border: 0, outline: 0, background: "none", fontSize: 17 }} />
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {(["Все", ...MUSCLES] as const).map((m) => (
          <button key={m} className={`chip ${muscle === m ? "on" : ""}`} onClick={() => setMuscle(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="list glass">
        {list.map((e) => (
          <Row
            key={e.name}
            title={e.name}
            subtitle={`${e.muscle} · ${e.places.map((p) => PLACE[p]).join(", ")} · ${"●".repeat(e.level)}${"○".repeat(3 - e.level)}`}
            onClick={() => setOpen(e)}
          />
        ))}
      </div>
      {open && (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            <span className="badge">{open.muscle}</span>
            <span className="badge">Инвентарь: {open.equipment}</span>
            <span className="badge">Сложность {open.level}/3</span>
          </div>
          <div className="list-header" style={{ marginLeft: 4 }}>Техника</div>
          <div className="list glass">
            {open.steps.map((s, i) => (
              <div key={s} className="list-row plain">
                <span className="icon-tile" style={{ background: "var(--blue)", width: 26, height: 26, borderRadius: 13, fontSize: 13 }}>{i + 1}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
          <div className="list-header" style={{ marginLeft: 4 }}>Частые ошибки</div>
          <div className="list glass">
            {open.mistakes.map((s) => (
              <div key={s} className="list-row plain">
                <span style={{ color: "var(--red)" }}>✕</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </Page>
  );
}

function ToolSheet({ tool, onClose }: { tool: "bmi" | "orm" | "hr"; onClose: () => void }) {
  const u = useUser()!;
  const [w, setW] = useState(60);
  const [r, setR] = useState(5);
  const age = ageFrom(u.profile.birthDate);

  if (tool === "bmi") {
    const v = bmi(u.profile);
    const zones = [
      { to: 18.5, l: "Недостаток", c: "var(--blue)" },
      { to: 25, l: "Норма", c: "var(--green)" },
      { to: 30, l: "Избыток", c: "var(--orange)" },
      { to: 99, l: "Ожирение", c: "var(--red)" },
    ];
    const z = zones.find((x) => v < x.to)!;
    return (
      <Sheet title="Индекс массы тела" onClose={onClose}>
        <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
          <div className="big-num" style={{ fontSize: 64 }}>{v.toFixed(1).replace(".", ",")}</div>
          <span className="badge" style={{ background: z.c, color: "#fff", marginTop: 8 }}>{z.l}</span>
        </div>
        <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden" }}>
          {zones.map((x) => (
            <i key={x.l} style={{ flex: 1, background: x.c }} />
          ))}
        </div>
        <p className="muted" style={{ lineHeight: 1.4 }}>
          Рост {u.profile.heightCm} см, вес {u.profile.weightKg} кг. ИМТ не учитывает мышечную массу — у спортсменов он может быть завышен. Ориентируйтесь также на обхват талии.
        </p>
      </Sheet>
    );
  }
  if (tool === "orm") {
    const orm = w * (1 + r / 30); // Epley
    return (
      <Sheet title="Калькулятор 1ПМ" onClose={onClose}>
        <div className="grid-2">
          <label>
            <div className="caption">Вес, кг</div>
            <input className="field" type="number" inputMode="decimal" value={w} onChange={(e) => setW(Number(e.target.value))} />
          </label>
          <label>
            <div className="caption">Повторы</div>
            <input className="field" type="number" inputMode="numeric" value={r} onChange={(e) => setR(Math.max(1, Math.min(20, Number(e.target.value))))} />
          </label>
        </div>
        <div className="glass card" style={{ textAlign: "center", marginTop: 16 }}>
          <div className="caption">Ваш примерный максимум</div>
          <div className="big-num">{Math.round(orm)} кг</div>
        </div>
        <div className="list glass" style={{ marginTop: 12 }}>
          {[95, 90, 85, 80, 75, 70].map((pct) => (
            <div key={pct} className="list-row plain">
              <span>{pct}% · ~{Math.round(30 * (100 / pct - 1))} повт.</span>
              <span className="value">{Math.round((orm * pct) / 100)} кг</span>
            </div>
          ))}
        </div>
      </Sheet>
    );
  }
  const max = 220 - age;
  const zones = [
    { n: 1, l: "Восстановление", a: 0.5, b: 0.6, c: "var(--blue)" },
    { n: 2, l: "Жиросжигание / база", a: 0.6, b: 0.7, c: "var(--green)" },
    { n: 3, l: "Аэробная", a: 0.7, b: 0.8, c: "var(--yellow)" },
    { n: 4, l: "Анаэробный порог", a: 0.8, b: 0.9, c: "var(--orange)" },
    { n: 5, l: "Максимум", a: 0.9, b: 1, c: "var(--red)" },
  ];
  return (
    <Sheet title="Пульсовые зоны" onClose={onClose}>
      <div className="glass card row">
        <Calculator size={22} />
        <span>
          Максимальный пульс ≈ <b>{max}</b> уд/мин
          <div className="caption">Формула 220 − возраст ({age})</div>
        </span>
      </div>
      <div className="list glass" style={{ marginTop: 12 }}>
        {zones.map((z) => (
          <div key={z.n} className="list-row plain">
            <span className="icon-tile" style={{ background: z.c }}>{z.n}</span>
            <span>{z.l}</span>
            <span className="value">
              {Math.round(max * z.a)}–{Math.round(max * z.b)}
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
