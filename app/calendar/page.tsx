"use client";

import { useState } from "react";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/ui";
import { addDays, fmtDay, fmtShort, parseDate, startOfWeek, today, weekdayShort } from "@/lib/dates";
import { useStore } from "@/lib/store";

const STATUS_LABEL = { planned: "Записана", done: "Пришла", noshow: "Не пришла", cancelled: "Отменена" } as const;

export default function CalendarPage() {
  const { db, openDialog, openClient, openDress } = useStore();
  const t = today();
  const [week, setWeek] = useState(startOfWeek(t));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const end = days[6];
  const sameMonth = parseDate(week).getMonth() === parseDate(end).getMonth();
  const range = sameMonth ? `${parseDate(week).getDate()}–${fmtDay(end)}` : `${fmtShort(week)} — ${fmtShort(end)}`;
  const count = db.fittings.filter((f) => f.date >= week && f.date <= end && f.status !== "cancelled").length;

  return (
    <div className="page">
      <PageHead
        title="Календарь"
        sub={`Неделя ${range}: ${count} примерок`}
        actions={
          <div className="week-nav">
            <button type="button" className="icon-btn" aria-label="Предыдущая неделя" onClick={() => setWeek(addDays(week, -7))}>
              <Icon name="chevronL" />
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setWeek(startOfWeek(t))} disabled={week === startOfWeek(t)}>
              Эта неделя
            </button>
            <button type="button" className="icon-btn" aria-label="Следующая неделя" onClick={() => setWeek(addDays(week, 7))}>
              <Icon name="chevronR" />
            </button>
          </div>
        }
      />

      <div className="week">
        {days.map((d) => {
          const fits = db.fittings.filter((f) => f.date === d && f.status !== "cancelled");
          const issues = db.orders.filter((o) => o.status !== "cancelled" && o.issueDate === d);
          const returns = db.orders.filter((o) => o.type === "rent" && o.status !== "cancelled" && o.returnDate === d);
          const isToday = d === t;
          return (
            <section key={d} className={`day${isToday ? " is-today" : ""}${d < t ? " is-past" : ""}`} aria-label={fmtDay(d)}>
              <header className="day-head">
                <span className="day-wd">{weekdayShort(d)}</span>
                <span className="day-num">{parseDate(d).getDate()}</span>
                {isToday && <span className="day-today">сегодня</span>}
                <button type="button" className="icon-btn icon-btn-sm day-add" aria-label={`Записать на ${fmtDay(d)}`} onClick={() => openDialog({ kind: "fitting", date: d })}>
                  <Icon name="plus" size={16} />
                </button>
              </header>
              <div className="day-body">
                {fits.map((f) => {
                  const c = db.clients.find((x) => x.id === f.clientId);
                  return (
                    <button key={f.id} type="button" className={`slot slot-${f.status}`} onClick={() => c && openClient(c.id)}>
                      <span className="slot-time">{f.time}</span>
                      <span className="slot-name">{c?.name}</span>
                      <span className="slot-status">{STATUS_LABEL[f.status]}</span>
                    </button>
                  );
                })}
                {issues.map((o) => (
                  <button key={o.id} type="button" className="event" onClick={() => openDress(o.dressId)}>
                    <Icon name="bag" size={14} /> Выдача: {db.dresses.find((x) => x.id === o.dressId)?.name}
                  </button>
                ))}
                {returns.map((o) => (
                  <button key={o.id} type="button" className="event" onClick={() => openDress(o.dressId)}>
                    <Icon name="swap" size={14} /> Возврат: {db.dresses.find((x) => x.id === o.dressId)?.name}
                  </button>
                ))}
                {fits.length + issues.length + returns.length === 0 && <p className="day-empty">Свободно</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
