"use client";

import { useEffect, useRef } from "react";

/* ---------- Icons (1.6px stroke, 20px) ---------- */

const PATHS: Record<string, string> = {
  today: "M4 7h16M4 7v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7M4 7V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v1M8 3v4M16 3v4M9 13.5l2 2 4-4",
  calendar: "M4 7h16M4 7v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7M4 7V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v1M8 3v4M16 3v4M8 12h2M14 12h2M8 16h2",
  clients: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c1.6.7 2.7 2.4 3 5.2",
  dress: "M9.5 3 8 7l2.5 2L6 20h12l-4.5-11L16 7l-1.5-4M9.5 3c.8 1 1.6 1.5 2.5 1.5S13.7 4 14.5 3",
  reports: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  chevronL: "M15 6l-6 6 6 6",
  chevronR: "M9 6l6 6-6 6",
  phone: "M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  chat: "M4 19.5 5.5 15A8 8 0 1 1 9 18.5L4 19.5Z",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  check: "M5 12.5l4.5 4.5L19 7",
  x: "M7 7l10 10M17 7 7 17",
  ring: "M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM9.5 9 8 5.5 10 3h4l2 2.5L14.5 9",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  bag: "M5 8h14l-1 12H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2",
  swap: "M4 8h13l-3-3M20 16H7l3 3",
  alert: "M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.2v.3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20c.8-3.6 3.8-6 7.5-6s6.7 2.4 7.5 6",
  reset: "M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5",
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14",
  chart: "M4 20V10M10 20V4M16 20v-7",
};

export function Icon({ name, size = 20, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

/* ---------- Modal dialog ---------- */

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? " modal-wide" : ""}`}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 className="modal-title">{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </dialog>
  );
}

/* ---------- Side drawer ---------- */

export function Drawer({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button type="button" className="icon-btn drawer-close" onClick={onClose} aria-label="Закрыть">
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}

/* ---------- Small pieces ---------- */

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "ink";

export function Chip({ tone = "neutral", children, icon }: { tone?: Tone; children: React.ReactNode; icon?: string }) {
  return (
    <span className={`chip chip-${tone}`}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  // стабильный оттенок по имени — только для различия, не несёт смысла
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const tones = ["#efe6da", "#e9e2ef", "#e1ebe6", "#f1e3e3", "#e3e8f1"];
  return (
    <span className="avatar" style={{ width: size, height: size, background: tones[h % tones.length], fontSize: size * 0.36 }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  error,
  group,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  /** true — для составных полей (поиск клиентки, выбор платья), чтобы не вкладывать label в label */
  group?: boolean;
}) {
  const cls = `field${error ? " has-error" : ""}`;
  const tail = error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>;
  if (group) {
    return (
      <div className={cls} role="group" aria-label={label}>
        <span className="field-label">{label}</span>
        {children}
        {tail}
      </div>
    );
  }
  return (
    <label className={cls}>
      <span className="field-label">{label}</span>
      {children}
      {tail}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="segmented-item"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
