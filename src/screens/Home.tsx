import { Droplet, Dumbbell, Flame, Minus, Plus, Sparkles, Trash2, User } from "lucide-react";
import { useState } from "react";
import type { Tab } from "../App";
import { Ring, ScreenWithTitle, haptic } from "../components/ui";
import { today, updateUser, useUser, type MealEntry } from "../store";
import Profile from "./Profile";
import { WorkoutDetail, nextDayIndex } from "./Workouts";
import { Sheet } from "../components/ui";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function Home({ go }: { go: (t: Tab) => void }) {
  const u = useUser()!;
  const [day, setDay] = useState(today());
  const [profile, setProfile] = useState(false);
  const [workout, setWorkout] = useState<number | null>(null);
  const [meal, setMeal] = useState<MealEntry | null>(null);

  const meals = u.meals.filter((m) => m.date === day);
  const eaten = meals.reduce(
    (a, m) => ({ cal: a.cal + m.calories, p: a.p + m.protein, c: a.c + m.carbs, f: a.f + m.fat }),
    { cal: 0, p: 0, c: 0, f: 0 },
  );
  const burned = u.workouts.filter((w) => w.date === day).reduce((a, w) => a + w.calories, 0);
  const budget = u.plan.calories + burned;
  const left = budget - eaten.cal;
  const water = u.water[day] ?? 0;

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return today(d);
  });
  const streak = (() => {
    let n = 0;
    const d = new Date();
    for (;;) {
      const key = today(d);
      if (u.meals.some((m) => m.date === key) || u.workouts.some((w) => w.date === key)) n++;
      else if (key !== today()) break;
      d.setDate(d.getDate() - 1);
      if (n > 365) break;
    }
    return n;
  })();

  const program = u.program;
  const nextIdx = program ? nextDayIndex(u) : 0;
  const nextDay = program?.days[nextIdx];
  const doneToday = u.workouts.some((w) => w.date === today());

  const addWater = (ml: number) => {
    haptic();
    updateUser((d) => ({ ...d, water: { ...d.water, [day]: Math.max(0, (d.water[day] ?? 0) + ml) } }));
  };

  return (
    <>
      <ScreenWithTitle
        title="Сегодня"
        kicker={new Date(day).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
        right={
          <>
            <span className="pill-btn glass" style={{ height: 40, padding: "0 12px" }}>
              <Flame size={18} color="var(--orange)" fill="var(--orange)" /> {streak}
            </span>
            <button className="circle-btn glass" onClick={() => setProfile(true)} aria-label="Профиль">
              <User size={22} />
            </button>
          </>
        }
      >
        <div className="stagger">
          <div className="week" style={{ marginBottom: 14 }}>
            {week.map((d, i) => {
              const has = u.meals.some((m) => m.date === d) || u.workouts.some((w) => w.date === d);
              return (
                <button key={d} className={`day ${d === day ? "on" : ""} ${has ? "done" : ""}`} onClick={() => (haptic(), setDay(d))}>
                  {WD[i]}
                  <b>{Number(d.slice(8))}</b>
                </button>
              );
            })}
          </div>

          <div className="glass card row" style={{ padding: 22 }}>
            <div style={{ flex: 1 }}>
              <div className="big-num">{Math.abs(left)}</div>
              <div style={{ fontWeight: 600, marginTop: 6 }}>{left >= 0 ? "Калорий осталось" : "Калорий сверх нормы"}</div>
              <div className="caption" style={{ marginTop: 6 }}>
                Съедено {eaten.cal} · Норма {u.plan.calories}
                {burned > 0 && ` · +${burned} тренировка`}
              </div>
            </div>
            <Ring value={eaten.cal / budget} size={110} stroke={11} color={left < 0 ? "var(--red)" : "var(--ink)"}>
              <Flame size={28} />
            </Ring>
          </div>

          <div className="grid-3" style={{ marginTop: 12 }}>
            {[
              { l: "Белки", v: u.plan.protein - eaten.p, t: u.plan.protein, e: eaten.p, c: "var(--protein)", i: "🍗" },
              { l: "Углеводы", v: u.plan.carbs - eaten.c, t: u.plan.carbs, e: eaten.c, c: "var(--carbs)", i: "🌾" },
              { l: "Жиры", v: u.plan.fat - eaten.f, t: u.plan.fat, e: eaten.f, c: "var(--fat)", i: "🥑" },
            ].map((m) => (
              <div key={m.l} className="glass" style={{ borderRadius: 24, padding: "14px 12px" }}>
                <div className="mid-num" style={{ fontSize: 20 }}>{Math.abs(m.v)}г</div>
                <div className="caption" style={{ fontSize: 12 }}>{m.l} {m.v >= 0 ? "осталось" : "сверх"}</div>
                <div style={{ display: "grid", placeItems: "center", marginTop: 10 }}>
                  <Ring value={m.e / m.t} size={64} stroke={7} color={m.c}>
                    <span style={{ fontSize: 20 }}>{m.i}</span>
                  </Ring>
                </div>
              </div>
            ))}
          </div>

          <div className="glass card" style={{ marginTop: 12 }}>
            <div className="row">
              <span className="icon-tile" style={{ background: "var(--teal)" }}>
                <Droplet size={18} fill="#fff" />
              </span>
              <div>
                <b>Вода</b>
                <div className="caption">
                  {(water / 1000).toFixed(2).replace(".", ",")} из {(u.plan.waterMl / 1000).toFixed(1).replace(".", ",")} л
                </div>
              </div>
              <span className="spacer" />
              <button className="circle-btn" style={{ background: "var(--fill)", width: 38, height: 38 }} onClick={() => addWater(-250)} aria-label="Меньше воды">
                <Minus size={18} />
              </button>
              <button className="circle-btn" style={{ background: "var(--ink)", color: "var(--on-ink)", width: 38, height: 38 }} onClick={() => addWater(250)} aria-label="Добавить стакан">
                <Plus size={18} />
              </button>
            </div>
            <div className="bar" style={{ marginTop: 12 }}>
              <i style={{ width: `${Math.min(100, (water / u.plan.waterMl) * 100)}%`, background: "var(--teal)" }} />
            </div>
          </div>

          <div className="section-title">
            Тренировка дня
            <button onClick={() => go("workouts")}>Все</button>
          </div>
          {nextDay ? (
            <button className="glass card" style={{ width: "100%", textAlign: "left", display: "block" }} onClick={() => setWorkout(nextIdx)}>
              <div className="row">
                <span className="icon-tile" style={{ background: "linear-gradient(135deg, var(--orange), var(--pink))", width: 52, height: 52, borderRadius: 16 }}>
                  <Dumbbell size={26} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="caption">День {nextIdx + 1} · {program!.name}</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{nextDay.title}</div>
                  <div className="caption">{nextDay.durationMin} мин · {nextDay.exercises.length} упражнений</div>
                </div>
              </div>
              <div className="btn btn-primary" style={{ marginTop: 14, height: 48 }}>
                {doneToday ? "Ещё одна тренировка" : "Начать тренировку"}
              </div>
            </button>
          ) : (
            <div className="glass card row">
              <span className="spinner" />
              <div>
                <b>ИИ составляет программу…</b>
                <div className="caption">Обычно это занимает до минуты</div>
              </div>
            </div>
          )}

          <div className="section-title">Недавно добавлено</div>
          {meals.length === 0 ? (
            <div className="glass card" style={{ textAlign: "center", padding: 26 }}>
              <Sparkles size={26} color="var(--purple)" />
              <div style={{ fontWeight: 600, marginTop: 8 }}>Пока ничего не добавлено</div>
              <div className="caption" style={{ marginTop: 4 }}>Нажмите «+», чтобы сфотографировать еду — ИИ посчитает калории</div>
            </div>
          ) : (
            <div className="stack">
              {meals
                .slice()
                .reverse()
                .map((m) => (
                  <button key={m.id} className="glass row" style={{ borderRadius: 24, padding: 10, textAlign: "left", width: "100%" }} onClick={() => setMeal(m)}>
                    {m.photo ? (
                      <img src={m.photo} alt="" style={{ width: 76, height: 76, borderRadius: 16, objectFit: "cover" }} />
                    ) : (
                      <span style={{ width: 76, height: 76, borderRadius: 16, background: "var(--fill)", display: "grid", placeItems: "center", fontSize: 32 }}>🍽️</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</b>
                        <span className="spacer" />
                        <span className="badge">{m.time}</span>
                      </div>
                      <div style={{ fontWeight: 600, margin: "4px 0" }}>
                        <Flame size={14} style={{ verticalAlign: -2 }} /> {m.calories} ккал
                      </div>
                      <div className="caption">🍗 {m.protein}г · 🌾 {m.carbs}г · 🥑 {m.fat}г</div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </ScreenWithTitle>

      {meal && <MealSheet meal={meal} onClose={() => setMeal(null)} />}
      {profile && <Profile onBack={() => setProfile(false)} />}
      {workout !== null && program && <WorkoutDetail index={workout} onBack={() => setWorkout(null)} />}
    </>
  );
}

function MealSheet({ meal, onClose }: { meal: MealEntry; onClose: () => void }) {
  return (
    <Sheet title="Приём пищи" onClose={onClose}>
      {meal.photo && <img src={meal.photo} alt="" style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 24 }} />}
      <h2 style={{ margin: "14px 0 4px" }}>{meal.name}</h2>
      <div className="caption">{meal.time} · индекс полезности {meal.healthScore}/10</div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        {[
          ["🔥 Калории", `${meal.calories}`],
          ["🍗 Белки", `${meal.protein} г`],
          ["🌾 Углеводы", `${meal.carbs} г`],
          ["🥑 Жиры", `${meal.fat} г`],
        ].map(([k, v]) => (
          <div key={k} className="glass" style={{ borderRadius: 18, padding: 12 }}>
            <div className="caption">{k}</div>
            <div className="mid-num">{v}</div>
          </div>
        ))}
      </div>
      {meal.items.length > 0 && (
        <>
          <div className="list-header" style={{ marginLeft: 4 }}>Состав</div>
          <div className="list glass">
            {meal.items.map((i) => (
              <div key={i.name} className="list-row plain">
                <span>{i.name}</span>
                <span className="value">{i.grams} г · {i.calories} ккал</span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="muted" style={{ lineHeight: 1.4 }}>{meal.comment}</p>
      <button
        className="btn btn-tinted"
        style={{ color: "var(--red)" }}
        onClick={() => {
          updateUser((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== meal.id) }));
          onClose();
        }}
      >
        <Trash2 size={18} /> Удалить
      </button>
    </Sheet>
  );
}
