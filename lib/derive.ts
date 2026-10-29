import { addDays, addMonths, diffDays, fmtShort, monthShort, startOfMonth, startOfWeek, today } from "./dates";
import { CURRENCIES, type Booking, type Currency, type DB, type DateStr, type DressItem, type Payment, type Staff } from "./types";

/** Сумма в своей валюте: «7 000 €», «120 000 ₽» */
export function fmtMoney(n: number, cur: Currency = "RUB"): string {
  if (cur === "RUB") return rub(n);
  const sign = CURRENCIES.find((c) => c.value === cur)?.sign ?? cur;
  return `${Math.round(n).toLocaleString("ru-RU")} ${sign}`;
}

/** Закупка в рублях — только её можно сравнить с выручкой от аренды; закупка в валюте не пересчитывается */
export const purchaseRub = (i: DressItem) => (!i.purchaseCurrency || i.purchaseCurrency === "RUB" ? i.purchasePrice : 0);

export function rub(n: number): string {
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

export function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

/** «Гасанова Хадижат Мурадовна» → «Гасанова Хадижат» */
/** «Амина Алиева Билаловна» → «Амина А.Б.»; «Консультант 1» остаётся как есть */
export function staffShort(full: string) {
  const [first, ...rest] = full.trim().split(/\s+/);
  const initials = rest.filter((w) => /^\p{L}/u.test(w)).map((w) => `${w[0].toUpperCase()}.`);
  if (!initials.length || initials.length !== rest.length) return full;
  return `${first} ${initials.join("")}`;
}

/** «30 т.р» — как пишут в тетради; не кратное тысяче — полностью */
export function tr(n: number) {
  return n % 1000 === 0 ? `${(n / 1000).toLocaleString("ru-RU")} т.р` : rub(n);
}

/** № договора: вписанный консультантом или внутренний номер */
export const contractNo = (b: Booking) => b.contractDeposit || String(b.depositNo);

export function shortName(full: string) {
  return full.split(" ").slice(0, 2).join(" ");
}

/* ---------- Индексы (кэш по объекту базы) ---------- */

type Index = {
  bride: Map<string, DB["brides"][number]>;
  booking: Map<string, Booking>;
  item: Map<string, DressItem>;
  staff: Map<string, Staff>;
  supplier: Map<string, DB["suppliers"][number]>;
  paymentsByBooking: Map<string, Payment[]>;
  bookingsByItem: Map<string, Booking[]>;
};
const cache = new WeakMap<DB, Index>();

export function idx(db: DB): Index {
  let i = cache.get(db);
  if (i) return i;
  const group = <T, K>(arr: T[], key: (x: T) => K) => {
    const m = new Map<K, T[]>();
    arr.forEach((x) => {
      const k = key(x);
      const list = m.get(k);
      if (list) list.push(x);
      else m.set(k, [x]);
    });
    return m;
  };
  i = {
    bride: new Map(db.brides.map((b) => [b.id, b])),
    booking: new Map(db.bookings.map((b) => [b.id, b])),
    item: new Map(db.items.map((x) => [x.id, x])),
    staff: new Map(db.staff.map((s) => [s.id, s])),
    supplier: new Map(db.suppliers.map((s) => [s.id, s])),
    paymentsByBooking: group(db.payments, (p) => p.bookingId),
    bookingsByItem: group(db.bookings, (b) => b.itemId),
  };
  cache.set(db, i);
  return i;
}

/* ---------- Договоры ---------- */

export const STATUS_LABEL: Record<Booking["status"], string> = {
  booked: "Залог внесён",
  issued: "Выдано",
  returned: "Принято",
  refused: "Отказ",
};

export function paid(db: DB, b: Booking) {
  const ps = idx(db).paymentsByBooking.get(b.id) ?? [];
  const rent = ps.filter((p) => p.kind !== "fine").reduce((s, p) => s + p.amount, 0);
  const fines = ps.filter((p) => p.kind === "fine").reduce((s, p) => s + p.amount, 0);
  return { rent, fines, due: Math.max(0, b.rentPrice + b.extra - rent), payments: ps };
}

export function isOverdue(b: Booking) {
  return b.status === "issued" && b.returnDate < today();
}

/** Пересечение аренды одного экземпляра */
export function itemConflict(db: DB, itemId: string, from: DateStr, to: DateStr, ignoreId?: string) {
  return (idx(db).bookingsByItem.get(itemId) ?? []).find(
    (b) => b.id !== ignoreId && (b.status === "booked" || b.status === "issued") && !(to < b.issueDate || from > b.returnDate),
  );
}

export type ItemState = "free" | "booked" | "issued" | "cleaning";
export const ITEM_STATE_LABEL: Record<ItemState, string> = {
  free: "В салоне",
  booked: "Забронировано",
  issued: "Выдано",
  cleaning: "В химчистке",
};

export function itemState(db: DB, itemId: string): { state: ItemState; booking?: Booking } {
  const bs = idx(db).bookingsByItem.get(itemId) ?? [];
  const out = bs.find((b) => b.status === "issued");
  if (out) return { state: "issued", booking: out };
  if (db.cleanings.some((c) => c.itemId === itemId && !c.backAt)) return { state: "cleaning" };
  const next = bs
    .filter((b) => b.status === "booked" && b.issueDate >= today())
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate))[0];
  // «Забронировано» — когда выдача в ближайшую неделю; иначе платье в салоне и его можно мерить
  if (next && diffDays(next.issueDate, today()) <= 7) return { state: "booked", booking: next };
  return { state: "free", booking: next };
}

