import { Dumbbell, House, MessageCircle, Plus, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import { Ambient, ToastHost, haptic } from "./components/ui";
import Onboarding from "./onboarding/Onboarding";
import AddSheet from "./screens/AddSheet";
import Coach from "./screens/Coach";
import EquipmentScanner from "./screens/EquipmentScanner";
import Home from "./screens/Home";
import Food from "./screens/Food";
import FridgeScanner from "./screens/FridgeScanner";
import { PaywallHost } from "./screens/Paywall";
import { isPlus, openPaywall } from "./subscription";
import Workouts from "./screens/Workouts";
import { ensurePlans } from "./ensure";
import { today, updateUser, useStore, useUser } from "./store";

export type Tab = "home" | "workouts" | "food" | "coach";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Сегодня", icon: House },
  { id: "workouts", label: "Fit", icon: Dumbbell },
  { id: "food", label: "Food", icon: Utensils },
  { id: "coach", label: "ИИ", icon: MessageCircle },
];

export default function App() {
  const theme = useStore((s) => s.theme);
  const user = useUser();
  const session = useStore((s) => s.session);
  const missing = !!user && (!user.menu || !user.program);

  useEffect(() => {
    if (session && missing) ensurePlans(session);
  }, [session, missing]);
  const [tab, setTab] = useState<Tab>("home");
  const [add, setAdd] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [fridge, setFridge] = useState(false);

  // Offer Plus once, right after the plan is ready (Cal AI-style), never again automatically.
  const offerPlus = !!user && !user.paywallSeen && !isPlus(user);
  useEffect(() => {
    if (!offerPlus) return;
    const id = setTimeout(() => openPaywall("welcome"), 1200);
    return () => clearTimeout(id);
  }, [offerPlus]);

  // Training-day reminder: fires once per day after the chosen time while the app is open or installed.
  useEffect(() => {
    if (!user) return;
    const check = () => {
      const p = user.profile;
      const day = (new Date().getDay() + 6) % 7;
      const [h, m] = (p.reminderTime ?? "18:00").split(":").map(Number);
      const due = new Date();
      due.setHours(h, m, 0, 0);
      if (p.reminders === false || !p.days?.includes(day) || new Date() < due) return;
      if (user.lastReminder === today() || user.workouts.some((w) => w.date === today())) return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try {
        new Notification("Parri Fit", { body: "Сегодня по плану тренировка. Начнём?", icon: "/icon.svg" });
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
      updateUser((d) => ({ ...d, lastReminder: today() }));
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="device">
      {!user ? (
        <Onboarding />
      ) : (
        <>
          <Ambient />
          <div key={tab} className="fade-in" style={{ position: "absolute", inset: 0 }}>
            {tab === "home" && <Home go={setTab} />}
            {tab === "workouts" && <Workouts />}
            {tab === "food" && <Food />}
            {tab === "coach" && <Coach />}
          </div>
          <nav className="tabbar-wrap">
            <div className="tabbar glass">
              <span
                className="tab-indicator"
                style={{ width: `calc((100% - 8px) / 4)`, transform: `translateX(${TABS.findIndex((t) => t.id === tab) * 100}%)` }}
              />
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => (haptic(), setTab(id))}>
                  <Icon size={24} strokeWidth={tab === id ? 2.4 : 2} />
                  {label}
                </button>
              ))}
            </div>
            <button className="fab glass" onClick={() => (haptic(12), setAdd(true))} aria-label="Добавить">
              <Plus size={30} strokeWidth={2.4} />
            </button>
          </nav>
          {add && <AddSheet onClose={() => setAdd(false)} onScan={() => setScanner(true)} onFridge={() => setFridge(true)} />}
          {scanner && <EquipmentScanner onBack={() => setScanner(false)} />}
          {fridge && <FridgeScanner onBack={() => setFridge(false)} />}
          <PaywallHost />
        </>
      )}
      <ToastHost />
    </div>
  );
}
