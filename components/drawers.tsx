"use client";

import { fmtDate, relDay, today } from "@/lib/dates";
import { DRESS_STATE_LABEL, STAGE_LABEL, clientStage, dressState, rub } from "@/lib/derive";
import { useStore } from "@/lib/store";
import type { Client, Dress } from "@/lib/types";
import { FittingRow, OrderRow } from "./rows";
import { Avatar, Chip, Drawer, Icon, type Tone } from "./ui";

export function DrawerHost() {
  const { drawer, closeDrawer, db } = useStore();
  if (!drawer) return null;
  if (drawer.kind === "client") {
    const c = db.clients.find((x) => x.id === drawer.id);
    return c ? <ClientDrawer key={c.id} c={c} onClose={closeDrawer} /> : null;
  }
  const d = db.dresses.find((x) => x.id === drawer.id);
  return d ? <DressDrawer key={d.id} d={d} onClose={closeDrawer} /> : null;
}

export const STAGE_TONE: Record<string, Tone> = { new: "info", fitting: "warn", deal: "ink", done: "good", lost: "neutral" };
export const DRESS_TONE: Record<string, Tone> = { available: "good", reserved: "warn", rented: "info" };

function ClientDrawer({ c, onClose }: { c: Client; onClose: () => void }) {
  const { db, openDialog } = useStore();
  const stage = clientStage(db, c);
  const fittings = db.fittings.filter((f) => f.clientId === c.id);
  const orders = db.orders.filter((o) => o.clientId === c.id);
  const history = [
    ...fittings.map((f) => ({ key: f.id, date: f.date + f.time, node: <FittingRow key={f.id} f={f} showClient={false} /> })),
    ...orders.map((o) => ({ key: o.id, date: o.createdAt + "99", node: <OrderRow key={o.id} o={o} showClient={false} /> })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const wa = c.phone.replace(/\D/g, "");
  const m = c.measurements;
  const hasM = m.bust || m.waist || m.hips || m.height;

  return (
    <Drawer label={`Карточка: ${c.name}`} onClose={onClose}>
      <header className="drawer-head">
        <Avatar name={c.name} size={56} />
        <div>
          <h2 className="drawer-title">{c.name}</h2>
          <Chip tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Chip>
        </div>
      </header>

      <div className="contact-row">
        <a className="btn btn-small btn-ghost" href={`tel:+${wa}`}>
          <Icon name="phone" size={16} /> {c.phone}
        </a>
        <a className="btn btn-small btn-ghost" href={`https://wa.me/${wa}`} target="_blank" rel="noopener">
          <Icon name="chat" size={16} /> WhatsApp
        </a>
      </div>

      <dl className="facts">
        <div>
          <dt>Свадьба</dt>
          <dd>
            {c.weddingDate ? (
              <>
                {fmtDate(c.weddingDate)}
                <span className="muted"> · {relDay(c.weddingDate)}</span>
              </>
            ) : (
              <span className="muted">не указана</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Откуда узнала</dt>
          <dd>{c.source}</dd>
        </div>
        <div>
          <dt>В базе с</dt>
          <dd>{fmtDate(c.createdAt)}</dd>
        </div>
        <div>
          <dt>Мерки</dt>
          <dd>
            {hasM ? (
              <span className="measures">
                {m.bust && <span>Грудь {m.bust}</span>}
                {m.waist && <span>Талия {m.waist}</span>}
                {m.hips && <span>Бёдра {m.hips}</span>}
                {m.height && <span>Рост {m.height}</span>}
              </span>
            ) : (
              <span className="muted">не сняты</span>
            )}
          </dd>
        </div>
      </dl>
      {c.notes && <p className="note-box">{c.notes}</p>}

      <div className="drawer-actions">
        <button type="button" className="btn" onClick={() => openDialog({ kind: "fitting", clientId: c.id })}>
          <Icon name="calendar" size={18} /> Записать на примерку
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "order", type: "sale", clientId: c.id })}>
          Продажа
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "order", type: "rent", clientId: c.id })}>
          Аренда
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "client", client: c })}>
          <Icon name="edit" size={16} /> Изменить
        </button>
      </div>

      <section className="drawer-section">
        <h3 className="section-label">История</h3>
        {history.length ? <div className="rows">{history.map((h) => h.node)}</div> : <p className="muted">Пока ни одного визита</p>}
      </section>
    </Drawer>
  );
}

