"use client";

import { useMemo, useState } from "react";
import { PageHead } from "@/components/Shell";
import { BookingCard, STATUS_TONE } from "@/components/sheets";
import { Chip, Empty, Icon, Segmented } from "@/components/ui";
import { addDays, fmtShort, today } from "@/lib/dates";
import { STATUS_LABEL, idx, isOverdue, rub, shortName } from "@/lib/derive";
import { useStore } from "@/lib/store";
import type { BookingStatus } from "@/lib/types";

type Range = "30" | "90" | "365" | "all" | "custom";

export default function RecordsPage() {
  const { db, can, open, user } = useStore();
  const I = idx(db);
  const [range, setRange] = useState<Range>("90");
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [dateBy, setDateBy] = useState<"createdAt" | "eventDate">("createdAt");
  const [status, setStatus] = useState<BookingStatus | "all" | "overdue">("all");
  const [cons, setCons] = useState(user?.role === "employee" ? user.id : "all");
  const [model, setModel] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [view, setView] = useState<"table" | "book">("table");
  const [page, setPage] = useState(0);

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
    const q = model.trim().toLowerCase();
    return db.bookings
      .filter((b) => {
        const d = b[dateBy];
        if (p && (d < p.from || d > p.to)) return false;
        if (status === "overdue" ? !isOverdue(b) : status !== "all" && b.status !== status) return false;
        if (cons !== "all" && b.consultantId !== cons) return false;
        if (q && !I.item.get(b.itemId)?.model.toLowerCase().includes(q)) return false;
        if (min && b.rentPrice < Number(min)) return false;
        if (max && b.rentPrice > Number(max)) return false;
        return true;
      })
      .sort((a, b) => b[dateBy].localeCompare(a[dateBy]) || b.depositNo - a.depositNo);
  }, [db.bookings, range, from, to, dateBy, status, cons, model, min, max, I]);

  const sum = list.reduce((s, b) => s + b.rentPrice, 0);
  const deposits = list.reduce((s, b) => s + b.deposit, 0);
  const current = list[Math.min(page, Math.max(0, list.length - 1))];

  return (
    <div className="page">
      <PageHead
        title="Записи"
        sub={
          <>
            {list.length} договоров
            {can("reports") && ` · прокат ${rub(sum)} · залоги ${rub(deposits)}`}
          </>
        }
        actions={
          <Segmented
            label="Вид"
            value={view}
            onChange={(v) => {
              setView(v);
              setPage(0);
            }}
            options={[
              { value: "table", label: "Список" },
              { value: "book", label: "Книжка" },
            ]}
          />
        }
      />

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
          <span className="field-label">Сумма проката, ₽</span>
          <span className="sum-range">
            <input type="number" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder="от" aria-label="Сумма от" />
            <input type="number" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder="до" aria-label="Сумма до" />
          </span>
        </label>
      </div>

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
                <th scope="col">Конс.</th>
                <th scope="col">Записана</th>
                <th scope="col">Свадьба</th>
                <th scope="col" className="num">Сумма</th>
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
                  <td data-label="Конс.">{I.staff.get(b.consultantId)?.name}</td>
                  <td data-label="Записана">{fmtShort(b.createdAt)}</td>
                  <td data-label="Свадьба">{fmtShort(b.eventDate)}</td>
                  <td data-label="Сумма" className="num">{rub(b.rentPrice)}</td>
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
        current && (
          <div className="book">
            <div className="book-nav">
              <button type="button" className="icon-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} aria-label="Предыдущая запись">
                <Icon name="chevronL" />
              </button>
              <span className="tabular">
                {Math.min(page, list.length - 1) + 1} из {list.length}
              </span>
              <button type="button" className="icon-btn" disabled={page >= list.length - 1} onClick={() => setPage((p) => Math.min(list.length - 1, p + 1))} aria-label="Следующая запись">
                <Icon name="chevronR" />
              </button>
            </div>
            <BookingCard key={current.id} b={current} />
          </div>
        )
      )}
    </div>
  );
}
