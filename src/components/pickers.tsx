import { useEffect, useRef } from "react";
import { haptic } from "./ui";

const ROW = 44;

export function Wheel<T extends string | number>({
  items,
  value,
  onChange,
  format = (v) => String(v),
}: {
  items: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, items.indexOf(value));
  const settle = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (el && Math.abs(el.scrollTop - idx * ROW) > 2) el.scrollTop = idx * ROW;
    // only on mount / external change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  return (
    <div
      className="wheel"
      ref={ref}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        window.clearTimeout(settle.current);
        settle.current = window.setTimeout(() => {
          const i = Math.max(0, Math.min(items.length - 1, Math.round(top / ROW)));
          if (items[i] !== value) {
            haptic(4);
            onChange(items[i]);
          }
        }, 60);
      }}
    >
      <div className="wheel-pad" />
      {items.map((it, i) => (
        <div
          key={String(it)}
          className={i === idx ? "sel" : ""}
          onClick={() => ref.current?.scrollTo({ top: i * ROW, behavior: "smooth" })}
        >
          {format(it)}
        </div>
      ))}
      <div className="wheel-pad" />
    </div>
  );
}

/** Horizontal ruler like Cal AI's target-weight picker. step = 0.1 unit per tick. */
export function Ruler({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const TICK = 10;
  const ticks = Math.round((max - min) * 10) + 1;
  const last = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = Math.round((value - min) * 10) * TICK;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]);

  return (
    <div style={{ position: "relative" }}>
      <div
        className="ruler"
        ref={ref}
        onScroll={(e) => {
          const v = Math.round(min * 10 + e.currentTarget.scrollLeft / TICK) / 10;
          const clamped = Math.max(min, Math.min(max, v));
          if (clamped !== last.current) {
            if (Math.round(clamped) === clamped) haptic(3);
            last.current = clamped;
            onChange(clamped);
          }
        }}
      >
        <div className="ruler-track" style={{ padding: "0 calc(50% - 5px)", width: "max-content" }}>
          {Array.from({ length: ticks }, (_, i) => (
            <i key={i} className={i % 10 === 0 ? "major" : ""} />
          ))}
        </div>
      </div>
      <div className="ruler-needle" />
    </div>
  );
}
