import { Bell, Check, Crown, Lock, Minus, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Ambient, Overlay, haptic, toast } from "../components/ui";
import { FREE_LIMITS, PLANS, isPlus, registerPaywall, subscribe, type PaywallReason, type PlanId } from "../subscription";
import { updateUser, useUser } from "../store";

const REASON: Record<PaywallReason, string> = {
  welcome: "Получите максимум от Parri",
  scans: `Бесплатные ИИ-сканы на этой неделе закончились (${FREE_LIMITS.scans} из ${FREE_LIMITS.scans})`,
  chat: `Бесплатные сообщения ИИ на этой неделе закончились (${FREE_LIMITS.chat} из ${FREE_LIMITS.chat})`,
  ai_plan: "Программа от ИИ по вашему дневнику — в Parri Plus",
  ai_menu: "Меню от ИИ под бюджет и вкусы — в Parri Plus",
  profile: "Parri Plus",
};

const FEATURES: [string, boolean | string, string][] = [
  ["План тренировок и меню", "базовый", "от ИИ"],
  ["Дневник и адаптивная нагрузка", true, "✓"],
  ["Список покупок и аллергены", true, "✓"],
  ["ИИ-сканы: еда, тренажёры, продукты", `${FREE_LIMITS.scans} в нед.`, "без лимита"],
  ["Чат с ИИ", `${FREE_LIMITS.chat} в нед.`, "без лимита"],
  ["Корректировка плана по факту", false, "✓"],
];

export function PaywallHost() {
  const [reason, setReason] = useState<PaywallReason | null>(null);
  useEffect(() => {
    registerPaywall(setReason);
    return () => registerPaywall(null);
  }, []);
  return reason ? <Paywall reason={reason} onClose={() => setReason(null)} /> : null;
}

function Paywall({ reason, onClose }: { reason: PaywallReason; onClose: () => void }) {
  const u = useUser();
  const [plan, setPlan] = useState<PlanId>("yearly");
  const [leaving, setLeaving] = useState(false);
  const trial = PLANS[plan].trialDays > 0;
  const close = () => {
    setLeaving(true);
    setTimeout(onClose, 280);
  };

  useEffect(() => {
    updateUser((d) => (d.paywallSeen ? d : { ...d, paywallSeen: true }));
  }, []);

  const buy = () => {
    haptic(20);
    subscribe(plan);
    toast(trial ? "Пробный период начат ✨" : "Parri Plus активирован ✨");
    close();
  };

  const charge = new Date(Date.now() + PLANS.yearly.trialDays * 864e5).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

  return (
    <Overlay>
      <div className={`push paywall ${leaving ? "leaving-down" : ""}`} style={{ zIndex: 80 }}>
        <Ambient />
        <div className="screen" style={{ paddingTop: "calc(var(--safe-top) + 14px)", paddingBottom: "calc(var(--safe-bottom) + 200px)" }}>
          <div className="row">
            <span className="spacer" />
            <button className="circle-btn glass" onClick={close} aria-label="Закрыть">
              <X size={20} />
            </button>
          </div>
          <div style={{ textAlign: "center" }} className="fade-in">
            <div className="plus-badge">
              <Crown size={34} />
            </div>
            <div className="caption" style={{ fontWeight: 700, letterSpacing: ".08em", marginTop: 14 }}>PARRI PLUS</div>
            <h1 style={{ fontSize: 28, letterSpacing: "-0.03em", margin: "6px 10px 6px", textWrap: "balance" }}>{REASON[reason]}</h1>
            <p className="muted" style={{ margin: "0 12px", lineHeight: 1.4 }}>Тренировки и питание с ИИ без лимитов — один план на обе цели.</p>
          </div>

          {isPlus(u) && (
            <div className="glass card row" style={{ marginTop: 16 }}>
              <Check size={20} color="var(--green)" />
              <b>Parri Plus уже активен</b>
            </div>
          )}

          <div className="glass card compare" style={{ marginTop: 18, padding: "6px 0" }}>
            <div className="compare-row head">
              <span />
              <span>Free</span>
              <span>Plus</span>
            </div>
            {FEATURES.map(([name, free, plus]) => (
              <div key={name} className="compare-row">
                <span>{name}</span>
                <span className="muted">{free === true ? <Check size={16} /> : free === false ? <Minus size={16} /> : free}</span>
                <span className="plus">{plus === "✓" ? <Check size={16} strokeWidth={3} /> : plus}</span>
              </div>
            ))}
          </div>

          {trial && (
            <div className="glass card" style={{ marginTop: 12 }}>
              <div className="timeline">
                <div>
                  <span className="tl-dot" style={{ background: "var(--green)" }}>
                    <Lock size={14} />
                  </span>
                  <span>
                    <b>Сегодня</b>
                    <div className="caption">Полный доступ ко всему Parri Plus</div>
                  </span>
                </div>
                <div>
                  <span className="tl-dot" style={{ background: "var(--orange)" }}>
                    <Bell size={14} />
                  </span>
                  <span>
                    <b>Через 5 дней</b>
                    <div className="caption">Напомним, что пробный период заканчивается</div>
                  </span>
                </div>
                <div>
                  <span className="tl-dot" style={{ background: "var(--ink)", color: "var(--on-ink)" }}>
                    <Crown size={14} />
                  </span>
                  <span>
                    <b>{charge}</b>
                    <div className="caption">Первое списание ${PLANS.yearly.price}, если не отмените раньше</div>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="paywall-foot glass strong">
          <div className="grid-2">
            {(["yearly", "monthly"] as const).map((id) => {
              const p = PLANS[id];
              return (
                <button key={id} className={`plan ${plan === id ? "on" : ""}`} onClick={() => (haptic(), setPlan(id))}>
                  {p.save > 0 && <span className="plan-tag">Выгода {p.save}%</span>}
                  <span className="caption" style={{ fontWeight: 600 }}>{p.label}</span>
                  <b className="mid-num">${p.price}</b>
                  <span className="caption">{id === "yearly" ? `$${p.perMonth}/мес · ${p.trialDays} дней бесплатно` : "в месяц"}</span>
                </button>
              );
            })}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={buy}>
            <Sparkles size={18} /> {trial ? `Попробовать ${PLANS.yearly.trialDays} дней бесплатно` : `Оформить за $${PLANS.monthly.price} в месяц`}
          </button>
          <p className="caption" style={{ textAlign: "center", fontSize: 12, margin: "8px 0 0", lineHeight: 1.35 }}>
            {trial ? `Затем $${PLANS.yearly.price} в год. ` : ""}Отмена в любой момент в профиле. Демо-версия: оплата не подключена, подписка активируется без списания.
          </p>
        </div>
      </div>
    </Overlay>
  );
}
