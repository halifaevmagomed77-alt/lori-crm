"use client";

import { useMemo, useState } from "react";
import { PageHead } from "@/components/Shell";
import { STAGE_TONE } from "@/components/drawers";
import { Avatar, Chip, Empty, Icon } from "@/components/ui";
import { fmtShort, relDay, today } from "@/lib/dates";
import { STAGE_LABEL, clientStage, lastVisit, nextFitting, type ClientStage } from "@/lib/derive";
import { useStore } from "@/lib/store";

const FILTERS: { value: ClientStage | "all"; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "fitting", label: "Думают" },
  { value: "deal", label: "Ждут выдачи" },
  { value: "done", label: "Купили или арендовали" },
  { value: "lost", label: "Без покупки" },
];

export default function ClientsPage() {
  const { db, openClient, openDialog } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ClientStage | "all">("all");

  const rows = useMemo(() => {
    return db.clients
      .map((c) => ({ c, stage: clientStage(db, c), last: lastVisit(db, c.id), next: nextFitting(db, c.id) }))
      .sort((a, b) => {
        // сначала те, у кого есть будущая запись (ближайшие сверху), затем по последнему визиту
        if (!!a.next !== !!b.next) return a.next ? -1 : 1;
        if (a.next && b.next) return (a.next.date + a.next.time).localeCompare(b.next.date + b.next.time);
        return (b.last?.date ?? b.c.createdAt).localeCompare(a.last?.date ?? a.c.createdAt);
      });
  }, [db]);

  const query = q.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const list = rows.filter(
    ({ c, stage }) =>
      (filter === "all" || stage === filter) &&
      (!query || c.name.toLowerCase().includes(query) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))),
  );
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, f.value === "all" ? rows.length : rows.filter((r) => r.stage === f.value).length]));

  return (
    <div className="page">
      <PageHead
        title="Клиентки"
        sub={`${db.clients.length} в базе`}
        actions={
          <button type="button" className="btn" onClick={() => openDialog({ kind: "client" })}>
            <Icon name="plus" size={18} /> Новая клиентка
          </button>
        }
      />

      <div className="toolbar">
        <div className="search-input search-wide">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени или телефону" aria-label="Поиск клиенток" />
        </div>
        <div className="filter-row" role="radiogroup" aria-label="Этап">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" role="radio" aria-checked={filter === f.value} className="filter" onClick={() => setFilter(f.value)}>
              {f.label} <span className="filter-count">{counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Клиентка</th>
                <th scope="col">Этап</th>
                <th scope="col">Свадьба</th>
                <th scope="col">Последний визит</th>
                <th scope="col">Следующая примерка</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 120).map(({ c, stage, last, next }) => (
                <tr key={c.id} onClick={() => openClient(c.id)} className="tr-click">
                  <td>
                    <button type="button" className="person" onClick={(e) => (e.stopPropagation(), openClient(c.id))}>
                      <Avatar name={c.name} size={36} />
                      <span>
                        <span className="person-name">{c.name}</span>
                        <span className="person-sub">{c.phone}</span>
                      </span>
                    </button>
                  </td>
                  <td data-label="Этап">
                    <Chip tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Chip>
                  </td>
                  <td data-label="Свадьба">
                    {c.weddingDate ? (
                      <>
                        {fmtShort(c.weddingDate)}
                        {c.weddingDate >= today() && <span className="muted small"> · {relDay(c.weddingDate)}</span>}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td data-label="Визит">{last ? fmtShort(last.date) : <span className="muted">—</span>}</td>
                  <td data-label="Примерка">{next ? `${fmtShort(next.date)}, ${next.time}` : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > 120 && <p className="muted small table-more">Показаны первые 120. Уточните поиск, чтобы найти остальных.</p>}
        </div>
      ) : (
        <Empty
          title={query ? "Никого не нашли" : "В этой группе пока никого"}
          text={query ? "Проверьте написание или добавьте новую клиентку." : undefined}
          action={
            query ? (
              <button type="button" className="btn" onClick={() => openDialog({ kind: "client" })}>
                Новая клиентка
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
