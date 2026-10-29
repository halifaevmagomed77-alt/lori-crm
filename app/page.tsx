"use client";

import { useState } from "react";
import { EmptyDbHint } from "@/components/Demo";
import { Chip, Icon } from "@/components/ui";
import { addDays, fmtDay, parseDate, today, weekday } from "@/lib/dates";
import { daySummary, funnel, idx, pct, rub, shortName } from "@/lib/derive";
import { useStore } from "@/lib/store";
import type { Booking, Payment, Visit } from "@/lib/types";

export default function JournalPage() {
  const store = useStore();
  const { db, can, user, open, openDialog, confirmPayment, toast } = store;
  const [date, setDate] = useState(today());
  const I = idx(db);
  const s = daySummary(db, date);
  const isToday = date === today();
  const consName = (id: string) => I.staff.get(id)?.name ?? "—";

  /** Итог строки: сколько у каждого консультанта и всего — полными именами */
  const tally = <T extends { consultantId: string }>(list: T[]) => {
    if (!list.length) return <span className="tally-empty">—</span>;
    const counts = new Map<string, number>();
    list.forEach((x) => counts.set(x.consultantId, (counts.get(x.consultantId) ?? 0) + 1));
    return (
      <span className="tally">
        <span className="tally-total">{list.length}</span>
        {[...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => (
            <span key={id} className="who">
              {consName(id)}
              {n > 1 && <span className="who-n">{n}</span>}
            </span>
          ))}
      </span>
    );
  };

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

  const sumOf = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
  const deposits = s.payments.filter((p) => p.kind === "deposit");
  const extraPays = s.payments.filter((p) => p.kind === "extra");
  const withExtra = s.issued.filter((k) => k.extra > 0);
  const money = {
    deposit: sumOf(deposits.map((p) => p.amount)),
    rent: sumOf(s.issued.map((k) => k.rentPrice)),
    extra: sumOf(withExtra.map((k) => k.extra)) + sumOf(extraPays.map((p) => p.amount)),
    fines: sumOf(s.fines.map((p) => p.amount)),
  };
  const isOwner = can("reports");

  /** Оплата строкой: сумма, договор, способ и подпись владельца */
  const payList = (list: Payment[]) => (
    <ul className="entries">
      {list.map((p) => {
        const k = I.booking.get(p.bookingId);
        const b = k ? I.bride.get(k.brideId) : undefined;
        return (
          <li key={p.id} className="entry-li">
            <button type="button" className="entry-row" onClick={() => open({ kind: "booking", id: p.bookingId })}>
              <span className="entry-time">{rub(p.amount)}</span>
              <span className="entry-name">{p.reason ?? (k ? `№ ${k.depositNo}` : "")}</span>
              <span className="entry-cons">{b ? shortName(b.name) : ""}</span>
              <span className="entry-cons">{p.method === "cash" ? "наличные" : p.bank ?? "перевод"}</span>
            </button>
            {p.confirmedAt ? (
              <Chip tone="good">получено</Chip>
            ) : (
              <button
                type="button"
                className="btn btn-small btn-red"
                onClick={() => {
                  confirmPayment(p.id);
                  toast("Получение подтверждено");
                }}
              >
                Подтвердить
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
  const sumList = (list: Booking[], pick: (k: Booking) => number, note?: (k: Booking) => string) => (
    <ul className="entries">
      {list.map((k) => (
        <li key={k.id}>
          <button type="button" className="entry-row" onClick={() => open({ kind: "booking", id: k.id })}>
            <span className="entry-time">{rub(pick(k))}</span>
            <span className="entry-name">{I.item.get(k.itemId)?.model}</span>
            <span className="entry-cons">{shortName(I.bride.get(k.brideId)?.name ?? "")}</span>
            {note && <span className="entry-cons">{note(k)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
  const moneyValue = (sum: number, n: number) =>
    n ? (
      <span className="money-val">
        <strong>{rub(sum)}</strong>
        <span className="muted small">· {n}</span>
      </span>
    ) : (
      <span className="tally-empty">—</span>
    );

  const wd = weekday(date);
  return (
    <div className="page page-journal">
      <div className="date-bar">
        <button type="button" className="icon-btn" aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>
          <Icon name="chevronL" />
        </button>
        <label className="date-pick">
          <span className="date-big">{fmtDay(date)}</span>
          <span className="date-wd">
            {wd}
            {isToday && " · сегодня"}
          </span>
          <input type="date" value={date} max={addDays(today(), 60)} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Выбрать дату" />
        </label>
        <button type="button" className="icon-btn" aria-label="Следующий день" onClick={() => setDate(addDays(date, 1))}>
          <Icon name="chevronR" />
        </button>
        {!isToday && (
          <button type="button" className="btn btn-small btn-ghost date-today" onClick={() => setDate(today())}>
            Сегодня
          </button>
        )}
      </div>

      <EmptyDbHint />
      <article className="paper sheet-day">
        <div className="ledger">
          <Row label="Зашли" summary={tally(s.visits)} count={s.visits.length}>
            {visitList(s.visits)}
            {isToday && (
              <button type="button" className="link-btn" onClick={() => openDialog({ kind: "visit", date })}>
                <Icon name="plus" size={16} /> Новая запись
              </button>
            )}
          </Row>
          <Row label="Примерка" summary={tally(s.tried)} count={s.tried.length}>
            {visitList(s.tried)}
          </Row>
          <Row label="Возвратные" summary={tally(s.returning)} count={s.returning.length}>
            {visitList(s.returning)}
          </Row>
          <Row label="Запись" title="Договор на залог" summary={tally(s.records)} count={s.records.length}>
            {bookingList(s.records)}
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
          {!isOwner && (
            <Row
              label="Штрафы"
              title="Штрафы невест"
              summary={
                s.fines.length ? (
                  <span className="tally">
                    {s.fines.map((f) => (
                      <button key={f.id} type="button" className="model-link fine" onClick={() => open({ kind: "booking", id: f.bookingId })}>
                        {f.reason?.toLowerCase() ?? "штраф"}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="tally-empty">—</span>
                )
              }
              count={s.fines.length}
            />
          )}
        </div>

        {isOwner && (
          <section className="ledger ledger-money" aria-label="Деньги за день">
            <p className="money-head">Деньги за день · видите только вы</p>
            <Row label="Залог" title="Залоги по договорам на залог" summary={moneyValue(money.deposit, deposits.length)} count={deposits.length}>
              {payList(deposits)}
            </Row>
            <Row label="Аренда" title="Полная сумма аренды выданных платьев" summary={moneyValue(money.rent, s.issued.length)} count={s.issued.length}>
              {sumList(s.issued, (k) => k.rentPrice, (k) => `залог был ${rub(k.deposit)}`)}
            </Row>
            <Row label="Доп" title="Фотосессия, серьги, фата и другое" summary={moneyValue(money.extra, withExtra.length + extraPays.length)} count={withExtra.length + extraPays.length}>
              {sumList(withExtra, (k) => k.extra, (k) => k.accessories.map((a) => a.name.toLowerCase()).join(", "))}
              {extraPays.length > 0 && payList(extraPays)}
            </Row>
            <Row label="Штрафы" title="Только штрафы невест" summary={moneyValue(money.fines, s.fines.length)} count={s.fines.length}>
              {payList(s.fines)}
            </Row>
          </section>
        )}

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