/* ---------- Журнал дня ---------- */

export function daySummary(db: DB, date: DateStr) {
  const visits = db.visits.filter((v) => v.date === date);
  return {
    visits,
    tried: visits.filter((v) => v.tried),
    returning: visits.filter((v) => v.returning),
    records: db.bookings.filter((b) => b.createdAt === date),
    refusals: db.bookings.filter((b) => b.refusedAt === date),
    issued: db.bookings.filter((b) => b.issuedAt === date),
    toIssue: db.bookings.filter((b) => b.status === "booked" && b.issueDate === date),
    returned: db.bookings.filter((b) => b.returnedAt === date),
    toReturn: db.bookings.filter((b) => b.status === "issued" && b.returnDate === date),
    cleaning: db.cleanings.filter((c) => c.sentAt === date),
    fines: db.payments.filter((p) => p.kind === "fine" && p.date === date),
    payments: db.payments.filter((p) => p.date === date),
    attendance: db.attendance.filter((a) => a.date === date),
  };
}

/* ---------- Периоды ---------- */

export type Period = { from: DateStr; to: DateStr };
export type PresetId = "day" | "week" | "month" | "quarter" | "year" | "custom";

export function presetPeriod(p: Exclude<PresetId, "custom">): Period {
  const t = today();
  if (p === "day") return { from: t, to: t };
  if (p === "week") return { from: addDays(t, -6), to: t };
  if (p === "month") return { from: addDays(t, -29), to: t };
  if (p === "quarter") return { from: addDays(t, -89), to: t };
  return { from: addDays(t, -364), to: t };
}

export function previousPeriod({ from, to }: Period): Period {
  const len = diffDays(to, from) + 1;
  return { from: addDays(from, -len), to: addDays(from, -1) };
}

export const inP = (d: DateStr | undefined, p: Period) => !!d && d >= p.from && d <= p.to;

/** Воронка: зашли → примерили → записались (договор на залог) → выдано; отказы и возвратные */
export function funnel(db: DB, p: Period, consultantId?: string) {
  const mine = <T extends { consultantId: string }>(x: T) => !consultantId || x.consultantId === consultantId;
  const visits = db.visits.filter((v) => inP(v.date, p) && mine(v));
  const records = db.bookings.filter((b) => inP(b.createdAt, p) && mine(b));
  const refusals = db.bookings.filter((b) => inP(b.refusedAt, p) && mine(b));
  const issued = db.bookings.filter((b) => inP(b.issuedAt, p) && mine(b));
  return {
    visits: visits.length,
    tried: visits.filter((v) => v.tried).length,
    returning: visits.filter((v) => v.returning).length,
    records: records.length,
    refusals: refusals.length,
    issued: issued.length,
    recordSum: records.reduce((s, b) => s + b.rentPrice, 0),
  };
}