function DressDrawer({ d, onClose }: { d: Dress; onClose: () => void }) {
  const { db, openDialog, role } = useStore();
  const { state } = dressState(db, d.id);
  const orders = db.orders.filter((o) => o.dressId === d.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const tried = db.fittings.filter((f) => f.status === "done" && f.dressIds.includes(d.id)).length;
  const sales = orders.filter((o) => o.type === "sale" && o.status !== "cancelled");
  const rents = orders.filter((o) => o.type === "rent" && o.status !== "cancelled");
  const revenue = [...sales, ...rents].reduce((s, o) => s + o.price, 0);
  const upcoming = rents.filter((o) => o.status !== "returned" && (o.returnDate ?? "") >= today()).sort((a, b) => a.issueDate.localeCompare(b.issueDate));

  return (
    <Drawer label={`Платье ${d.name}`} onClose={onClose}>
      <div className="dress-hero">
        {d.photo ? <img src={d.photo} alt={`Платье ${d.name}`} /> : <Icon name="dress" size={48} />}
      </div>
      <header className="drawer-head drawer-head-plain">
        <div>
          <h2 className="drawer-title">{d.name}</h2>
          <p className="muted">
            {d.category} · размер {d.size} · {d.color.toLowerCase()}
          </p>
        </div>
        <Chip tone={DRESS_TONE[state]}>{DRESS_STATE_LABEL[state]}</Chip>
      </header>

      <dl className="facts facts-3">
        <div>
          <dt>Продажа</dt>
          <dd>{d.forSale ? rub(d.salePrice) : <span className="muted">не продаётся</span>}</dd>
        </div>
        <div>
          <dt>Аренда</dt>
          <dd>{d.forRent ? rub(d.rentPrice) : <span className="muted">не сдаётся</span>}</dd>
        </div>
        <div>
          <dt>Примеряли</dt>
          <dd>{tried} раз</dd>
        </div>
        <div>
          <dt>Продано</dt>
          <dd>{sales.length} раз</dd>
        </div>
        <div>
          <dt>Сдавали в аренду</dt>
          <dd>{rents.length} раз</dd>
        </div>
        {role === "owner" && (
          <div>
            <dt>Принесло</dt>
            <dd>{rub(revenue)}</dd>
          </div>
        )}
      </dl>

      <div className="drawer-actions">
        {d.forSale && (
          <button type="button" className="btn" onClick={() => openDialog({ kind: "order", type: "sale", dressId: d.id })}>
            Оформить продажу
          </button>
        )}
        {d.forRent && (
          <button type="button" className={`btn${d.forSale ? " btn-ghost" : ""}`} onClick={() => openDialog({ kind: "order", type: "rent", dressId: d.id })}>
            Оформить аренду
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => openDialog({ kind: "dress", dress: d })}>
          <Icon name="edit" size={16} /> Изменить
        </button>
      </div>

      {upcoming.length > 0 && (
        <section className="drawer-section">
          <h3 className="section-label">Занято в аренде</h3>
          <ul className="busy-list">
            {upcoming.map((o) => (
              <li key={o.id}>
                {fmtDate(o.issueDate)} — {fmtDate(o.returnDate!)}
                <span className="muted"> · {db.clients.find((c) => c.id === o.clientId)?.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="drawer-section">
        <h3 className="section-label">Сделки</h3>
        {orders.length ? (
          <div className="rows">
            {orders.map((o) => (
              <OrderRow key={o.id} o={o} showDress={false} />
            ))}
          </div>
        ) : (
          <p className="muted">Платье ещё не продавали и не сдавали</p>
        )}
      </section>
    </Drawer>
  );
}
