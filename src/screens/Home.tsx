import { Bell, ChevronRight, Droplet, Dumbbell, Flame, Minus, Plus, ScanLine, Sparkles, Trash2, User } from "lucide-react";
import { useState } from "react";
import type { Tab } from "../App";
import { Ring, ScreenWithTitle, Sheet, haptic } from "../components/ui";
import { today, updateUser, useUser, type MealEntry } from "../store";
import EquipmentScanner from "./EquipmentScanner";
import { RecipePage, SLOT, todayIndex } from "./Food";
import Profile from "./Profile";
import { WorkoutDetail, nextDayIndex } from "./Workouts";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WD_FULL = ["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"];

export default function Home({ go }: { go: (t: Tab) => void }) {
  const u = useUser()!;
  const [day, setDay] = useState(today());
  const [profile, setProfile] = useState(false);
  const [workout, setWorkout] = useState<number | null>(null);
  const [scanner, setScanner] = useState(false);
  const [recipe, setRecipe] = useState<number | null>(null);

  const p = u.profile;
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
  const ti = todayIndex();
  const scheduled = p.days?.length ? p.days.includes(ti) : true;
  const nextTraining = p.days?.length ? [...p.days.filter((d) => d > ti), ...p.days].find((d) => d !== ti) : undefined;
  const todayMenu = u.menu?.days[ti];

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
                  <i className={`dot ${p.days?.includes(i) ? "on" : ""}`} />
                </button>
              );
            })}
          </div>

          {/* Fit */}
          <div className="section-title" style={{ marginTop: 6 }}>
            <span>
              <span className="eyebrow">Fit</span> Тренировка
            </span>
            <button onClick={() => go("workouts")}>План</button>
          </div>
          {!nextDay ? (
            <div className="glass card row">
              <span className="spinner" />
              <div>
                <b>ИИ составляет программу…</b>
                <div className="caption">Обычно это занимает до минуты</div>
              </div>
            </div>
          ) : doneToday ? (
            <div className="glass card row">
              <span className="icon-tile" style={{ background: "var(--green)", width: 48, height: 48, borderRadius: 14 }}>✓</span>
              <div>
                <b>Сегодняшняя тренировка выполнена</b>
                <div className="caption">Отдыхайте и восстанавливайтесь</div>
              </div>
            </div>
          ) : (
            <button className="glass card" style={{ width: "100%", textAlign: "left", display: "block" }} onClick={() => setWorkout(nextIdx)}>
              {scheduled && p.reminders !== false && (
                <div className="row caption" style={{ gap: 6, marginBottom: 10, fontSize: 13 }}>
                  <Bell size={14} /> По плану сегодня в {p.reminderTime ?? "18:00"}
                </div>
              )}
              <div className="row">
                <span className="icon-tile" style={{ background: scheduled ? "linear-gradient(135deg, var(--orange), var(--pink))" : "var(--fill-2)", width: 52, height: 52, borderRadius: 16 }}>
                  <Dumbbell size={26} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="caption">{scheduled ? "Сегодня по плану" : `День отдыха · следующая в ${nextTraining !== undefined ? WD_FULL[nextTraining] : "—"}`}</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{nextDay.title}</div>
                  <div className="caption">{nextDay.durationMin} мин · {nextDay.exercises.length} упражнений</div>
                </div>
              </div>
              <div className={`btn ${scheduled ? "btn-primary" : "btn-tinted"}`} style={{ marginTop: 14, height: 48 }}>
                {scheduled ? "Начать тренировку" : "Потренироваться сегодня"}
              </div>
            </button>
          )}
          <div style={{ marginTop: 12 }}>
            <ScanBanner onClick={() => setScanner(true)} />
          </div>

          {/* Food */}
          <div className="section-title">
            <span>
              <span className="eyebrow food">Food</span> Меню на сегодня
            </span>
            <button onClick={() => go("food")}>Неделя</button>
          </div>
          {todayMenu ? (
            <div className="list glass">
              {todayMenu.meals.map((m, i) => {
                const eatenIt = meals.some((x) => x.name === m.recipe.title);
                return (
                  <button key={i} className="list-row plain" onClick={() => setRecipe(i)}>
                    <span style={{ width: 64, flex: "none" }} className="caption">
                      {SLOT[m.slot]}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, textDecoration: eatenIt ? "line-through" : "none", opacity: eatenIt ? 0.55 : 1 }}>{m.recipe.title}</span>
                    <span className="value">≈{m.recipe.kcal}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="glass card row">
              <span className="spinner" />
              <b>Составляем меню…</b>
            </div>
          )}

          <div className="glass card row" style={{ padding: 20, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="big-num" style={{ fontSize: 38 }}>≈{Math.abs(left)}</div>
              <div style={{ fontWeight: 600, marginTop: 6 }}>{left >= 0 ? "ккал до ориентира" : "ккал сверх ориентира"}</div>
              <div className="caption" style={{ marginTop: 6 }}>
                Съедено ≈{eaten.cal} · Ориентир {u.plan.calories}
                {burned > 0 && ` · +${burned} тренировка`}
              </div>
              <div className="row caption" style={{ gap: 10, marginTop: 8, fontSize: 13 }}>
                <span>🍗 {eaten.p}/{u.plan.protein} г</span>
                <span>🌾 {eaten.c}/{u.plan.carbs} г</span>
                <span>🥑 {eaten.f}/{u.plan.fat} г</span>
              </div>
            </div>
            <Ring value={eaten.cal / budget} size={96} stroke={10} color={left < 0 ? "var(--red)" : "var(--ink)"}>
              <Flame size={26} />
            </Ring>
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

          <div className="section-title">Съедено</div>
          <MealList date={day} />
        </div>
      </ScreenWithTitle>

      {profile && <Profile onBack={() => setProfile(false)} />}
      {scanner && <EquipmentScanner onBack={() => setScanner(false)} />}
      {workout !== null && program && <WorkoutDetail index={workout} onBack={() => setWorkout(null)} />}
      {recipe !== null && u.menu && <RecipePage dayIndex={ti} mealIndex={recipe} onBack={() => setRecipe(null)} />}
    </>
  );
}

export function MealList({ date }: { date: string }) {
  const u = useUser()!;
  const [meal, setMeal] = useState<MealEntry | null>(null);
  const meals = u.meals.filter((m) => m.date === date);
  return (
    <>
      {meals.length === 0 ? (
        <div className="glass card" style={{ textAlign: "center", padding: 22 }}>
          <Sparkles size={24} color="var(--purple)" />
          <div style={{ fontWeight: 600, marginTop: 8 }}>Пока ничего не отмечено</div>
          <div className="caption" style={{ marginTop: 4 }}>Отметьте блюдо из меню или сфотографируйте еду через «+»</div>
        </div>
      ) : (
        <div className="stack">
          {meals
            .slice()
            .reverse()
            .map((m) => (
              <button key={m.id} className="glass row" style={{ borderRadius: 24, padding: 10, textAlign: "left", width: "100%" }} onClick={() => setMeal(m)}>
                {m.photo ? (
                  <img src={m.photo} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }} />
                ) : (
                  <span style={{ width: 64, height: 64, borderRadius: 16, background: "var(--fill)", display: "grid", placeItems: "center", fontSize: 28 }}>🍽️</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</b>
                    <span className="spacer" />
                    <span className="badge">{m.time}</span>
                  </div>
                  <div style={{ fontWeight: 600, margin: "4px 0" }}>≈{m.calories} ккал</div>
                  <div className="caption">🍗 {m.protein}г · 🌾 {m.carbs}г · 🥑 {m.fat}г</div>
                </div>
              </button>
            ))}
        </div>
      )}
      {meal && <MealSheet meal={meal} onClose={() => setMeal(null)} />}
    </>
  );
}

function MealSheet({ meal, onClose }: { meal: MealEntry; onClose: () => void }) {
  return (
    <Sheet title="Приём пищи" onClose={onClose}>
      {meal.photo && <img src={meal.photo} alt="" style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 24 }} />}
      <h2 style={{ margin: "14px 0 4px" }}>{meal.name}</h2>
      <div className="caption">{meal.time} · приблизительная оценка</div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        {[
          ["🔥 Калории", `≈${meal.calories}`],
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

export function ScanBanner({ onClick }: { onClick: () => void }) {
  return (
    <button className="scan-banner" onClick={() => (haptic(12), onClick())}>
      <span className="scan-icon">
        <ScanLine size={28} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 17 }}>Сканер тренажёров</b>
        <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.3, marginTop: 2 }}>Сфотографируйте тренажёр — ИИ объяснит, что и как на нём делать по вашему плану</div>
      </span>
      <ChevronRight size={22} style={{ opacity: 0.7 }} />
    </button>
  );
}
