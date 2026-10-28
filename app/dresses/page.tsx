"use client";

import { useState } from "react";
import { EditorTabs, PageHead } from "@/components/Shell";
import { ITEM_TONE } from "@/components/sheets";
import { Chip, Empty, Icon, Segmented } from "@/components/ui";
import { fmtShort } from "@/lib/dates";
import { ITEM_STATE_LABEL, idx, itemState, rub, shortName, type ItemState } from "@/lib/derive";
import { DressPhoto } from "@/components/forms";
import { useStore } from "@/lib/store";

export default function DressesPage() {
  const { db, can, open, openDialog } = useStore();
  const I = idx(db);
  const [tab, setTab] = useState<"items" | "suppliers">("items");
  const [q, setQ] = useState("");
  const [state, setState] = useState<ItemState | "all">("all");
  const [sup, setSup] = useState("all");
  const [archived, setArchived] = useState(false);

  const items = db.items
    .filter((i) => !!i.retired === archived)
    .map((i) => ({ i, ...itemState(db, i.id) }))
    .sort((a, b) => a.i.model.localeCompare(b.i.model));
  const counts: Record<string, number> = { all: items.length };
  items.forEach((x) => (counts[x.state] = (counts[x.state] ?? 0) + 1));
  const list = items.filter(
    (x) => (state === "all" || x.state === state) && (sup === "all" || x.i.supplierId === sup) && x.i.model.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="page">
      <EditorTabs />
      <PageHead
        title="Платья"
        sub={`${counts.free ?? 0} в салоне · ${counts.issued ?? 0} выдано · ${counts.booked ?? 0} забронировано · ${counts.cleaning ?? 0} в химчистке`}
        actions={
          can("receiveItems") ? (
            <button type="button" className="btn" onClick={() => openDialog({ kind: "item" })}>
              <Icon name="truck" size={18} /> Поступление
            </button>
          ) : undefined
        }
      />

      {can("suppliers") && (
        <div className="tabs-row">
          <Segmented
            label="Раздел"
            value={tab}
            onChange={setTab}
            options={[
              { value: "items", label: "Платья" },
              { value: "suppliers", label: "Поставщики" },
            ]}
          />
        </div>
      )}

      {tab === "items" ? (
        <>
          <div className="filters">
            <div className="search-input search-wide">
              <Icon name="search" size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название модели" aria-label="Поиск платьев" />
            </div>
            <div className="filter-row" role="radiogroup" aria-label="Статус">
              {(["all", "free", "booked", "issued", "cleaning"] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={state === s} className="filter" onClick={() => setState(s)}>
                  {s === "all" ? "Все" : ITEM_STATE_LABEL[s]} <span className="filter-count">{counts[s] ?? 0}</span>
                </button>
              ))}
            </div>
            {can("editAll") && (
              <label className="check small">
                <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
                <span>Снятые с проката ({db.items.filter((i) => i.retired).length})</span>
              </label>
            )}
            {can("suppliers") && (
              <select className="filter-select" value={sup} onChange={(e) => setSup(e.target.value)} aria-label="Поставщик">
                <option value="all">Все поставщики</option>
                {db.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {list.length ? (
            <ul className="dress-grid">
              {list.map(({ i, state: st, booking }) => (
                <li key={i.id}>
                  <button type="button" className="dress-card" onClick={() => open({ kind: "item", id: i.id })}>
                    <span className="dress-img">
                      <DressPhoto src={i.photo} />
                      <span className="dress-chip">
                        <Chip tone={ITEM_TONE[st]}>{ITEM_STATE_LABEL[st]}</Chip>
                      </span>
                    </span>
                    <span className="dress-name">{i.model}</span>
                    <span className="dress-meta">
                      Размер {i.size} · аренда {rub(i.rentPrice)}
                    </span>
                    {can("suppliers") && <span className="dress-sup">{I.supplier.get(i.supplierId)?.name ?? "поставщик не указан"}</span>}
                    {booking && (
                      <span className="dress-who">
                        {st === "issued" ? "У невесты до " : "Выдача "}
                        {fmtShort(st === "issued" ? booking.returnDate : booking.issueDate)} · {shortName(I.bride.get(booking.brideId)?.name ?? "").split(" ")[0]}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : db.items.length === 0 ? (
            <Empty
              title="В салоне пока нет платьев"
              text={can("receiveItems") ? "Нажмите «Поступление», укажите модель, поставщика и цену аренды, загрузите фото." : "Платья добавляет владелец."}
              action={
                can("receiveItems") ? (
                  <button type="button" className="btn" onClick={() => openDialog({ kind: "item" })}>
                    <Icon name="truck" size={18} /> Добавить первое платье
                  </button>
                ) : undefined
              }
            />
          ) : (
            <Empty title={archived ? "Снятых с проката платьев нет" : "Платьев с такими условиями нет"} />
          )}
        </>
      ) : (
        <>
          <div className="filters">
            <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "supplier" })}>
              <Icon name="plus" size={18} /> Новый поставщик
            </button>
            <p className="muted small">Эту вкладку видит только владелец. Нажмите на поставщика, чтобы изменить или удалить его.</p>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Поставщик</th>
                  <th scope="col">Телефон</th>
                  <th scope="col" className="num">Платьев</th>
                  <th scope="col">Модели</th>
                </tr>
              </thead>
              <tbody>
                {db.suppliers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Поставщиков пока нет
                    </td>
                  </tr>
                )}
                {db.suppliers.map((s) => {
                  const its = db.items.filter((i) => i.supplierId === s.id);
                  return (
                    <tr key={s.id} className="tr-click" onClick={() => openDialog({ kind: "supplier", supplier: s })}>
                      <td>
                        <span className="person-name">{s.name}</span>
                      </td>
                      <td data-label="Телефон">{s.phone ?? "—"}</td>
                      <td data-label="Платьев" className="num">
                        {its.length}
                      </td>
                      <td data-label="Модели">{[...new Set(its.map((i) => i.model))].join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
