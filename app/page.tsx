"use client";

import Link from "next/link";
import { PageHead } from "@/components/Shell";
import { FittingRow, OrderRow } from "@/components/rows";
import { Empty, Icon } from "@/components/ui";
import { addDays, fmtDay, plural, startOfMonth, today, weekday } from "@/lib/dates";
import { totals } from "@/lib/derive";
import { useStore } from "@/lib/store";

export default function TodayPage() {
  const { db, openDialog, role } = useStore();
  const t = today();
  const soon = addDays(t, 3);

  const todays = db.fittings.filter((f) => f.date === t && f.status !== "cancelled");
  const waiting = todays.filter((f) => f.status === "planned").length;
  const overdueFittings = db.fittings.filter((f) => f.status === "planned" && f.date < t);

  const toIssue = db.orders
    .filter((o) => o.status === "booked" && o.issueDate <= soon)
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate));
  const toReturn = db.orders
    .filter((o) => o.type === "rent" && o.status === "issued" && (o.returnDate ?? t) <= soon)
    .sort((a, b) => (a.returnDate ?? "").localeCompare(b.returnDate ?? ""));

  const month = totals(db, { from: startOfMonth(t), to: t });
  const tomorrow = db.fittings.filter((f) => f.date === addDays(t, 1) && f.status === "planned").length;

  return (
    <div className="page">
      <PageHead
        title={`Сегодня, ${fmtDay(t)}`}
        sub={
          <>
            {weekday(t)[0].toUpperCase() + weekday(t).slice(1)}.{" "}
            {todays.length
              ? `${todays.length} ${plural(todays.length, "примерка", "примерки", "примерок")}${waiting ? `, ждём ещё ${waiting}` : ", все уже отмечены"}.`
              : "Примерок нет."}
            {tomorrow > 0 && ` Завтра — ${tomorrow}.`}
          </>
        }
      />

      <section className="kpis" aria-label="С начала месяца">
        <Link href={role === "owner" ? "/reports" : "/calendar"} className="kpi">
          <span className="kpi-label">Примерок с 1-го числа</span>
          <span className="kpi-value">{month.fittings}</span>
        </Link>
        <Link href={role === "owner" ? "/reports" : "/dresses"} className="kpi">
          <span className="kpi-label">Продано</span>
          <span className="kpi-value">{month.sales}</span>
        </Link>
        <Link href={role === "owner" ? "/reports" : "/dresses"} className="kpi">
          <span className="kpi-label">Сдано в аренду</span>
          <span className="kpi-value">{month.rents}</span>
        </Link>
      </section>

      <div className="today-grid">
        <section className="panel panel-main" aria-labelledby="t-fit">
          <div className="panel-head">
            <h2 id="t-fit" className="panel-title">Примерки сегодня</h2>
            <button type="button" className="link-btn" onClick={() => openDialog({ kind: "fitting", date: t })}>
              <Icon name="plus" size={16} /> Записать
            </button>
          </div>
          {todays.length ? (
            <div className="rows">
              {todays.map((f) => (
                <FittingRow key={f.id} f={f} showDate={false} />
              ))}
            </div>
          ) : (
            <Empty title="На сегодня записей нет" text="Свободный день — хорошее время, чтобы напомнить о себе тем, кто приходил и ничего не выбрал." />
          )}
          {overdueFittings.length > 0 && (
            <div className="subpanel">
              <h3 className="section-label">Не отмечены с прошлых дней</h3>
              <div className="rows">
                {overdueFittings.map((f) => (
                  <FittingRow key={f.id} f={f} />
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="today-side">
          <section className="panel" aria-labelledby="t-issue">
            <div className="panel-head">
              <h2 id="t-issue" className="panel-title">Выдать платье</h2>
              <span className="panel-hint">на 3 дня вперёд</span>
            </div>
            {toIssue.length ? (
              <div className="rows">
                {toIssue.map((o) => (
                  <OrderRow key={o.id} o={o} />
                ))}
              </div>
            ) : (
              <Empty title="Выдач в ближайшие дни нет" />
            )}
          </section>

          <section className="panel" aria-labelledby="t-return">
            <div className="panel-head">
              <h2 id="t-return" className="panel-title">Вернуть из аренды</h2>
              <span className="panel-hint">на 3 дня вперёд</span>
            </div>
            {toReturn.length ? (
              <div className="rows">
                {toReturn.map((o) => (
                  <OrderRow key={o.id} o={o} />
                ))}
              </div>
            ) : (
              <Empty title="Возвратов в ближайшие дни нет" />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
