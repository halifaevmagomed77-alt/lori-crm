"use client";

import { useEffect, useRef, useState } from "react";

export type Series = { key: string; label: string; color: string };
export type Row = { label: string; title: string; values: Record<string, number> };

/** Шаг оси из ряда 1, 2, 5, 10… так, чтобы делений было 4–5 и все были целыми */
function niceScale(v: number) {
  const raw = Math.max(1, v) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.max(1, [1, 2, 5, 10].map((k) => k * pow).find((k) => k >= raw) ?? 10 * pow);
  const max = Math.ceil(Math.max(1, v) / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return { max, ticks };
}

/** Сгруппированные столбцы: одна ось, тонкие столбцы, подсказка при наведении */
export function BarChart({ series, rows, height = 260 }: { series: Series[]; rows: Row[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 8, bottom: 28, left: 32 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;
  const { max, ticks } = niceScale(Math.max(...rows.flatMap((r) => series.map((s) => r.values[s.key]))));
  const band = iw / Math.max(1, rows.length);
  const gap = 2;
  const barW = Math.max(3, Math.min(24, (band * 0.72 - gap * (series.length - 1)) / series.length));
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => pad.top + ih - (v / max) * ih;
  const labelEvery = Math.ceil(rows.length / Math.max(1, Math.floor(iw / 46)));

  const bar = (x: number, v: number) => {
    const top = y(v);
    const h = pad.top + ih - top;
    if (h <= 0) return "";
    const r = Math.min(4, h, barW / 2);
    return `M${x},${pad.top + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + ih} Z`;
  };

  const hv = hover !== null ? rows[hover] : null;
  const tipLeft = hover !== null ? pad.left + band * hover + band / 2 : 0;

  return (
    <div className="chart" ref={wrap}>
      <ul className="legend" aria-label="Обозначения">
        {series.map((s) => (
          <li key={s.key}>
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="chart-plot" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label="Примерки, продажи и аренда по периодам. Точные значения — в таблице под графиком.">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={pad.left - 8} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const gx = pad.left + band * i + (band - groupW) / 2;
            return (
              <g key={r.title}>
                {hover === i && <rect x={pad.left + band * i} y={pad.top} width={band} height={ih} className="hover-band" />}
                {series.map((s, k) => (
                  <path key={s.key} d={bar(gx + k * (barW + gap), r.values[s.key])} fill={s.color} />
                ))}
                {i % labelEvery === 0 && (
                  <text x={pad.left + band * i + band / 2} y={height - 8} className="axis" textAnchor="middle">
                    {r.label}
                  </text>
                )}
                <rect
                  x={pad.left + band * i}
                  y={0}
                  width={band}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
        {hv && (
          <div
            className="tooltip"
            style={{ left: Math.min(Math.max(tipLeft, 90), width - 90) }}
            role="status"
          >
            <p className="tooltip-title">{hv.title}</p>
            {series.map((s) => (
              <p key={s.key} className="tooltip-row">
                <span className="legend-swatch" style={{ background: s.color }} />
                <span>{s.label}</span>
                <strong>{hv.values[s.key]}</strong>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
