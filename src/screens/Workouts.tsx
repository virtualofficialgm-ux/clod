import { Check, ChevronDown, Clock, Dumbbell, Flame, Pause, Play, RefreshCw, SkipForward, Sparkles, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WorkoutDay } from "../../shared/types";
import { generateProgram } from "../api";
import { Page, Ring, ScreenWithTitle, Sheet, haptic, toast } from "../components/ui";
import { EXERCISES } from "../data/exercises";
import { getState, today, uid, updateUser, useUser, type UserData } from "../store";
import EquipmentScanner from "./EquipmentScanner";
import { ScanBanner } from "./Home";

const INTENSITY = { low: "Лёгкая", medium: "Средняя", high: "Высокая" };
const GRADIENTS = [
  "linear-gradient(135deg, #ff9f0a, #ff375f)",
  "linear-gradient(135deg, #0a84ff, #5e5ce6)",
  "linear-gradient(135deg, #30d158, #40c8e0)",
  "linear-gradient(135deg, #bf5af2, #ff375f)",
  "linear-gradient(135deg, #5e5ce6, #40c8e0)",
  "linear-gradient(135deg, #ffd60a, #ff9f0a)",
  "linear-gradient(135deg, #ff453a, #bf5af2)",
];

export function nextDayIndex(u: UserData): number {
  const n = u.program?.days.length ?? 1;
  return u.workouts.length % n;
}

