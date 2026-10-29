"use client";

import { useMemo, useState } from "react";
import { EditorTabs, PageHead } from "@/components/Shell";
import { STATUS_TONE } from "@/components/sheets";
import { Chip, Empty, Icon } from "@/components/ui";
import { fmtShort, relDay, today } from "@/lib/dates";
import { STATUS_LABEL, idx } from "@/lib/derive";
import { useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";

export default function BridesPage() {
  const { db, open, openDialog, user, can } = useStore();
  const I = idx(db);
  const [q, setQ] = useState("");
  const [cons, setCons] = useState(user?.role === "employee" ? user.id : "all");
  const [only, setOnly] = useState<"all" | "nobook" | "returning">("all");

  const rows = useMemo(() => {
    const visitsBy = new Map<string, { count: number; last: string }>();
    db.visits.forEach((v) => {
      const r = visitsBy.get(v.brideId) ?? { count: 0, last: "" };
      r.count++;
      if (v.date > r.last) r.last = v.date;
      visitsBy.set(v.brideId, r);
    });
    const lastBooking = new Map<string, Booking>();
    db.bookings.forEach((b) => {
      const prev = lastBooking.get(b.brideId);
      if (!prev || b.createdAt > prev.createdAt) lastBooking.set(b.brideId, b);
    });
    return db.brides
      .map((b) => ({ b, v: visitsBy.get(b.id) ?? { count: 0, last: b.createdAt }, k: lastBooking.get(b.id) }))
      .sort((x, y) => y.v.last.localeCompare(x.v.last));
  }, [db.brides, db.visits, db.bookings]);

  const s = q.trim().toLowerCase();
  const digits = s.replace(/\D/g, "");
  const list = rows.filter(
    ({ b, v, k }) =>
      (cons === "all" || b.consultantId === cons) &&
      (only === "all" || (only === "nobook" ? !k && v.count > 0 : v.count > 1)) &&
      (!s || b.name.toLowerCase().includes(s) || (digits.length >= 4 && b.phones.some((p) => p.replace(/\D/g, "").includes(digits)))),
  );

  return (
    <div className="page">
      <EditorTabs />
      <PageHead
        title={can("editAll") ? "Редактор" : "Невесты"}
        sub={`Невест в базе: ${db.brides.length}. Нажмите на невесту, чтобы открыть карточку и записи.`}
        actions={
          <button type="button" className="btn" onClick={() => openDialog({ kind: "visit" })}>
            <Icon name="plus" size={18} /> Новая запись
          </button>
        }
      />
      <div className="filters">
        <div className="search-input search-wide">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Фамилия, имя или телефон" aria-label="Поиск невест" />
        </div>
        <label className="field">
          <span className="field-label">Консультант</span>
          <select value={cons} onChange={(e) => setCons(e.target.value)}>
            <option value="all">Все</option>
            {db.staff
              .filter((x) => x.role === "employee")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Показать</span>
          <select value={only} onChange={(e) => setOnly(e.target.value as typeof only)}>
            <option value="all">Всех</option>
            <option value="nobook">Были, но не записались</option>
            <option value="returning">Возвратные</option>
          </select>
        </label>
      </div>

      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Невеста</th>
                <th scope="col">Консультант</th>
                <th scope="col">Визитов</th>
                <th scope="col">Последний визит</th>
                <th scope="col">Свадьба</th>
                <th scope="col">Договор</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 150).map(({ b, v, k }) => (
                <tr key={b.id} className="tr-click" onClick={() => open({ kind: "bride", id: b.id })}>
                  <td>
                    <button type="button" className="person" onClick={(e) => (e.stopPropagation(), open({ kind: "bride", id: b.id }))}>
                      <span>
                        <span className="person-name">{b.name}</span>
                        <span className="person-sub">{b.phones[0]}</span>
                      </span>
                    </button>
                  </td>
                  <td data-label="Консультант">{I.staff.get(b.consultantId)?.name}</td>
                  <td data-label="Визитов">
                    {v.count}
                    {v.count > 1 && <span className="muted small"> · возвратная</span>}
                  </td>
                  <td data-label="Визит">{v.count ? fmtShort(v.last) : "онлайн"}</td>
                  <td data-label="Свадьба">
                    {b.eventDate ? (
                      <>
                        {fmtShort(b.eventDate)}
                        {b.eventDate >= today() && <span className="muted small"> · {relDay(b.eventDate)}</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label="Договор">{k ? <Chip tone={STATUS_TONE[k.status]}>{STATUS_LABEL[k.status]}</Chip> : <span className="muted">нет</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > 150 && <p className="muted small table-more">Показаны 150 последних. Уточните поиск.</p>}
        </div>
      ) : (
        <Empty title="Никого не нашли" text="Проверьте фамилию или номер." />
      )}
    </div>
  );
}
