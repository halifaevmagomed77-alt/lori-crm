"use client";

import { useState } from "react";
import { OwnerTabs, PageHead } from "@/components/Shell";
import { Chip, Icon } from "@/components/ui";
import { addDays, today } from "@/lib/dates";
import { funnel, pct } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { MAX_EMPLOYEES, ROLE_LABEL } from "@/lib/types";

export default function StaffPage() {
  const { db, openDialog, user, can, clearAll, fillDemo, toast } = useStore();
  const [showClosed, setShowClosed] = useState(false);
  const [confirm, setConfirm] = useState("");
  const employees = db.staff.filter((s) => s.role === "employee" && s.active).length;
  const closed = db.staff.filter((s) => !s.active).length;
  const month = { from: addDays(today(), -29), to: today() };
  const order = { owner: 0, admin: 1, employee: 2 } as const;
  const isOwner = user?.role === "owner";

  return (
    <div className="page">
      <OwnerTabs />
      <PageHead
        title="Сотрудники"
        sub={`Консультантов: ${employees} из ${MAX_EMPLOYEES}`}
        actions={
          <button type="button" className="btn" onClick={() => openDialog({ kind: "staff" })} disabled={employees >= MAX_EMPLOYEES}>
            <Icon name="plus" size={18} /> Новый сотрудник
          </button>
        }
      />
      <p className="muted small page-intro">
        Нажмите на сотрудника, чтобы сменить имя, логин или пароль, а также удалить его.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Имя</th>
              <th scope="col">Роль</th>
              <th scope="col">Логин</th>
              <th scope="col" className="num">Смен за 30 дней</th>
              <th scope="col" className="num">Встретила / записала</th>
              <th scope="col">Доступ</th>
            </tr>
          </thead>
          <tbody>
            {db.staff
              .filter((s) => s.active || showClosed)
              .slice()
              .sort((a, b) => order[a.role] - order[b.role] || Number(b.active) - Number(a.active))
              .map((s) => {
                const shifts = db.attendance.filter((a) => a.staffId === s.id && a.in && a.date >= month.from).length;
                const f = s.role === "employee" ? funnel(db, month, s.id) : null;
                const editable = isOwner;
                return (
                  <tr key={s.id} className={editable ? "tr-click" : undefined} onClick={() => editable && openDialog({ kind: "staff", staff: s })}>
                    <td>
                      <span className="person-name">{s.name}</span>
                      {s.id === user?.id && <span className="muted small"> · это вы</span>}
                    </td>
                    <td data-label="Роль">{ROLE_LABEL[s.role]}</td>
                    <td data-label="Логин" className="tabular">
                      {editable ? s.login : "—"}
                    </td>
                    <td data-label="Смен" className="num">
                      {s.role === "owner" ? "—" : shifts}
                    </td>
                    <td data-label="Встретила / записала" className="num">
                      {f ? `${f.visits}/${f.records} · ${pct(f.records, f.visits)}` : "—"}
                    </td>
                    <td data-label="Доступ">{s.active ? <Chip tone="good">Работает</Chip> : <Chip>Доступ закрыт</Chip>}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {closed > 0 && (
        <label className="check small page-note">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          <span>Показать удалённых сотрудников ({closed}) — их имена остаются в истории записей</span>
        </label>
      )}

      {can("reports") && (
        <section className="panel danger-panel">
          <h2 className="panel-title">Данные</h2>
          <p className="small">
            Для демонстрации можно заполнить CRM примером за год работы салона: невесты, договоры, оплаты, платья с фото, поставщики. Текущие данные при этом заменятся.
          </p>
          <div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const err = fillDemo();
                toast(err ?? "Готово: в базе пример за год работы салона");
              }}
            >
              Заполнить примером
            </button>
          </div>
          <h3 className="section-label">Очистить все данные</h3>
          <p className="small">
            Удалит всех невест, визиты, договоры, оплаты, платья, фото, поставщиков, химчистку и табель. Учётные записи сотрудников останутся. Отменить нельзя.
          </p>
          <div className="inline-row">
            <input className="date-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Напишите: очистить" aria-label="Подтверждение очистки" />
            <button
              type="button"
              className="btn btn-red"
              disabled={confirm.trim().toLowerCase() !== "очистить"}
              onClick={() => {
                clearAll();
                setConfirm("");
                toast("Все данные удалены, CRM как новая");
              }}
            >
              Очистить
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
