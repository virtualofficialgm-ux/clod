import { ArrowUp, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ChatMessage } from "../../shared/types";
import { chat } from "../api";
import { Md, haptic, useAutoScroll } from "../components/ui";
import { trainingLog, updateUser, useUser } from "../store";
import { allow, consume } from "../subscription";

const SUGGESTIONS = [
  "Как прошла моя последняя неделя тренировок?",
  "Что съесть перед тренировкой?",
  "Чем заменить приседания, если некомфортно колену?",
  "Как уложиться в бюджет на продукты?",
  "Что приготовить из остатков риса и курицы?",
  "Почему вес стоит на месте?",
];

export default function Coach() {
  const u = useUser()!;
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const messages = u.chat;
  const scroller = useAutoScroll<HTMLDivElement>(messages.length + (streaming?.length ?? 0));

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming !== null) return;
    if (!allow("chat")) return;
    haptic();
    setInput("");
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    updateUser((d) => ({ ...d, chat: history }));
    setStreaming("");
    let reply = "";
    const ai = await chat(
      u.profile,
      history,
      (t) => {
        reply = t;
        setStreaming(t);
      },
      trainingLog(u),
    );
    setOffline(!ai);
    if (ai) consume("chat");
    updateUser((d) => ({ ...d, chat: [...history, { role: "assistant", content: reply || "Не удалось получить ответ. Попробуйте ещё раз." }] }));
    setStreaming(null);
  };

  return (
    <>
      <div className="topbar">
        <span className="pill-btn glass" style={{ gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--purple), var(--blue))", display: "grid", placeItems: "center", color: "#fff" }}>
            <Sparkles size={16} />
          </span>
          ИИ-помощник
          {offline && <span className="caption">· офлайн</span>}
        </span>
        <div className="spacer" />
        {messages.length > 0 && (
          <button className="circle-btn glass" onClick={() => updateUser((d) => ({ ...d, chat: [] }))} aria-label="Очистить чат">
            <Trash2 size={20} />
          </button>
        )}
      </div>
      <div className="screen" ref={scroller} style={{ paddingTop: "calc(var(--safe-top) + 74px)", paddingBottom: "calc(var(--safe-bottom) + 180px)" }}>
        {messages.length === 0 && streaming === null ? (
          <div className="fade-in" style={{ textAlign: "center", paddingTop: 30 }}>
            <div style={{ width: 92, height: 92, margin: "0 auto", borderRadius: "50%", background: "linear-gradient(135deg, var(--purple), var(--blue), var(--teal))", display: "grid", placeItems: "center", color: "#fff", boxShadow: "0 20px 50px -10px var(--purple)" }}>
              <Sparkles size={42} />
            </div>
            <h1 style={{ fontSize: 28, margin: "20px 0 6px", letterSpacing: "-0.03em" }}>Привет{u.profile.name ? `, ${u.profile.name}` : ""}!</h1>
            <p className="muted" style={{ margin: "0 20px 24px", lineHeight: 1.4 }}>
              Я знаю ваш план тренировок, дневник и меню. Спросите о нагрузке, технике, питании или покупках.
            </p>
            <div className="stack" style={{ gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className="glass" style={{ borderRadius: 18, padding: "12px 16px", textAlign: "left", fontSize: 15 }} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role === "user" ? "me" : "ai glass"} fade-in`}>
                {m.role === "user" ? m.content : <Md text={m.content} />}
              </div>
            ))}
            {streaming !== null && (
              <div className="bubble ai glass">
                {streaming ? (
                  <Md text={streaming} />
                ) : (
                  <span className="typing">
                    <span />
                    <span />
                    <span />
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="composer">
        <div className="input glass strong">
          <textarea
            rows={1}
            placeholder="Спросите Parri…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button
            className="circle-btn"
            style={{ width: 36, height: 36, background: input.trim() ? "var(--blue)" : "var(--fill-2)", color: "#fff", transition: "background .2s" }}
            onClick={() => send(input)}
            aria-label="Отправить"
          >
            <ArrowUp size={20} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </>
  );
}
