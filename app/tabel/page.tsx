"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TabelAdmin } from "@/components/TabelAdmin";
import { Icon } from "@/components/ui";
import { fmtDay, today, weekday } from "@/lib/dates";
import { fmtMinutes, workMinutes } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { ROLE_LABEL, type Attendance, type Staff } from "@/lib/types";

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
  if (a?.in && a.out) {
    const h = fmtMinutes(workMinutes(a));
    return { tone: "out", text: `${a.in} – ${a.out}${h ? ` · ${h}` : ""}` };
  }
  if (a?.in) return { tone: "in", text: `на работе с ${a.in}` };
  return { tone: "none", text: "не отметилась" };
}

export default function TabelPage() {
  const { kiosk } = useStore();
  return <div className="kiosk">{kiosk ? <Board /> : <OpenForm />}</div>;
}

/* ---------- Утро: администратор открывает табель на день ---------- */

function OpenForm() {
  const { openKiosk } = useStore();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const d = today();
  return (
    <form
      className="kiosk-open"
      onSubmit={(e) => {
        e.preventDefault();
        setError(openKiosk(login, password));
      }}
    >
      <p className="wordmark">LORI</p>
      <h1 className="kiosk-title">Табель рабочего времени</h1>
      <p className="kiosk-date">
        {fmtDay(d)}, {weekday(d)}
      </p>
      <p className="muted">Откройте табель на сегодня под учётной записью администратора. После этого сотрудники отмечаются сами.</p>
      <label className="field">
        <span className="field-label">Логин администратора</span>
        <input value={login} onChange={(e) => setLogin(e.target.value)} autoCapitalize="none" autoComplete="username" />
      </label>
      <label className="field">
        <span className="field-label">Пароль</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-block kiosk-big">
        Открыть табель на сегодня
      </button>
    </form>
  );
}

/* ---------- День: список сотрудников, каждый отмечается сам ---------- */

type Step = { kind: "list" } | { kind: "pin"; staff: Staff } | { kind: "act"; staff: Staff } | { kind: "done"; staff: Staff; text: string };

function Board() {
  const { db, kiosk, mark } = useStore();
  const now = useClock();
  const [step, setStep] = useState<Step>({ kind: "list" });
  const [closing, setClosing] = useState(false);
  const [askAdmin, setAskAdmin] = useState(false);
  const [manager, setManager] = useState<Staff | null>(null);
  const closeAdmin = useCallback(() => setManager(null), []);
  const team = db.staff.filter((s) => s.active && s.role !== "owner");
  const day = db.attendance.filter((a) => a.date === today());
  const opener = db.staff.find((s) => s.id === kiosk?.by);
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
              <button type="button" className={`kiosk-tile is-${st.tone}`} onClick={() => setStep({ kind: "pin", staff: s })}>
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
        <span className="muted small">
          Табель открыт: {opener ? `${opener.name}${opener.name === ROLE_LABEL[opener.role] ? "" : ` (${ROLE_LABEL[opener.role].toLowerCase()})`}` : "—"}
        </span>
        <span className="kiosk-foot-actions">
          <button type="button" className="btn btn-ghost" onClick={() => (setStep({ kind: "list" }), setAskAdmin(true))}>
            <Icon name="user" size={18} /> Режим администратора
          </button>
          <button type="button" className="link-btn small" onClick={() => setClosing(true)}>
            Закрыть табель
          </button>
        </span>
      </footer>

      {step.kind === "pin" && <PinPanel staff={step.staff} onCancel={() => setStep({ kind: "list" })} onOk={() => setStep({ kind: "act", staff: step.staff })} />}
      {step.kind === "act" && (
        <ActPanel staff={step.staff} a={day.find((x) => x.staffId === step.staff.id)} onCancel={() => setStep({ kind: "list" })} onAct={(k) => act(step.staff, k)} />
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
      {closing && <ClosePanel onClose={() => setClosing(false)} />}
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

/** Сотрудник подтверждает, что это она, — своим паролем от CRM */
function PinPanel({ staff, onCancel, onOk }: { staff: Staff; onCancel: () => void; onOk: () => void }) {
  const { checkPassword } = useStore();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  return (
    <Panel onClose={onCancel} label={staff.name}>
      <form
        className="kiosk-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (checkPassword(staff.id, pw)) onOk();
          else {
            setErr(true);
            setPw("");
          }
        }}
      >
        <p className="kiosk-panel-name">{staff.name}</p>
        <label className="field">
          <span className="field-label">Ваш пароль</span>
          <input type="password" value={pw} onChange={(e) => (setPw(e.target.value), setErr(false))} autoFocus autoComplete="off" />
        </label>
        {err && (
          <p className="field-error" role="alert">
            Неверный пароль
          </p>
        )}
        <div className="kiosk-actions">
          <button type="button" className="btn btn-ghost kiosk-big" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className="btn kiosk-big" disabled={!pw}>
            Далее
          </button>
        </div>
      </form>
    </Panel>
  );
}

/** Три действия: пришла, ушла, выходной — доступны только те, что подходят к текущей отметке */
function ActPanel({ staff, a, onCancel, onAct }: { staff: Staff; a?: Attendance; onCancel: () => void; onAct: (k: "in" | "out" | "off") => void }) {
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
      {a?.in && a.out && <p className="muted small">На сегодня всё отмечено. Если ошиблись — скажите администратору, она поправит.</p>}
      <button type="button" className="btn btn-ghost btn-block kiosk-big" onClick={onCancel}>
        Отмена
      </button>
    </Panel>
  );
}

/** Вечером администратор закрывает табель; на следующий день он закрывается сам */
function ClosePanel({ onClose }: { onClose: () => void }) {
  const { closeKiosk } = useStore();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  return (
    <Panel onClose={onClose} label="Закрыть табель">
      <form
        className="kiosk-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!closeKiosk(pw)) {
            setErr(true);
            setPw("");
          }
        }}
      >
        <p className="kiosk-panel-name">Закрыть табель</p>
        <p className="muted small">Нужен пароль администратора или владельца. Завтра табель закроется сам — утром его снова откроет администратор.</p>
        <label className="field">
          <span className="field-label">Пароль</span>
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
          <button type="submit" className="btn btn-red kiosk-big" disabled={!pw}>
            Закрыть
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
