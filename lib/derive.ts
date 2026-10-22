import { addDays, addMonths, diffDays, fmtShort, monthShort, startOfMonth, startOfWeek, today } from "./dates";
import type { Client, DB, DateStr, Dress, Fitting, Order } from "./types";

export function rub(n: number): string {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export function rubCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString("ru-RU")} тыс ₽`;
  return rub(n);
}

/* ---------- Dress state ---------- */

export type DressState = "available" | "reserved" | "rented";

export const DRESS_STATE_LABEL: Record<DressState, string> = {
  available: "В салоне",
  reserved: "Забронировано",
  rented: "В аренде",
};

const active = (o: Order) => o.status !== "cancelled";

export function dressState(db: DB, dressId: string, on: DateStr = today()): { state: DressState; order?: Order } {
  const orders = db.orders.filter((o) => o.dressId === dressId && active(o));
  const out = orders.find((o) => o.type === "rent" && o.status === "issued");
  if (out) return { state: "rented", order: out };
  const soon = orders
    .filter((o) => o.type === "rent" && o.status === "booked" && diffDays(o.issueDate, on) <= 7)
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate))[0];
  if (soon) return { state: "reserved", order: soon };
  return { state: "available" };
}

/**
 * Платье в базе — это модель из коллекции с образцом в салоне.
 * Продажа не убирает модель: клиентке выдают новое платье этой модели по её размеру.
 * Аренда занимает образец салона на даты, поэтому аренды не должны пересекаться.
 */
export function rentConflict(db: DB, dressId: string, from: DateStr, to: DateStr, ignoreId?: string): Order | undefined {
  return db.orders.find(
    (o) =>
      o.id !== ignoreId &&
      o.dressId === dressId &&
      active(o) &&
      o.type === "rent" &&
      o.status !== "returned" &&
      !(to < o.issueDate || from > (o.returnDate ?? o.issueDate)),
  );
}

/* ---------- Client stage ---------- */

export type ClientStage = "new" | "fitting" | "deal" | "done" | "lost";

export const STAGE_LABEL: Record<ClientStage, string> = {
  new: "Новая заявка",
  fitting: "Была на примерке",
  deal: "Оформлена сделка",
  done: "Платье выдано",
  lost: "Без покупки",
};

export function clientStage(db: DB, c: Client): ClientStage {
  const orders = db.orders.filter((o) => o.clientId === c.id && active(o));
  if (orders.some((o) => o.status === "issued" || o.status === "returned")) return "done";
  if (orders.length) return "deal";
  const fits = db.fittings.filter((f) => f.clientId === c.id);
  const done = fits.filter((f) => f.status === "done");
  const planned = fits.some((f) => f.status === "planned" && f.date >= today());
  if (done.length && !planned && diffDays(today(), done[done.length - 1].date) > 21) return "lost";
  if (done.length) return "fitting";
  return "new";
}

export function lastVisit(db: DB, clientId: string): Fitting | undefined {
  return db.fittings
    .filter((f) => f.clientId === clientId && f.status === "done")
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function nextFitting(db: DB, clientId: string): Fitting | undefined {
  return db.fittings
    .filter((f) => f.clientId === clientId && f.status === "planned" && f.date >= today())
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
}

/* ---------- Reports ---------- */

export type Period = { from: DateStr; to: DateStr };
export type PresetId = "week" | "month" | "quarter" | "year" | "custom";

export function presetPeriod(p: Exclude<PresetId, "custom">): Period {
  const t = today();
  if (p === "week") return { from: addDays(t, -6), to: t };
  if (p === "month") return { from: addDays(t, -29), to: t };
  if (p === "quarter") return { from: addDays(t, -89), to: t };
  return { from: addDays(t, -364), to: t };
}

export function previousPeriod({ from, to }: Period): Period {
  const len = diffDays(to, from) + 1;
  return { from: addDays(from, -len), to: addDays(from, -1) };
}

const inP = (d: DateStr, p: Period) => d >= p.from && d <= p.to;

export type Totals = {
  fittings: number;
  sales: number;
  rents: number;
  conversion: number; // доля проведённых примерок, после которых оформлена сделка
  saleRevenue: number;
  rentRevenue: number;
  noshow: number;
};

export function totals(db: DB, p: Period): Totals {
  const fits = db.fittings.filter((f) => f.status === "done" && inP(f.date, p));
  const noshow = db.fittings.filter((f) => f.status === "noshow" && inP(f.date, p)).length;
  const ords = db.orders.filter((o) => active(o) && inP(o.createdAt, p));
  const sales = ords.filter((o) => o.type === "sale");
  const rents = ords.filter((o) => o.type === "rent");
  const fitIds = new Set(fits.map((f) => f.id));
  const converted = new Set(ords.filter((o) => o.fittingId && fitIds.has(o.fittingId)).map((o) => o.fittingId));
  return {
    fittings: fits.length,
    sales: sales.length,
    rents: rents.length,
    conversion: fits.length ? converted.size / fits.length : 0,
    saleRevenue: sales.reduce((s, o) => s + o.price, 0),
    rentRevenue: rents.reduce((s, o) => s + o.price, 0),
    noshow,
  };
}

export type Bucket = { key: string; label: string; from: DateStr; to: DateStr; fittings: number; sales: number; rents: number };

export function buckets(db: DB, p: Period): Bucket[] {
  const len = diffDays(p.to, p.from) + 1;
  const out: Bucket[] = [];
  if (len <= 14) {
    for (let d = p.from; d <= p.to; d = addDays(d, 1)) out.push({ key: d, label: fmtShort(d), from: d, to: d, fittings: 0, sales: 0, rents: 0 });
  } else if (len <= 120) {
    for (let d = startOfWeek(p.from); d <= p.to; d = addDays(d, 7)) {
      const from = d < p.from ? p.from : d;
      const end = addDays(d, 6);
      out.push({ key: d, label: fmtShort(from), from, to: end > p.to ? p.to : end, fittings: 0, sales: 0, rents: 0 });
    }
  } else {
    for (let d = startOfMonth(p.from); d <= p.to; d = addMonths(d, 1)) {
      const from = d < p.from ? p.from : d;
      const end = addDays(addMonths(d, 1), -1);
      out.push({ key: d, label: monthShort(d), from, to: end > p.to ? p.to : end, fittings: 0, sales: 0, rents: 0 });
    }
  }
  const find = (d: DateStr) => out.find((b) => d >= b.from && d <= b.to);
  db.fittings.forEach((f) => {
    if (f.status === "done" && inP(f.date, p)) find(f.date)!.fittings++;
  });
  db.orders.forEach((o) => {
    if (!active(o) || !inP(o.createdAt, p)) return;
    const b = find(o.createdAt)!;
    if (o.type === "sale") b.sales++;
    else b.rents++;
  });
  return out;
}

export function topDresses(db: DB, p: Period, limit = 5) {
  const map = new Map<string, { dress: Dress; tried: number; sales: number; rents: number }>();
  const get = (id: string) => {
    const dress = db.dresses.find((d) => d.id === id);
    if (!dress) return null;
    if (!map.has(id)) map.set(id, { dress, tried: 0, sales: 0, rents: 0 });
    return map.get(id)!;
  };
  db.fittings.forEach((f) => {
    if (f.status === "done" && inP(f.date, p)) f.dressIds.forEach((id) => get(id) && get(id)!.tried++);
  });
  db.orders.forEach((o) => {
    if (!active(o) || !inP(o.createdAt, p)) return;
    const row = get(o.dressId);
    if (!row) return;
    if (o.type === "sale") row.sales++;
    else row.rents++;
  });
  return [...map.values()].sort((a, b) => b.sales + b.rents - (a.sales + a.rents) || b.tried - a.tried).slice(0, limit);
}

export function sourcesBreakdown(db: DB, p: Period) {
  const counts = new Map<string, number>();
  db.clients.forEach((c) => {
    if (inP(c.createdAt, p)) counts.set(c.source, (counts.get(c.source) ?? 0) + 1);
  });
  return [...counts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}
