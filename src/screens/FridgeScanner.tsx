import { AlertTriangle, Camera, Check, Clock, ImagePlus, Plus, ShoppingCart, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { checkIngredients } from "../../shared/allergens";
import type { PantryRecipe, PantryResult } from "../../shared/types";
import { prepareImage, scanPantry } from "../api";
import { Page, Segmented, Sheet, haptic, toast } from "../components/ui";
import { allow, consume, left } from "../subscription";
import { today, uid, updateUser, useUser } from "../store";
import { todayIndex } from "./Food";

type Mode = "intro" | "analyzing" | "result";
type Filter = "all" | "pre_workout" | "post_workout" | "rest_day";

const PURPOSE: Record<PantryRecipe["purpose"], { label: string; color: string }> = {
  pre_workout: { label: "До тренировки", color: "var(--orange)" },
  post_workout: { label: "После тренировки", color: "var(--blue)" },
  rest_day: { label: "День отдыха", color: "var(--green)" },
  any: { label: "Любой день", color: "var(--purple)" },
};

const QUICK = ["Яйца", "Курица", "Рис", "Гречка", "Творог", "Овсяные хлопья", "Банан", "Помидор", "Огурец", "Картофель", "Макароны", "Тунец", "Фасоль", "Брокколи", "Йогурт", "Сыр"];

export default function FridgeScanner({ onBack }: { onBack: () => void }) {
  const u = useUser()!;
  const [mode, setMode] = useState<Mode>("intro");
  const [photos, setPhotos] = useState<{ base64: string; thumb: string }[]>([]);
  const [text, setText] = useState("");
  const [result, setResult] = useState<PantryResult | null>(null);
  const [ai, setAi] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<PantryRecipe | null>(null);
  const [needList, setNeedList] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const ti = todayIndex();
  const trainingToday = u.profile.days?.length ? u.profile.days.includes(ti) && !u.workouts.some((w) => w.date === today()) : undefined;
  const scansLeft = left(u, "scans");

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = await Promise.all([...files].slice(0, 3 - photos.length).map((f) => prepareImage(f)));
    setPhotos((p) => [...p, ...list].slice(0, 3));
  };

  const run = async () => {
    if (!photos.length && !text.trim()) {
      toast("Сфотографируйте продукты или перечислите их");
      return;
    }
    const usesAi = photos.length > 0;
    if (usesAi && !allow("scans")) return;
    setMode("analyzing");
    const r = await scanPantry({ images: photos.map((p) => p.base64), text, profile: u.profile, trainingToday });
    if (!r) {
      setNeedList(true);
      setMode("intro");
      return;
    }
    if (r.ai && usesAi) consume("scans");
    setResult(r.data);
    setAi(r.ai);
    setFilter(trainingToday ? "pre_workout" : "all");
    setMode("result");
    haptic(20);
    updateUser((d) => ({ ...d, pantryScans: [{ id: uid(), date: today(), photo: photos[0]?.thumb, result: r.data }, ...(d.pantryScans ?? [])].slice(0, 10) }));
  };

  const savePantry = () => {
    if (!result) return;
    updateUser((d) => ({ ...d, profile: { ...d.profile, pantry: [...new Set([...(d.profile.pantry ?? []), ...result.products.map((p) => p.name)])] } }));
    toast("Продукты добавлены в «Есть дома»");
  };

  const recipes = (result?.recipes ?? []).filter((r) => filter === "all" || r.purpose === filter || r.purpose === "any");

  return (
    <Page title="Что приготовить" onBack={onBack}>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addPhotos(e.target.files).finally(() => (e.target.value = ""))} />
      <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files).finally(() => (e.target.value = ""))} />

      {mode === "intro" && (
        <div className="stagger">
          <h1 className="large-title">
            <small>Parri Food</small>
            Что приготовить
          </h1>
          <p className="muted" style={{ margin: "-6px 4px 14px", lineHeight: 1.4 }}>
            Сфотографируйте холодильник или продукты на столе. ИИ узнает их и предложит блюда под вашу цель
            {trainingToday === undefined ? "" : trainingToday ? " и сегодняшнюю тренировку" : " и день отдыха"}.
          </p>

          {needList && (
            <div className="glass card row" style={{ marginBottom: 12, alignItems: "flex-start" }}>
              <AlertTriangle size={20} color="var(--orange)" style={{ flex: "none" }} />
              <span className="caption" style={{ fontSize: 14, lineHeight: 1.4 }}>
                ИИ сейчас недоступен, поэтому распознать фото не получится. Отметьте продукты ниже — подберём рецепты сами.
              </span>
            </div>
          )}

          <div className="photo-strip">
            {photos.map((p, i) => (
              <div key={i} className="photo-thumb" style={{ backgroundImage: `url(${p.thumb})` }}>
                <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label="Убрать фото">
                  <X size={14} />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <button className="photo-add glass" onClick={() => (haptic(12), camera.current?.click())}>
                <Camera size={26} />
                <span>{photos.length ? "Ещё фото" : "Сфотографировать"}</span>
              </button>
            )}
            {photos.length < 3 && (
              <button className="photo-add glass" onClick={() => gallery.current?.click()}>
                <ImagePlus size={26} />
                <span>Из галереи</span>
              </button>
            )}
          </div>

          <div className="list-header">Или перечислите продукты</div>
          <textarea id="pantry-text" className="field" rows={2} placeholder="Например: яйца, рис, курица, помидоры" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="chips" style={{ flexWrap: "wrap", margin: "10px 0 0", padding: 0 }}>
            {QUICK.map((q) => {
              const on = text.toLowerCase().split(/[,;]/).map((s) => s.trim()).includes(q.toLowerCase());
              return (
                <button
                  key={q}
                  className={`chip ${on ? "on" : ""}`}
                  onClick={() => {
                    const items = text.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
                    setText((on ? items.filter((x) => x.toLowerCase() !== q.toLowerCase()) : [...items, q]).join(", "));
                  }}
                >
                  {q}
                </button>
              );
            })}
          </div>

          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={run}>
            <Sparkles size={18} /> Подобрать блюда
          </button>
          {Number.isFinite(scansLeft) && photos.length > 0 && (
            <div className="caption" style={{ textAlign: "center", marginTop: 8 }}>
              Бесплатных ИИ-сканов на этой неделе: {scansLeft}
            </div>
          )}
        </div>
      )}

      {mode === "analyzing" && (
        <div style={{ textAlign: "center", paddingTop: 80 }} className="fade-in">
          <div className="scanner-frame analyzing" style={{ backgroundImage: photos[0] ? `url(${photos[0].thumb})` : undefined }}>
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            <span className="scan-beam" />
          </div>
          <h2 style={{ margin: "22px 0 4px" }}>Смотрим, что у вас есть…</h2>
          <div className="caption" style={{ fontSize: 15 }}>Подбираем блюда под цель и тренировки</div>
        </div>
      )}

      {mode === "result" && result && (
        <div className="fade-in">
          <h1 className="large-title" style={{ fontSize: 28 }}>
            <small>{ai ? "Распознано ИИ" : "Подбор без ИИ"}</small>
            Можно приготовить
          </h1>

          <div className="glass card">
            <div className="row" style={{ marginBottom: 10 }}>
              <b style={{ flex: 1 }}>Продукты ({result.products.length})</b>
              <button className="btn btn-sm btn-tinted" onClick={savePantry}>
                <Plus size={16} /> В «Есть дома»
              </button>
            </div>
            <div className="chips" style={{ flexWrap: "wrap", margin: 0, padding: 0 }}>
              {result.products.map((p) => (
                <span key={p.name} className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {p.name}
                  {p.amount && <span className="caption">{p.amount}</span>}
                </span>
              ))}
            </div>
          </div>

          <div className="glass card row" style={{ marginTop: 12, alignItems: "flex-start" }}>
            <Sparkles size={18} color="var(--purple)" style={{ flex: "none", marginTop: 2 }} />
            <span style={{ lineHeight: 1.4, fontSize: 15 }}>{result.advice}</span>
          </div>

          {result.clarify.length > 0 && (
            <div className="glass card row" style={{ marginTop: 12, alignItems: "flex-start" }}>
              <AlertTriangle size={18} color="var(--orange)" style={{ flex: "none", marginTop: 2 }} />
              <span style={{ lineHeight: 1.4, fontSize: 15 }}>
                <b>Уточните состав:</b> {result.clarify.join(", ")}
              </span>
            </div>
          )}

          <div style={{ margin: "16px 0 12px" }}>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Все" },
                { value: "pre_workout", label: "До" },
                { value: "post_workout", label: "После" },
                { value: "rest_day", label: "Отдых" },
              ]}
            />
          </div>
          {trainingToday !== undefined && (
            <div className="caption" style={{ margin: "-4px 4px 10px", fontSize: 14 }}>
              {trainingToday ? "🏋️ Сегодня тренировка по плану" : "🛋️ Сегодня день отдыха"}
            </div>
          )}

          <div className="stack">
            {recipes.map((r) => (
              <button key={r.title} className="glass card" style={{ width: "100%", textAlign: "left", display: "block" }} onClick={() => setOpen(r)}>
                <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                  <span className="badge" style={{ background: PURPOSE[r.purpose].color, color: "#fff" }}>{PURPOSE[r.purpose].label}</span>
                  {r.missing.length === 0 ? <span className="badge">всё есть</span> : <span className="badge">+{r.missing.length} купить</span>}
                </div>
                <b style={{ fontSize: 17 }}>{r.title}</b>
                <div className="caption" style={{ marginTop: 2 }}>
                  <Clock size={11} style={{ verticalAlign: -1 }} /> {r.timeMin} мин · ≈{r.kcal} ккал · Б {r.protein} г
                </div>
                <div className="caption" style={{ marginTop: 6, fontSize: 14, lineHeight: 1.35 }}>{r.why}</div>
              </button>
            ))}
            {recipes.length === 0 && <div className="glass card caption">Для этого фильтра блюд нет — попробуйте «Все».</div>}
          </div>

          <button className="btn glass strong" style={{ margin: "18px 0 30px" }} onClick={() => (setMode("intro"), setResult(null), setPhotos([]))}>
            <Camera size={18} /> Сканировать снова
          </button>
        </div>
      )}

      {open && <RecipeSheet recipe={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}

function RecipeSheet({ recipe: r, onClose }: { recipe: PantryRecipe; onClose: () => void }) {
  const u = useUser()!;
  const { hits } = checkIngredients(r.ingredients.map((i) => i.name), u.profile.allergies ?? []);

  const ate = () => {
    updateUser((d) => ({
      ...d,
      meals: [
        ...d.meals,
        {
          id: uid(),
          date: today(),
          time: new Date().toTimeString().slice(0, 5),
          name: r.title,
          calories: r.kcal,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
          healthScore: 8,
          items: [],
          comment: "Из продуктов, которые были дома. Калорийность приблизительная.",
        },
      ],
    }));
    toast("Добавлено в дневник ✓");
    onClose();
  };

  const toShopping = () => {
    updateUser((d) => {
      if (!d.menu) return d;
      const have = new Set(d.menu.shopping.map((i) => i.name.toLowerCase()));
      const extra = r.missing.filter((m) => !have.has(m.toLowerCase())).map((name) => ({ name, qty: 1, unit: "шт", category: "Докупить", costRub: 0 }));
      return { ...d, menu: { ...d.menu, shopping: [...d.menu.shopping, ...extra] } };
    });
    toast("Добавлено в список покупок");
  };

  return (
    <Sheet title={r.title} onClose={onClose}>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <span className="badge" style={{ background: PURPOSE[r.purpose].color, color: "#fff" }}>{PURPOSE[r.purpose].label}</span>
        <span className="badge">
          <Clock size={12} /> {r.timeMin} мин
        </span>
        <span className="badge">≈{r.kcal} ккал</span>
        <span className="badge">Б {r.protein} · У {r.carbs} · Ж {r.fat}</span>
      </div>
      <p style={{ lineHeight: 1.4 }}>{r.why}</p>
      {hits.length > 0 && (
        <div className="glass card row" style={{ marginBottom: 10 }}>
          <AlertTriangle size={18} color="var(--orange)" />
          <span>Содержит: {hits.map((h) => h.allergen).join(", ")}</span>
        </div>
      )}
      <div className="list-header" style={{ marginLeft: 4 }}>Ингредиенты</div>
      <div className="list glass">
        {r.ingredients.map((i) => {
          const missing = r.missing.some((m) => m.toLowerCase() === i.name.toLowerCase());
          return (
            <div key={i.name} className="list-row plain">
              <span>
                {i.name}
                {missing && <span className="badge" style={{ marginLeft: 6 }}>купить</span>}
              </span>
              <span className="value">
                {String(i.qty).replace(".", ",")} {i.unit}
              </span>
            </div>
          );
        })}
      </div>
      <div className="list-header" style={{ marginLeft: 4 }}>Приготовление</div>
      <div className="list glass">
        {r.steps.map((s, i) => (
          <div key={s} className="list-row plain" style={{ alignItems: "flex-start" }}>
            <span className="icon-tile" style={{ background: "var(--green)", width: 26, height: 26, borderRadius: 13, fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
            <span style={{ lineHeight: 1.4 }}>{s}</span>
          </div>
        ))}
      </div>
      {r.missing.length > 0 && u.menu && (
        <button className="btn glass strong" style={{ marginTop: 14 }} onClick={toShopping}>
          <ShoppingCart size={18} /> Недостающее — в покупки
        </button>
      )}
      <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={ate}>
        <Check size={20} /> Я это приготовил(а) и съел(а)
      </button>
    </Sheet>
  );
}