export function byConsultant(db: DB, p: Period) {
  return db.staff
    .filter((s) => s.role === "employee")
    .map((s) => ({ staff: s, ...funnel(db, p, s.id) }))
    .filter((r) => r.visits || r.records || r.staff.active)
    .sort((a, b) => b.records - a.records || b.visits - a.visits);
}

/** Деньги за период: залог, полная аренда выданных платьев, допы, штрафы невест — в таком порядке */
export function money(db: DB, p: Period) {
  const ps = db.payments.filter((x) => inP(x.date, p));
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const issued = db.bookings.filter((b) => inP(b.issuedAt, p));
  const fines = ps.filter((x) => x.kind === "fine");
  return {
    deposit: sum(ps.filter((x) => x.kind === "deposit").map((x) => x.amount)),
    rentFull: sum(issued.map((b) => b.rentPrice)),
    extra: sum(issued.map((b) => b.extra)) + sum(ps.filter((x) => x.kind === "extra").map((x) => x.amount)),
    rent: sum(ps.filter((x) => x.kind !== "fine").map((x) => x.amount)),
    fines: sum(fines.map((x) => x.amount)),
    received: sum(ps.map((x) => x.amount)),
    unconfirmed: ps.filter((x) => !x.confirmedAt),
    unconfirmedSum: sum(ps.filter((x) => !x.confirmedAt).map((x) => x.amount)),
    count: ps.length,
  };
}

export function refusals(db: DB, p: Period) {
  const list = db.bookings.filter((b) => inP(b.refusedAt, p));
  return {
    list,
    count: list.length,
    rentLost: list.reduce((s, b) => s + b.rentPrice, 0),
    depositKept: list.reduce((s, b) => s + b.deposit, 0),
  };
}

export function finesStats(db: DB, p: Period) {
  const list = db.payments.filter((x) => x.kind === "fine" && inP(x.date, p));
  const byReason = new Map<string, { count: number; sum: number }>();
  list.forEach((f) => {
    const k = f.reason ?? "Без причины";
    const r = byReason.get(k) ?? { count: 0, sum: 0 };
    r.count++;
    r.sum += f.amount;
    byReason.set(k, r);
  });
  return {
    list,
    count: list.length,
    sum: list.reduce((s, x) => s + x.amount, 0),
    byReason: [...byReason.entries()].map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.sum - a.sum),
  };
}

/** Какие модели лучше сдаются: выдачи за период */
export function byModel(db: DB, p: Period) {
  const I = idx(db);
  const m = new Map<string, { model: string; issued: number; records: number; refusals: number; revenue: number; photo?: string }>();
  const row = (model: string, photo?: string) => {
    if (!m.has(model)) m.set(model, { model, issued: 0, records: 0, refusals: 0, revenue: 0, photo });
    return m.get(model)!;
  };
  db.bookings.forEach((b) => {
    const it = I.item.get(b.itemId);
    if (!it) return;
    if (inP(b.issuedAt, p)) {
      const r = row(it.model, it.photo);
      r.issued++;
      r.revenue += b.rentPrice + b.extra;
    }
    if (inP(b.createdAt, p)) row(it.model, it.photo).records++;
    if (inP(b.refusedAt, p)) row(it.model, it.photo).refusals++;
  });
  return [...m.values()].sort((a, b) => b.issued - a.issued || b.revenue - a.revenue);
}

