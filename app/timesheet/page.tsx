"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/ui";
import { addDays, fmtDay, today, weekday } from "@/lib/dates";
import { fmtMinutes, workMinutes } from "@/lib/derive";
import { useStore } from "@/lib/store";
import type { Attendance } from "@/lib/types";

/** Табель в CRM: владелец и администратор смотрят и поправляют отметки, сделанные на планшете */
export default function TimesheetPage() {
  const { db, setAttendance } = useStore();
  const [date, setDate] = useState(today());
  const team = db.staff.filter((s) => s.role !== "owner" && s.active);
  const day = db.attendance.filter((a) => a.date === date);
  const onShift = day.filter((a) => a.in && !a.dayOff).length;
  const from = addDays(today(), -29);

  return (
    <div className="page">
      <PageHead title="Табель" sub={`На смене ${onShift} из ${team.length}`} />

      <section className="callout callout-info kiosk-link">
        <Icon name="clock" size={18} />
        <span>
          Сотрудники отмечаются сами на планшете в салоне. Утром администратор открывает на нём табель по адресу <strong>/tabel</strong> под своей учётной записью.
        </span>
        <Link href="/tabel" className="btn btn-small">
          Открыть табель для планшета
        </Link>
      </section>

      <div className="date-bar date-bar-inline">
        <button type="button" className="icon-btn" aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>
          <Icon name="chevronL" />
        </button>
        <label className="date-pick">
          <span className="date-big">{fmtDay(date)}</span>
          <span className="date-wd">
            {weekday(date)}
            {date === today() && " · сегодня"}
          </span>
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Выбрать дату" />
        </label>
        <button type="button" className="icon-btn" aria-label="Следующий день" disabled={date >= today()} onClick={() => setDate(addDays(date, 1))}>
          <Icon name="chevronR" />
        </button>
      </div>

      <div className="paper timesheet">
        <table className="attendance">
          <thead>
            <tr>
              <th scope="col">Сотрудник</th>
              <th scope="col">Пришла</th>
              <th scope="col">Ушла</th>
              <th scope="col">Часов</th>
            </tr>
          </thead>
          <tbody>
            {team.map((st) => {
              const a = day.find((x) => x.staffId === st.id);
              const set = (patch: Partial<Attendance>) => setAttendance({ staffId: st.id, date, in: a?.in, out: a?.out, dayOff: a?.dayOff, ...patch });
              return (
                <tr key={st.id} className={a?.dayOff ? "is-off" : undefined}>
                  <th scope="row">{st.name}</th>
                  {a?.dayOff ? (
                    <td colSpan={3} className="off">
                      выходной
                      {a.note ? ` · ${a.note.toLowerCase()}` : ""}
                      {a.setBy ? ` · поставила ${db.staff.find((x) => x.id === a.setBy)?.name ?? "администратор"}` : ""}{" "}
                      <button type="button" className="link-btn small" onClick={() => set({ dayOff: false })}>
                        отменить
                      </button>
                    </td>
                  ) : (
                    <>
                      <td>
                        <input type="time" className="time-cell" value={a?.in ?? ""} onChange={(e) => set({ in: e.target.value, dayOff: false })} aria-label={`${st.name}: пришла`} />
                      </td>
                      <td>
                        <input type="time" className="time-cell" value={a?.out ?? ""} onChange={(e) => set({ out: e.target.value })} aria-label={`${st.name}: ушла`} />
                      </td>
                      <td className="tabular small">
                        {fmtMinutes(workMinutes(a)) ||
                          (!a?.in && (
                            <button type="button" className="link-btn small" onClick={() => set({ dayOff: true, in: undefined, out: undefined })}>
                              выходной
                            </button>
                          ))}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">Время можно поправить вручную, если сотрудник забыл отметиться.</p>
      </div>

      <section className="panel">
        <h2 className="section-label">За 30 дней</h2>
        <div className="table-wrap">
          <table className="table table-compact">
            <thead>
              <tr>
                <th scope="col">Сотрудник</th>
                <th scope="col" className="num">Смен</th>
                <th scope="col" className="num">Выходных</th>
                <th scope="col" className="num">Часов</th>
              </tr>
            </thead>
            <tbody>
              {team.map((st) => {
                const list = db.attendance.filter((a) => a.staffId === st.id && a.date >= from && a.date <= today());
                const shifts = list.filter((a) => a.in && !a.dayOff).length;
                const off = list.filter((a) => a.dayOff).length;
                const min = list.reduce((s, a) => s + workMinutes(a), 0);
                return (
                  <tr key={st.id}>
                    <td>{st.name}</td>
                    <td className="num">{shifts}</td>
                    <td className="num">{off}</td>
                    <td className="num">{Math.round(min / 60)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
