import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Renders above the tab bar, at the device root. */
export function Overlay({ children }: { children: ReactNode }) {
  return createPortal(children, document.querySelector(".device") ?? document.body);
}

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

export function Ambient() {
  return (
    <div className="ambient" aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

export function Ring({
  value,
  size = 120,
  stroke = 12,
  color = "var(--ink)",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(Math.max(0, Math.min(1, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-bar"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Sheet({
  title,
  onClose,
  children,
  full,
  left,
  right,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Overlay>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet glass strong ${full ? "full" : ""}`} role="dialog" aria-label={title}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          {left ?? (
            <button className="circle-btn glass" onClick={onClose} aria-label="Закрыть">
              <X size={20} />
            </button>
          )}
          <h3>{title}</h3>
          {right ?? <div style={{ width: 44 }} />}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </Overlay>
  );
}

/** Pushed full-screen page with a glass back button and a collapsing large title. */
export function Page({
  title,
  onBack,
  right,
  children,
  bottom,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
  children: ReactNode;
  bottom?: ReactNode;
}) {
  const [leaving, setLeaving] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const back = () => {
    setLeaving(true);
    setTimeout(onBack, 300);
  };
  return (
    <Overlay>
    <div className={`push ${leaving ? "leaving" : ""}`}>
      <Ambient />
      <div className={`topbar ${scrolled ? "scrolled" : ""}`}>
        <button className="circle-btn glass" onClick={back} aria-label="Назад">
          <ChevronLeft size={24} />
        </button>
        <div className="title">{title}</div>
        <div className="spacer" />
        {right}
      </div>
      <div className="screen" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 40)}>
        {children}
      </div>
      {bottom}
    </div>
    </Overlay>
  );
}

export function ScreenWithTitle({
  title,
  kicker,
  right,
  children,
}: {
  title: string;
  kicker?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  return (
    <>
      <div className={`topbar ${scrolled ? "scrolled" : ""}`}>
        <div className="title">{title}</div>
        <div className="spacer" />
        {right}
      </div>
      <div className="screen" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 50)}>
        <h1 className="large-title">
          {kicker && <small>{kicker}</small>}
          {title}
        </h1>
        {children}
      </div>
    </>
  );
}

export function Row({
  icon,
  color,
  title,
  subtitle,
  value,
  onClick,
  chevron = !!onClick,
  plain,
  style,
}: {
  icon?: ReactNode;
  color?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  plain?: boolean;
  style?: CSSProperties;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`list-row ${plain ? "plain" : ""}`} onClick={onClick} style={style}>
      {icon && (
        <span className="icon-tile" style={{ background: color }}>
          {icon}
        </span>
      )}
      <span style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17 }}>{title}</div>
        {subtitle && <div className="caption">{subtitle}</div>}
      </span>
      {(value !== undefined || chevron) && (
        <span className="value">
          {value}
          {chevron && <ChevronRight size={18} style={{ opacity: 0.45 }} />}
        </span>
      )}
    </Tag>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={`toggle ${on ? "on" : ""}`} role="switch" aria-checked={on} onClick={() => (haptic(), onChange(!on))} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? "on" : ""} onClick={() => (haptic(), onChange(o.value))}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

let toastSetter: ((t: { text: string; id: number } | null) => void) | null = null;
export function toast(text: string) {
  toastSetter?.({ text, id: Date.now() });
}
export function ToastHost() {
  const [t, setT] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    toastSetter = setT;
    return () => {
      toastSetter = null;
    };
  }, []);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 2600);
    return () => clearTimeout(id);
  }, [t]);
  return t ? (
    <div key={t.id} className="toast glass strong">
      {t.text}
    </div>
  ) : null;
}

/** Tiny markdown: **bold**, bullet lists, paragraphs. */
export function Md({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>,
    );
  return (
    <div className="md">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-•*]|\d+[.)])\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#+\s*/, ""))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function useAutoScroll<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [dep]);
  return ref;
}
