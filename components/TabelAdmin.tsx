"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, fmtDay, fmtShort, today, weekday } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { MAX_EMPLOYEES, ROLE_LABEL, type Staff } from "@/lib/types";
import { Icon } from "./ui";

/** Режим администратора закрывается сам, если планшет оставили без присмотра */
const ADMIN_IDLE_SECONDS = 120;

const REASONS = ["Болеет", "По семейным обстоятельствам", "Отпуск", "Отгул"];

/**
 * Режим администратора на планшете: выходные за сотрудников и список сотрудников.
 * Открывается паролем администратора или владельца.
 */
export function TabelAdmin({ manager, onClose }: { manager: Staff; onClose: () => void }) {
  const [tab, setTab] = useState<"off" | "staff">("off");

  // без касаний режим закрывается, чтобы сотрудники не остались в нём сами
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const reset = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(onClose, ADMIN_IDLE_SECONDS * 1000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [onClose]);

  return (
    <div className="kiosk-overlay kiosk-admin-wrap">
      <section className="kiosk-panel kiosk-admin" role="dialog" aria-modal="true" aria-label="Режим администратора">
        <header className="kadm-head">
          <div>
            <p className="kiosk-panel-name">Режим администратора</p>
            <p className="muted small">
              {manager.name}
              {manager.name === ROLE_LABEL[manager.role] ? "" : ` · ${ROLE_LABEL[manager.role].toLowerCase()}`} · закроется сам через 2 минуты без касаний
            </p>
          </div>
          <button type="button" className="btn kiosk-big" onClick={onClose}>
            Готово
          </button>
        </header>
        <div className="kadm-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "off"} onClick={() => setTab("off")}>
            Выходные
          </button>
          <button type="button" role="tab" aria-selected={tab === "staff"} onClick={() => setTab("staff")}>
            Сотрудники
          </button>
        </div>
        {tab === "off" ? <DaysOff manager={manager} /> : <StaffList />}
      </section>
    </div>
  );
}

/* ---------- Выходные за сотрудников ---------- */

