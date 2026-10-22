import { addDays, diffDays, parseDate, today } from "./dates";
import type { Client, DB, Dress, Fitting, Order, Source } from "./types";

/* Вымышленные демо-данные. Все имена и телефоны придуманы. */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Амина", "Патимат", "Мадина", "Заира", "Фатима", "Хадижат", "Марьям", "Сабина", "Алина", "Диана", "Лейла", "Аминат", "Зарина", "Камила", "Эльмира", "Айшат", "Милана", "Саида", "Джамиля", "Асият", "Карина", "Луиза", "Написат", "Умукусум", "Самира", "Аида"];
const LAST = ["Магомедова", "Мамаева", "Атаева", "Багомедова", "Гусейнова", "Хасбулатова", "Даудова", "Эминова", "Казиева", "Пирмагомедова", "Абдуллаева", "Гасанова", "Алиева", "Омарова", "Рамазанова", "Исмаилова", "Гаджиева", "Курбанова", "Ахмедова", "Мусаева", "Халилова", "Шамилова", "Расулова", "Юсупова", "Арсланова", "Керимова", "Ибрагимова", "Сулейманова", "Набиева"];
const DRESS_NAMES = ["Selena", "Scarlett", "Sara", "Samira", "Odri", "Mona", "Amira", "Diana", "Leyla", "Milana", "Aurora", "Bianca", "Celine", "Esma", "Lana", "Nora", "Valeria", "Yasmin", "Vera", "Alisa", "Dalia", "Inessa", "Jasmine", "Kira"];
const SIZES = ["40", "42", "44", "46", "48", "50", "52"];
const COLORS = ["Белый", "Молочный", "Айвори", "Шампань"];
const NOTES = [
  "Хочет закрытые плечи и длинный рукав",
  "Свадьба в Дербенте, нужен лёгкий шлейф",
  "Нравятся корсеты, но без пайеток",
  "Приходила с мамой и сестрой",
  "Рассматривает второе платье на вечер",
  "Просила подобрать фату к платью",
  "",
  "",
  "",
];
const SOURCES: Source[] = ["Instagram", "Instagram", "Instagram", "Рекомендация", "Рекомендация", "Сайт", "Проходили мимо", "Другое"];

