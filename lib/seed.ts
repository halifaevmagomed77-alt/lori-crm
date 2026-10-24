import { addDays, parseDate, today } from "./dates";
import type { Attendance, Booking, Bride, Cleaning, DB, DressItem, Payment, Staff, Supplier, Visit } from "./types";

/* Вымышленные демо-данные. Имена, телефоны и суммы придуманы. */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Амина", "Патимат", "Мадина", "Заира", "Фатима", "Хадижат", "Марьям", "Сабина", "Алина", "Диана", "Лейла", "Аминат", "Зарина", "Камила", "Эльмира", "Айшат", "Милана", "Саида", "Джамиля", "Асият", "Карина", "Луиза", "Написат", "Умукусум", "Самира", "Аида", "Зульфия", "Индира"];
const LAST = ["Магомедова", "Абдуллаева", "Гасанова", "Алиева", "Омарова", "Рамазанова", "Исмаилова", "Гаджиева", "Курбанова", "Ахмедова", "Мусаева", "Халилова", "Шамилова", "Расулова", "Юсупова", "Арсланова", "Керимова", "Ибрагимова", "Сулейманова", "Набиева", "Мамаева", "Атаева", "Гусейнова", "Даудова", "Эминова", "Казиева", "Джамалутдинова", "Кадиева"];
const MIDDLE = ["Магомедовна", "Руслановна", "Шамилевна", "Ахмедовна", "Исламовна", "Мурадовна", "Гаджиевна", "Юсуповна", "Сайидовна", "Расуловна"];

const MODELS = ["Sara", "Selena", "Scarlett", "Samira", "Odri", "Mona", "Chloe", "Marcella", "Anita", "Lina", "Catherine", "Enova", "Monte Carlo", "Montreal", "La Vie", "Sharmanta", "Amira", "Diana", "Leyla", "Aurora", "Bianca", "Celine", "Esma", "Valeria"];
const SIZES = ["40", "42", "44", "46", "48", "50"];
const TASKS = ["Пришить пуговицы", "Вставка под пуговицы", "Подол на 2 см", "Ушить спинку на 1 см", "Собрать оборку на 15 см", "Рукава из кружева", "Фата испанка с кромкой", "Поднять подол", "Убрать шлейф"];
const FINES: [string, number][] = [
  ["Не принесли вешалку", 350],
  ["Не принесли чехол", 500],
  ["Грязная обувь", 500],
  ["Порвали фату", 2000],
  ["Пятна на подоле", 5000],
  ["Дырка на кружеве", 2000],
  ["Возврат с опозданием", 0], // 10% от проката, считается ниже
];
const ACCESSORIES = ["Корона", "Серьги", "Обувь", "Фата"];
const BANKS = ["ВТБ", "Сбер", "Т-Банк"];