function DaysOff({ manager }: { manager: Staff }) {
  const { db, setDaysOff, cancelDayOff } = useStore();
  const [form, setForm] = useState<Staff | null>(null);
  const team = db.staff.filter((s) => s.active && s.role !== "owner");
  const t = today();
  const upcoming = db.attendance
    .filter((a) => a.dayOff && a.date >= t && team.some((s) => s.id === a.staffId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const name = (id: string) => db.staff.find((s) => s.id === id)?.name ?? "—";

  if (form) {
    return (
      <DayOffForm
        staff={form}
        onCancel={() => setForm(null)}
        onSave={(from, to, note) => {
          setDaysOff(form.id, from, to, note, manager.id);
          setForm(null);
        }}
      />
    );
  }

  return (
    <div className="kadm-body">
      <p className="muted small">Если сотрудник заболел или не может прийти, поставьте выходной за него. Можно сразу на несколько дней.</p>
      <ul className="kadm-list">
        {team.map((s) => {
          const a = db.attendance.find((x) => x.staffId === s.id && x.date === t);
          return (
            <li key={s.id} className="kadm-row">
              <span className="kadm-name">{s.name}</span>
              <span className="kadm-state">
                {a?.dayOff ? `сегодня выходной${a.note ? ` · ${a.note.toLowerCase()}` : ""}` : a?.in ? `на работе с ${a.in}` : "сегодня не отмечалась"}
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => setForm(s)}>
                Поставить выходной
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="section-label">Выходные сегодня и дальше</h3>
      {upcoming.length ? (
        <ul className="kadm-list">
          {upcoming.map((a) => (
            <li key={a.id} className="kadm-row">
              <span className="kadm-name">{name(a.staffId)}</span>
              <span className="kadm-state">
                {a.date === t ? "сегодня" : `${fmtShort(a.date)}, ${weekday(a.date)}`}
                {a.note ? ` · ${a.note.toLowerCase()}` : ""}
                {a.setBy ? ` · поставила ${name(a.setBy)}` : " · отметилась сама"}
              </span>
              <button type="button" className="btn btn-ghost btn-danger" onClick={() => cancelDayOff(a.staffId, a.date)}>
                Отменить
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Выходных нет.</p>
      )}
    </div>
  );
}

function DayOffForm({ staff, onCancel, onSave }: { staff: Staff; onCancel: () => void; onSave: (from: string, to: string, note: string) => void }) {
  const t = today();
  const [from, setFrom] = useState(t);
  const [to, setTo] = useState(t);
  const [note, setNote] = useState("Болеет");
  const bad = to < from;
  const days = bad ? 0 : Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;
  return (
    <form
      className="kadm-body kiosk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!bad) onSave(from, to, note.trim());
      }}
    >
      <p className="kadm-title">Выходной — {staff.name}</p>
      <div className="kadm-quick">
        <button type="button" className="btn btn-ghost" onClick={() => (setFrom(t), setTo(t))}>
          Сегодня
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => (setFrom(addDays(t, 1)), setTo(addDays(t, 1)))}>
          Завтра
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => (setFrom(t), setTo(addDays(t, 2)))}>
          3 дня
        </button>
      </div>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">С</span>
          <input type="date" value={from} min={t} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">По</span>
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Причина</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} list="off-reasons" placeholder="Можно не указывать" />
        <datalist id="off-reasons">
          {REASONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </label>
      {bad && (
        <p className="field-error" role="alert">
          Дата «по» раньше даты «с»
        </p>
      )}
      <div className="kiosk-actions">
        <button type="button" className="btn btn-ghost kiosk-big" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn kiosk-big" disabled={bad}>
          {days > 1 ? `Поставить выходной · ${days} дн.` : `Поставить выходной · ${fmtDay(from)}`}
        </button>
      </div>
    </form>
  );
}

/* ---------- Сотрудники: добавить и удалить ---------- */

function StaffList() {
  const { db, saveStaff, removeStaff } = useStore();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Staff | null>(null);
  const [msg, setMsg] = useState("");
  const team = db.staff.filter((s) => s.active && s.role !== "owner");
  const employees = team.filter((s) => s.role === "employee").length;

  if (adding)
    return (
      <AddStaff
        onCancel={() => setAdding(false)}
        onSave={(name, login, password) => {
          saveStaff({ name, login, password, role: "employee", active: true });
          setAdding(false);
          setMsg(`Добавлена ${name}. Логин: ${login}`);
        }}
      />
    );

  if (removing)
    return (
      <RemoveStaff
        staff={removing}
        onCancel={() => setRemoving(null)}
        onConfirm={(moveTo) => {
          removeStaff(removing.id, moveTo || undefined);
          setMsg(`${removing.name} удалена из табеля и CRM`);
          setRemoving(null);
        }}
      />
    );

  return (
    <div className="kadm-body">
      {msg && (
        <p className="callout callout-info" role="status">
          <Icon name="check" size={18} /> {msg}
        </p>
      )}
      <ul className="kadm-list">
        {team.map((s) => (
          <li key={s.id} className="kadm-row">
            <span className="kadm-name">{s.name}</span>
            <span className="kadm-state">
              {ROLE_LABEL[s.role]} · логин {s.login}
            </span>
            {s.role === "employee" ? (
              <button type="button" className="btn btn-ghost btn-danger" onClick={() => (setMsg(""), setRemoving(s))}>
                Удалить
              </button>
            ) : (
              <span className="muted small kadm-note">удаляет владелец</span>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-block kiosk-big" disabled={employees >= MAX_EMPLOYEES} onClick={() => (setMsg(""), setAdding(true))}>
        <Icon name="plus" size={20} /> Новый сотрудник
      </button>
      <p className="muted small">
        Консультантов: {employees} из {MAX_EMPLOYEES}. Новый сотрудник сразу появляется в табеле и может войти в CRM со своим логином и паролем.
      </p>
    </div>
  );
}

function AddStaff({ onCancel, onSave }: { onCancel: () => void; onSave: (name: string, login: string, password: string) => void }) {
  const { db } = useStore();
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const taken = !!login.trim() && db.staff.some((s) => s.login.toLowerCase() === login.trim().toLowerCase());
  const errs = {
    name: !name.trim() ? "Укажите имя" : "",
    login: !login.trim() ? "Придумайте логин" : taken ? "Такой логин уже занят" : "",
    password: password.length < 4 ? "Пароль не короче 4 символов" : "",
  };
  const ok = !errs.name && !errs.login && !errs.password;
  return (
    <form
      className="kadm-body kiosk-form"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (ok) onSave(name.trim(), login.trim(), password);
      }}
    >
      <p className="kadm-title">Новый сотрудник</p>
      <label className="field">
        <span className="field-label">Имя и фамилия</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {tried && errs.name && <span className="field-error">{errs.name}</span>}
      </label>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Логин</span>
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoCapitalize="none" autoComplete="off" />
          {(tried || taken) && errs.login && <span className="field-error">{errs.login}</span>}
        </label>
        <label className="field">
          <span className="field-label">Пароль</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          {tried && errs.password && <span className="field-error">{errs.password}</span>}
        </label>
      </div>
      <p className="muted small">Сотрудник отмечается в табеле этим паролем. Роль — консультант.</p>
      <div className="kiosk-actions">
        <button type="button" className="btn btn-ghost kiosk-big" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn kiosk-big">
          Добавить
        </button>
      </div>
    </form>
  );
}

function RemoveStaff({ staff, onCancel, onConfirm }: { staff: Staff; onCancel: () => void; onConfirm: (moveTo: string) => void }) {
  const { db } = useStore();
  const brides = db.brides.filter((b) => b.consultantId === staff.id).length;
  const others = db.staff.filter((s) => s.active && s.role === "employee" && s.id !== staff.id);
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? "");
  return (
    <div className="kadm-body">
      <p className="kadm-title">Удалить {staff.name}?</p>
      <p>
        Сотрудник исчезнет из табеля и больше не сможет войти в CRM. Прошлые отметки, записи и отчёты с его именем сохранятся.
      </p>
      {brides > 0 && others.length > 0 && (
        <label className="field">
          <span className="field-label">За ним закреплено невест: {brides}. Кому их передать?</span>
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="kiosk-actions">
        <button type="button" className="btn btn-ghost kiosk-big" onClick={onCancel}>
          Отмена
        </button>
        <button type="button" className="btn btn-red kiosk-big" onClick={() => onConfirm(brides > 0 ? moveTo : "")}>
          Удалить
        </button>
      </div>
    </div>
  );
}