export function createSeed(): DB {
  const r = rng(20261022);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const T = today();
  let uid = 0;
  const id = (p: string) => `${p}${(++uid).toString(36)}`;

  /* Платья */
  const dresses: Dress[] = DRESS_NAMES.map((name, i) => {
    const evening = i >= 20;
    const sale = Math.round(int(evening ? 35 : 75, evening ? 70 : 220) / 5) * 5000;
    return {
      id: id("d"),
      name,
      category: evening ? "Вечернее" : "Свадебное",
      size: pick(SIZES),
      color: evening ? "Белый" : pick(COLORS),
      salePrice: sale,
      rentPrice: Math.round((sale * 0.28) / 1000) * 1000,
      forSale: i % 7 !== 3,
      forRent: i % 5 !== 2,
      photo: `/dresses/d${String(i + 1).padStart(2, "0")}.jpg`,
      createdAt: addDays(T, -int(410, 600)),
    };
  });

  /* Клиентки */
  const clients: Client[] = [];
  const usedNames = new Set<string>();
  const newClient = (createdAt: string): Client => {
    // в жизни бывают тёзки, поэтому после нескольких попыток допускаем повтор
    let name = `${pick(FIRST)} ${pick(LAST)}`;
    for (let tries = 0; usedNames.has(name) && tries < 20; tries++) name = `${pick(FIRST)} ${pick(LAST)}`;
    usedNames.add(name);
    const c: Client = {
      id: id("c"),
      name,
      phone: `+7 9${int(10, 99)} ${int(100, 999)}-${String(int(0, 99)).padStart(2, "0")}-${String(int(0, 99)).padStart(2, "0")}`,
      weddingDate: addDays(createdAt, int(25, 140)),
      source: pick(SOURCES),
      measurements:
        r() < 0.7
          ? { bust: int(80, 104), waist: int(58, 84), hips: int(86, 110), height: int(155, 178) }
          : {},
      notes: pick(NOTES),
      createdAt,
    };
    clients.push(c);
    return c;
  };

  const fittings: Fitting[] = [];
  const orders: Order[] = [];
  const rentBusy = new Map<string, [string, string][]>();

  const freeForRent = (dressId: string, from: string, to: string) =>
    !(rentBusy.get(dressId) ?? []).some(([a, b]) => !(to < a || from > b));

  /* Прошлые примерки: чуть больше года, сезонность — больше весной и осенью */
  for (let back = 400; back >= 1; back--) {
    const date = addDays(T, -back);
    const dow = parseDate(date).getDay();
    const month = parseDate(date).getMonth();
    const season = [3, 4, 8, 9].includes(month) ? 1.35 : month === 0 || month === 11 ? 0.7 : 1;
    const base = dow === 0 ? 1 : dow === 6 ? 4 : 2.4;
    const count = Math.max(0, Math.round(base * season + (r() - 0.5) * 2));
    const slots = ["10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "16:30", "17:30"];
    for (let k = 0; k < count; k++) {
      // часть примерок — повторные визиты существующих клиенток
      const repeat = clients.length > 10 && r() < 0.22;
      const c = repeat ? clients[clients.length - 1 - int(0, 9)] : newClient(date);
      const tried = Array.from({ length: int(2, 4) }, () => pick(dresses).id).filter((v, i, a) => a.indexOf(v) === i);
      const roll = r();
      const status = roll < 0.08 ? "noshow" : roll < 0.12 ? "cancelled" : "done";
      const f: Fitting = { id: id("f"), clientId: c.id, date, time: slots[k % slots.length], dressIds: tried, status, notes: "" };
      fittings.push(f);
      if (status !== "done") continue;

      const deal = r();
      if (deal < 0.2) {
        const dress = dresses.find((d) => tried.includes(d.id) && d.forSale) ?? null;
        if (!dress) continue;
        const issue = addDays(date, int(10, 45));
        orders.push({
          id: id("o"),
          type: "sale",
          clientId: c.id,
          dressId: dress.id,
          fittingId: f.id,
          price: dress.salePrice - (r() < 0.3 ? 5000 : 0),
          createdAt: date,
          issueDate: issue,
          status: issue <= T ? "issued" : "booked",
          notes: "",
        });
      } else if (deal < 0.37) {
        const issue = addDays(date, int(5, 40));
        const ret = addDays(issue, int(2, 4));
        const dress = dresses.find((d) => tried.includes(d.id) && d.forRent && freeForRent(d.id, issue, ret));
        if (!dress) continue;
        rentBusy.set(dress.id, [...(rentBusy.get(dress.id) ?? []), [issue, ret]]);
        const status = ret < T ? "returned" : issue <= T ? "issued" : "booked";
        orders.push({
          id: id("o"),
          type: "rent",
          clientId: c.id,
          dressId: dress.id,
          fittingId: f.id,
          price: dress.rentPrice,
          createdAt: date,
          issueDate: issue,
          returnDate: ret,
          status,
          notes: "",
        });
      }
    }
  }

  /* Одна просроченная аренда — чтобы было видно, как CRM подсвечивает возвраты */
  const late = orders.find((o) => o.type === "rent" && o.status === "returned" && diffDays(T, o.returnDate!) <= 6);
  if (late) late.status = "issued";

  /* Сегодня и ближайшие две недели */
  const todaySlots = ["11:00", "13:00", "15:30", "17:00"];
  todaySlots.forEach((time, i) => {
    const c = i === 3 && clients.length ? clients[clients.length - 4] : newClient(addDays(T, -int(1, 6)));
    fittings.push({
      id: id("f"),
      clientId: c.id,
      date: T,
      time,
      dressIds: [pick(dresses).id, pick(dresses).id].filter((v, j, a) => a.indexOf(v) === j),
      status: "planned",
      notes: i === 0 ? "Придёт с мамой, хочет закрытое платье" : i === 3 ? "Повторная примерка" : "",
    });
  });
  for (let fwd = 1; fwd <= 14; fwd++) {
    const date = addDays(T, fwd);
    const n = parseDate(date).getDay() === 0 ? 1 : int(1, 3);
    for (let k = 0; k < n; k++) {
      const c = newClient(addDays(T, -int(0, 5)));
      fittings.push({
        id: id("f"),
        clientId: c.id,
        date,
        time: ["11:00", "12:30", "14:00", "16:00", "17:30"][k + int(0, 2)],
        dressIds: [pick(dresses).id],
        status: "planned",
        notes: "",
      });
    }
  }

  fittings.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { version: 1, clients, dresses, fittings, orders };
}