/** Лидеры по поставщикам: выдачи и выручка экземпляров каждого поставщика */
export function bySupplier(db: DB, p: Period) {
  const I = idx(db);
  return db.suppliers
    .map((s) => {
      const items = db.items.filter((i) => i.supplierId === s.id);
      const ids = new Set(items.map((i) => i.id));
      const issued = db.bookings.filter((b) => ids.has(b.itemId) && inP(b.issuedAt, p));
      const revenue = issued.reduce((sum, b) => sum + b.rentPrice + b.extra, 0);
      const purchase = items.reduce((sum, i) => sum + purchaseRub(i), 0);
      const models = new Map<string, number>();
      issued.forEach((b) => {
        const model = I.item.get(b.itemId)!.model;
        models.set(model, (models.get(model) ?? 0) + 1);
      });
      const top = [...models.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      return { supplier: s, items: items.length, issued: issued.length, revenue, purchase, perItem: items.length ? revenue / items.length : 0, top };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/** Одна модель у разных поставщиков — у кого выгоднее брать */
export function modelSupplierCompare(db: DB, p: Period) {
  const byModel = new Map<string, DressItem[]>();
  db.items.forEach((i) => byModel.set(i.model, [...(byModel.get(i.model) ?? []), i]));
  return [...byModel.entries()]
    .filter(([, list]) => new Set(list.map((i) => i.supplierId)).size > 1)
    .map(([model, list]) => ({
      model,
      rows: list.map((i) => {
        const issued = db.bookings.filter((b) => b.itemId === i.id && inP(b.issuedAt, p));
        const revenue = issued.reduce((s, b) => s + b.rentPrice + b.extra, 0);
        return { item: i, supplier: idx(db).supplier.get(i.supplierId)!, issued: issued.length, revenue, payback: purchaseRub(i) ? revenue / purchaseRub(i) : 0 };
      }),
    }));
}

export function cleaningByModel(db: DB, p: Period) {
  const I = idx(db);
  const m = new Map<string, number>();
  db.cleanings.forEach((c) => {
    if (!inP(c.sentAt, p)) return;
    const model = I.item.get(c.itemId)?.model ?? "—";
    m.set(model, (m.get(model) ?? 0) + 1);
  });
  return [...m.entries()].map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count);
}

export type Bucket = { label: string; title: string; from: DateStr; to: DateStr; visits: number; records: number; issued: number };

export function buckets(db: DB, p: Period): Bucket[] {
  const len = diffDays(p.to, p.from) + 1;
  const out: Bucket[] = [];
  const push = (from: DateStr, to: DateStr, label: string) =>
    out.push({ label, title: from === to ? fmtShort(from) : `${fmtShort(from)} — ${fmtShort(to)}`, from, to, visits: 0, records: 0, issued: 0 });
  if (len <= 31) {
    for (let d = p.from; d <= p.to; d = addDays(d, 1)) push(d, d, fmtShort(d));
  } else if (len <= 120) {
    for (let d = startOfWeek(p.from); d <= p.to; d = addDays(d, 7)) {
      const from = d < p.from ? p.from : d;
      const end = addDays(d, 6);
      push(from, end > p.to ? p.to : end, fmtShort(from));
    }
  } else {
    for (let d = startOfMonth(p.from); d <= p.to; d = addMonths(d, 1)) {
      const from = d < p.from ? p.from : d;
      const end = addDays(addMonths(d, 1), -1);
      push(from, end > p.to ? p.to : end, monthShort(d));
    }
  }
  const find = (d: DateStr) => out.find((b) => d >= b.from && d <= b.to);
  db.visits.forEach((v) => inP(v.date, p) && find(v.date)!.visits++);
  db.bookings.forEach((b) => {
    if (inP(b.createdAt, p)) find(b.createdAt)!.records++;
    if (inP(b.issuedAt, p)) find(b.issuedAt!)!.issued++;
  });
  return out;
}

/* ---------- Табель ---------- */

/** Минуты между «пришла» и «ушла» */
export function workMinutes(a?: { in?: string; out?: string }) {
  if (!a?.in || !a.out) return 0;
  const [h1, m1] = a.in.split(":").map(Number);
  const [h2, m2] = a.out.split(":").map(Number);
  return Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1));
}

/** «8 ч 30 мин» */
export function fmtMinutes(min: number) {
  if (!min) return "";
  return `${Math.floor(min / 60)} ч${min % 60 ? ` ${min % 60} мин` : ""}`;
}

/* ---------- Красная строка оплаты, как в тетради ---------- */

const PAY_WORD: Record<Payment["kind"], string> = { deposit: "Залог", balance: "Остаток", extra: "Доп", fine: "Штраф" };
const ddmm = (d: DateStr) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

/** «Залог 30 т.р / ВТБ / 04.01» — без статуса; статус рисует штамп */
export function payText(p: Payment) {
  const how = p.method === "cash" ? "наличные" : p.bank ?? "перевод";
  return `${PAY_WORD[p.kind]} ${tr(p.amount)}${p.reason ? ` (${p.reason.toLowerCase()})` : ""} / ${how} / ${ddmm(p.date)}`;
}