export function createSeed(): DB {
  const r = rng(20261025);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const chance = (p: number) => r() < p;
  const T = today();
  let uid = 0;
  const id = (p: string) => `${p}${(++uid).toString(36)}`;
  const round = (n: number, step = 1000) => Math.round(n / step) * step;

  /* Сотрудники */
  const staff: Staff[] = [
    { id: "u-owner", name: "Владелец", role: "owner", active: true },
    { id: "u-admin", name: "Аминат", role: "admin", active: true },
    ...["Милена", "Патимат", "Марьям", "Зара", "Алина", "Наргиз"].map((name, i) => ({
      id: `u-e${i + 1}`,
      name,
      role: "employee" as const,
      active: true,
    })),
  ];
  const consultants = staff.filter((s) => s.role === "employee");

  /* Поставщики */
  const suppliers: Supplier[] = [
    { id: "s1", name: "ИП Иванов И.И.", phone: "+7 928 000-11-22" },
    { id: "s2", name: "ИП Гаджиева П.М.", phone: "+7 988 000-33-44" },
    { id: "s3", name: "ООО «Белый шёлк»", phone: "+7 495 000-55-66" },
    { id: "s4", name: "Bridal House, Стамбул", phone: "+90 212 000-77-88" },
  ];

  /* Экземпляры платьев: у части моделей — по два от разных поставщиков */
  const items: DressItem[] = [];
  MODELS.forEach((model, i) => {
    const copies = i % 2 === 0 ? 2 : 1;
    const used = new Set<string>();
    for (let k = 0; k < copies; k++) {
      let sup = pick(suppliers);
      while (used.has(sup.id)) sup = pick(suppliers);
      used.add(sup.id);
      const purchase = round(int(70, 230) * 1000 * (sup.id === "s4" ? 0.85 : 1), 5000);
      items.push({
        id: id("i"),
        model,
        size: pick(SIZES),
        supplierId: sup.id,
        purchasePrice: purchase,
        cost: round(purchase * 1.4, 5000),
        rentPrice: round(purchase * (0.38 + r() * 0.15), 5000),
        receivedAt: addDays(T, -int(380, 700)),
        photo: `/dresses/d${String(i + 1).padStart(2, "0")}.jpg`,
      });
    }
  });

  const brides: Bride[] = [];
  const visits: Visit[] = [];
  const bookings: Booking[] = [];
  const payments: Payment[] = [];
  const cleanings: Cleaning[] = [];
  const attendance: Attendance[] = [];
  const busy = new Map<string, [string, string][]>();
  let depositNo = 120;
  let rentNo = 140;

  const phone = () => `8 9${int(10, 99)} ${int(100, 999)} ${String(int(0, 99)).padStart(2, "0")} ${String(int(0, 99)).padStart(2, "0")}`;
  const free = (itemId: string, a: string, b: string) => !(busy.get(itemId) ?? []).some(([x, y]) => !(b < x || a > y));

  const newBride = (date: string, consultantId: string): Bride => {
    const b: Bride = {
      id: id("b"),
      name: `${pick(LAST)} ${pick(FIRST)} ${pick(MIDDLE)}`,
      phones: chance(0.55) ? [phone(), phone()] : [phone()],
      eventDate: addDays(date, int(20, 150)),
      consultantId,
      createdAt: date,
      notes: chance(0.25) ? pick(["Хочет закрытые плечи", "Нравятся корсеты", "Свадьба в Дербенте", "Приходила с мамой и сестрой", "Невеста очень приятная, добрая"]) : "",
    };
    brides.push(b);
    return b;
  };

  const pay = (p: Omit<Payment, "id" | "confirmedAt">) => {
    const old = p.date < addDays(T, -2);
    payments.push({ ...p, id: id("p"), confirmedAt: old && chance(0.97) ? addDays(p.date, int(0, 2)) : undefined });
  };

  const makeBooking = (bride: Bride, visit: Visit, date: string) => {
    const event = bride.eventDate && bride.eventDate > addDays(date, 5) ? bride.eventDate : addDays(date, int(10, 120));
    bride.eventDate = event;
    const issue = addDays(event, -1);
    const ret = addDays(event, 1);
    const candidates = items.filter((it) => free(it.id, issue, ret));
    const tried = candidates.filter((it) => visit.dressIds.includes(it.id));
    const item = tried[0] ?? pick(candidates);
    if (!item) return;
    busy.set(item.id, [...(busy.get(item.id) ?? []), [issue, ret]]);
    const rent = round(item.rentPrice * (0.9 + r() * 0.2), 5000);
    const deposit = round(rent * (0.15 + r() * 0.15), 5000) || 10000;
    const acc = chance(0.4) ? [{ name: pick(ACCESSORIES), price: 0 }] : [];
    const extra = chance(0.2) ? round(int(3, 10) * 1000) : 0;
    const b: Booking = {
      id: id("k"),
      depositNo: ++depositNo,
      brideId: bride.id,
      consultantId: visit.consultantId,
      itemId: item.id,
      createdAt: date,
      eventDate: event,
      issueDate: issue,
      returnDate: ret,
      rentPrice: rent,
      deposit,
      extra,
      accessories: acc,
      veil: chance(0.5) ? pick(["Испанка", "Испанка с кромкой", "Фата со шлейфом", "Короткая фата"]) : undefined,
      tasks: Array.from({ length: int(0, 3) }, () => pick(TASKS)).filter((v, i, a) => a.indexOf(v) === i),
      status: "booked",
      log: [],
      createdBy: visit.consultantId,
    };
    bookings.push(b);
    pay({ bookingId: b.id, kind: "deposit", amount: deposit, date, method: chance(0.6) ? "transfer" : "cash", bank: pick(BANKS), recordedBy: visit.consultantId });

    if (chance(0.05)) b.log.push({ date: addDays(date, int(1, 10)), text: "Перенос даты по просьбе невесты" });

    // отказ
    if (chance(0.09)) {
      const refused = addDays(date, int(0, Math.max(0, Math.min(30, diff(issue, date) - 2))));
      if (refused <= T) {
        b.status = "refused";
        b.refusedAt = refused;
        b.refuseReason = pick(["Нашла другое платье", "Свадьба перенесена", "Передумала по фасону", "Не устроила цена подгонки", "Без объяснения причин"]);
        busy.set(item.id, (busy.get(item.id) ?? []).filter(([x]) => x !== issue));
        return;
      }
    }
    // выдачи на сегодня оставляем «ждут выдачи», чтобы администратор видел работу на день
    if (issue < T) {
      b.status = "issued";
      b.issuedAt = issue;
      b.rentNo = ++rentNo;
      const balance = rent - deposit + extra;
      pay({ bookingId: b.id, kind: "balance", amount: balance, date: issue, method: chance(0.5) ? "transfer" : "cash", bank: pick(BANKS), recordedBy: "u-admin" });
    }
    if (ret < T || (ret === T && chance(0.5))) {
      const late = chance(0.06) ? 1 : 0;
      const back = addDays(ret, late);
      if (back <= T) {
        b.status = "returned";
        b.returnedAt = back;
        if (late || chance(0.11)) {
          const [reason, amt] = late ? FINES[6] : pick(FINES.slice(0, 6));
          pay({ bookingId: b.id, kind: "fine", amount: late ? round(rent * 0.1, 50) : amt, reason, date: back, method: "cash", recordedBy: "u-admin" });
        }
        if (chance(0.85)) {
          const sent = back;
          const backAt = addDays(sent, int(3, 6));
          cleanings.push({ id: id("c"), itemId: item.id, bookingId: b.id, sentAt: sent, backAt: backAt <= T ? backAt : undefined });
        }
      }
    }
  };

  const diff = (a: string, b: string) => Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);

  /* Год истории + сегодняшнее утро */
  const recent: { bride: Bride; last: string; booked: boolean }[] = [];
  for (let back = 365; back >= 0; back--) {
    const date = addDays(T, -back);
    const dow = parseDate(date).getDay();
    const month = parseDate(date).getMonth();

    // табель
    const working = consultants.filter((c, i) => (i + dow) % 7 !== 3 && !(back === 0 && i === 5));
    [...staff.filter((s) => s.role !== "owner"), ...[]].forEach((s) => {
      const isWorking = s.role === "admin" ? dow !== 1 : working.includes(s);
      const inT = `09:${String(int(30, 59)).padStart(2, "0")}`;
      const outT = back === 0 ? undefined : `${int(18, 20)}:${pick(["00", "00", "30"])}`;
      attendance.push({ id: id("a"), staffId: s.id, date, in: isWorking ? inT : undefined, out: isWorking ? outT : undefined, dayOff: !isWorking });
    });

    const season = [3, 4, 5, 7, 8].includes(month) ? 1.3 : month === 0 || month === 11 ? 0.7 : 1;
    const base = dow === 6 ? 8 : dow === 0 ? 4 : 5.5;
    let n = Math.max(1, Math.round(base * season + (r() - 0.5) * 3));
    if (back === 0) n = 4; // сегодня — утренние визиты

    // онлайн-запись без визита: договор на залог оформлен удалённо
    if (back > 0 && chance(0.12)) {
      const c = pick(working.length ? working : consultants);
      const bride = newBride(date, c.id);
      bride.notes = "Онлайн-запись без визита в салон";
      makeBooking(bride, { id: "", brideId: bride.id, date, time: "12:00", consultantId: c.id, tried: false, dressIds: [], returning: false, notes: "" }, date);
    }

    for (let k = 0; k < n; k++) {
      const time = `${10 + Math.floor((k * 9) / n)}:${pick(["00", "15", "30", "45"])}`.padStart(5, "0");
      const pool = recent.filter((x) => diff(date, x.last) <= 45 && diff(date, x.last) >= 1 && !x.booked);
      const returning = pool.length > 0 && chance(0.27);
      let bride: Bride;
      if (returning) {
        const x = pick(pool);
        bride = x.bride;
        x.last = date;
      } else {
        bride = newBride(date, pick(working.length ? working : consultants).id);
        recent.push({ bride, last: date, booked: false });
        if (recent.length > 200) recent.shift();
      }
      const tried = chance(returning ? 0.95 : 0.85);
      const v: Visit = {
        id: id("v"),
        brideId: bride.id,
        date,
        time,
        consultantId: bride.consultantId, // возвратную встречает тот же консультант
        tried,
        dressIds: tried ? Array.from({ length: int(1, 4) }, () => pick(items).id).filter((x, i, a) => a.indexOf(x) === i) : [],
        returning,
        notes: "",
      };
      visits.push(v);
      const p = !tried ? 0.03 : returning ? 0.55 : 0.3;
      if (chance(p)) {
        makeBooking(bride, v, date);
        const rec = recent.find((x) => x.bride.id === bride.id);
        if (rec) rec.booked = true;
      }
    }
  }

  // пара неподтверждённых оплат за последние дни — чтобы владелец увидел, что нужно подтвердить
  payments.filter((p) => p.date >= addDays(T, -1)).forEach((p) => (p.confirmedAt = undefined));

  visits.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return {
    version: 2,
    staff,
    attendance,
    suppliers,
    items,
    brides,
    visits,
    bookings,
    payments,
    cleanings,
    nextDepositNo: depositNo + 1,
    nextRentNo: rentNo + 1,
  };
}
