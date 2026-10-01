import { Camera, Check, Droplet, ImagePlus, PenLine, Scale, ScanLine, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import type { MealAnalysis } from "../../shared/types";
import { analyzeMeal, prepareImage } from "../api";
import { Ring, Sheet, haptic, toast } from "../components/ui";
import { today, uid, updateUser, useUser } from "../store";
import { computePlan } from "../../shared/nutrition";
import { allow, consume } from "../subscription";
import { Refrigerator } from "lucide-react";

type Mode = "menu" | "describe" | "analyzing" | "result" | "weight";

export default function AddSheet({ onClose, onScan, onFridge }: { onClose: () => void; onScan: () => void; onFridge: () => void }) {
  const u = useUser()!;
  const [mode, setMode] = useState<Mode>("menu");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [result, setResult] = useState<MealAnalysis | null>(null);
  const [ai, setAi] = useState(true);
  const [portion, setPortion] = useState(1);
  const [kg, setKg] = useState(String(u.profile.weightKg));
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!allow("scans")) return;
    setMode("analyzing");
    try {
      const { base64, thumb } = await prepareImage(file);
      setPhoto(thumb);
      const r = await analyzeMeal({ image: base64, mediaType: "image/jpeg", text, profile: u.profile });
      if (r.ai) consume("scans");
      setResult(r.data);
      setAi(r.ai);
      setMode("result");
    } catch {
      toast("Не удалось обработать фото");
      setMode("menu");
    }
  };

  const describe = async () => {
    if (!text.trim()) return;
    setMode("analyzing");
    const r = await analyzeMeal({ text, profile: u.profile });
    setResult(r.data);
    setAi(r.ai);
    setMode("result");
  };

  const save = () => {
    if (!result) return;
    const k = portion;
    const now = new Date();
    updateUser((d) => ({
      ...d,
      meals: [
        ...d.meals,
        {
          ...result,
          calories: Math.round(result.calories * k),
          protein: Math.round(result.protein * k),
          carbs: Math.round(result.carbs * k),
          fat: Math.round(result.fat * k),
          id: uid(),
          date: today(),
          time: now.toTimeString().slice(0, 5),
          photo,
        },
      ],
    }));
    haptic(20);
    toast("Добавлено в дневник ✓");
    onClose();
  };

  const saveWeight = () => {
    const v = Number(kg.replace(",", "."));
    if (!(v > 25 && v < 350)) return toast("Введите корректный вес");
    updateUser((d) => {
      const profile = { ...d.profile, weightKg: v };
      return { ...d, profile, plan: computePlan(profile), weights: [...d.weights.filter((w) => w.date !== today()), { date: today(), kg: v }] };
    });
    toast("Вес записан");
    onClose();
  };

  const titles: Record<Mode, string> = {
    menu: "Добавить",
    describe: "Опишите еду",
    analyzing: "Анализ",
    result: "Результат",
    weight: "Вес",
  };

  return (
    <Sheet title={titles[mode]} onClose={onClose}>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ""))} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ""))} />

      {mode === "menu" && (
        <div className="grid-2 stagger">
          <Tile icon={<Camera size={26} />} color="linear-gradient(135deg, var(--orange), var(--pink))" label="Сканировать еду" sub="ИИ по фото" onClick={() => camera.current?.click()} />
          <Tile icon={<ImagePlus size={26} />} color="linear-gradient(135deg, var(--purple), var(--indigo))" label="Из галереи" sub="Выбрать фото" onClick={() => gallery.current?.click()} />
          <Tile icon={<PenLine size={26} />} color="linear-gradient(135deg, var(--blue), var(--teal))" label="Описать текстом" sub="«Омлет из 2 яиц»" onClick={() => setMode("describe")} />
          <Tile
            icon={<Droplet size={26} />}
            color="linear-gradient(135deg, var(--teal), var(--blue))"
            label="+250 мл воды"
            sub="Стакан"
            onClick={() => {
              updateUser((d) => ({ ...d, water: { ...d.water, [today()]: (d.water[today()] ?? 0) + 250 } }));
              toast("💧 +250 мл");
              onClose();
            }}
          />
          <Tile icon={<Scale size={26} />} color="linear-gradient(135deg, var(--green), var(--teal))" label="Записать вес" sub="Обновит план" onClick={() => setMode("weight")} />
          <Tile icon={<Refrigerator size={26} />} color="linear-gradient(135deg, var(--green), var(--yellow))" label="Что приготовить" sub="Фото продуктов" onClick={() => (onClose(), onFridge())} />
          <Tile icon={<ScanLine size={26} />} color="linear-gradient(135deg, var(--indigo), var(--teal))" label="Сканер тренажёров" sub="Что и как делать" onClick={() => (onClose(), onScan())} />
        </div>
      )}

      {mode === "describe" && (
        <div className="fade-in">
          <textarea className="field" rows={4} autoFocus placeholder="Например: тарелка гречки с куриной грудкой и салат из огурцов" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={!text.trim()} onClick={describe}>
            <Sparkles size={18} /> Рассчитать
          </button>
        </div>
      )}

      {mode === "analyzing" && (
        <div style={{ textAlign: "center", padding: "20px 0 30px" }} className="fade-in">
          {photo ? (
            <div style={{ position: "relative", width: 200, height: 200, margin: "0 auto", borderRadius: 30, overflow: "hidden" }}>
              <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(255,255,255,.6) 50%, transparent 60%)", backgroundSize: "100% 300%", animation: "scan 1.6s linear infinite" }} />
            </div>
          ) : (
            <span className="spinner" style={{ width: 44, height: 44, display: "inline-block", borderWidth: 4 }} />
          )}
          <style>{`@keyframes scan { from { background-position: 0 100%; } to { background-position: 0 -100%; } }`}</style>
          <h3 style={{ marginTop: 20 }}>ИИ анализирует блюдо…</h3>
          <div className="caption">Определяем ингредиенты и считаем КБЖУ</div>
        </div>
      )}

      {mode === "result" && result && (
        <div className="fade-in">
          {photo && <img src={photo} alt="" style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 24, marginBottom: 14 }} />}
          <div className="row">
            <h2 style={{ margin: 0, flex: 1 }}>{result.name}</h2>
            {!ai && <span className="badge">офлайн</span>}
          </div>
          <div className="glass card row" style={{ marginTop: 12 }}>
            <Ring value={result.healthScore / 10} size={64} stroke={7} color="var(--green)">
              <b>{result.healthScore}</b>
            </Ring>
            <div>
              <div className="big-num" style={{ fontSize: 36 }}>≈{Math.round(result.calories * portion)}</div>
              <div className="caption">ккал — приблизительная оценка · полезность {result.healthScore}/10</div>
            </div>
          </div>
          <div className="grid-3" style={{ marginTop: 10 }}>
            {[
              ["🍗 Белки", result.protein],
              ["🌾 Углев.", result.carbs],
              ["🥑 Жиры", result.fat],
            ].map(([l, v]) => (
              <div key={l} className="glass" style={{ borderRadius: 18, padding: 12, textAlign: "center" }}>
                <div className="caption" style={{ fontSize: 12 }}>{l}</div>
                <div className="mid-num">{Math.round(Number(v) * portion)}г</div>
              </div>
            ))}
          </div>
          <div className="list-header" style={{ marginLeft: 4 }}>Порция</div>
          <div className="chips">
            {[0.5, 0.75, 1, 1.5, 2].map((x) => (
              <button key={x} className={`chip ${portion === x ? "on" : ""}`} onClick={() => setPortion(x)}>
                ×{String(x).replace(".", ",")}
              </button>
            ))}
          </div>
          {result.items.length > 0 && (
            <div className="list glass" style={{ marginTop: 14 }}>
              {result.items.map((i) => (
                <div key={i.name} className="list-row plain">
                  <span>{i.name}</span>
                  <span className="value">
                    {Math.round(i.grams * portion)} г · {Math.round(i.calories * portion)} ккал
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="muted" style={{ lineHeight: 1.4 }}>{result.comment}</p>
          <button className="btn btn-primary" onClick={save}>
            <Check size={20} /> Добавить в дневник
          </button>
        </div>
      )}

      {mode === "weight" && (
        <div className="fade-in">
          <input className="field" style={{ fontSize: 34, height: 80, textAlign: "center", fontWeight: 700 }} inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} autoFocus />
          <div className="caption" style={{ textAlign: "center", margin: "8px 0 18px" }}>кг</div>
          <button className="btn btn-primary" onClick={saveWeight}>Сохранить</button>
        </div>
      )}
    </Sheet>
  );
}

function Tile({ icon, color, label, sub, onClick }: { icon: React.ReactNode; color: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button className="glass" style={{ borderRadius: 24, padding: 16, textAlign: "left" }} onClick={() => (haptic(), onClick())}>
      <span style={{ width: 50, height: 50, borderRadius: 16, background: color, color: "#fff", display: "grid", placeItems: "center" }}>{icon}</span>
      <div style={{ fontWeight: 600, marginTop: 12 }}>{label}</div>
      <div className="caption">{sub}</div>
    </button>
  );
}
