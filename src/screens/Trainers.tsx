import { CalendarCheck, Info, MapPin, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import type { Profile } from "../../shared/types";
import { Page, Sheet, haptic, toast } from "../components/ui";
import { uid, updateUser, useUser } from "../store";

interface Trainer {
  id: string;
  name: string;
  initials: string;
  color: string;
  focus: string;
  tags: string[]; // matched against the profile
  formats: ("Зал" | "Онлайн" | "На улице" | "Дома")[];
  priceRub: number;
  experienceYears: number;
  about: string;
}

// Demo partner profiles until real partner onboarding is connected.
const TRAINERS: Trainer[] = [
  { id: "t1", name: "Тренер A", initials: "A", color: "linear-gradient(135deg,#ff9f0a,#ff375f)", focus: "Снижение веса и кондиции", tags: ["lose", "beginner", "home", "gym"], formats: ["Зал", "Онлайн"], priceRub: 1800, experienceYears: 6, about: "Силовые и круговые тренировки для снижения веса, работа с новичками." },
  { id: "t2", name: "Тренер B", initials: "B", color: "linear-gradient(135deg,#0a84ff,#5e5ce6)", focus: "Набор мышечной массы", tags: ["gain", "intermediate", "advanced", "gym"], formats: ["Зал"], priceRub: 2500, experienceYears: 9, about: "Программы на гипертрофию, техника базовых упражнений, прогрессия нагрузки." },
  { id: "t3", name: "Тренер C", initials: "C", color: "linear-gradient(135deg,#30d158,#40c8e0)", focus: "Мягкий старт и ограничения", tags: ["limits", "beginner", "maintain", "home"], formats: ["Онлайн", "Дома"], priceRub: 2200, experienceYears: 11, about: "Тренировки с учётом ограничений колен, спины и плеч; согласует нагрузку с рекомендациями врача." },
  { id: "t4", name: "Тренер D", initials: "D", color: "linear-gradient(135deg,#bf5af2,#5e5ce6)", focus: "Функциональный тренинг на улице", tags: ["outdoor", "lose", "maintain", "intermediate"], formats: ["На улице", "Онлайн"], priceRub: 1500, experienceYears: 5, about: "Турники, бег, функциональные круги. Групповые и персональные занятия." },
  { id: "t5", name: "Тренер E", initials: "E", color: "linear-gradient(135deg,#ffd60a,#ff9f0a)", focus: "Сила и выносливость", tags: ["advanced", "gain", "maintain", "gym"], formats: ["Зал", "Онлайн"], priceRub: 3000, experienceYears: 12, about: "Пауэрлифтинг и силовая выносливость для опытных." },
];

function score(t: Trainer, p: Profile) {
  let s = 0;
  if (t.tags.includes(p.goal)) s += 3;
  if (t.tags.includes(p.experience)) s += 2;
  if (t.tags.includes(p.place)) s += 2;
  if ((p.limitations?.length || p.limitationsNote) && t.tags.includes("limits")) s += 4;
  return s;
}

export default function Trainers({ onBack }: { onBack: () => void }) {
  const u = useUser()!;
  const [book, setBook] = useState<Trainer | null>(null);
  const list = useMemo(() => [...TRAINERS].sort((a, b) => score(b, u.profile) - score(a, u.profile)), [u.profile]);
  const bookings = u.bookings ?? [];

  return (
    <Page title="Тренеры" onBack={onBack}>
      <h1 className="large-title">
        <small>Parri Fit</small>
        Подбор тренера
      </h1>
      <div className="glass card row" style={{ alignItems: "flex-start", marginBottom: 14 }}>
        <Info size={20} style={{ flex: "none", marginTop: 2 }} color="var(--blue)" />
        <span className="caption" style={{ fontSize: 14, lineHeight: 1.4 }}>
          Демо-профили: каталог партнёров ещё подключается. Подбор учитывает вашу цель, опыт, место тренировок и ограничения.
        </span>
      </div>

      {bookings.length > 0 && (
        <>
          <div className="list-header">Мои заявки</div>
          <div className="list glass" style={{ marginBottom: 8 }}>
            {bookings.map((b) => {
              const t = TRAINERS.find((x) => x.id === b.trainerId);
              return (
                <div key={b.id} className="list-row">
                  <span className="icon-tile" style={{ background: "var(--green)" }}>
                    <CalendarCheck size={18} />
                  </span>
                  <span>
                    <div>{t?.name ?? "Тренер"}</div>
                    <div className="caption">{new Date(b.slot).toLocaleString("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  </span>
                  <span className="value badge">Ждёт подтверждения</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="stack">
        {list.map((t, i) => (
          <div key={t.id} className="glass card">
            <div className="row">
              <span style={{ width: 54, height: 54, borderRadius: "50%", background: t.color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 20, flex: "none" }}>{t.initials}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="row" style={{ gap: 6 }}>
                  <b>{t.name}</b>
                  {i === 0 && <span className="badge" style={{ background: "var(--ink)", color: "var(--on-ink)" }}>Лучшее совпадение</span>}
                </span>
                <div className="caption">{t.focus} · опыт {t.experienceYears} лет</div>
              </span>
            </div>
            <p style={{ margin: "12px 0", lineHeight: 1.4, fontSize: 15 }}>{t.about}</p>
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              {t.formats.map((f) => (
                <span key={f} className="badge">
                  <MapPin size={11} /> {f}
                </span>
              ))}
              <span className="spacer" />
              <b>{t.priceRub.toLocaleString("ru-RU")} ₽</b>
              <span className="caption">/ занятие</span>
            </div>
            <button className="btn btn-primary" style={{ height: 46, marginTop: 14 }} onClick={() => (haptic(), setBook(t))}>
              Записаться
            </button>
          </div>
        ))}
      </div>

      <div className="glass card row" style={{ marginTop: 16, alignItems: "flex-start" }}>
        <span style={{ fontSize: 22 }}>🧰</span>
        <span className="caption" style={{ fontSize: 14, lineHeight: 1.4 }}>
          Нужен диетолог, массажист или реабилитолог? Поиск специалистов появится через <b>Parri Tasks</b>.
        </span>
      </div>
      <div style={{ height: 30 }} />
      {book && <BookingSheet trainer={book} onClose={() => setBook(null)} />}
    </Page>
  );
}

function BookingSheet({ trainer, onClose }: { trainer: Trainer; onClose: () => void }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
  const [day, setDay] = useState(0);
  const [time, setTime] = useState("19:00");
  const [format, setFormat] = useState(trainer.formats[0]);

  const confirm = () => {
    const d = new Date(days[day]);
    const [h, m] = time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    updateUser((u) => ({ ...u, bookings: [...(u.bookings ?? []), { id: uid(), trainerId: trainer.id, slot: d.toISOString(), createdAt: new Date().toISOString() }] }));
    toast("Заявка отправлена тренеру");
    onClose();
  };

  return (
    <Sheet title={`Запись: ${trainer.name}`} onClose={onClose}>
      <div className="list-header" style={{ marginLeft: 4 }}>Формат</div>
      <div className="chips">
        {trainer.formats.map((f) => (
          <button key={f} className={`chip ${format === f ? "on" : ""}`} onClick={() => setFormat(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="list-header" style={{ marginLeft: 4 }}>День</div>
      <div className="chips">
        {days.map((d, i) => (
          <button key={i} className={`chip ${day === i ? "on" : ""}`} onClick={() => setDay(i)}>
            {d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric" })}
          </button>
        ))}
      </div>
      <div className="list-header" style={{ marginLeft: 4 }}>Время</div>
      <div className="chips">
        {["08:00", "10:00", "12:00", "17:00", "19:00", "20:30"].map((t) => (
          <button key={t} className={`chip ${time === t ? "on" : ""}`} onClick={() => setTime(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="glass card row" style={{ marginTop: 18 }}>
        <Wallet size={20} />
        <span style={{ flex: 1 }}>
          <b>{trainer.priceRub.toLocaleString("ru-RU")} ₽</b>
          <div className="caption">Оплата через Parri Pay появится позже. Сейчас — после подтверждения тренером.</div>
        </span>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={confirm}>
        Отправить заявку
      </button>
    </Sheet>
  );
}
