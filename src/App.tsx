import { BookOpen, Dumbbell, House, MessageCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Ambient, ToastHost, haptic } from "./components/ui";
import Onboarding from "./onboarding/Onboarding";
import AddSheet from "./screens/AddSheet";
import Coach from "./screens/Coach";
import Home from "./screens/Home";
import Library from "./screens/Library";
import Workouts from "./screens/Workouts";
import { useStore, useUser } from "./store";

export type Tab = "home" | "workouts" | "coach" | "library";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Сегодня", icon: House },
  { id: "workouts", label: "Тренировки", icon: Dumbbell },
  { id: "coach", label: "ИИ-тренер", icon: MessageCircle },
  { id: "library", label: "Знания", icon: BookOpen },
];

export default function App() {
  const theme = useStore((s) => s.theme);
  const user = useUser();
  const [tab, setTab] = useState<Tab>("home");
  const [add, setAdd] = useState(false);

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
            {tab === "coach" && <Coach />}
            {tab === "library" && <Library />}
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
          {add && <AddSheet onClose={() => setAdd(false)} />}
        </>
      )}
      <ToastHost />
    </div>
  );
}
