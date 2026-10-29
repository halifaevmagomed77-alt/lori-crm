"use client";

import { fmtDate, fmtShort, relDay, today } from "@/lib/dates";
import { ITEM_STATE_LABEL, STATUS_LABEL, contractNo, fmtMoney, idx, isOverdue, itemState, paid, payText, purchaseRub, rub, shortName, tr } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { type Booking, type Bride, type DressItem, type Payment } from "@/lib/types";
import { DressPhoto } from "./forms";
import { Chip, Drawer, Icon, type Tone } from "./ui";

export const STATUS_TONE: Record<Booking["status"], Tone> = { booked: "warn", issued: "info", returned: "good", refused: "bad" };
export const ITEM_TONE = { free: "good", booked: "warn", issued: "info", cleaning: "neutral" } as const;

export function SheetHost() {
  const { sheet, closeSheet, db } = useStore();
  if (!sheet) return null;
  if (sheet.kind === "booking") {
    const b = db.bookings.find((x) => x.id === sheet.id);
    return b ? (
      <Drawer key={b.id} label={`Запись № ${b.depositNo}`} onClose={closeSheet}>
        <BookingCard b={b} />
      </Drawer>
    ) : null;
  }
  if (sheet.kind === "bride") {
    const b = db.brides.find((x) => x.id === sheet.id);
    return b ? (
      <Drawer key={b.id} label={b.name} onClose={closeSheet}>
        <BrideCard b={b} />
      </Drawer>
    ) : null;
  }
  const it = db.items.find((x) => x.id === sheet.id);
  return it ? (
    <Drawer key={it.id} label={it.model} onClose={closeSheet}>
      <ItemCard it={it} />
    </Drawer>
  ) : null;
}

/* ---------- Запись в тетради ---------- */

function PayLine({ p }: { p: Payment }) {
  const { db, can, confirmPayment, toast } = useStore();
  const who = idx(db).staff.get(p.recordedBy)?.name;
  return (
    <li className={`pay-line${p.kind === "fine" ? " is-fine" : ""}`}>
      <span className="pay-what">
        {payText(p)} / {p.confirmedAt ? "подтверждён" : "ждёт подтверждения"}
      </span>
      <span className="pay-meta">
        {who && `внесла ${who}`}
        {p.confirmedAt && ` · владелец подтвердил ${fmtShort(p.confirmedAt)}`}
      </span>
      {p.confirmedAt ? (
        <span className="stamp" title={`Подтверждено владельцем ${fmtDate(p.confirmedAt)}`}>
          <Icon name="check" size={14} /> получено
        </span>
      ) : can("confirmPayments") ? (
        <button
          type="button"
          className="btn btn-small btn-red"
          onClick={() => {
            confirmPayment(p.id);
            toast("Получение оплаты подтверждено");
          }}
        >
          Подтвердить получение
        </button>
      ) : (
        <span className="stamp stamp-wait">ждёт подтверждения</span>
      )}
    </li>
  );
}

