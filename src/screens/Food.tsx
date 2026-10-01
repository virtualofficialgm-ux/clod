import { AlertTriangle, BookOpen, Check, Clock, Dumbbell, Minus, Plus, RefreshCw, Repeat, ShoppingCart, Sparkles, Store, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { checkIngredients } from "../../shared/allergens";
import type { Menu, Recipe } from "../../shared/types";
import { generateMenu } from "../api";
import { Page, ScreenWithTitle, Segmented, Sheet, haptic, toast } from "../components/ui";
import { alternativesFor } from "../data/recipes";
import { sharedSchedule, today, uid, updateUser, useUser } from "../store";
import { MealList } from "./Home";
import Library from "./Library";

export const SLOT = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" } as const;
const SLOT_EMOJI = { breakfast: "🥣", lunch: "🍲", dinner: "🍽️", snack: "🍎" } as const;
const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function todayIndex() {
  return (new Date().getDay() + 6) % 7;
}

export function menuWarnings(menu: Menu, allergies: string[]) {
  const names = [...new Set(menu.days.flatMap((d) => d.meals.flatMap((m) => m.recipe.ingredients.map((i) => i.name))))];
  const { hits, unknown } = checkIngredients(names, allergies);
  return { hits, unknown: [...new Set([...menu.clarify, ...unknown])] };
}

export default function Food() {
  const u = useUser()!;
  const [tab, setTab] = useState<"menu" | "shop" | "diary">("menu");
  const [day, setDay] = useState(todayIndex());
  const [recipe, setRecipe] = useState<{ d: number; m: number } | null>(null);
  const [regen, setRegen] = useState(false);
  const [library, setLibrary] = useState(false);
  const menu = u.menu;
  const p = u.profile;
  const schedule = sharedSchedule(u);

  return (
    <>
      <ScreenWithTitle
        title="Food"
        kicker="Parri Food"
        right={
          <>
            <button className="circle-btn glass" onClick={() => setLibrary(true)} aria-label="Знания о питании">
              <BookOpen size={20} />
            </button>
            <button className="circle-btn glass" onClick={() => setRegen(true)} aria-label="Новое меню">
              <Sparkles size={20} />
            </button>
          </>
        }
      >
        {!menu ? (
          <div className="glass card row">
            <span className="spinner" />
            <div style={{ flex: 1 }}>
              <b>Составляем меню на неделю…</b>
              <div className="caption">Если долго — нажмите ✨ сверху</div>
            </div>
          </div>
        ) : (
          <div className="stagger">
            <BudgetCard menu={menu} />
            <Warnings menu={menu} />
            {p.linkFitFood ? (
              <div className="caption" style={{ margin: "10px 4px 0", fontSize: 14 }}>
                <Dumbbell size={13} style={{ verticalAlign: -2 }} /> Согласовано с Fit: тренировки {schedule.map((d) => WEEK[d]).join(", ") || "не заданы"}
              </div>
            ) : null}

            <div style={{ margin: "16px 0 12px" }}>
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: "menu", label: "Меню" },
                  { value: "shop", label: "Покупки" },
                  { value: "diary", label: "Дневник" },
                ]}
              />
            </div>

            {tab === "menu" && (
              <>
                <div className="week" style={{ marginBottom: 12 }}>
                  {menu.days.map((d, i) => (
                    <button key={i} className={`day ${i === day ? "on" : ""} ${d.training ? "done" : ""}`} onClick={() => (haptic(), setDay(i))}>
                      {WEEK[i]}
                      <b>{d.training ? <Dumbbell size={15} /> : d.meals.length}</b>
                    </button>
                  ))}
                </div>
                {menu.days[day]?.training && (
                  <div className="caption" style={{ margin: "0 4px 10px", fontSize: 14 }}>
                    🏋️ День тренировки: больше углеводов до и белка после занятия
                  </div>
                )}
                <div className="stack">
                  {menu.days[day]?.meals.map((m, i) => (
                    <MealCard key={i} slot={m.slot} recipe={m.recipe} onClick={() => setRecipe({ d: day, m: i })} />
                  ))}
                </div>
                {menu.notes.length > 0 && (
                  <div className="glass card stack" style={{ gap: 8, marginTop: 14 }}>
                    {menu.notes.map((n) => (
                      <div key={n} className="row" style={{ alignItems: "flex-start" }}>
                        <Sparkles size={15} color="var(--purple)" style={{ flex: "none", marginTop: 3 }} />
                        <span className="caption" style={{ fontSize: 14, lineHeight: 1.4 }}>{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "shop" && <Shopping menu={menu} />}

            {tab === "diary" && (
              <>
                <div className="caption" style={{ margin: "0 4px 12px", fontSize: 14 }}>
                  Отмечайте, что съели: из меню или по фото через «+». Калорийность — приблизительная оценка.
                </div>
                <MealList date={today()} />
              </>
            )}
          </div>
        )}
      </ScreenWithTitle>
      {recipe && menu && <RecipePage dayIndex={recipe.d} mealIndex={recipe.m} onBack={() => setRecipe(null)} />}
      {regen && <MenuSheet onClose={() => setRegen(false)} />}
      {library && <Library asPage initial="Питание" onBack={() => setLibrary(false)} />}
    </>
  );
}

function BudgetCard({ menu }: { menu: Menu }) {
  const u = useUser()!;
  const budget = u.profile.budgetWeek ?? 0;
  const over = budget > 0 && menu.totalRub > budget;
  return (
    <div className="glass card">
      <div className="row">
        <span className="icon-tile" style={{ background: over ? "var(--orange)" : "var(--green)" }}>
          <Wallet size={18} />
        </span>
        <span style={{ flex: 1 }}>
          <div className="caption">Продукты на неделю</div>
          <b className="mid-num">≈ {menu.totalRub.toLocaleString("ru-RU")} ₽</b>
        </span>
        <span style={{ textAlign: "right" }}>
          <div className="caption">бюджет</div>
          <b>{budget ? `${budget.toLocaleString("ru-RU")} ₽` : "—"}</b>
        </span>
      </div>
      {budget > 0 && (
        <div className="bar" style={{ marginTop: 12 }}>
          <i style={{ width: `${Math.min(100, (menu.totalRub / budget) * 100)}%`, background: over ? "var(--orange)" : "var(--green)" }} />
        </div>
      )}
      <div className="caption" style={{ marginTop: 8 }}>
        <Users size={12} style={{ verticalAlign: -1 }} /> {u.profile.household ?? 1} чел. · готовка до {u.profile.cookTimeMin ?? 30} мин
        {u.menuAt && ` · меню от ${new Date(u.menuAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`}
      </div>
    </div>
  );
}

function Warnings({ menu }: { menu: Menu }) {
  const u = useUser()!;
  const { hits, unknown: all } = menuWarnings(menu, u.profile.allergies ?? []);
  const unknown = all.filter((x) => !u.confirmedIngredients?.includes(x));
  if (!hits.length && !unknown.length) return null;
  return (
    <div className="glass card" style={{ marginTop: 12 }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <AlertTriangle size={20} color="var(--orange)" style={{ flex: "none", marginTop: 2 }} />
        <span style={{ lineHeight: 1.4, fontSize: 15 }}>
          {hits.length > 0 && (
            <div>
              <b>Аллерген в меню:</b> {hits.map((h) => `${h.ingredient} (${h.allergen})`).join(", ")}. Замените эти блюда.
            </div>
          )}
          {unknown.length > 0 && (
            <div style={{ marginTop: hits.length ? 6 : 0 }}>
              <b>Уточните состав:</b> {unknown.join(", ")} — у разных производителей состав отличается.
              <button
                className="btn btn-sm btn-tinted"
                style={{ marginTop: 10, display: "flex" }}
                onClick={() => updateUser((d) => ({ ...d, confirmedIngredients: [...new Set([...(d.confirmedIngredients ?? []), ...unknown])] }))}
              >
                <Check size={16} /> Состав проверен
              </button>
            </div>
          )}
        </span>
      </div>
    </div>
  );
}

function MealCard({ slot, recipe, onClick }: { slot: keyof typeof SLOT; recipe: Recipe; onClick: () => void }) {
  const u = useUser()!;
  const flagged = checkIngredients(recipe.ingredients.map((i) => i.name), u.profile.allergies ?? []).hits.length > 0;
  return (
    <button className="glass row" style={{ borderRadius: 22, padding: 12, textAlign: "left", width: "100%" }} onClick={onClick}>
      <span style={{ width: 58, height: 58, borderRadius: 16, background: "var(--fill)", display: "grid", placeItems: "center", fontSize: 28, flex: "none" }}>{SLOT_EMOJI[slot]}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div className="caption" style={{ fontWeight: 600, fontSize: 12, letterSpacing: ".03em" }}>{SLOT[slot].toUpperCase()}</div>
        <div style={{ fontWeight: 600, lineHeight: 1.25 }}>{recipe.title}</div>
        <div className="caption" style={{ marginTop: 2 }}>
          <Clock size={11} style={{ verticalAlign: -1 }} /> {recipe.timeMin} мин · ≈{recipe.kcal} ккал
          {recipe.costRub > 0 && ` · ${recipe.costRub} ₽`}
        </div>
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        {recipe.usesLeftovers && <span className="badge" style={{ background: "var(--green)", color: "#fff" }}>остатки</span>}
        {flagged && <span className="badge" style={{ background: "var(--orange)", color: "#fff" }}>аллерген</span>}
      </span>
    </button>
  );
}

export function RecipePage({ dayIndex, mealIndex, onBack }: { dayIndex: number; mealIndex: number; onBack: () => void }) {
  const u = useUser()!;
  const meal = u.menu!.days[dayIndex].meals[mealIndex];
  const r = meal.recipe;
  const [servings, setServings] = useState(r.servings);
  const [swap, setSwap] = useState(false);
  const k = servings / Math.max(1, r.servings);
  const { hits } = checkIngredients(r.ingredients.map((i) => i.name), u.profile.allergies ?? []);

  const ate = () => {
    const now = new Date();
    updateUser((d) => ({
      ...d,
      meals: [
        ...d.meals,
        {
          id: uid(),
          date: today(),
          time: now.toTimeString().slice(0, 5),
          name: r.title,
          calories: r.kcal,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
          healthScore: 8,
          items: [],
          comment: "Из меню Parri Food. Калорийность приблизительная.",
        },
      ],
    }));
    toast("Добавлено в дневник ✓");
  };

  const replace = (next: Recipe) => {
    updateUser((d) => {
      if (!d.menu) return d;
      const days = d.menu.days.map((dd, i) =>
        i !== dayIndex ? dd : { ...dd, meals: dd.meals.map((m, j) => (j === mealIndex ? { ...m, recipe: next } : m)) },
      );
      return { ...d, menu: { ...d.menu, days } };
    });
    setSwap(false);
    setServings(next.servings);
    toast("Блюдо заменено");
  };

  const fmt = (q: number) => String(Math.round(q * k * 10) / 10).replace(".", ",");

  return (
    <Page
      title={r.title}
      onBack={onBack}
      bottom={
        <div className="tabbar-wrap" style={{ zIndex: 45 }}>
          <button className="btn btn-primary" style={{ pointerEvents: "auto" }} onClick={ate}>
            <Check size={20} /> Я это съел(а)
          </button>
        </div>
      }
    >
      <div className="hero-img fade-in" style={{ marginTop: 52, background: "linear-gradient(135deg, #30d158, #ffd60a)", fontSize: 84 }}>
        {SLOT_EMOJI[meal.slot]}
        <span className="badge glass" style={{ position: "absolute", left: 14, bottom: 14, color: "#fff", background: "rgba(0,0,0,.25)" }}>
          {WEEK[dayIndex]} · {SLOT[meal.slot]}
        </span>
      </div>
      <h1 style={{ fontSize: 28, letterSpacing: "-0.03em", margin: "18px 4px 8px", textWrap: "balance" }}>{r.title}</h1>
      <div className="row" style={{ gap: 6, flexWrap: "wrap", margin: "0 4px" }}>
        <span className="badge">
          <Clock size={12} /> {r.timeMin} мин
        </span>
        <span className="badge">≈{r.kcal} ккал / порция</span>
        <span className="badge">Б {r.protein} · У {r.carbs} · Ж {r.fat}</span>
        {r.usesLeftovers && <span className="badge" style={{ background: "var(--green)", color: "#fff" }}>из остатков</span>}
      </div>

      {hits.length > 0 && (
        <div className="glass card row" style={{ marginTop: 14 }}>
          <AlertTriangle size={20} color="var(--orange)" />
          <span>Содержит: {hits.map((h) => h.allergen).join(", ")}. Замените блюдо.</span>
        </div>
      )}

      <div className="list-header">Ингредиенты</div>
      <div className="glass card row" style={{ padding: "10px 16px", marginBottom: 8, borderRadius: 18 }}>
        <span style={{ flex: 1 }}>Порций</span>
        <button className="circle-btn" style={{ background: "var(--fill)", width: 34, height: 34 }} onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Меньше порций">
          <Minus size={16} />
        </button>
        <b className="mid-num" style={{ width: 28, textAlign: "center", fontSize: 18 }}>{servings}</b>
        <button className="circle-btn" style={{ background: "var(--fill)", width: 34, height: 34 }} onClick={() => setServings(servings + 1)} aria-label="Больше порций">
          <Plus size={16} />
        </button>
      </div>
      <div className="list glass">
        {r.ingredients.map((i) => (
          <div key={i.name} className="list-row plain">
            <span>{i.name}</span>
            <span className="value">
              {fmt(i.qty)} {i.unit}
            </span>
          </div>
        ))}
      </div>

      {r.substitutions.length > 0 && (
        <>
          <div className="list-header">Чем заменить</div>
          <div className="list glass">
            {r.substitutions.map((s) => (
              <div key={s.ingredient} className="list-row plain" style={{ display: "block" }}>
                <div style={{ fontWeight: 600 }}>
                  <Repeat size={13} style={{ verticalAlign: -1 }} /> {s.ingredient}
                </div>
                <div className="caption">{s.options.join(" · ")}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="list-header">Приготовление</div>
      <div className="list glass">
        {r.steps.map((s, i) => (
          <div key={s} className="list-row plain" style={{ alignItems: "flex-start" }}>
            <span className="icon-tile" style={{ background: "var(--green)", width: 26, height: 26, borderRadius: 13, fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
            <span style={{ lineHeight: 1.4 }}>{s}</span>
          </div>
        ))}
      </div>

      <button className="btn glass strong" style={{ marginTop: 16 }} onClick={() => setSwap(true)}>
        <RefreshCw size={18} /> Заменить блюдо
      </button>
      <div style={{ height: 40 }} />

      {swap && (
        <Sheet title="Заменить на" onClose={() => setSwap(false)}>
          <div className="stack">
            {alternativesFor(meal.slot, u.profile, r.title).map((alt) => (
              <button key={alt.title} className="glass row" style={{ borderRadius: 18, padding: 12, textAlign: "left", width: "100%" }} onClick={() => replace(alt)}>
                <span style={{ flex: 1 }}>
                  <b>{alt.title}</b>
                  <div className="caption">
                    {alt.timeMin} мин · ≈{alt.kcal} ккал · {alt.costRub} ₽
                  </div>
                </span>
              </button>
            ))}
            {alternativesFor(meal.slot, u.profile, r.title).length === 0 && <div className="caption">Нет подходящих замен под ваши ограничения.</div>}
          </div>
        </Sheet>
      )}
    </Page>
  );
}

function Shopping({ menu }: { menu: Menu }) {
  const u = useUser()!;
  const checked = u.shopChecked ?? {};
  const groups = menu.shopping.reduce<Record<string, Menu["shopping"]>>((acc, i) => {
    (acc[i.category] ??= []).push(i);
    return acc;
  }, {});
  const left = menu.shopping.filter((i) => !checked[i.name]);
  const toggle = (name: string) => {
    haptic();
    updateUser((d) => ({ ...d, shopChecked: { ...(d.shopChecked ?? {}), [name]: !(d.shopChecked ?? {})[name] } }));
  };
  const copy = async () => {
    const text = Object.entries(groups)
      .map(([cat, items]) => `${cat}:\n${items.map((i) => `— ${i.name}, ${String(i.qty).replace(".", ",")} ${i.unit}`).join("\n")}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("Список скопирован");
    } catch {
      toast("Не удалось скопировать");
    }
  };

  return (
    <>
      <div className="glass card row">
        <ShoppingCart size={22} />
        <span style={{ flex: 1 }}>
          <b>
            Осталось купить: {left.length} из {menu.shopping.length}
          </b>
          <div className="caption">≈ {left.reduce((a, i) => a + i.costRub, 0).toLocaleString("ru-RU")} ₽</div>
        </span>
        <button className="btn btn-sm btn-tinted" onClick={copy}>
          Копировать
        </button>
      </div>
      {u.profile.pantry?.length ? (
        <div className="caption" style={{ margin: "10px 4px 0", fontSize: 14 }}>Не добавлено, потому что есть дома: {u.profile.pantry.join(", ")}</div>
      ) : null}
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat}>
          <div className="list-header">{cat}</div>
          <div className="list glass">
            {items.map((i) => (
              <button key={i.name} className="list-row plain" onClick={() => toggle(i.name)}>
                <span className={`check ${checked[i.name] ? "on" : ""}`}>{checked[i.name] && <Check size={14} strokeWidth={3} />}</span>
                <span style={{ flex: 1, textDecoration: checked[i.name] ? "line-through" : "none", opacity: checked[i.name] ? 0.5 : 1 }}>{i.name}</span>
                <span className="value">
                  {String(i.qty).replace(".", ",")} {i.unit} · {i.costRub} ₽
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="glass card row" style={{ marginTop: 16 }}>
        <Store size={20} />
        <span className="caption" style={{ fontSize: 14, lineHeight: 1.4 }}>
          Заказ в магазинах-партнёрах появится позже. Партнёрские предложения всегда будут отмечены.
        </span>
      </div>
    </>
  );
}

function MenuSheet({ onClose }: { onClose: () => void }) {
  const u = useUser()!;
  const [budget, setBudget] = useState(u.profile.budgetWeek ?? 5000);
  const [people, setPeople] = useState(u.profile.household ?? 1);
  const [time, setTime] = useState(u.profile.cookTimeMin ?? 30);
  const [leftovers, setLeftovers] = useState("");
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const extra = leftovers.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    const profile = { ...u.profile, budgetWeek: budget, household: people, cookTimeMin: time, pantry: [...new Set([...(u.profile.pantry ?? []), ...extra])] };
    const { data, ai } = await generateMenu(profile, sharedSchedule({ ...u, profile }), wish);
    updateUser((d) => ({ ...d, profile, menu: data, menuAt: new Date().toISOString(), shopChecked: {} }));
    setBusy(false);
    toast(ai ? "Новое меню от ИИ готово ✨" : "Меню обновлено (офлайн-режим)");
    onClose();
  };

  return (
    <Sheet title="Новое меню" onClose={onClose}>
      <div className="row" style={{ marginBottom: 8 }}>
        <b>Бюджет в неделю</b>
        <span className="spacer" />
        <b className="mid-num" style={{ fontSize: 18 }}>{budget.toLocaleString("ru-RU")} ₽</b>
      </div>
      <input id="menu-budget" className="slider" type="range" min={1500} max={25000} step={500} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
      <div className="list-header" style={{ marginLeft: 4 }}>Сколько человек</div>
      <div className="chips">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} className={`chip ${people === n ? "on" : ""}`} onClick={() => setPeople(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="list-header" style={{ marginLeft: 4 }}>Время на готовку</div>
      <div className="chips">
        {[15, 30, 45, 60].map((m) => (
          <button key={m} className={`chip ${time === m ? "on" : ""}`} onClick={() => setTime(m)}>
            до {m} мин
          </button>
        ))}
      </div>
      <div className="list-header" style={{ marginLeft: 4 }}>Остатки и продукты, которые надо использовать</div>
      <input id="menu-leftovers" className="field" placeholder="Например: полкурицы, рис, кабачок" value={leftovers} onChange={(e) => setLeftovers(e.target.value)} />
      <div className="list-header" style={{ marginLeft: 4 }}>Пожелания</div>
      <textarea id="menu-wish" className="field" rows={2} placeholder="Больше супов, без духовки, детское меню…" value={wish} onChange={(e) => setWish(e.target.value)} />
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={run} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" style={{ borderTopColor: "var(--on-ink)" }} /> Составляем…
          </>
        ) : (
          <>
            <Sparkles size={18} /> Составить меню
          </>
        )}
      </button>
    </Sheet>
  );
}
