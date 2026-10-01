import {
  BookOpen, Check, ChevronDown, ChevronRight, Clock, Dumbbell, Minus, Pause, Play, Plus, RefreshCw, SkipForward, Sparkles,
  Trophy, UserRound, Video, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { suggest, type Feedback, type SetLog } from "../../shared/progression";
import type { WorkoutDay } from "../../shared/types";
import { generateProgram } from "../api";
import { Page, Ring, ScreenWithTitle, Sheet, Toggle, haptic, toast } from "../components/ui";
import { EXERCISES } from "../data/exercises";
import { getState, today, trainingLog, uid, updateUser, useUser, type UserData, type WorkoutLog } from "../store";
import EquipmentScanner from "./EquipmentScanner";
import { ScanBanner } from "./Home";
import Library from "./Library";
import Trainers from "./Trainers";

const INTENSITY = { low: "Лёгкая", medium: "Средняя", high: "Высокая" };
const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const FEEDBACK: Record<Feedback, { label: string; emoji: string }> = {
  easy: { label: "Легко", emoji: "😌" },
  ok: { label: "Нормально", emoji: "🙂" },
  hard: { label: "Тяжело", emoji: "😮‍💨" },
  pain: { label: "Был дискомфорт или боль", emoji: "⚠️" },
};
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

function mondayOf(d: Date) {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return m;
}

/** Share of planned sessions completed, per week, oldest first. */
export function weeklyCompletion(u: UserData, weeks = 8) {
  const planned = Math.max(1, u.profile.days?.length || u.profile.workoutsPerWeek);
  const start = mondayOf(new Date());
  return Array.from({ length: weeks }, (_, i) => {
    const from = new Date(start);
    from.setDate(start.getDate() - 7 * (weeks - 1 - i));
    const to = new Date(from);
    to.setDate(from.getDate() + 7);
    const done = u.workouts.filter((w) => w.date >= today(from) && w.date < today(to)).length;
    return { from, done, planned, rate: Math.min(1, done / planned) };
  });
}

export default function Workouts() {
  const u = useUser()!;
  const [open, setOpen] = useState<number | null>(null);
  const [regen, setRegen] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [trainers, setTrainers] = useState(false);
  const [library, setLibrary] = useState(false);
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [adapting, setAdapting] = useState(false);
  const program = u.program;

  const weeks = weeklyCompletion(u);
  const thisWeek = weeks[weeks.length - 1];
  const weekNo = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / (7 * 864e5)) + 1;
  const withFeedback = u.workouts.filter((w) => w.feedback).length;

  const adapt = async () => {
    setAdapting(true);
    const { data, ai } = await generateProgram(u.profile, "", trainingLog(u));
    updateUser((d) => ({ ...d, program: data }));
    setAdapting(false);
    toast(ai ? "План скорректирован по вашим тренировкам ✨" : "План обновлён (офлайн-режим)");
  };

  return (
    <>
      <ScreenWithTitle
        title="Fit"
        kicker={program?.name ?? "Parri Fit"}
        right={
          <>
            <button className="circle-btn glass" onClick={() => setLibrary(true)} aria-label="Знания">
              <BookOpen size={20} />
            </button>
            <button className="circle-btn glass" onClick={() => setRegen(true)} aria-label="Пересоздать программу">
              <Sparkles size={20} />
            </button>
          </>
        }
      >
        {!program ? (
          <div className="glass card row">
            <span className="spinner" />
            <div>
              <b>ИИ составляет программу…</b>
              <div className="caption">Обычно это занимает до минуты</div>
            </div>
          </div>
        ) : (
          <div className="stagger">
            <div className="glass card">
              <div className="row" style={{ alignItems: "flex-start" }}>
                <Ring value={thisWeek.rate} size={86} stroke={9} color="var(--green)">
                  <b className="mid-num" style={{ fontSize: 18 }}>
                    {thisWeek.done}/{thisWeek.planned}
                  </b>
                </Ring>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="caption" style={{ fontWeight: 600 }}>НЕДЕЛЯ {weekNo}</div>
                  <b style={{ fontSize: 17 }}>
                    {thisWeek.done >= thisWeek.planned ? "План недели выполнен 🎉" : `Осталось ${thisWeek.planned - thisWeek.done} из ${thisWeek.planned}`}
                  </b>
                  <div className="weeks-bars" aria-label="Выполнение по неделям">
                    {weeks.map((w, i) => (
                      <i key={i} title={`${w.done}/${w.planned}`} style={{ height: `${Math.max(8, w.rate * 100)}%`, opacity: i === weeks.length - 1 ? 1 : 0.55 }} />
                    ))}
                  </div>
                  <div className="caption">Выполнение плана за 8 недель</div>
                </div>
              </div>
              {withFeedback > 0 && (
                <button className="btn btn-tinted" style={{ height: 46, marginTop: 14 }} onClick={adapt} disabled={adapting}>
                  {adapting ? <span className="spinner" /> : <RefreshCw size={18} />} Скорректировать по факту
                </button>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <ScanBanner onClick={() => setScanner(true)} />
            </div>

            <div className="section-title">План на неделю</div>
            <p className="muted" style={{ margin: "-4px 4px 12px", lineHeight: 1.4 }}>{program.summary}</p>
            <div className="stack">
              {program.days.map((d, i) => (
                <DayCard key={i} day={d} index={i} weekday={u.profile.days?.[i]} next={i === nextDayIndex(u)} onClick={() => setOpen(i)} />
              ))}
            </div>

            <div className="section-title">Ещё в Parri Fit</div>
            <div className="list glass">
              <button className="list-row" onClick={() => setTrainers(true)}>
                <span className="icon-tile" style={{ background: "var(--indigo)" }}>
                  <UserRound size={18} />
                </span>
                <span style={{ flex: 1 }}>
                  <div>Подобрать тренера</div>
                  <div className="caption">Под вашу цель и ограничения</div>
                </span>
                <ChevronRight size={18} style={{ opacity: 0.45 }} />
              </button>
              <button className="list-row" onClick={() => setLibrary(true)}>
                <span className="icon-tile" style={{ background: "var(--blue)" }}>
                  <BookOpen size={18} />
                </span>
                <span style={{ flex: 1 }}>
                  <div>Знания и упражнения</div>
                  <div className="caption">Статьи, техника, калькуляторы</div>
                </span>
                <ChevronRight size={18} style={{ opacity: 0.45 }} />
              </button>
            </div>

            <div className="glass card" style={{ marginTop: 12 }}>
              <div className="row">
                <span className="icon-tile" style={{ background: "var(--pink)" }}>
                  <Video size={18} />
                </span>
                <b style={{ flex: 1 }}>Анализ техники по видео</b>
                <span className="badge">Скоро</span>
              </div>
              <p className="caption" style={{ fontSize: 14, lineHeight: 1.4, margin: "10px 0" }}>
                Запустим после проверки точности. Видео будет обрабатываться только с вашего отдельного согласия.
              </p>
              <div className="row">
                <span style={{ flex: 1 }}>Сообщить о запуске</span>
                <Toggle on={!!u.videoWaitlist} onChange={(v) => updateUser((d) => ({ ...d, videoWaitlist: v }))} />
              </div>
            </div>

            {program.tips.length > 0 && (
              <>
                <div className="section-title">Советы</div>
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

            <div className="section-title">Дневник</div>
            {u.workouts.length === 0 ? (
              <div className="glass card caption" style={{ fontSize: 15, textAlign: "center" }}>
                Здесь появятся ваши тренировки: подходы, веса и как всё прошло.
              </div>
            ) : (
              <div className="list glass">
                {u.workouts
                  .slice(-12)
                  .reverse()
                  .map((w) => (
                    <button key={w.id} className="list-row" onClick={() => setLog(w)}>
                      <span className="icon-tile" style={{ background: w.feedback === "pain" ? "var(--orange)" : "var(--green)" }}>
                        {w.feedback ? FEEDBACK[w.feedback].emoji : <Check size={18} />}
                      </span>
                      <span style={{ flex: 1 }}>
                        <div>{w.title}</div>
                        <div className="caption">
                          {new Date(w.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · {w.durationMin} мин · {w.sets} подходов
                        </div>
                      </span>
                      <ChevronRight size={18} style={{ opacity: 0.45 }} />
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </ScreenWithTitle>
      {open !== null && <WorkoutDetail index={open} onBack={() => setOpen(null)} />}
      {regen && <RegenSheet onClose={() => setRegen(false)} />}
      {scanner && <EquipmentScanner onBack={() => setScanner(false)} />}
      {trainers && <Trainers onBack={() => setTrainers(false)} />}
      {library && <Library asPage onBack={() => setLibrary(false)} />}
      {log && <LogSheet log={log} onClose={() => setLog(null)} />}
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

function DayCard({ day, index, weekday, next, onClick }: { day: WorkoutDay; index: number; weekday?: number; next: boolean; onClick: () => void }) {
  return (
    <button className="glass card" style={{ width: "100%", textAlign: "left", display: "flex", gap: 14, alignItems: "center" }} onClick={onClick}>
      <span style={{ width: 56, height: 56, borderRadius: 18, background: GRADIENTS[index % GRADIENTS.length], color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: weekday !== undefined ? 17 : 20, flex: "none" }}>
        {weekday !== undefined ? WEEK[weekday] : index + 1}
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
          {u.profile.days?.[index] !== undefined ? WEEK[u.profile.days[index]] : `День ${index + 1}`}
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
          const s = suggest(e.reps, u.exerciseLog?.[e.name]);
          const open = expanded === i;
          return (
            <div key={i}>
              <button className="list-row" onClick={() => setExpanded(open ? null : i)}>
                <span className="icon-tile" style={{ background: GRADIENTS[i % GRADIENTS.length], fontWeight: 700 }}>{i + 1}</span>
                <span style={{ flex: 1 }}>
                  <div>{e.name}</div>
                  <div className="caption">
                    {e.sets} × {e.reps} · отдых {e.restSec} с{s && s.weight > 0 ? ` · ${s.weight} кг` : ""}
                  </div>
                </span>
                <ChevronDown size={18} style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "transform .3s" }} />
              </button>
              {open && (
                <div className="fade-in" style={{ padding: "0 16px 14px 60px", fontSize: 15, lineHeight: 1.4 }}>
                  {s && u.exerciseLog?.[e.name] && <div style={{ color: s.caution ? "var(--orange)" : "var(--green)", marginBottom: 6 }}>↗ {s.note}</div>}
                  <div>💡 {e.tip}</div>
                  {info && (
                    <ol style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--label-2)" }}>
                      {info.steps.map((st) => (
                        <li key={st}>{st}</li>
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
      {active && <ActiveWorkout day={day} dayIndex={index} onClose={() => setActive(false)} onFinish={() => (setActive(false), onBack())} />}
    </Page>
  );
}

function Stepper({ label, value, step, unit, onChange }: { label: string; value: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="stepper glass">
      <button onClick={() => (haptic(4), onChange(Math.max(0, Math.round((value - step) * 10) / 10)))} aria-label={`Меньше: ${label}`}>
        <Minus size={18} />
      </button>
      <div>
        <b>
          {value}
          {unit && <small> {unit}</small>}
        </b>
        <span>{label}</span>
      </div>
      <button onClick={() => (haptic(4), onChange(Math.round((value + step) * 10) / 10))} aria-label={`Больше: ${label}`}>
        <Plus size={18} />
      </button>
    </div>
  );
}

function ActiveWorkout({ day, dayIndex, onClose, onFinish }: { day: WorkoutDay; dayIndex: number; onClose: () => void; onFinish: () => void }) {
  const u = useUser()!;
  const suggestions = useMemo(() => day.exercises.map((e) => suggest(e.reps, u.exerciseLog?.[e.name])), [day, u.exerciseLog]);
  const [ex, setEx] = useState(0);
  const [logs, setLogs] = useState<SetLog[][]>(() => day.exercises.map(() => []));
  const [weight, setWeight] = useState(suggestions[0]?.weight ?? 0);
  const [reps, setReps] = useState(suggestions[0]?.reps ?? 10);
  const [rest, setRest] = useState(0);
  const [restTotal, setRestTotal] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [painful, setPainful] = useState<string[]>([]);

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
  const timed = !suggestions[ex];
  const totalSets = useMemo(() => day.exercises.reduce((a, e) => a + e.sets, 0), [day]);
  const doneSets = logs.reduce((a, l) => a + l.length, 0);

  const goTo = (i: number) => {
    setEx(i);
    const last = logs[i][logs[i].length - 1];
    setWeight(last?.weight ?? suggestions[i]?.weight ?? 0);
    setReps(last?.reps ?? suggestions[i]?.reps ?? 10);
  };

  const completeSet = () => {
    haptic(15);
    const nl = logs.map((l, i) => (i === ex ? [...l, { weight, reps: timed ? 1 : reps }] : l));
    setLogs(nl);
    if (nl[ex].length >= cur.sets) {
      const nextEx = nl.findIndex((l, i) => l.length < day.exercises[i].sets);
      if (nextEx === -1) {
        setFinished(true);
        return;
      }
      goTo(nextEx);
    }
    setRest(cur.restSec);
    setRestTotal(cur.restSec);
  };

  const save = () => {
    if (!feedback) return;
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const kg = getState().session ? (getState().data[getState().session!]?.profile.weightKg ?? 70) : 70;
    const met = day.intensity === "high" ? 7 : day.intensity === "medium" ? 5.5 : 4;
    const date = today();
    const entries = day.exercises.map((e, i) => ({ name: e.name, sets: logs[i] })).filter((e) => e.sets.length);
    updateUser((d) => {
      const exerciseLog = { ...(d.exerciseLog ?? {}) };
      entries.forEach((e) => {
        if (!suggestions[day.exercises.findIndex((x) => x.name === e.name)]) return; // timed sets are not progressed
        const fb: Feedback = painful.includes(e.name) ? "pain" : feedback === "pain" ? "hard" : feedback;
        exerciseLog[e.name] = [...(exerciseLog[e.name] ?? []), { date, sets: e.sets, feedback: fb }].slice(-12);
      });
      return {
        ...d,
        exerciseLog,
        workouts: [
          ...d.workouts,
          { id: uid(), date, title: day.title, durationMin: minutes, sets: doneSets, calories: Math.round((met * kg * minutes) / 60), dayIndex, feedback, entries },
        ],
      };
    });
    toast(feedback === "pain" ? "Сохранено. Нагрузку на эти упражнения снизим" : "Тренировка сохранена 💪");
    onFinish();
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const sg = suggestions[ex];

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
        <div className="screen" style={{ position: "relative", flex: 1, paddingTop: 10 }}>
          <div className="fade-in" style={{ textAlign: "center" }}>
            <div className="glass" style={{ width: 110, height: 110, borderRadius: "50%", display: "grid", placeItems: "center", margin: "0 auto" }}>
              <Trophy size={52} color="var(--yellow)" fill="var(--yellow)" />
            </div>
            <h1 style={{ fontSize: 28, margin: "14px 0 4px" }}>Тренировка завершена</h1>
            <p className="muted" style={{ margin: 0 }}>
              {doneSets} подходов · {mmss(elapsed)}
            </p>
          </div>
          <h3 style={{ margin: "26px 4px 10px" }}>Как прошло?</h3>
          <p className="caption" style={{ margin: "-6px 4px 12px", fontSize: 14 }}>По ответу скорректируем нагрузку на следующий раз.</p>
          {(Object.keys(FEEDBACK) as Feedback[]).map((k) => (
            <button key={k} className={`option ${feedback === k ? "on" : ""}`} onClick={() => (haptic(), setFeedback(k))}>
              <span className="opt-icon" style={{ fontSize: 20 }}>{FEEDBACK[k].emoji}</span>
              {FEEDBACK[k].label}
            </button>
          ))}
          {feedback === "pain" && (
            <div className="fade-in" style={{ marginTop: 14 }}>
              <div className="caption" style={{ fontSize: 14, margin: "0 4px 8px" }}>Где было некомфортно? Снизим вес и предложим замену.</div>
              <div className="chips" style={{ flexWrap: "wrap", margin: 0, padding: 0 }}>
                {day.exercises.map((e) => {
                  const on = painful.includes(e.name);
                  return (
                    <button key={e.name} className={`chip ${on ? "on" : ""}`} onClick={() => setPainful(on ? painful.filter((x) => x !== e.name) : [...painful, e.name])}>
                      {e.name}
                    </button>
                  );
                })}
              </div>
              <p className="caption" style={{ fontSize: 13, lineHeight: 1.4, margin: "12px 4px 0" }}>
                Parri не ставит диагнозы. Если боль острая или не проходит — обратитесь к врачу.
              </p>
            </div>
          )}
          <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={!feedback} onClick={save}>
            Сохранить в дневник
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 20px calc(var(--safe-bottom) + 24px)", minHeight: 0 }}>
          <div className="bar" style={{ margin: "8px 0 16px" }}>
            <i style={{ width: `${(doneSets / totalSets) * 100}%`, background: "var(--green)" }} />
          </div>
          <div className="caption">Упражнение {ex + 1} из {day.exercises.length} · {cur.muscle}</div>
          <h1 style={{ fontSize: 28, margin: "6px 0 4px", letterSpacing: "-0.03em" }}>{cur.name}</h1>
          <div className="muted" style={{ fontSize: 15 }}>{sg && u.exerciseLog?.[cur.name] ? `↗ ${sg.note}` : `💡 ${cur.tip}`}</div>

          <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: 180 }}>
            {rest > 0 ? (
              <Ring value={rest / restTotal} size={190} stroke={13} color="var(--teal)">
                <div style={{ textAlign: "center" }}>
                  <div className="caption">Отдых</div>
                  <div className="big-num" style={{ fontSize: 54, fontVariantNumeric: "tabular-nums" }}>{rest}</div>
                  <button className="badge" style={{ marginTop: 6 }} onClick={() => setRest(0)}>
                    <SkipForward size={12} /> Пропустить
                  </button>
                </div>
              </Ring>
            ) : (
              <Ring value={logs[ex].length / cur.sets} size={190} stroke={13} color="var(--green)">
                <div style={{ textAlign: "center" }}>
                  <div className="caption">Подход {Math.min(cur.sets, logs[ex].length + 1)} из {cur.sets}</div>
                  <div className="big-num" style={{ fontSize: 44 }}>{cur.reps}</div>
                  <div className="caption">по плану</div>
                </div>
              </Ring>
            )}
          </div>

          {!timed && (
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <Stepper label="вес" unit="кг" value={weight} step={2.5} onChange={setWeight} />
              <Stepper label="повторы" unit="" value={reps} step={1} onChange={setReps} />
            </div>
          )}
          <div className="chips" style={{ marginBottom: 12 }}>
            {day.exercises.map((e, i) => (
              <button key={i} className={`chip ${i === ex ? "on" : ""}`} onClick={() => (goTo(i), setRest(0))}>
                {logs[i].length >= e.sets ? "✓ " : ""}
                {e.name}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-primary" onClick={completeSet}>
              <Check size={22} /> Подход выполнен
            </button>
            {doneSets > 0 && (
              <button className="btn btn-tinted" style={{ width: 120, flex: "none" }} onClick={() => setFinished(true)}>
                Финиш
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LogSheet({ log, onClose }: { log: WorkoutLog; onClose: () => void }) {
  return (
    <Sheet title={log.title} onClose={onClose}>
      <div className="caption" style={{ fontSize: 15 }}>
        {new Date(log.date).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })} · {log.durationMin} мин · ≈{log.calories} ккал
      </div>
      {log.feedback && (
        <div className="badge" style={{ marginTop: 10 }}>
          {FEEDBACK[log.feedback].emoji} {FEEDBACK[log.feedback].label}
        </div>
      )}
      <div className="list glass" style={{ marginTop: 14 }}>
        {(log.entries ?? []).map((e) => (
          <div key={e.name} className="list-row plain" style={{ display: "block" }}>
            <div style={{ fontWeight: 600 }}>{e.name}</div>
            <div className="caption">{e.sets.map((s) => (s.weight ? `${s.weight} кг × ${s.reps}` : `${s.reps}`)).join(" · ")}</div>
          </div>
        ))}
        {!log.entries?.length && <div className="list-row plain caption">Подробности подходов не записаны</div>}
      </div>
    </Sheet>
  );
}

function RegenSheet({ onClose }: { onClose: () => void }) {
  const u = useUser()!;
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState<number[]>(u.profile.days ?? [0, 2, 4]);
  const [place, setPlace] = useState(u.profile.place);

  const run = async () => {
    setBusy(true);
    const profile = { ...u.profile, days, workoutsPerWeek: days.length, place };
    const { data, ai } = await generateProgram(profile, wish, trainingLog(u));
    updateUser((d) => ({ ...d, profile, program: data }));
    setBusy(false);
    toast(ai ? "Новая программа от ИИ готова ✨" : "Программа обновлена (офлайн-режим)");
    onClose();
  };

  return (
    <Sheet title="Новая программа" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>ИИ составит программу с учётом пожеланий и того, как прошли ваши тренировки.</p>
      <div className="list-header" style={{ marginLeft: 4 }}>Дни тренировок</div>
      <div className="chips">
        {WEEK.map((d, i) => {
          const on = days.includes(i);
          return (
            <button key={d} className={`chip ${on ? "on" : ""}`} onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i].sort())}>
              {d}
            </button>
          );
        })}
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
        id="regen-wish"
        className="field"
        rows={3}
        placeholder="Например: больше на ягодицы, без прыжков…"
        value={wish}
        onChange={(e) => setWish(e.target.value)}
      />
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={run} disabled={busy || !days.length}>
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
      <div className="caption" style={{ textAlign: "center", marginTop: 10 }}>Дневник тренировок сохранится</div>
    </Sheet>
  );
}
