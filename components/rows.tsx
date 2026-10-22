"use client";

import { diffDays, fmtDate, fmtShort, plural, relDay, today } from "@/lib/dates";
import { rub } from "@/lib/derive";
import { useStore } from "@/lib/store";
import type { Fitting, Order } from "@/lib/types";
import { Chip, Icon, type Tone } from "./ui";

const FIT_STATUS: Record<Fitting["status"], { label: string; tone: Tone }> = {
  planned: { label: "Записана", tone: "info" },
  done: { label: "Пришла", tone: "good" },
  noshow: { label: "Не пришла", tone: "bad" },
  cancelled: { label: "Отменена", tone: "neutral" },
};

export function FittingRow({ f, showClient = true, showDate = true }: { f: Fitting; showClient?: boolean; showDate?: boolean }) {
  const { db, setFittingStatus, openClient, openDialog, toast } = useStore();
  const client = db.clients.find((c) => c.id === f.clientId);
  const dresses = f.dressIds.map((id) => db.dresses.find((d) => d.id === id)?.name).filter(Boolean);
  const deal = db.orders.find((o) => o.fittingId === f.id && o.status !== "cancelled");
  const canMark = f.status === "planned" && f.date <= today();
  const st = FIT_STATUS[f.status];

  return (
    <div className="row">
      <div className="row-when">
        <span className="row-time">{f.time}</span>
        {showDate && <span className="row-date">{fmtShort(f.date)}</span>}
      </div>
      <div className="row-main">
        <p className="row-title">
          {showClient && client ? (
            <button type="button" className="name-btn" onClick={() => openClient(client.id)}>
              {client.name}
            </button>
          ) : (
            "Примерка"
          )}
          <Chip tone={st.tone}>{st.label}</Chip>
          {deal && <Chip tone="ink" icon={deal.type === "sale" ? "bag" : "swap"}>{deal.type === "sale" ? "Купила" : "Арендовала"}</Chip>}
        </p>
        {dresses.length > 0 && <p className="row-sub">Платья: {dresses.join(", ")}</p>}
        {showClient && client?.weddingDate && client.weddingDate >= today() && (
          <p className="row-sub">Свадьба {fmtDate(client.weddingDate)}, {relDay(client.weddingDate)}</p>
        )}
        {f.notes && <p className="row-note">{f.notes}</p>}
      </div>
      <div className="row-actions">
        {canMark && (
          <>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                setFittingStatus(f.id, "done");
                toast("Отмечено: пришла");
              }}
            >
              <Icon name="check" size={16} /> Пришла
            </button>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => {
                setFittingStatus(f.id, "noshow");
                toast("Отмечено: не пришла");
              }}
            >
              Не пришла
            </button>
          </>
        )}
        {f.status === "done" && !deal && (
          <>
            <button type="button" className="btn btn-small" onClick={() => openDialog({ kind: "order", type: "sale", clientId: f.clientId, fittingId: f.id })}>
              Продажа
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => openDialog({ kind: "order", type: "rent", clientId: f.clientId, fittingId: f.id })}>
              Аренда
            </button>
          </>
        )}
        {f.status === "planned" && (
          <button type="button" className="icon-btn" aria-label="Изменить примерку" onClick={() => openDialog({ kind: "fitting", fitting: f })}>
            <Icon name="edit" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export function orderStatus(o: Order): { label: string; tone: Tone } {
  const t = today();
  if (o.status === "cancelled") return { label: "Отменено", tone: "neutral" };
  if (o.type === "sale") return o.status === "issued" ? { label: "Выдано", tone: "good" } : { label: "Ждёт выдачи", tone: "warn" };
  if (o.status === "returned") return { label: "Возвращено", tone: "good" };
  if (o.status === "issued") {
    const late = diffDays(t, o.returnDate!);
    return late > 0 ? { label: `Просрочено на ${late} ${plural(late, "день", "дня", "дней")}`, tone: "bad" } : { label: "У клиентки", tone: "info" };
  }
  return { label: "Ждёт выдачи", tone: "warn" };
}

export function OrderRow({ o, showClient = true, showDress = true }: { o: Order; showClient?: boolean; showDress?: boolean }) {
  const { db, setOrderStatus, openClient, openDress, openDialog, toast } = useStore();
  const client = db.clients.find((c) => c.id === o.clientId);
  const dress = db.dresses.find((d) => d.id === o.dressId);
  const st = orderStatus(o);

  return (
    <div className="row">
      <div className={`row-kind kind-${o.type}`} aria-hidden="true">
        <Icon name={o.type === "sale" ? "bag" : "swap"} size={18} />
      </div>
      <div className="row-main">
        <p className="row-title">
          <span>{o.type === "sale" ? "Продажа" : "Аренда"}</span>
          {showDress && dress && (
            <button type="button" className="name-btn" onClick={() => openDress(dress.id)}>
              {dress.name}
            </button>
          )}
          {showClient && client && (
            <>
              <span className="muted">·</span>
              <button type="button" className="name-btn" onClick={() => openClient(client.id)}>
                {client.name}
              </button>
            </>
          )}
          <Chip tone={st.tone}>{st.label}</Chip>
        </p>
        <p className="row-sub">
          {o.type === "sale"
            ? `Выдача ${fmtDate(o.issueDate)}`
            : `${fmtDate(o.issueDate)} — ${fmtDate(o.returnDate!)}`}
          {" · "}
          {rub(o.price)}
          {" · оформлено "}
          {fmtShort(o.createdAt)}
        </p>
        {o.notes && <p className="row-note">{o.notes}</p>}
      </div>
      <div className="row-actions">
        {o.status === "booked" && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              setOrderStatus(o.id, "issued");
              toast(o.type === "sale" ? "Платье выдано" : "Платье выдано в аренду");
            }}
          >
            Выдать
          </button>
        )}
        {o.type === "rent" && o.status === "issued" && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              setOrderStatus(o.id, "returned");
              toast("Возврат принят, платье снова в салоне");
            }}
          >
            Принять возврат
          </button>
        )}
        {o.status === "booked" && (
          <button type="button" className="icon-btn" aria-label="Изменить сделку" onClick={() => openDialog({ kind: "order", type: o.type, order: o })}>
            <Icon name="edit" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