export default function Workouts() {
  const u = useUser()!;
  const [open, setOpen] = useState<number | null>(null);
  const [regen, setRegen] = useState(false);
  const [scanner, setScanner] = useState(false);
  const program = u.program;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const thisWeek = u.workouts.filter((w) => w.date >= today(weekStart)).length;

  return (
    <>
      <ScreenWithTitle
        title="Тренировки"
        kicker={program?.name ?? "Программа"}
        right={
          <button className="circle-btn glass" onClick={() => setRegen(true)} aria-label="Пересоздать программу">
            <Sparkles size={20} />
          </button>
        }
      >
        {!program ? (
          <div className="glass card row">
            <span className="spinner" />
            <div>
              <b>ИИ составляет программу…</b>
              <div className="caption">Можно пока посмотреть раздел «Знания»</div>
            </div>
          </div>
        ) : (
          <div className="stagger">
            <div className="glass card">
              <p style={{ margin: 0, lineHeight: 1.4 }}>{program.summary}</p>
              <div className="grid-3" style={{ marginTop: 14 }}>
                <Stat label="на неделе" value={`${thisWeek}/${program.days.length}`} />
                <Stat label="недель" value={String(program.weeks)} />
                <Stat label="всего" value={String(u.workouts.length)} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <ScanBanner onClick={() => setScanner(true)} />
            </div>

            <div className="section-title">План на неделю</div>
            <div className="stack">
              {program.days.map((d, i) => (
                <DayCard key={i} day={d} index={i} next={i === nextDayIndex(u)} onClick={() => setOpen(i)} />
              ))}
            </div>

            {program.tips.length > 0 && (
              <>
                <div className="section-title">Советы тренера</div>
                <div className="glass card stack" style={{ gap: 10 }}>
                  {program.tips.map((t) => (
                    <div key={t} className="row" style={{ alignItems: "flex-start" }}>
                      <Sparkles size={16} color="var(--purple)" style={{ flex: "none", marginTop: 3 }} />
                      <span style={{ lineHeight: 1.4 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {u.workouts.length > 0 && (
              <>
                <div className="section-title">История</div>
                <div className="list glass">
                  {u.workouts
                    .slice(-10)
                    .reverse()
                    .map((w) => (
                      <div key={w.id} className="list-row">
                        <span className="icon-tile" style={{ background: "var(--green)" }}>
                          <Check size={18} />
                        </span>
                        <span>
                          <div>{w.title}</div>
                          <div className="caption">
                            {new Date(w.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · {w.durationMin} мин · {w.sets} подходов
                          </div>
                        </span>
                        <span className="value">{w.calories} ккал</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}
      </ScreenWithTitle>
      {open !== null && <WorkoutDetail index={open} onBack={() => setOpen(null)} />}
      {regen && <RegenSheet onClose={() => setRegen(false)} />}
      {scanner && <EquipmentScanner onBack={() => setScanner(false)} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center", background: "var(--fill)", borderRadius: 16, padding: "10px 4px" }}>
      <div className="mid-num">{value}</div>
      <div className="caption" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}

function DayCard({ day, index, next, onClick }: { day: WorkoutDay; index: number; next: boolean; onClick: () => void }) {
  return (
    <button className="glass card" style={{ width: "100%", textAlign: "left", display: "flex", gap: 14, alignItems: "center" }} onClick={onClick}>
      <span style={{ width: 56, height: 56, borderRadius: 18, background: GRADIENTS[index % GRADIENTS.length], color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20, flex: "none" }}>
        {index + 1}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="row" style={{ gap: 6 }}>
          <b style={{ fontSize: 17 }}>{day.title}</b>
          {next && <span className="badge" style={{ background: "var(--ink)", color: "var(--on-ink)" }}>Следующая</span>}
        </span>
        <div className="caption" style={{ marginTop: 2 }}>{day.focus}</div>
        <div className="caption" style={{ marginTop: 4 }}>
          <Clock size={12} style={{ verticalAlign: -1 }} /> {day.durationMin} мин · {day.exercises.length} упр. · {INTENSITY[day.intensity]}
        </div>
      </span>
    </button>
  );
}

export function WorkoutDetail({ index, onBack }: { index: number; onBack: () => void }) {
  const u = useUser()!;
  const day = u.program!.days[index];
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <Page
      title={day.title}
      onBack={onBack}
      bottom={
        <div className="tabbar-wrap" style={{ zIndex: 45 }}>
          <button className="btn btn-primary" style={{ pointerEvents: "auto" }} onClick={() => (haptic(15), setActive(true))}>
            <Play size={20} fill="currentColor" /> Начать тренировку
          </button>
        </div>
      }
    >
      <div className="hero-img fade-in" style={{ background: GRADIENTS[index % GRADIENTS.length], marginTop: 52 }}>
        <Dumbbell size={72} strokeWidth={1.5} style={{ opacity: 0.9 }} />
        <span className="badge glass" style={{ position: "absolute", left: 14, bottom: 14, color: "#fff", background: "rgba(255,255,255,.2)" }}>
          День {index + 1}
        </span>
      </div>
      <h1 className="large-title" style={{ marginTop: 18 }}>{day.title}</h1>
      <p className="muted" style={{ margin: "-6px 4px 14px" }}>{day.focus}</p>
      <div className="grid-3">
        <Stat label="минут" value={String(day.durationMin)} />
        <Stat label="упражнений" value={String(day.exercises.length)} />
        <Stat label="нагрузка" value={INTENSITY[day.intensity]} />
      </div>

      <div className="list-header">Разминка</div>
      <div className="list glass">
        {day.warmup.map((w) => (
          <div key={w} className="list-row plain">{w}</div>
        ))}
      </div>

      <div className="list-header">Упражнения</div>
      <div className="list glass">
        {day.exercises.map((e, i) => {
          const info = EXERCISES.find((x) => x.name.toLowerCase() === e.name.toLowerCase());
          const open = expanded === i;
          return (
            <div key={i}>
              <button className="list-row" onClick={() => setExpanded(open ? null : i)}>
                <span className="icon-tile" style={{ background: GRADIENTS[i % GRADIENTS.length], fontWeight: 700 }}>{i + 1}</span>
                <span style={{ flex: 1 }}>
                  <div>{e.name}</div>
                  <div className="caption">
                    {e.sets} × {e.reps} · отдых {e.restSec} с · {e.muscle}
                  </div>
                </span>
                <ChevronDown size={18} style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "transform .3s" }} />
              </button>
              {open && (
                <div className="fade-in" style={{ padding: "0 16px 14px 60px", fontSize: 15, lineHeight: 1.4 }}>
                  <div>💡 {e.tip}</div>
                  {info && (
                    <ol style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--label-2)" }}>
                      {info.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="list-header">Заминка</div>
      <div className="list glass">
        {day.cooldown.map((w) => (
          <div key={w} className="list-row plain">{w}</div>
        ))}
      </div>
      <div style={{ height: 40 }} />
      {active && <ActiveWorkout day={day} onClose={() => setActive(false)} onFinish={() => (setActive(false), onBack())} />}
    </Page>
  );
}

function ActiveWorkout({ day, onClose, onFinish }: { day: WorkoutDay; onClose: () => void; onFinish: () => void }) {
  const [ex, setEx] = useState(0);
  const [done, setDone] = useState<number[]>(() => day.exercises.map(() => 0));
  const [rest, setRest] = useState(0);
  const [restTotal, setRestTotal] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (paused || finished) return;
    const id = setInterval(() => {
      setElapsed((e) => e + 1);
      setRest((r) => {
        if (r === 1) haptic(40);
        return Math.max(0, r - 1);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, finished]);

  const cur = day.exercises[ex];
  const totalSets = useMemo(() => day.exercises.reduce((a, e) => a + e.sets, 0), [day]);
  const doneSets = done.reduce((a, b) => a + b, 0);

  const completeSet = () => {
    haptic(15);
    const nd = [...done];
    nd[ex] = Math.min(cur.sets, nd[ex] + 1);
    setDone(nd);
    if (nd[ex] >= cur.sets) {
      const nextEx = nd.findIndex((d, i) => d < day.exercises[i].sets);
      if (nextEx === -1) {
        setFinished(true);
        return;
      }
      setEx(nextEx);
    }
    setRest(cur.restSec);
    setRestTotal(cur.restSec);
  };

  const save = () => {
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const kg = getState().session ? (getState().data[getState().session!]?.profile.weightKg ?? 70) : 70;
    const met = day.intensity === "high" ? 7 : day.intensity === "medium" ? 5.5 : 4;
    updateUser((d) => ({
      ...d,
      workouts: [
        ...d.workouts,
        { id: uid(), date: today(), title: day.title, durationMin: minutes, sets: doneSets, calories: Math.round((met * kg * minutes) / 60) },
      ],
    }));
    toast("Тренировка сохранена 💪");
    onFinish();
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="push" style={{ zIndex: 60, display: "flex", flexDirection: "column" }}>
      <div className="ambient" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="topbar" style={{ position: "relative" }}>
        <button className="circle-btn glass" onClick={onClose} aria-label="Закрыть">
          <X size={22} />
        </button>
        <div className="spacer" />
        <span className="pill-btn glass" style={{ fontVariantNumeric: "tabular-nums" }}>
          <Clock size={18} /> {mmss(elapsed)}
        </span>
        <button className="circle-btn glass" onClick={() => setPaused((p) => !p)} aria-label="Пауза">
          {paused ? <Play size={20} /> : <Pause size={20} />}
        </button>
      </div>

      {finished ? (
        <div className="ob-body center fade-in" style={{ padding: 22, textAlign: "center", alignItems: "center" }}>
          <div className="glass" style={{ width: 140, height: 140, borderRadius: "50%", display: "grid", placeItems: "center" }}>
            <Trophy size={64} color="var(--yellow)" fill="var(--yellow)" />
          </div>
          <h1 style={{ fontSize: 32 }}>Отличная работа!</h1>
          <p className="muted">
            {doneSets} подходов · {mmss(elapsed)}
          </p>
          <button className="btn btn-primary" style={{ marginTop: 26 }} onClick={save}>Сохранить тренировку</button>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 20px calc(var(--safe-bottom) + 24px)" }}>
          <div className="bar" style={{ margin: "8px 0 20px" }}>
            <i style={{ width: `${(doneSets / totalSets) * 100}%`, background: "var(--green)" }} />
          </div>
          <div className="caption">Упражнение {ex + 1} из {day.exercises.length} · {cur.muscle}</div>
          <h1 style={{ fontSize: 30, margin: "6px 0 4px", letterSpacing: "-0.03em" }}>{cur.name}</h1>
          <div className="muted">💡 {cur.tip}</div>

          <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
            {rest > 0 ? (
              <Ring value={rest / restTotal} size={230} stroke={14} color="var(--teal)">
                <div style={{ textAlign: "center" }}>
                  <div className="caption">Отдых</div>
                  <div className="big-num" style={{ fontSize: 60, fontVariantNumeric: "tabular-nums" }}>{rest}</div>
                  <button className="badge" style={{ marginTop: 6 }} onClick={() => setRest(0)}>
                    <SkipForward size={12} /> Пропустить
                  </button>
                </div>
              </Ring>
            ) : (
              <Ring value={done[ex] / cur.sets} size={230} stroke={14} color="var(--green)">
                <div style={{ textAlign: "center" }}>
                  <div className="caption">Подход {Math.min(cur.sets, done[ex] + 1)} из {cur.sets}</div>
                  <div className="big-num" style={{ fontSize: 54 }}>{cur.reps}</div>
                  <div className="caption">повторений</div>
                </div>
              </Ring>
            )}
          </div>

          <div className="chips" style={{ marginBottom: 16 }}>
            {day.exercises.map((e, i) => (
              <button key={i} className={`chip ${i === ex ? "on" : ""}`} onClick={() => (setEx(i), setRest(0))}>
                {done[i] >= e.sets ? "✓ " : ""}
                {e.name}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={completeSet}>
            <Check size={22} /> Подход выполнен
          </button>
        </div>
      )}
    </div>
  );
}

function RegenSheet({ onClose }: { onClose: () => void }) {
  const u = useUser()!;
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(u.profile.workoutsPerWeek);
  const [place, setPlace] = useState(u.profile.place);

  const run = async () => {
    setBusy(true);
    const profile = { ...u.profile, workoutsPerWeek: days, place };
    const { data, ai } = await generateProgram(profile, wish);
    updateUser((d) => ({ ...d, profile, program: data }));
    setBusy(false);
    toast(ai ? "Новая программа от ИИ готова ✨" : "Программа обновлена (офлайн-режим)");
    onClose();
  };

  return (
    <Sheet title="Новая программа" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>ИИ составит новую программу с учётом ваших пожеланий.</p>
      <div className="list-header" style={{ marginLeft: 4 }}>Тренировок в неделю</div>
      <div className="chips">
        {[2, 3, 4, 5, 6].map((n) => (
          <button key={n} className={`chip ${days === n ? "on" : ""}`} onClick={() => setDays(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="list-header" style={{ marginLeft: 4 }}>Где</div>
      <div className="chips">
        {(
          [
            ["gym", "Зал"],
            ["home", "Дом"],
            ["outdoor", "Улица"],
          ] as const
        ).map(([v, l]) => (
          <button key={v} className={`chip ${place === v ? "on" : ""}`} onClick={() => setPlace(v)}>
            {l}
          </button>
        ))}
      </div>
      <div className="list-header" style={{ marginLeft: 4 }}>Пожелания</div>
      <textarea
        className="field"
        rows={3}
        placeholder="Например: больше на ягодицы, без прыжков, болит колено…"
        value={wish}
        onChange={(e) => setWish(e.target.value)}
      />
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={run} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" style={{ borderTopColor: "var(--on-ink)" }} /> ИИ думает…
          </>
        ) : (
          <>
            <RefreshCw size={18} /> Сгенерировать
          </>
        )}
      </button>
      <div className="caption" style={{ textAlign: "center", marginTop: 10 }}>
        <Flame size={12} style={{ verticalAlign: -1 }} /> История тренировок сохранится
      </div>
    </Sheet>
  );
}
