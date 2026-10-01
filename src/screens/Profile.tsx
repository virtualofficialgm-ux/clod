import { Bell, Flame, LogOut, Moon, Ruler, Scale, Target, Trash2, User } from "lucide-react";
import { useState } from "react";
import { computePlan, ageFrom } from "../../shared/nutrition";
import { Page, Row, Segmented, Sheet, toast } from "../components/ui";
import { fmtW } from "../onboarding/Onboarding";
import { setState, today, updateUser, useStore, useUser } from "../store";

const GOAL = { lose: "Похудеть", maintain: "Поддерживать", gain: "Набрать массу" };

export default function Profile({ onBack }: { onBack: () => void }) {
  const u = useUser()!;
  const theme = useStore((s) => s.theme);
  const account = useStore((s) => (s.session ? s.accounts[s.session] : null));
  const [edit, setEdit] = useState<"weight" | "goals" | null>(null);
  const p = u.profile;

  const weights = u.weights.slice(-12);
  const minW = Math.min(...weights.map((w) => w.kg), p.targetWeightKg) - 1;
  const maxW = Math.max(...weights.map((w) => w.kg), p.targetWeightKg) + 1;
  const pts = weights.map((w, i) => [weights.length === 1 ? 150 : 10 + (i * 280) / (weights.length - 1), 110 - ((w.kg - minW) / (maxW - minW)) * 100]);
  const targetY = 110 - ((p.targetWeightKg - minW) / (maxW - minW)) * 100;

  return (
    <Page title="Профиль" onBack={onBack}>
      <div style={{ textAlign: "center", marginTop: 56 }} className="fade-in">
        <div style={{ width: 96, height: 96, borderRadius: "50%", margin: "0 auto", background: "linear-gradient(135deg, var(--blue), var(--purple))", color: "#fff", display: "grid", placeItems: "center", fontSize: 40, fontWeight: 700 }}>
          {(p.name || "?")[0].toUpperCase()}
        </div>
        <h1 style={{ margin: "12px 0 2px", fontSize: 26 }}>{p.name}</h1>
        <div className="caption">
          {account?.provider === "email" ? account.email : account?.provider === "apple" ? "Вход через Apple" : "Вход через Google"}
        </div>
      </div>

      <div className="glass card" style={{ marginTop: 22 }}>
        <div className="row">
          <b>Вес</b>
          <span className="spacer" />
          <button className="btn btn-sm btn-primary" onClick={() => setEdit("weight")}>Записать</button>
        </div>
        <div className="row" style={{ marginTop: 8, alignItems: "baseline" }}>
          <span className="big-num" style={{ fontSize: 36 }}>{fmtW(weights[weights.length - 1]?.kg ?? p.weightKg, p.units)}</span>
          <span className="caption">цель {fmtW(p.targetWeightKg, p.units)}</span>
        </div>
        <svg viewBox="0 0 300 120" width="100%" style={{ marginTop: 10 }}>
          <line x1="0" x2="300" y1={targetY} y2={targetY} stroke="var(--green)" strokeDasharray="4 4" strokeWidth="1.5" />
          {pts.length > 1 && <polyline points={pts.map((x) => x.join(",")).join(" ")} fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4.5" fill="var(--bg-elevated)" stroke="var(--ink)" strokeWidth="2.5" />
          ))}
        </svg>
      </div>

      <div className="list-header">Мой план</div>
      <div className="list glass">
        <Row icon={<Flame size={18} />} color="var(--orange)" title="Калории" value={`${u.plan.calories} ккал`} chevron={false} />
        <Row icon={<span>🍗</span>} color="var(--protein)" title="Белки / Углеводы / Жиры" value={`${u.plan.protein} / ${u.plan.carbs} / ${u.plan.fat} г`} chevron={false} />
        <Row icon={<Target size={18} />} color="var(--green)" title="Цель" value={GOAL[p.goal]} onClick={() => setEdit("goals")} />
      </div>

      <div className="list-header">Данные</div>
      <div className="list glass">
        <Row icon={<User size={18} />} color="var(--blue)" title="Возраст" value={`${ageFrom(p.birthDate)}`} chevron={false} />
        <Row icon={<Ruler size={18} />} color="var(--indigo)" title="Рост" value={`${p.heightCm} см`} chevron={false} />
        <Row icon={<Scale size={18} />} color="var(--teal)" title="Тренировок в неделю" value={`${p.workoutsPerWeek}`} chevron={false} />
      </div>

      <div className="list-header">Настройки</div>
      <div className="list glass">
        <div className="list-row">
          <span className="icon-tile" style={{ background: "var(--indigo)" }}>
            <Moon size={18} />
          </span>
          <span>Тема</span>
          <span className="value" style={{ width: 200 }}>
            <Segmented
              value={theme}
              onChange={(t) => setState((s) => ({ ...s, theme: t }))}
              options={[
                { value: "system", label: "Авто" },
                { value: "light", label: "Светлая" },
                { value: "dark", label: "Тёмная" },
              ]}
            />
          </span>
        </div>
        <Row
          icon={<Bell size={18} />}
          color="var(--red)"
          title="Уведомления"
          onClick={() => {
            if ("Notification" in window) Notification.requestPermission().then((r) => toast(r === "granted" ? "Уведомления включены" : "Разрешите уведомления в настройках"));
          }}
        />
      </div>

      <div className="list glass" style={{ marginTop: 22 }}>
        <Row icon={<LogOut size={18} />} color="var(--label-3)" title="Выйти" onClick={() => setState((s) => ({ ...s, session: null }))} chevron={false} />
        <Row
          icon={<Trash2 size={18} />}
          color="var(--red)"
          title={<span style={{ color: "var(--red)" }}>Удалить аккаунт</span>}
          chevron={false}
          onClick={() => {
            if (!confirm("Удалить аккаунт и все данные на этом устройстве?")) return;
            setState((s) => {
              if (!s.session) return s;
              const { [s.session]: _a, ...accounts } = s.accounts;
              const { [s.session]: _d, ...data } = s.data;
              return { ...s, session: null, accounts, data };
            });
          }}
        />
      </div>
      <p className="caption" style={{ textAlign: "center", margin: "20px 0 40px" }}>
        Pulse не заменяет консультацию врача. Данные хранятся на этом устройстве.
      </p>

      {edit === "weight" && <WeightSheet onClose={() => setEdit(null)} />}
      {edit === "goals" && <GoalSheet onClose={() => setEdit(null)} />}
    </Page>
  );
}

