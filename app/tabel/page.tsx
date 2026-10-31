"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TabelAdmin } from "@/components/TabelAdmin";
import { Icon } from "@/components/ui";
import { fmtDay, today, weekday } from "@/lib/dates";
import { fmtMinutes, workMinutes } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { MARK_LABEL, type Attendance, type MarkKind, type Staff } from "@/lib/types";

/** Сколько секунд держим экран сотрудника без действий, прежде чем вернуться к списку */
const IDLE_SECONDS = 30;

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = window.setInterval(tick, 10_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function statusOf(a?: Attendance): { tone: "none" | "in" | "out" | "off"; text: string } {
  if (a?.dayOff) return { tone: "off", text: a.note ? `выходной · ${a.note.toLowerCase()}` : "выходной" };
  const marks = a?.marks?.length ? ` · ${[...new Set(a.marks.map((m) => MARK_LABEL[m.kind].toLowerCase()))].join(", ")}` : "";
  if (a?.in && a.out) {
    const h = fmtMinutes(workMinutes(a));
    return { tone: "out", text: `${a.in} – ${a.out}${h ? ` · ${h}` : ""}${marks}` };
  }
  if (a?.in) return { tone: "in", text: `на работе с ${a.in}${marks}` };
  return { tone: "none", text: "не отметилась" };
}

/** Особые отметки: что нажать и что произойдёт со временем */
const SPECIAL: { kind: MarkKind; hint: string; placeholder: string }[] = [
  { kind: "dressing", hint: "Пришла раньше на надевание невесты", placeholder: "Чья невеста, во сколько надевание" },
  { kind: "photo", hint: "Пришла раньше помочь невесте на фотосессии", placeholder: "Чья невеста, где фотосессия" },
  { kind: "overtime", hint: "Задержалась после окончания рабочего дня", placeholder: "Почему задержалась" },
  { kind: "partial", hint: "Пришла позже или ушла раньше", placeholder: "Причина: по семейным, к врачу, отпустила администратор…" },
];

/** Табель открыт всегда — без ежедневного открытия и закрытия администратором */
export default function TabelPage() {
  return (
    <div className="kiosk">
      <Board />
    </div>
  );
}

/* ---------- День: список сотрудников, каждый отмечается сам ---------- */

type Step =
  | { kind: "list" }
  | { kind: "act"; staff: Staff }
  | { kind: "special"; staff: Staff; mark: MarkKind }
  | { kind: "done"; staff: Staff; text: string };

function Board() {
  const { db, mark, markSpecial } = useStore();
  const now = useClock();
  const [step, setStep] = useState<Step>({ kind: "list" });
  const [askAdmin, setAskAdmin] = useState(false);
  const [manager, setManager] = useState<Staff | null>(null);
  const closeAdmin = useCallback(() => setManager(null), []);
  const team = db.staff.filter((s) => s.active && s.role !== "owner");
  const day = db.attendance.filter((a) => a.date === today());
  const d = today();
  const counts = {
    in: day.filter((a) => a.in && !a.out && !a.dayOff).length,
    off: day.filter((a) => a.dayOff).length,
  };

  // экран сотрудника не висит открытым: без действий возвращаемся к списку
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (step.kind === "list") return;
    timer.current = window.setTimeout(() => setStep({ kind: "list" }), step.kind === "done" ? 3500 : IDLE_SECONDS * 1000);
    return () => window.clearTimeout(timer.current);
  }, [step]);

  const act = (staff: Staff, kind: "in" | "out" | "off") => {
    mark(staff.id, kind);
    const t = now ? hhmm(new Date()) : "";
    setStep({ kind: "done", staff, text: kind === "in" ? `Пришла в ${t}` : kind === "out" ? `Ушла в ${t}` : "Сегодня выходной" });
  };
  const actSpecial = (staff: Staff, kind: MarkKind, note: string) => {
    markSpecial(staff.id, kind, note);
    setStep({ kind: "done", staff, text: `${MARK_LABEL[kind]} · ${hhmm(new Date())}` });
  };

  return (
    <>
      <header className="kiosk-head">
        <div>
          <p className="wordmark">LORI</p>
          <p className="kiosk-sub">Табель рабочего времени</p>
        </div>
        <div className="kiosk-now">
          <span className="kiosk-clock">{now ? hhmm(now) : ""}</span>
          <span className="kiosk-date">
            {fmtDay(d)}, {weekday(d)}
          </span>
        </div>
      </header>

      <p className="kiosk-summary">
        На работе: <strong>{counts.in}</strong> · выходной: <strong>{counts.off}</strong> · всего сотрудников: {team.length}
      </p>
      <p className="kiosk-hint">Нажмите на своё имя</p>

      <ul className="kiosk-grid">
        {team.map((s) => {
          const st = statusOf(day.find((a) => a.staffId === s.id));
          return (
            <li key={s.id}>
              <button type="button" className={`kiosk-tile is-${st.tone}`} onClick={() => setStep({ kind: "act", staff: s })}>
                <span className="kiosk-name">{s.name}</span>
                <span className="kiosk-status">
                  <span className="kiosk-dot" aria-hidden="true" />
                  {st.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="kiosk-foot">
        <span className="kiosk-foot-actions">
          <button type="button" className="btn btn-ghost" onClick={() => (setStep({ kind: "list" }), setAskAdmin(true))}>
            <Icon name="user" size={18} /> Режим администратора
          </button>
        </span>
      </footer>

      {step.kind === "act" && (
        <ActPanel
          staff={step.staff}
          a={day.find((x) => x.staffId === step.staff.id)}
          onCancel={() => setStep({ kind: "list" })}
          onAct={(k) => act(step.staff, k)}
          onSpecial={(m) => setStep({ kind: "special", staff: step.staff, mark: m })}
        />
      )}
      {step.kind === "special" && (
        <SpecialPanel
          staff={step.staff}
          kind={step.mark}
          a={day.find((x) => x.staffId === step.staff.id)}
          onBack={() => setStep({ kind: "act", staff: step.staff })}
          onSave={(note) => actSpecial(step.staff, step.mark, note)}
        />
      )}
      {step.kind === "done" && (
        <Panel onClose={() => setStep({ kind: "list" })} label="Отмечено">
          <div className="kiosk-done" role="status">
            <span className="kiosk-done-icon">
              <Icon name="check" size={40} />
            </span>
            <p className="kiosk-panel-name">{step.staff.name}</p>
            <p className="kiosk-done-text">{step.text}</p>
          </div>
        </Panel>
      )}
      {askAdmin && (
        <AdminLogin
          onClose={() => setAskAdmin(false)}
          onOk={(m) => {
            setAskAdmin(false);
            setManager(m);
          }}
        />
      )}
      {manager && <TabelAdmin manager={manager} onClose={closeAdmin} />}
    </>
  );
}

function Panel({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="kiosk-overlay" onClick={onClose}>
      <div className="kiosk-panel" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** Основные действия: пришла, ушла, выходной. Ниже — особые отметки с комментарием */
function ActPanel({
  staff,
  a,
  onCancel,
  onAct,
  onSpecial,
}: {
  staff: Staff;
  a?: Attendance;
  onCancel: () => void;
  onAct: (k: "in" | "out" | "off") => void;
  onSpecial: (k: MarkKind) => void;
}) {
  const st = statusOf(a);
  const canIn = !a?.in;
  const canOut = !!a?.in && !a.out && !a.dayOff;
  const canOff = !a?.in && !a?.dayOff;
  return (
    <Panel onClose={onCancel} label={staff.name}>
      <p className="kiosk-panel-name">{staff.name}</p>
      <p className={`kiosk-status is-${st.tone}`}>
        <span className="kiosk-dot" aria-hidden="true" />
        Сегодня: {st.text}
      </p>
      <div className="kiosk-buttons">
        <button type="button" className="kiosk-act act-in" disabled={!canIn} onClick={() => onAct("in")}>
          <Icon name="door" size={30} />
          Пришла
        </button>
        <button type="button" className="kiosk-act act-out" disabled={!canOut} onClick={() => onAct("out")}>
          <Icon name="logout" size={30} />
          Ушла
        </button>
        <button type="button" className="kiosk-act act-off" disabled={!canOff} onClick={() => onAct("off")}>
          <Icon name="calendar" size={30} />
          Выходной
        </button>
      </div>

      <p className="kiosk-special-title">Особая отметка</p>
      <div className="kiosk-special">
        {SPECIAL.map((x) => (
          <button key={x.kind} type="button" className={`kiosk-sp sp-${x.kind}`} onClick={() => onSpecial(x.kind)}>
            <strong>{MARK_LABEL[x.kind]}</strong>
            <span>{x.hint}</span>
          </button>
        ))}
      </div>

      {a?.marks && a.marks.length > 0 && (
        <ul className="kiosk-marks">
          {a.marks.map((m, i) => (
            <li key={i}>
              <strong>{MARK_LABEL[m.kind]}</strong> · {m.time}
              {m.note ? ` · ${m.note}` : ""}
            </li>
          ))}
        </ul>
      )}
      {a?.in && a.out && <p className="muted small">Если ошиблись со временем — скажите администратору, она поправит.</p>}
      <button type="button" className="btn btn-ghost btn-block kiosk-big" onClick={onCancel}>
        Отмена
      </button>
    </Panel>
  );
}

/** Особая отметка: что произойдёт со временем + комментарий */
function SpecialPanel({ staff, kind, a, onBack, onSave }: { staff: Staff; kind: MarkKind; a?: Attendance; onBack: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState("");
  const sp = SPECIAL.find((x) => x.kind === kind)!;
  const now = hhmm(new Date());
  const working = !!a?.in && !a.dayOff;
  const effect =
    kind === "dressing" || kind === "photo"
      ? working
        ? `Вы уже на работе с ${a!.in} — время прихода не изменится, отметка добавится к дню.`
        : `Приход будет отмечен сейчас: ${now}.`
      : kind === "overtime"
        ? working
          ? `Уход будет отмечен сейчас: ${now}.`
          : `Приход будет отмечен сейчас: ${now}.`
        : !working
          ? `Приход будет отмечен сейчас: ${now} (пришла позже).`
          : !a?.out
            ? `Уход будет отмечен сейчас: ${now} (ушла раньше).`
            : "Отметка добавится к дню.";
  return (
    <Panel onClose={onBack} label={MARK_LABEL[kind]}>
      <form
        className="kiosk-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(note);
        }}
      >
        <p className="kiosk-panel-name">{MARK_LABEL[kind]}</p>
        <p className="muted">
          {staff.name} · {sp.hint.toLowerCase()}
        </p>
        <p className="kiosk-effect">{effect}</p>
        <label className="field">
          <span className="field-label">Комментарий</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={sp.placeholder} autoFocus />
        </label>
        <div className="kiosk-actions">
          <button type="button" className="btn btn-ghost kiosk-big" onClick={onBack}>
            Назад
          </button>
          <button type="submit" className="btn kiosk-big">
            Отметить
          </button>
        </div>
      </form>
    </Panel>
  );
}

/** Вход в режим администратора — пароль администратора или владельца */
function AdminLogin({ onClose, onOk }: { onClose: () => void; onOk: (m: Staff) => void }) {
  const { checkManager } = useStore();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  return (
    <Panel onClose={onClose} label="Режим администратора">
      <form
        className="kiosk-form"
        onSubmit={(e) => {
          e.preventDefault();
          const m = checkManager(pw);
          if (m) onOk(m);
          else {
            setErr(true);
            setPw("");
          }
        }}
      >
        <p className="kiosk-panel-name">Режим администратора</p>
        <p className="muted small">Выходные за сотрудников, добавление и удаление сотрудников.</p>
        <label className="field">
          <span className="field-label">Пароль администратора</span>
          <input type="password" value={pw} onChange={(e) => (setPw(e.target.value), setErr(false))} autoFocus />
        </label>
        {err && (
          <p className="field-error" role="alert">
            Неверный пароль
          </p>
        )}
        <div className="kiosk-actions">
          <button type="button" className="btn btn-ghost kiosk-big" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn kiosk-big" disabled={!pw}>
            Войти
          </button>
        </div>
      </form>
    </Panel>
  );
}
