"use client";

import { useMemo, useState } from "react";
import { ConsultantBook } from "@/components/ConsultantBook";
import { BookTabs, PageHead } from "@/components/Shell";
import { RecordCard, STATUS_TONE } from "@/components/sheets";
import { Chip, Empty, Icon, Segmented } from "@/components/ui";
import { addDays, fmtShort, today } from "@/lib/dates";
import { STATUS_LABEL, contractNo, idx, isOverdue, payText, rub, shortName } from "@/lib/derive";
import { useStore } from "@/lib/store";
import type { BookingStatus } from "@/lib/types";

type Range = "30" | "90" | "365" | "all" | "custom";

export default function RecordsPage() {
  const { can } = useStore();
  // у консультанта — своя страница, как в бумажной тетради
  return can("editAll") ? <RecordsBook /> : <ConsultantBook />;
}

function RecordsBook() {
  const { db, can, open } = useStore();
  const I = idx(db);
  const [range, setRange] = useState<Range>("90");
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [dateBy, setDateBy] = useState<"createdAt" | "eventDate">("createdAt");
  const [status, setStatus] = useState<BookingStatus | "all" | "overdue">("all");
  const [cons, setCons] = useState("all");
  const [model, setModel] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [view, setView] = useState<"table" | "book">("book");
  const [shown, setShown] = useState(20);
  const [q, setQ] = useState("");

  const consultants = db.staff.filter((s) => s.role === "employee");
  const models = useMemo(() => [...new Set(db.items.map((i) => i.model))].sort(), [db.items]);

  const list = useMemo(() => {
    const p =
      range === "all"
        ? null
        : range === "custom"
          ? { from, to }
          : // по дате свадьбы период захватывает и ближайшие будущие свадьбы
            { from: addDays(today(), -Number(range) + 1), to: dateBy === "eventDate" ? addDays(today(), Number(range)) : today() };
    const mq = model.trim().toLowerCase();
    const sq = q.trim().toLowerCase();
    const digits = sq.replace(/\D/g, "");
    return db.bookings
      .filter((b) => {
        const d = b[dateBy];
        if (p && (d < p.from || d > p.to)) return false;
        if (status === "overdue" ? !isOverdue(b) : status !== "all" && b.status !== status) return false;
        if (cons !== "all" && b.consultantId !== cons) return false;
        if (mq && !I.item.get(b.itemId)?.model.toLowerCase().includes(mq)) return false;
        if (sq) {
          const br = I.bride.get(b.brideId);
          const hit =
            br?.name.toLowerCase().includes(sq) ||
            I.item.get(b.itemId)?.model.toLowerCase().includes(sq) ||
            String(b.depositNo) === sq ||
            (digits.length >= 4 && br?.phones.some((p) => p.replace(/\D/g, "").includes(digits)));
          if (!hit) return false;
        }
        if (min && b.rentPrice < Number(min)) return false;
        if (max && b.rentPrice > Number(max)) return false;
        return true;
      })
      .sort((a, b) => b[dateBy].localeCompare(a[dateBy]) || b.depositNo - a.depositNo);
  }, [db.bookings, range, from, to, dateBy, status, cons, model, min, max, q, I]);

  const sum = list.reduce((s, b) => s + b.rentPrice, 0);
  const deposits = list.reduce((s, b) => s + b.deposit, 0);

  return (
    <div className="page page-book">
      <BookTabs />
      <PageHead
        title="Книга записей"
        sub={
          <>
            {list.length} записей
            {can("reports") && ` · аренда ${rub(sum)} · залоги ${rub(deposits)}`}
          </>
        }
        actions={
          <Segmented
            label="Вид"
            value={view}
            onChange={setView}
            options={[
              { value: "book", label: "Карточки" },
              { value: "table", label: "Таблица" },
            ]}
          />
        }
      />

      {can("confirmPayments") && <ToConfirm />}
      <TodayRecords />

      <div className="search-input book-search">
        <Icon name="search" size={18} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(20);
          }}
          placeholder="Имя, телефон, платье или № договора"
          aria-label="Поиск по книге записей"
        />
      </div>
      <details className="details filters-box">
        <summary>Фильтры</summary>
      <div className="filters">
        <label className="field">
          <span className="field-label">Период</span>
          <select value={range} onChange={(e) => setRange(e.target.value as Range)}>
            <option value="30">30 дней</option>
            <option value="90">3 месяца</option>
            <option value="365">Год</option>
            <option value="all">Всё время</option>
            <option value="custom">Свои даты</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">По дате</span>
          <select value={dateBy} onChange={(e) => setDateBy(e.target.value as "createdAt" | "eventDate")}>
            <option value="createdAt">записи</option>
            <option value="eventDate">свадьбы</option>
          </select>
        </label>
        {range === "custom" && (
          <>
            <label className="field">
              <span className="field-label">С</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">По</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
        <label className="field">
          <span className="field-label">Статус</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">Все</option>
            <option value="booked">Залог внесён</option>
            <option value="issued">Выдано</option>
            <option value="overdue">Просрочен возврат</option>
            <option value="returned">Принято</option>
            <option value="refused">Отказ</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Консультант</span>
          <select value={cons} onChange={(e) => setCons(e.target.value)}>
            <option value="all">Все</option>
            {consultants.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Платье</span>
          <input value={model} onChange={(e) => setModel(e.target.value)} list="rec-models" placeholder="Название" />
          <datalist id="rec-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="field field-sum">
          <span className="field-label">Сумма аренды, ₽</span>
          <span className="sum-range">
            <input type="number" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder="от" aria-label="Сумма от" />
            <input type="number" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder="до" aria-label="Сумма до" />
          </span>
        </label>
      </div>
      </details>

      {list.length === 0 ? (
        <Empty title="Записей с такими условиями нет" text="Расширьте период или сбросьте фильтры." />
      ) : view === "table" ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">№</th>
                <th scope="col">Невеста</th>
                <th scope="col">Платье</th>
                <th scope="col">Консультант</th>
                <th scope="col">Записана</th>
                <th scope="col">Свадьба</th>
                <th scope="col" className="num">Аренда</th>
                <th scope="col" className="num">Залог</th>
                <th scope="col">Статус</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 200).map((b) => (
                <tr key={b.id} className="tr-click" onClick={() => open({ kind: "booking", id: b.id })}>
                  <td data-label="№" className="tabular">{b.depositNo}</td>
                  <td data-label="Невеста">
                    <button type="button" className="person-name name-btn" onClick={(e) => (e.stopPropagation(), open({ kind: "booking", id: b.id }))}>
                      {shortName(I.bride.get(b.brideId)?.name ?? "—")}
                    </button>
                  </td>
                  <td data-label="Платье">{I.item.get(b.itemId)?.model}</td>
                  <td data-label="Консультант">{I.staff.get(b.consultantId)?.name}</td>
                  <td data-label="Записана">{fmtShort(b.createdAt)}</td>
                  <td data-label="Свадьба">{fmtShort(b.eventDate)}</td>
                  <td data-label="Аренда" className="num">{rub(b.rentPrice)}</td>
                  <td data-label="Залог" className="num">{rub(b.deposit)}</td>
                  <td data-label="Статус">
                    <Chip tone={isOverdue(b) ? "bad" : STATUS_TONE[b.status]}>{isOverdue(b) ? "Просрочен" : STATUS_LABEL[b.status]}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > 200 && <p className="muted small table-more">Показаны первые 200. Уточните фильтры.</p>}
        </div>
      ) : (
        <div className="record-book">
          {list.slice(0, shown).map((b) => (
            <RecordCard key={b.id} b={b} />
          ))}
          {list.length > shown && (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setShown((n) => n + 20)}>
              Показать ещё ({list.length - shown})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Кто и кого записал сегодня — видят все консультанты, чтобы не оформить одно платье дважды */
function TodayRecords() {
  const { db, open } = useStore();
  const I = idx(db);
  const t = today();
  const list = db.bookings.filter((b) => b.createdAt === t).sort((a, b) => b.depositNo - a.depositNo);
  return (
    <section className="today-records" aria-label="Сегодня записали">
      <h2 className="today-title">
        Сегодня записали <span className="today-count">{list.length}</span>
      </h2>
      {list.length ? (
        <ul className="today-list">
          {list.map((b) => {
            const it = I.item.get(b.itemId);
            return (
              <li key={b.id}>
                <button type="button" className="today-row" onClick={() => open({ kind: "booking", id: b.id })}>
                  <span className="today-no">№ {b.depositNo}</span>
                  <span className="today-main">
                    <strong>{shortName(I.bride.get(b.brideId)?.name ?? "—")}</strong>
                    <span>
                      {it ? `${it.model}, р. ${it.size}` : "—"} · выдача {fmtShort(b.issueDate)}–{fmtShort(b.returnDate)}
                    </span>
                  </span>
                  <span className="today-cons">{I.staff.get(b.consultantId)?.name ?? "—"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">Сегодня ещё никого не записали.</p>
      )}
    </section>
  );
}

/** Владелец: записи и оплаты, которые консультанты отправили на подтверждение */
function ToConfirm() {
  const { db, open, confirmPayment, toast } = useStore();
  const I = idx(db);
  const list = db.payments.filter((p) => !p.confirmedAt).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return null;
  return (
    <section className="confirm-block" aria-label="Ждут подтверждения">
      <h2 className="today-title confirm-title">
        Ждут подтверждения <span className="today-count">{list.length}</span>
      </h2>
      <ul className="today-list">
        {list.map((p) => {
          const k = I.booking.get(p.bookingId);
          return (
            <li key={p.id} className="confirm-row">
              <button type="button" className="today-row" onClick={() => open({ kind: "booking", id: p.bookingId })}>
                <span className="today-no">№ {k ? contractNo(k) : "—"}</span>
                <span className="today-main">
                  <strong>{k ? shortName(I.bride.get(k.brideId)?.name ?? "—") : "—"}</strong>
                  <span className="confirm-text">{payText(p)}</span>
                </span>
                <span className="today-cons">{I.staff.get(p.recordedBy)?.name ?? "—"}</span>
              </button>
              <button
                type="button"
                className="btn btn-small btn-red"
                onClick={() => {
                  confirmPayment(p.id);
                  toast("Подтверждено");
                }}
              >
                Подтвердить
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
