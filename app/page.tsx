"use client";

import { useState } from "react";
import { PageHead } from "@/components/Shell";
import { Chip, Icon } from "@/components/ui";
import { addDays, fmtDay, parseDate, today, weekday } from "@/lib/dates";
import { daySummary, funnel, idx, initials, pct, rub, shortName } from "@/lib/derive";
import { useStore } from "@/lib/store";
import type { Booking, Visit } from "@/lib/types";

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function JournalPage() {
  const store = useStore();
  const { db, can, user, open, openDialog } = store;
  const [date, setDate] = useState(today());
  const I = idx(db);
  const s = daySummary(db, date);
  const isToday = date === today();
  const consName = (id: string) => I.staff.get(id)?.name ?? "—";

  const tally = <T extends { consultantId: string }>(list: T[]) =>
    list.length ? (
      <span className="tally">
        {list.map((x, i) => (
          <span key={i} className="tally-mark">
            {initials(consName(x.consultantId))}
          </span>
        ))}
        <span className="tally-total">= {list.length}</span>
      </span>
    ) : (
      <span className="tally-empty">—</span>
    );

  const visitList = (list: Visit[]) => (
    <ul className="entries">
      {list.map((v) => {
        const b = I.bride.get(v.brideId);
        return (
          <li key={v.id}>
            <button type="button" className="entry-row" onClick={() => b && open({ kind: "bride", id: b.id })}>
              <span className="entry-time">{v.time}</span>
              <span className="entry-name">{b ? shortName(b.name) : "—"}</span>
              <span className="entry-cons">{consName(v.consultantId)}</span>
              {v.returning && <Chip tone="info">возвратная</Chip>}
              {v.tried && <Chip>примерка</Chip>}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const bookingList = (list: Booking[], action?: (b: Booking) => React.ReactNode) => (
    <ul className="entries">
      {list.map((k) => {
        const b = I.bride.get(k.brideId);
        return (
          <li key={k.id} className="entry-li">
            <button type="button" className="entry-row" onClick={() => open({ kind: "booking", id: k.id })}>
              <span className="entry-time">№ {k.depositNo}</span>
              <span className="entry-name">{I.item.get(k.itemId)?.model}</span>
              <span className="entry-cons">{b ? shortName(b.name) : ""}</span>
              <span className="entry-cons">{consName(k.consultantId)}</span>
            </button>
            {action?.(k)}
          </li>
        );
      })}
    </ul>
  );

  const models = (list: Booking[]) =>
    list.length ? (
      <span className="tally">
        {list.map((k) => (
          <button key={k.id} type="button" className="model-link" onClick={() => open({ kind: "booking", id: k.id })}>
            {I.item.get(k.itemId)?.model}
          </button>
        ))}
      </span>
    ) : (
      <span className="tally-empty">—</span>
    );

  const consultants = db.staff.filter((x) => x.role === "employee" && x.active);
  const dayStats = consultants
    .map((c) => ({ c, ...funnel(db, { from: date, to: date }, c.id) }))
    .filter((r) => (r.visits || r.records) && (can("editAll") || r.c.id === user?.id));
  const total = funnel(db, { from: date, to: date });

  const fineSum = s.fines.reduce((a, p) => a + p.amount, 0);
  const rentSum = s.payments.filter((p) => p.kind !== "fine").reduce((a, p) => a + p.amount, 0);
  const unconfirmed = s.payments.filter((p) => !p.confirmedAt);

  const wd = weekday(date);
  return (
    <div className="page">
      <PageHead
        title="Журнал"
        actions={
          <div className="day-nav">
            <button type="button" className="icon-btn" aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>
              <Icon name="chevronL" />
            </button>
            <input type="date" className="date-input" value={date} max={addDays(today(), 60)} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Дата" />
            <button type="button" className="icon-btn" aria-label="Следующий день" onClick={() => setDate(addDays(date, 1))}>
              <Icon name="chevronR" />
            </button>
            {!isToday && (
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setDate(today())}>
                Сегодня
              </button>
            )}
          </div>
        }
      />

      <article className="paper sheet-day">
        <h2 className="day-title">
          {fmtDay(date)} <span className="day-wd">({wd[0].toUpperCase() + wd.slice(1)})</span>
          {isToday && <Chip tone="ink">сегодня</Chip>}
        </h2>

        <table className="attendance">
          <thead>
            <tr>
              <th scope="col">Сотрудник</th>
              <th scope="col">Пришла</th>
              <th scope="col">Ушла</th>
            </tr>
          </thead>
          <tbody>
            {db.staff
              .filter((st) => st.role !== "owner" && st.active)
              .map((st) => {
                const a = s.attendance.find((x) => x.staffId === st.id);
                const mine = st.id === user?.id && isToday;
                const editable = can("manageStaff") || mine;
                const set = (patch: { in?: string; out?: string; dayOff?: boolean }) =>
                  store.setAttendance({ staffId: st.id, date, in: a?.in, out: a?.out, dayOff: a?.dayOff, ...patch });
                return (
                  <tr key={st.id} className={a?.dayOff ? "is-off" : undefined}>
                    <th scope="row">{st.name}</th>
                    {a?.dayOff ? (
                      <td colSpan={2} className="off">
                        выходной
                        {editable && (
                          <button type="button" className="link-btn small" onClick={() => set({ dayOff: false })}>
                            отменить
                          </button>
                        )}
                      </td>
                    ) : (
                      <>
                        <td>
                          {editable ? (
                            <input type="time" className="time-cell" value={a?.in ?? ""} onChange={(e) => set({ in: e.target.value, dayOff: false })} aria-label={`${st.name}: пришла`} />
                          ) : (
                            a?.in ?? "—"
                          )}
                          {mine && !a?.in && (
                            <button type="button" className="btn btn-small" onClick={() => set({ in: nowTime(), dayOff: false })}>
                              Я пришла
                            </button>
                          )}
                        </td>
                        <td>
                          {editable ? (
                            <input type="time" className="time-cell" value={a?.out ?? ""} onChange={(e) => set({ out: e.target.value })} aria-label={`${st.name}: ушла`} />
                          ) : (
                            a?.out ?? "—"
                          )}
                          {mine && a?.in && !a.out && (
                            <button type="button" className="btn btn-small btn-ghost" onClick={() => set({ out: nowTime() })}>
                              Я ушла
                            </button>
                          )}
                          {can("manageStaff") && !a?.in && (
                            <button type="button" className="link-btn small" onClick={() => set({ dayOff: true, in: undefined, out: undefined })}>
                              выходной
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>

        <div className="ledger">
          <Row label="Зашли" summary={tally(s.visits)} count={s.visits.length}>
            {visitList(s.visits)}
            {isToday && (
              <button type="button" className="link-btn" onClick={() => openDialog({ kind: "visit", date })}>
                <Icon name="plus" size={16} /> Зашла невеста
              </button>
            )}
          </Row>
          <Row label="Примерка" summary={tally(s.tried)} count={s.tried.length}>
            {visitList(s.tried)}
          </Row>
          <Row label="Возвр-е" title="Возвратные невесты" summary={tally(s.returning)} count={s.returning.length}>
            {visitList(s.returning)}
          </Row>
          <Row label="Запись" title="Договор на залог" summary={tally(s.records)} count={s.records.length}>
            {bookingList(s.records)}
            {isToday && (
              <button type="button" className="link-btn" onClick={() => openDialog({ kind: "booking" })}>
                <Icon name="plus" size={16} /> Записать
              </button>
            )}
          </Row>
          <Row label="Отказ" summary={tally(s.refusals)} count={s.refusals.length} tone={s.refusals.length ? "bad" : undefined}>
            {bookingList(s.refusals)}
            {s.refusals.length > 0 && (
              <p className="small muted">Залоги остаются салону: {rub(s.refusals.reduce((a, b) => a + b.deposit, 0))}</p>
            )}
          </Row>
          <Row label="Выдача" summary={models(s.issued)} count={s.issued.length} pending={s.toIssue.length}>
            {s.toIssue.length > 0 && (
              <>
                <p className="ledger-sub">Ждут выдачи</p>
                {bookingList(s.toIssue, (k) =>
                  can("editAll") ? (
                    <button type="button" className="btn btn-small" onClick={() => openDialog({ kind: "issue", bookingId: k.id })}>
                      Выдать
                    </button>
                  ) : null,
                )}
              </>
            )}
            {s.issued.length > 0 && (
              <>
                <p className="ledger-sub">Выдано</p>
                {bookingList(s.issued)}
              </>
            )}
          </Row>
          <Row label="Приёмка" summary={models(s.returned)} count={s.returned.length} pending={s.toReturn.length}>
            {s.toReturn.length > 0 && (
              <>
                <p className="ledger-sub">Должны вернуть</p>
                {bookingList(s.toReturn, (k) =>
                  can("editAll") ? (
                    <button type="button" className="btn btn-small" onClick={() => openDialog({ kind: "return", bookingId: k.id })}>
                      Принять
                    </button>
                  ) : null,
                )}
              </>
            )}
            {s.returned.length > 0 && (
              <>
                <p className="ledger-sub">Принято</p>
                {bookingList(s.returned)}
              </>
            )}
          </Row>
          <Row
            label="Химчистка"
            summary={
              s.cleaning.length ? (
                <span className="tally">
                  {s.cleaning.map((c) => (
                    <button key={c.id} type="button" className="model-link" onClick={() => open({ kind: "item", id: c.itemId })}>
                      {I.item.get(c.itemId)?.model}
                    </button>
                  ))}
                </span>
              ) : (
                <span className="tally-empty">—</span>
              )
            }
            count={s.cleaning.length}
          />
          <Row
            label="Штрафы кл."
            title="Штрафы невест"
            summary={
              s.fines.length ? (
                <span className="tally">
                  {s.fines.map((f) => (
                    <button key={f.id} type="button" className="model-link fine" onClick={() => open({ kind: "booking", id: f.bookingId })}>
                      {f.reason?.toLowerCase()} {rub(f.amount)}
                    </button>
                  ))}
                  <span className="tally-total">= {rub(fineSum)}</span>
                </span>
              ) : (
                <span className="tally-empty">—</span>
              )
            }
            count={s.fines.length}
          />
          {can("reports") && (
            <Row
              label="Касса"
              title="Оплаты за день"
              summary={
                <span className="tally">
                  <span>прокат {rub(rentSum)}</span>
                  <span className="muted">· штрафы {rub(fineSum)}</span>
                  {unconfirmed.length > 0 && <Chip tone="bad">{unconfirmed.length} ждут подтверждения</Chip>}
                </span>
              }
              count={s.payments.length}
            >
              <ul className="entries">
                {s.payments.map((p) => {
                  const k = db.bookings.find((x) => x.id === p.bookingId);
                  return (
                    <li key={p.id}>
                      <button type="button" className="entry-row" onClick={() => open({ kind: "booking", id: p.bookingId })}>
                        <span className="entry-time">{rub(p.amount)}</span>
                        <span className="entry-name">
                          {p.kind === "deposit" ? "залог" : p.kind === "balance" ? "остаток" : p.kind === "extra" ? "доп" : "штраф"}
                          {k ? ` · № ${k.depositNo}` : ""}
                        </span>
                        <span className="entry-cons">{p.method === "cash" ? "наличные" : p.bank ?? "перевод"}</span>
                        {p.confirmedAt ? <Chip tone="good">получено</Chip> : <Chip tone="bad">подтвердить</Chip>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Row>
          )}
        </div>

        {dayStats.length > 0 && (
          <div className="day-cons">
            <p className="ledger-sub">Итог дня: встретила / записала</p>
            <ul className="cons-lines">
              {can("editAll") && (
                <li className="cons-total">
                  <span>Все</span>
                  <span className="tabular">
                    {total.visits}/{total.records}
                  </span>
                  <span className="tabular">{pct(total.records, total.visits)}</span>
                </li>
              )}
              {dayStats.map((r) => (
                <li key={r.c.id}>
                  <span>{r.c.name}</span>
                  <span className="tabular">
                    {r.visits}/{r.records}
                  </span>
                  <span className="tabular">{pct(r.records, r.visits)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
      {parseDate(date) > new Date() && <p className="muted small page-note">Это будущий день: здесь видны запланированные выдачи и возвраты.</p>}
    </div>
  );
}

function Row({
  label,
  title,
  summary,
  count,
  pending,
  tone,
  children,
}: {
  label: string;
  title?: string;
  summary: React.ReactNode;
  count: number;
  pending?: number;
  tone?: "bad";
  children?: React.ReactNode;
}) {
  const expandable = !!children && (count > 0 || !!pending || label === "Зашли" || label === "Запись");
  const head = (
    <>
      <span className={`ledger-label${tone ? " is-bad" : ""}`} title={title}>
        {label}
      </span>
      <span className="ledger-value">
        {summary}
        {!!pending && <Chip tone="warn">ждут: {pending}</Chip>}
      </span>
    </>
  );
  if (!expandable) return <div className="ledger-row">{head}</div>;
  return (
    <details className="ledger-row">
      <summary>{head}</summary>
      <div className="ledger-body">{children}</div>
    </details>
  );
}
