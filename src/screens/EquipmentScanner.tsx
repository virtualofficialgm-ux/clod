import { AlertTriangle, Camera, Check, ImagePlus, ListPlus, RotateCcw, ScanLine, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { useRef, useState } from "react";
import type { EquipmentAnalysis } from "../../shared/types";
import { prepareImage, scanEquipment } from "../api";
import { Page, haptic, toast } from "../components/ui";
import { MACHINES, localEquipment } from "../data/machines";
import { today, uid, updateUser, useUser } from "../store";

type Mode = "intro" | "analyzing" | "manual" | "result";

export default function EquipmentScanner({ onBack }: { onBack: () => void }) {
  const u = useUser()!;
  const [mode, setMode] = useState<Mode>("intro");
  const [photo, setPhoto] = useState<string | undefined>();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<EquipmentAnalysis | null>(null);
  const [ai, setAi] = useState(true);
  const [added, setAdded] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const scans = u.scans ?? [];

  const show = (r: EquipmentAnalysis, fromAi: boolean, thumb = photo) => {
    setResult(r);
    setAi(fromAi);
    setAdded(false);
    setMode("result");
    haptic(20);
    if (r.recognized) {
      updateUser((d) => ({ ...d, scans: [{ id: uid(), date: today(), photo: thumb, result: r }, ...(d.scans ?? [])].slice(0, 20) }));
    }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setMode("analyzing");
    try {
      const { base64, thumb } = await prepareImage(file);
      setPhoto(thumb);
      const r = await scanEquipment({ image: base64, question, profile: u.profile, program: u.program });
      if (r) show(r, true, thumb);
      else setMode("manual");
    } catch {
      toast("Не удалось обработать фото");
      setMode("intro");
    }
  };

  const addToPlan = () => {
    if (!result || !u.program) return;
    const m = result.planMatch;
    updateUser((d) => {
      if (!d.program) return d;
      const idx = Math.max(0, d.program.days.findIndex((x) => x.title === m.dayTitle));
      const days = d.program.days.map((day, i) =>
        i === idx
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                { name: m.exercise, sets: m.sets, reps: m.reps, restSec: m.restSec, muscle: result.muscles[0] ?? "", tip: result.steps[0] ?? "" },
              ],
            }
          : day,
      );
      return { ...d, program: { ...d.program, days } };
    });
    setAdded(true);
    toast("Упражнение добавлено в план ✓");
  };

  const reset = () => {
    setMode("intro");
    setResult(null);
    setPhoto(undefined);
  };

  return (
    <Page title="Сканер тренажёров" onBack={onBack}>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {mode === "intro" && (
        <div className="stagger">
          <h1 className="large-title">
            <small>ИИ в зале</small>
            Сканер тренажёров
          </h1>
          <button className="scanner-frame" onClick={() => (haptic(15), camera.current?.click())}>
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            <span className="scan-beam" />
            <span className="scanner-cta glass strong">
              <Camera size={22} /> Сфотографировать тренажёр
            </span>
          </button>
          <p className="muted" style={{ margin: "14px 4px", lineHeight: 1.4 }}>
            ИИ узнает тренажёр, покажет, как его настроить под ваш рост, и скажет, какое упражнение из вашего плана на нём делать.
          </p>
          <input
            id="scan-question"
            className="field"
            placeholder="Вопрос к фото (необязательно)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button className="btn glass strong" style={{ marginTop: 12 }} onClick={() => gallery.current?.click()}>
            <ImagePlus size={20} /> Выбрать из галереи
          </button>

          {scans.length > 0 && (
            <>
              <div className="section-title">Мои тренажёры</div>
              <div className="stack">
                {scans.map((s) => (
                  <button key={s.id} className="glass row" style={{ borderRadius: 22, padding: 10, textAlign: "left", width: "100%" }} onClick={() => (setPhoto(s.photo), setResult(s.result), setAi(true), setAdded(false), setMode("result"))}>
                    {s.photo ? (
                      <img src={s.photo} alt="" style={{ width: 60, height: 60, borderRadius: 14, objectFit: "cover" }} />
                    ) : (
                      <span style={{ width: 60, height: 60, borderRadius: 14, background: "var(--fill)", display: "grid", placeItems: "center" }}>
                        <Wrench size={24} />
                      </span>
                    )}
                    <span style={{ minWidth: 0 }}>
                      <b>{s.result.name}</b>
                      <div className="caption">
                        {s.result.planMatch.exercise} · {s.result.planMatch.sets} × {s.result.planMatch.reps}
                      </div>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="section-title">Или выберите вручную</div>
          <MachineGrid onPick={(i) => show(localEquipment(MACHINES[i], u.profile, u.program), false, undefined)} />
        </div>
      )}

      {mode === "analyzing" && (
        <div style={{ textAlign: "center", paddingTop: 70 }} className="fade-in">
          <div className="scanner-frame analyzing" style={{ backgroundImage: photo ? `url(${photo})` : undefined }}>
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            <span className="scan-beam" />
          </div>
          <h2 style={{ margin: "22px 0 4px" }}>ИИ изучает тренажёр…</h2>
          <div className="caption" style={{ fontSize: 15 }}>Сверяем с вашей программой «{u.program?.name ?? "тренировок"}»</div>
        </div>
      )}

      {mode === "manual" && (
        <div className="fade-in">
          <h1 className="large-title" style={{ fontSize: 28 }}>Выберите тренажёр</h1>
          <div className="glass card row" style={{ marginBottom: 16 }}>
            <AlertTriangle size={22} color="var(--orange)" style={{ flex: "none" }} />
            <span className="caption" style={{ fontSize: 15 }}>
              ИИ сейчас недоступен, поэтому распознать фото не получится. Выберите тренажёр из списка — подскажем по вашему плану.
            </span>
          </div>
          <MachineGrid onPick={(i) => show(localEquipment(MACHINES[i], u.profile, u.program), false)} />
        </div>
      )}

      {mode === "result" && result && (
        <div className="fade-in">
          <div className="hero-img" style={{ marginTop: 52, background: photo ? `center/cover url(${photo})` : "linear-gradient(135deg, var(--indigo), var(--teal))" }}>
            {!photo && <Wrench size={64} />}
            <span className="badge glass" style={{ position: "absolute", left: 12, bottom: 12, background: "rgba(0,0,0,.35)", color: "#fff" }}>
              {ai ? (
                <>
                  <Sparkles size={12} /> Распознано ИИ
                </>
              ) : (
                "Из каталога"
              )}
            </span>
          </div>

          {!result.recognized ? (
            <div className="glass card" style={{ marginTop: 16, textAlign: "center" }}>
              <h2 style={{ marginTop: 0 }}>Не похоже на тренажёр</h2>
              <p className="muted">{result.description}</p>
              <button className="btn btn-primary" onClick={reset}>
                <RotateCcw size={18} /> Попробовать снова
              </button>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "18px 4px 6px", textWrap: "balance" }}>{result.name}</h1>
              <p className="muted" style={{ margin: "0 4px 12px", lineHeight: 1.4 }}>{result.description}</p>
              <div className="chips" style={{ marginBottom: 16 }}>
                {result.muscles.map((m) => (
                  <span key={m} className="chip" style={{ display: "inline-flex", alignItems: "center" }}>{m}</span>
                ))}
              </div>

              <div className="plan-card">
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge" style={{ background: "rgba(255,255,255,.22)", color: "#fff" }}>
                    {result.planMatch.inPlan ? "Есть в вашем плане" : "Рекомендация под ваш план"}
                  </span>
                </div>
                {result.planMatch.dayTitle && <div style={{ opacity: 0.85, marginTop: 10, fontSize: 15 }}>{result.planMatch.dayTitle}</div>}
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{result.planMatch.exercise}</div>
                <div className="plan-stats">
                  <div>
                    <b>{result.planMatch.sets}</b>
                    <span>подхода</span>
                  </div>
                  <div>
                    <b>{result.planMatch.reps}</b>
                    <span>повторов</span>
                  </div>
                  <div>
                    <b>{result.planMatch.restSec ? `${result.planMatch.restSec} с` : "—"}</b>
                    <span>отдых</span>
                  </div>
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.95 }}>⚖️ {result.planMatch.weightTip}</div>
                {!result.planMatch.inPlan && u.program && (
                  <button className="btn" style={{ marginTop: 14, height: 48, background: "#fff", color: "#000" }} onClick={addToPlan} disabled={added}>
                    {added ? (
                      <>
                        <Check size={18} /> Добавлено
                      </>
                    ) : (
                      <>
                        <ListPlus size={18} /> Добавить в план
                      </>
                    )}
                  </button>
                )}
              </div>

              <Steps title="Настройка тренажёра" items={result.setup} color="var(--indigo)" />
              <Steps title="Как выполнять" items={result.steps} color="var(--green)" />

              <div className="list-header">Частые ошибки</div>
              <div className="list glass">
                {result.mistakes.map((s) => (
                  <div key={s} className="list-row plain">
                    <span style={{ color: "var(--red)", fontWeight: 700 }}>✕</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>

              <div className="glass card row" style={{ marginTop: 16, alignItems: "flex-start" }}>
                <ShieldCheck size={22} color="var(--green)" style={{ flex: "none" }} />
                <span style={{ lineHeight: 1.4 }}>{result.safety}</span>
              </div>

              {result.alternatives.length > 0 && (
                <>
                  <div className="list-header">Ещё на этом тренажёре</div>
                  <div className="list glass">
                    {result.alternatives.map((a) => (
                      <div key={a.name} className="list-row plain" style={{ display: "block" }}>
                        <div style={{ fontWeight: 600 }}>{a.name}</div>
                        <div className="caption">{a.how}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="glass card row" style={{ marginTop: 16, alignItems: "flex-start" }}>
                <Sparkles size={20} color="var(--purple)" style={{ flex: "none", marginTop: 2 }} />
                <span style={{ lineHeight: 1.4 }}>
                  <b>Совет тренера. </b>
                  {result.coachNote}
                </span>
              </div>

              <button className="btn btn-primary" style={{ margin: "20px 0 30px" }} onClick={reset}>
                <ScanLine size={20} /> Сканировать другой тренажёр
              </button>
            </>
          )}
        </div>
      )}
    </Page>
  );
}

function Steps({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <>
      <div className="list-header">{title}</div>
      <div className="list glass">
        {items.map((s, i) => (
          <div key={s} className="list-row plain" style={{ alignItems: "flex-start" }}>
            <span className="icon-tile" style={{ background: color, width: 26, height: 26, borderRadius: 13, fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
            <span style={{ lineHeight: 1.4 }}>{s}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function MachineGrid({ onPick }: { onPick: (i: number) => void }) {
  return (
    <div className="grid-3" style={{ gap: 8 }}>
      {MACHINES.map((m, i) => (
        <button key={m.name} className="glass" style={{ borderRadius: 18, padding: "12px 6px", textAlign: "center", fontSize: 13, fontWeight: 600, lineHeight: 1.2 }} onClick={() => (haptic(), onPick(i))}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>{m.emoji}</div>
          {m.name}
        </button>
      ))}
    </div>
  );
}