export function BookingCard({ b }: { b: Booking }) {
  const { db, can, openDialog, open } = useStore();
  const I = idx(db);
  const bride = I.bride.get(b.brideId);
  const item = I.item.get(b.itemId);
  const cons = I.staff.get(b.consultantId);
  const money = paid(db, b);
  const fines = money.payments.filter((p) => p.kind === "fine");
  // после сохранения консультант меняет только комментарий; запись правят администратор и владелец
  const canEdit = can("editAll");
  const overdue = isOverdue(b);

  return (
    <article className="paper entry">
      <header className="entry-head">
        <p className="entry-date">{fmtDate(b.createdAt)}</p>
        <Chip tone={overdue ? "bad" : STATUS_TONE[b.status]}>{overdue ? "Просрочен возврат" : STATUS_LABEL[b.status]}</Chip>
      </header>

      <dl className="entry-lines">
        <div className="line">
          <dt>Имя</dt>
          <dd>
            {bride ? (
              <button type="button" className="ink-link" onClick={() => open({ kind: "bride", id: bride.id })}>
                {bride.name}
              </button>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="line">
          <dt>Платье</dt>
          <dd>
            {item ? (
              <button type="button" className="ink-link" onClick={() => open({ kind: "item", id: item.id })}>
                {item.model}
              </button>
            ) : (
              "—"
            )}
            {item && <span className="muted"> · размер {item.size}</span>}
            {b.veil && <span className="muted"> · фата: {b.veil.toLowerCase()}</span>}
          </dd>
        </div>
        <div className="line">
          <dt>Тел</dt>
          <dd className="tabular">
            {bride?.phones.map((ph, i) => (
              <a key={ph} href={`tel:${ph.replace(/\D/g, "")}`} className="ink-link">
                {ph}
                {i < bride.phones.length - 1 ? ", " : ""}
              </a>
            ))}
          </dd>
        </div>
      </dl>

      <div className="entry-grid">
        <dl className="entry-lines">
          <div className="line">
            <dt>Залог</dt>
            <dd className="tabular">{rub(b.deposit)}</dd>
          </div>
          <div className="line">
            <dt>Аренда</dt>
            <dd className="tabular">{rub(b.rentPrice)}</dd>
          </div>
          <div className="line">
            <dt>Доп</dt>
            <dd className="tabular">
              {b.extra ? rub(b.extra) : b.extraNote ? "" : "—"}
              {b.extraNote && <span className={b.extra ? "muted" : undefined}>{b.extra ? " · " : ""}{b.extraNote}</span>}
              {b.accessories.length > 0 && <span className="muted"> · {b.accessories.map((a) => a.name.toLowerCase()).join(", ")}</span>}
            </dd>
          </div>
          <div className="line">
            <dt>Штраф</dt>
            <dd className="tabular">
              {fines.length ? fines.map((f) => `${rub(f.amount)}${f.reason ? ` (${f.reason.toLowerCase()})` : ""}`).join("; ") : b.fineNote ? "" : "—"}
              {b.fineNote && !fines.some((f) => f.reason === b.fineNote) && <span>{fines.length ? " · " : ""}{b.fineNote}</span>}
            </dd>
          </div>
        </dl>
        <dl className="entry-lines entry-side">
          <div className="line">
            <dt>№</dt>
            <dd className="tabular">
              залог {contractNo(b)}
              {b.contractRent || b.rentNo ? ` · аренда ${b.contractRent || b.rentNo}` : ""}
            </dd>
          </div>
          <div className="line">
            <dt>Консультант</dt>
            <dd>{cons?.name ?? "—"}</dd>
          </div>
          <div className="line">
            <dt>Свадьба</dt>
            <dd>
              {fmtDate(b.eventDate)}
              {b.eventDate >= today() && <span className="muted"> · {relDay(b.eventDate)}</span>}
            </dd>
          </div>
          <div className="line">
            <dt>Выдача</dt>
            <dd>
              {fmtShort(b.issueDate)} → возврат {fmtShort(b.returnDate)}
            </dd>
          </div>
        </dl>
      </div>

      {b.tasks.length > 0 && (
        <ul className="entry-tasks">
          {b.tasks.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      {b.notes && <p className="entry-note">Комментарий: {b.notes}</p>}

      {b.status === "refused" && (
        <p className="entry-refuse">
          Отказ {b.refusedAt && fmtShort(b.refusedAt)}: {b.refuseReason}. Залог {rub(b.deposit)} остаётся салону по договору.
        </p>
      )}

      <ul className="pay-lines" aria-label="Оплаты">
        {money.payments.map((p) => (
          <PayLine key={p.id} p={p} />
        ))}
        {money.payments.length === 0 && <li className="muted small">Оплат пока нет</li>}
      </ul>
      {b.status !== "refused" && money.due > 0 && (
        <p className="entry-due">остаток {tr(money.due)}</p>
      )}

      {b.log.length > 0 && (
        <ul className="entry-log">
          {b.log.map((l, i) => (
            <li key={i}>
              {fmtShort(l.date)} — {l.text}
            </li>
          ))}
        </ul>
      )}

      <div className="entry-actions">
        {b.status === "booked" && can("editAll") && (
          <button type="button" className="btn" onClick={() => openDialog({ kind: "issue", bookingId: b.id })}>
            Выдать платье
          </button>
        )}
        {b.status === "issued" && can("editAll") && (
          <button type="button" className="btn" onClick={() => openDialog({ kind: "return", bookingId: b.id })}>
            Принять платье
          </button>
        )}
        {(b.status === "booked" || b.status === "issued") && (
          <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "payment", bookingId: b.id })}>
            <Icon name="coin" size={16} /> Оплата
          </button>
        )}
        {b.status !== "refused" && (
          <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "payment", bookingId: b.id, paymentKind: "fine" })}>
            Штраф
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "comment", target: "booking", id: b.id })}>
          <Icon name="chat" size={16} /> Комментарий
        </button>
        {b.status === "booked" && canEdit && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "move", bookingId: b.id })}>
              Перенос даты
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "booking", booking: b })}>
              <Icon name="edit" size={16} /> Изменить
            </button>
            {can("editAll") && (
              <button type="button" className="btn btn-ghost btn-danger" onClick={() => openDialog({ kind: "refuse", bookingId: b.id })}>
                Отказ
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

/* ---------- Карточка в книге записей: половина экрана телефона ---------- */

export function RecordCard({ b }: { b: Booking }) {
  const { db, open } = useStore();
  const I = idx(db);
  const bride = I.bride.get(b.brideId);
  const item = I.item.get(b.itemId);
  const overdue = isOverdue(b);
  const money = paid(db, b);
  const fines = money.payments.filter((p) => p.kind === "fine").reduce((s, p) => s + p.amount, 0);
  // возвратная: до этой записи невеста уже приходила в салон
  const upTo = db.visits.filter((v) => v.brideId === b.brideId && v.date <= b.createdAt);
  const isReturning = upTo.some((v) => v.returning) || db.visits.some((v) => v.brideId === b.brideId && v.date < b.createdAt);
  const visitsBefore = isReturning ? Math.max(1, upTo.length - 1) : 0;
  const servedBy = b.createdBy !== b.consultantId ? I.staff.get(b.createdBy) : undefined;
  return (
    <button type="button" className="paper record-card" onClick={() => open({ kind: "booking", id: b.id })}>
      <span className="rc-head">
        <span className="rc-no">№ {contractNo(b)}</span>
        <span className="rc-date">{fmtDate(b.createdAt)}</span>
        <Chip tone={overdue ? "bad" : STATUS_TONE[b.status]}>{overdue ? "Просрочен" : STATUS_LABEL[b.status]}</Chip>
      </span>
      <span className="rc-name">{bride?.name ?? "—"}</span>
      {visitsBefore > 0 && (
        <span className="rc-returning">
          Возвратная · {visitsBefore + 1}-й визит
          {servedBy && servedBy.role === "employee" ? ` · обслужила ${servedBy.name}` : ""}
        </span>
      )}
      <span className="rc-lines">
        <span className="rc-line">
          <i>Платье</i>
          <b>
            {item?.model ?? "—"}
            {item && <span className="muted"> · {item.size}</span>}
          </b>
        </span>
        <span className="rc-line">
          <i>Тел</i>
          <b className="tabular">{bride?.phones[0] ?? "—"}</b>
        </span>
        <span className="rc-line">
          <i>Свадьба</i>
          <b>
            {fmtShort(b.eventDate)} · выдача {fmtShort(b.issueDate)}
          </b>
        </span>
        <span className="rc-line">
          <i>Консультант</i>
          <b>{I.staff.get(b.consultantId)?.name ?? "—"}</b>
        </span>
      </span>
      <span className="rc-money">
        <span>
          <i>Залог</i>
          <b>{rub(b.deposit)}</b>
        </span>
        <span>
          <i>Аренда</i>
          <b>{rub(b.rentPrice)}</b>
        </span>
        <span>
          <i>Доп</i>
          <b>{b.extra ? rub(b.extra) : b.extraNote ? "" : "—"}</b>
        </span>
        <span>
          <i>Штраф</i>
          <b>{fines ? rub(fines) : "—"}</b>
        </span>
      </span>
      {b.extraNote && <span className="rc-note">Доп: {b.extraNote}</span>}
      {b.fineNote && !money.payments.some((p) => p.kind === "fine") && <span className="rc-note rc-fine">Штраф: {b.fineNote}</span>}
      {b.notes && <span className="rc-note">{b.notes}</span>}
      {money.payments.length > 0 && (
        <span className="rc-pays">
          {money.payments.map((p) => (
            <span key={p.id} className={p.confirmedAt ? "is-ok" : "is-wait"}>
              {payText(p)} / {p.confirmedAt ? "подтверждён" : "ждёт подтверждения"}
            </span>
          ))}
          {b.status !== "refused" && money.due > 0 && <span className="is-ok">остаток {tr(money.due)}</span>}
        </span>
      )}
    </button>
  );
}

/* ---------- Невеста ---------- */

function BrideCard({ b }: { b: Bride }) {
  const { db, open, openDialog, can } = useStore();
  const I = idx(db);
  const visits = db.visits.filter((v) => v.brideId === b.id).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
  const bookings = db.bookings.filter((x) => x.brideId === b.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const cons = I.staff.get(b.consultantId);

  return (
    <article className="paper entry">
      <header className="entry-head">
        <h2 className="entry-title">{b.name}</h2>
        {visits.length > 1 && <Chip tone="info">Возвратная · {visits.length} визита</Chip>}
      </header>
      <dl className="entry-lines">
        <div className="line">
          <dt>Тел</dt>
          <dd className="tabular">{b.phones.join(", ")}</dd>
        </div>
        <div className="line">
          <dt>Консультант</dt>
          <dd>
            {cons?.name ?? "—"} <span className="muted">· встречает при каждом визите</span>
          </dd>
        </div>
        <div className="line">
          <dt>Свадьба</dt>
          <dd>{b.eventDate ? `${fmtDate(b.eventDate)} · ${relDay(b.eventDate)}` : "—"}</dd>
        </div>
        <div className="line">
          <dt>В базе с</dt>
          <dd>{fmtDate(b.createdAt)}</dd>
        </div>
        {b.notes && (
          <div className="line">
            <dt>Комментарий</dt>
            <dd>{b.notes}</dd>
          </div>
        )}
      </dl>

      <div className="entry-actions">
        <button type="button" className="btn" onClick={() => openDialog({ kind: "visit", brideId: b.id })}>
          <Icon name="door" size={16} /> Снова зашла
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "booking", brideId: b.id })}>
          Запись (договор на залог)
        </button>
        {can("editAll") ? (
          <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "bride", bride: b })}>
            <Icon name="edit" size={16} /> Изменить
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "comment", target: "bride", id: b.id })}>
            <Icon name="chat" size={16} /> Комментарий
          </button>
        )}
      </div>
      {!can("editAll") && <p className="muted small">Карточку после сохранения меняют администратор и владелец. Вы можете дописать комментарий.</p>}

      <h3 className="section-label">Договоры</h3>
      {bookings.length ? (
        <ul className="mini-list">
          {bookings.map((k) => (
            <li key={k.id}>
              <button type="button" className="mini-row" onClick={() => open({ kind: "booking", id: k.id })}>
                <span>
                  № {k.depositNo} · {I.item.get(k.itemId)?.model}
                </span>
                <span className="muted small">свадьба {fmtShort(k.eventDate)}</span>
                <Chip tone={STATUS_TONE[k.status]}>{STATUS_LABEL[k.status]}</Chip>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Договора пока нет</p>
      )}

      <h3 className="section-label">Визиты</h3>
      <ul className="mini-list">
        {visits.map((v) => (
          <li key={v.id} className="mini-row is-static">
            <span>
              {fmtShort(v.date)}, {v.time}
            </span>
            <span className="muted small">
              {v.tried ? `примерила: ${v.dressIds.map((id) => I.item.get(id)?.model).filter(Boolean).join(", ") || "да"}` : "без примерки"}
            </span>
            {v.returning && <Chip tone="info">Возвратная</Chip>}
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ---------- Платье ---------- */

function ItemCard({ it }: { it: DressItem }) {
  const { db, can, open, openDialog, sendCleaning, toast, restoreItem } = useStore();
  const I = idx(db);
  const { state, booking } = itemState(db, it.id);
  const bookings = (I.bookingsByItem.get(it.id) ?? []).slice().sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const issued = bookings.filter((b) => b.issuedAt).length;
  const revenue = bookings.filter((b) => b.issuedAt).reduce((s, b) => s + b.rentPrice + b.extra, 0);
  const cleanings = db.cleanings.filter((c) => c.itemId === it.id).length;

  return (
    <article className="paper entry">
      <div className="item-hero">
        <DressPhoto src={it.photo} alt={`Платье ${it.model}`} />
      </div>
      {it.retired && <p className="callout callout-info">Платье снято с проката. Его история сохранена в отчётах.</p>}
      <header className="entry-head">
        <h2 className="entry-title">{it.model}</h2>
        <Chip tone={ITEM_TONE[state]}>{ITEM_STATE_LABEL[state]}</Chip>
      </header>
      {booking && (
        <p className="muted small">
          {state === "issued" ? "У невесты" : "Ближайшая выдача"}: {shortName(I.bride.get(booking.brideId)?.name ?? "")}, {fmtShort(booking.issueDate)} — {fmtShort(booking.returnDate)}
        </p>
      )}
      <dl className="entry-lines">
        <div className="line">
          <dt>Размер</dt>
          <dd>{it.size}</dd>
        </div>
        <div className="line">
          <dt>Аренда</dt>
          <dd className="tabular">{rub(it.rentPrice)}</dd>
        </div>
        <div className="line">
          <dt>Стоимость</dt>
          <dd className="tabular">
            {fmtMoney(it.cost, it.costCurrency)} <span className="muted">· для договора</span>
          </dd>
        </div>
        <div className="line">
          <dt>Выдавали</dt>
          <dd>
            {issued} раз · химчистка {cleanings} раз
          </dd>
        </div>
        {can("suppliers") && (
          <>
            <div className="line line-owner">
              <dt>Поставщик</dt>
              <dd>{I.supplier.get(it.supplierId)?.name ?? "не указан"}</dd>
            </div>
            <div className="line line-owner">
              <dt>Закупка</dt>
              <dd className="tabular">
                {fmtMoney(it.purchasePrice, it.purchaseCurrency)} · принесло {rub(revenue)}
                {purchaseRub(it) > 0 && <span className="muted"> · окупилось на {Math.round((revenue / purchaseRub(it)) * 100)}%</span>}
                
              </dd>
            </div>
          </>
        )}
      </dl>
      <div className="entry-actions">
        {state !== "issued" && !it.retired && (
          <button type="button" className="btn" onClick={() => openDialog({ kind: "booking", itemId: it.id })}>
            Записать на это платье
          </button>
        )}
        {can("cleaning") && state === "free" && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              sendCleaning(it.id);
              toast(`${it.model} отправлено в химчистку`);
            }}
          >
            <Icon name="drop" size={16} /> В химчистку
          </button>
        )}
        {can("receiveItems") && (
          <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "item", item: it })}>
            <Icon name="edit" size={16} /> Изменить, фото, удалить
          </button>
        )}
        {it.retired && can("receiveItems") && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              restoreItem(it.id);
              toast(`${it.model} снова в прокате`);
            }}
          >
            Вернуть в прокат
          </button>
        )}
      </div>
      <h3 className="section-label">Записи на это платье</h3>
      {bookings.length ? (
        <ul className="mini-list">
          {bookings.slice(0, 30).map((k) => (
            <li key={k.id}>
              <button type="button" className="mini-row" onClick={() => open({ kind: "booking", id: k.id })}>
                <span>
                  {fmtShort(k.issueDate)} — {fmtShort(k.returnDate)}
                </span>
                <span className="muted small">{shortName(I.bride.get(k.brideId)?.name ?? "")}</span>
                <Chip tone={STATUS_TONE[k.status]}>{STATUS_LABEL[k.status]}</Chip>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Записей ещё не было</p>
      )}
    </article>
  );
}
