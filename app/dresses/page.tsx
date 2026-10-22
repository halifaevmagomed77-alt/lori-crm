"use client";

import { useState } from "react";
import { PageHead } from "@/components/Shell";
import { DRESS_TONE } from "@/components/drawers";
import { Chip, Empty, Icon } from "@/components/ui";
import { fmtShort } from "@/lib/dates";
import { DRESS_STATE_LABEL, dressState, rub, type DressState } from "@/lib/derive";
import { useStore } from "@/lib/store";
import type { Category } from "@/lib/types";

export default function DressesPage() {
  const { db, openDress, openDialog } = useStore();
  const [q, setQ] = useState("");
  const [state, setState] = useState<DressState | "all">("all");
  const [cat, setCat] = useState<Category | "all">("all");

  const items = db.dresses
    .map((d) => ({ d, ...dressState(db, d.id) }))
    .sort((a, b) => a.d.name.localeCompare(b.d.name));
  const counts: Record<string, number> = { all: items.length };
  items.forEach((i) => (counts[i.state] = (counts[i.state] ?? 0) + 1));
  const list = items.filter(
    (i) => (state === "all" || i.state === state) && (cat === "all" || i.d.category === cat) && i.d.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="page">
      <PageHead
        title="Платья"
        sub={`${counts.available ?? 0} в салоне, ${counts.rented ?? 0} в аренде, ${counts.reserved ?? 0} забронировано`}
        actions={
          <button type="button" className="btn" onClick={() => openDialog({ kind: "dress" })}>
            <Icon name="plus" size={18} /> Новое платье
          </button>
        }
      />

      <div className="toolbar">
        <div className="search-input search-wide">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название модели" aria-label="Поиск платьев" />
        </div>
        <div className="filter-row" role="radiogroup" aria-label="Статус">
          {(["all", "available", "reserved", "rented"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={state === s} className="filter" onClick={() => setState(s)}>
              {s === "all" ? "Все" : DRESS_STATE_LABEL[s]} <span className="filter-count">{counts[s] ?? 0}</span>
            </button>
          ))}
          <select className="filter-select" value={cat} onChange={(e) => setCat(e.target.value as Category | "all")} aria-label="Категория">
            <option value="all">Все категории</option>
            <option value="Свадебное">Свадебные</option>
            <option value="Вечернее">Вечерние</option>
          </select>
        </div>
      </div>

      {list.length ? (
        <ul className="dress-grid">
          {list.map(({ d, state: st, order }) => {
            const client = order ? db.clients.find((c) => c.id === order.clientId) : undefined;
            return (
              <li key={d.id}>
                <button type="button" className="dress-card" onClick={() => openDress(d.id)}>
                  <span className="dress-img">
                    {d.photo ? <img src={d.photo} alt="" loading="lazy" /> : <Icon name="dress" size={40} />}
                    <span className="dress-chip">
                      <Chip tone={DRESS_TONE[st]}>{DRESS_STATE_LABEL[st]}</Chip>
                    </span>
                  </span>
                  <span className="dress-name">{d.name}</span>
                  <span className="dress-meta">
                    {d.category}, размер {d.size}
                  </span>
                  <span className="dress-prices">
                    {d.forSale && <span>Продажа {rub(d.salePrice)}</span>}
                    {d.forRent && <span>Аренда {rub(d.rentPrice)}</span>}
                  </span>
                  {order && client && st !== "available" && (
                    <span className="dress-who">
                      {st === "rented" ? `У ${client.name.split(" ")[0]} до ${fmtShort(order.returnDate!)}` : `${client.name.split(" ")[0]} заберёт ${fmtShort(order.issueDate)}`}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title="Платьев с такими условиями нет" text="Сбросьте фильтры или добавьте новое платье." />
      )}
    </div>
  );
}