function WeightSheet({ onClose }: { onClose: () => void }) {
  const u = useUser()!;
  const [kg, setKg] = useState(String(u.weights[u.weights.length - 1]?.kg ?? u.profile.weightKg));
  const save = () => {
    const v = Number(kg.replace(",", "."));
    if (!(v > 25 && v < 350)) return toast("Введите корректный вес");
    updateUser((d) => {
      const profile = { ...d.profile, weightKg: v };
      const weights = [...d.weights.filter((w) => w.date !== today()), { date: today(), kg: v }];
      return { ...d, profile, plan: computePlan(profile), weights };
    });
    toast("Вес записан, план пересчитан");
    onClose();
  };
  return (
    <Sheet title="Текущий вес" onClose={onClose}>
      <input className="field" style={{ fontSize: 34, height: 80, textAlign: "center", fontWeight: 700 }} inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} autoFocus />
      <div className="caption" style={{ textAlign: "center", margin: "8px 0 18px" }}>кг · {new Date().toLocaleDateString("ru-RU")}</div>
      <button className="btn btn-primary" onClick={save}>Сохранить</button>
    </Sheet>
  );
}

function GoalSheet({ onClose }: { onClose: () => void }) {
  const u = useUser()!;
  const [goal, setGoal] = useState(u.profile.goal);
  const [target, setTarget] = useState(String(u.profile.targetWeightKg));
  const [rate, setRate] = useState(u.profile.weeklyRateKg);
  const save = () => {
    const t = Number(target.replace(",", "."));
    updateUser((d) => {
      const profile = { ...d.profile, goal, targetWeightKg: goal === "maintain" ? d.profile.weightKg : t, weeklyRateKg: goal === "maintain" ? 0 : rate };
      return { ...d, profile, plan: computePlan(profile) };
    });
    toast("Цель обновлена");
    onClose();
  };
  return (
    <Sheet title="Цель" onClose={onClose}>
      <Segmented
        value={goal}
        onChange={setGoal}
        options={[
          { value: "lose", label: "Похудеть" },
          { value: "maintain", label: "Держать" },
          { value: "gain", label: "Набрать" },
        ]}
      />
      {goal !== "maintain" && (
        <>
          <div className="list-header" style={{ marginLeft: 4 }}>Целевой вес, кг</div>
          <input className="field" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          <div className="list-header" style={{ marginLeft: 4 }}>Темп: {rate.toFixed(1)} кг/нед</div>
          <input className="slider" type="range" min={0.1} max={goal === "gain" ? 0.7 : 1.5} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </>
      )}
      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={save}>Сохранить</button>
    </Sheet>
  );
}
