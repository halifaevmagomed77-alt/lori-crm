"use client";

import { PageHead } from "@/components/Shell";
import { Chip, Icon } from "@/components/ui";
import { addDays, today } from "@/lib/dates";
import { funnel, pct } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { MAX_EMPLOYEES, ROLE_LABEL } from "@/lib/types";

export default function StaffPage() {
  const { db, openDialog, user } = useStore();
  const employees = db.staff.filter((s) => s.role === "employee" && s.active).length;
  const month = { from: addDays(today(), -29), to: today() };
  const order = { owner: 0, admin: 1, employee: 2 } as const;

  return (
    <div className="page">
      <PageHead
        title="Сотрудники"
        sub={`Консультантов: ${employees} из ${MAX_EMPLOYEES}`}
        actions={
          <button type="button" className="btn" onClick={() => openDialog({ kind: "staff" })} disabled={employees >= MAX_EMPLOYEES}>
            <Icon name="plus" size={18} /> Новый сотрудник
          </button>
        }
      />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Имя</th>
              <th scope="col">Роль</th>
              <th scope="col" className="num">Смен за 30 дней</th>
              <th scope="col" className="num">Встретила / записала</th>
              <th scope="col">Доступ</th>
            </tr>
          </thead>
          <tbody>
            {db.staff
              .slice()
              .sort((a, b) => order[a.role] - order[b.role] || Number(b.active) - Number(a.active))
              .map((s) => {
                const shifts = db.attendance.filter((a) => a.staffId === s.id && a.in && a.date >= month.from).length;
                const f = s.role === "employee" ? funnel(db, month, s.id) : null;
                const editable = s.role !== "owner" && (user?.role === "owner" || s.role === "employee");
                return (
                  <tr key={s.id} className={editable ? "tr-click" : undefined} onClick={() => editable && openDialog({ kind: "staff", staff: s })}>
                    <td>
                      <span className="person-name">{s.name}</span>
                    </td>
                    <td data-label="Роль">{ROLE_LABEL[s.role]}</td>
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
      <p className="muted small page-note">
        Приход и уход сотрудники отмечают в журнале дня. Администратор может исправить отметки и записи любого консультанта.
      </p>
    </div>
  );
}
