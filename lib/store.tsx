"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TEST_ACCOUNTS, createInitial } from "./seed";
import { createDemo } from "./demo";
import { clearPhotos, deletePhoto } from "./photos";
import { addDays, today } from "./dates";
import type { Attendance, Booking, Bride, DB, DressItem, Payment, Role, Staff, Supplier, Visit } from "./types";

const KEY = "lori-crm:v3";
const USER_KEY = "lori-crm:session-v3";
const KIOSK_KEY = "lori-crm:kiosk";

/** Табель на планшете открыт на сегодня — кем и в какой день */
export type Kiosk = { by: string; date: string };

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/* ---------- Права ---------- */

export type Permission =
  | "reports" // финансовые отчёты
  | "suppliers" // поставщики и закупочные цены
  | "confirmPayments" // подпись владельца под оплатой
  | "manageStaff" // добавление и удаление сотрудников
  | "attendance" // табель всех сотрудников
  | "editAll" // правка чужих записей, выдача, приёмка, отказ
  | "cleaning" // блок «Химчистка»
  | "receiveItems"; // поступление платьев

const PERMS: Record<Role, Permission[]> = {
  owner: ["reports", "suppliers", "confirmPayments", "manageStaff", "attendance", "editAll", "cleaning", "receiveItems"],
  admin: ["attendance", "editAll", "cleaning"],
  employee: [],
};

export function can(role: Role, p: Permission) {
  return PERMS[role].includes(p);
}

/* ---------- UI-состояние ---------- */

export type Sheet = { kind: "booking"; id: string } | { kind: "bride"; id: string } | { kind: "item"; id: string } | null;

export type Dialog =
  | { kind: "visit"; brideId?: string; date?: string; mode?: "new" | "known" }
  | { kind: "booking"; brideId?: string; visitId?: string; itemId?: string; booking?: Booking; online?: boolean }
  | { kind: "issue"; bookingId: string }
  | { kind: "return"; bookingId: string }
  | { kind: "refuse"; bookingId: string }
  | { kind: "move"; bookingId: string }
  | { kind: "payment"; bookingId: string; paymentKind?: Payment["kind"] }
  | { kind: "bride"; bride?: Bride }
  | { kind: "item"; item?: DressItem }
  | { kind: "staff"; staff?: Staff }
  | { kind: "supplier"; supplier?: Supplier }
  | { kind: "feedback" }
  | { kind: "comment"; target: "bride" | "booking"; id: string }
  | null;

type Toast = { id: number; text: string };

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function load(): DB {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === 3) return parsed;
    }
  } catch {
    /* хранилище недоступно — работаем в памяти */
  }
  return createInitial();
}

function useStoreValue() {
  const [db, setDb] = useState<DB | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [kiosk, setKiosk] = useState<Kiosk | null>(null);

  useEffect(() => {
    const data = load();
    let u: string | null = null;
    try {
      u = window.localStorage.getItem(USER_KEY);
    } catch {}
    // единоразовая загрузка из localStorage после монтирования
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDb(data);
    try {
      const k = JSON.parse(window.localStorage.getItem(KIOSK_KEY) ?? "null") as Kiosk | null;
      if (k && k.date === today() && data.staff.some((s) => s.id === k.by && s.active)) setKiosk(k);
    } catch {}
    setUserId(u && data.staff.some((s) => s.id === u && s.active) ? u : null);
  }, []);

  useEffect(() => {
    if (!db) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(db));
    } catch {}
  }, [db]);

  const update = useCallback((fn: (d: DB) => DB) => setDb((d) => (d ? fn(d) : d)), []);
  const toast = useCallback((text: string) => {
    const tid = Date.now() + Math.random();
    setToasts((t) => [...t, { id: tid, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), 3200);
  }, []);

  return useMemo(() => {
    if (!db) return null;
    const user = userId ? db.staff.find((s) => s.id === userId) ?? null : null;
    const me = user?.id ?? "";

    const patchBooking = (id: string, fn: (b: Booking) => Booking) =>
      update((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === id ? fn(b) : b)) }));

    const addPayment = (p: Omit<Payment, "id" | "recordedBy" | "confirmedAt">) => {
      const payment: Payment = { ...p, id: uid("p"), recordedBy: me, confirmedAt: user?.role === "owner" ? p.date : undefined };
      update((d) => ({ ...d, payments: [...d.payments, payment] }));
      return payment;
    };

    return {
      db,
      user,
      role: (user?.role ?? "employee") as Role,
      can: (p: Permission) => !!user && can(user.role, p),
      /** Возвращает текст ошибки или null при успешном входе */
      login: (login: string, password: string): string | null => {
        const s = db.staff.find((x) => x.login.toLowerCase() === login.trim().toLowerCase());
        if (!s || s.password !== password) return "Неверный логин или пароль";
        if (!s.active) return "Доступ для этой учётной записи закрыт";
        setUserId(s.id);
        try {
          window.localStorage.setItem(USER_KEY, s.id);
        } catch {}
        return null;
      },
      logout: () => {
        setUserId(null);
        setSheet(null);
        setDialog(null);
        try {
          window.localStorage.removeItem(USER_KEY);
        } catch {}
      },
      /* ---------- Табель на планшете ---------- */
      kiosk: kiosk && kiosk.date === today() ? kiosk : null,
      /** Открыть табель на сегодня — только администратор или владелец. Возвращает текст ошибки или null. */
      openKiosk: (login: string, password: string): string | null => {
        const s = db.staff.find((x) => x.login.toLowerCase() === login.trim().toLowerCase());
        if (!s || s.password !== password) return "Неверный логин или пароль";
        if (!s.active) return "Доступ для этой учётной записи закрыт";
        if (s.role === "employee") return "Табель открывает администратор или владелец";
        const k = { by: s.id, date: today() };
        setKiosk(k);
        try {
          window.localStorage.setItem(KIOSK_KEY, JSON.stringify(k));
        } catch {}
        return null;
      },
      /** Закрыть табель — пароль администратора или владельца */
      closeKiosk: (password: string): boolean => {
        const ok = db.staff.some((s) => s.active && s.role !== "employee" && s.password === password);
        if (!ok) return false;
        setKiosk(null);
        try {
          window.localStorage.removeItem(KIOSK_KEY);
        } catch {}
        return true;
      },
      /** Пароль администратора или владельца — для режима администратора на планшете */
      checkManager: (password: string): Staff | null =>
        db.staff.find((s) => s.active && s.role !== "employee" && s.password === password) ?? null,
      /** Администратор ставит выходной за сотрудника — на один день или на несколько подряд */
      setDaysOff: (staffId: string, from: string, to: string, note: string, by: string) =>
        update((d) => {
          let attendance = d.attendance;
          for (let day = from; day <= to; day = addDays(day, 1)) {
            const ex = attendance.find((x) => x.staffId === staffId && x.date === day);
            const patch = { dayOff: true, in: undefined, out: undefined, note: note || undefined, setBy: by };
            attendance = ex ? attendance.map((x) => (x === ex ? { ...ex, ...patch } : x)) : [...attendance, { id: uid("a"), staffId, date: day, ...patch }];
          }
          return { ...d, attendance };
        }),
      cancelDayOff: (staffId: string, date: string) =>
        update((d) => ({
          ...d,
          attendance: d.attendance.filter((x) => !(x.staffId === staffId && x.date === date && x.dayOff && !x.in)),
        })),
      checkPassword: (staffId: string, password: string) => db.staff.some((s) => s.id === staffId && s.active && s.password === password),
      /** Отметка сотрудника на планшете текущим временем */
      mark: (staffId: string, kind: "in" | "out" | "off") =>
        update((d) => {
          const date = today();
          const ex = d.attendance.find((x) => x.staffId === staffId && x.date === date);
          const patch =
            kind === "in"
              ? { in: nowTime(), out: undefined, dayOff: false, note: undefined, setBy: undefined }
              : kind === "out"
                ? { out: nowTime() }
                : { dayOff: true, in: undefined, out: undefined, note: undefined, setBy: undefined };
          return {
            ...d,
            attendance: ex
              ? d.attendance.map((x) => (x === ex ? { ...ex, ...patch } : x))
              : [...d.attendance, { id: uid("a"), staffId, date, ...patch }],
          };
        }),
      /** Комментарий — единственное, что консультант может менять после сохранения */
      saveComment: (target: "bride" | "booking", id: string, notes: string) =>
        update((d) =>
          target === "bride"
            ? { ...d, brides: d.brides.map((b) => (b.id === id ? { ...b, notes } : b)) }
            : { ...d, bookings: d.bookings.map((b) => (b.id === id ? { ...b, notes } : b)) },
        ),
      sheet,
      open: (s: Sheet) => setSheet(s),
      closeSheet: () => setSheet(null),
      dialog,
      openDialog: (d: Dialog) => setDialog(d),
      closeDialog: () => setDialog(null),
      toasts,
      toast,

      saveBride: (input: Omit<Bride, "id" | "createdAt"> & { id?: string }) => {
        // upsert внутри update: запись могла быть создана в этом же действии и ещё не попасть в db
        const existing = input.id ? db.brides.find((b) => b.id === input.id) : undefined;
        const bride: Bride = { createdAt: today(), ...existing, ...input, id: input.id ?? uid("b") } as Bride;
        update((d) => ({
          ...d,
          brides: d.brides.some((b) => b.id === bride.id) ? d.brides.map((b) => (b.id === bride.id ? { ...b, ...bride } : b)) : [...d.brides, bride],
        }));
        return bride;
      },

      /** Возвратная невеста определяется автоматически: у неё уже был визит. Встречает её закреплённый консультант. */
      addVisit: (input: Omit<Visit, "id" | "returning" | "consultantId"> & { consultantId?: string }) => {
        const bride = db.brides.find((b) => b.id === input.brideId);
        const returning = db.visits.some((v) => v.brideId === input.brideId && v.date <= input.date);
        const visit: Visit = { ...input, id: uid("v"), returning, consultantId: bride?.consultantId ?? input.consultantId ?? me };
        update((d) => ({ ...d, visits: [...d.visits, visit].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) }));
        return visit;
      },
      updateVisit: (v: Visit) => update((d) => ({ ...d, visits: d.visits.map((x) => (x.id === v.id ? v : x)) })),

      createBooking: (
        input: Omit<Booking, "id" | "depositNo" | "status" | "log" | "createdBy" | "createdAt">,
        depositPay: { method: Payment["method"]; bank?: string },
      ) => {
        const booking: Booking = { ...input, id: uid("k"), depositNo: db.nextDepositNo, status: "booked", log: [], createdBy: me, createdAt: today() };
        update((d) => ({ ...d, bookings: [...d.bookings, booking], nextDepositNo: d.nextDepositNo + 1 }));
        if (input.deposit > 0) addPayment({ bookingId: booking.id, kind: "deposit", amount: input.deposit, date: today(), ...depositPay });
        return booking;
      },
      updateBooking: (b: Booking) => patchBooking(b.id, () => b),
      issueBooking: (id: string, balance: number, method: Payment["method"], bank?: string) => {
        const no = db.nextRentNo;
        patchBooking(id, (b) => ({ ...b, status: "issued", issuedAt: today(), rentNo: no }));
        update((d) => ({ ...d, nextRentNo: d.nextRentNo + 1 }));
        if (balance > 0) addPayment({ bookingId: id, kind: "balance", amount: balance, date: today(), method, bank });
        return no;
      },
      returnBooking: (id: string, opts: { fine?: { amount: number; reason: string; method: Payment["method"] }; cleaning: boolean }) => {
        const b = db.bookings.find((x) => x.id === id)!;
        patchBooking(id, (x) => ({ ...x, status: "returned", returnedAt: today() }));
        if (opts.fine && opts.fine.amount > 0)
          addPayment({ bookingId: id, kind: "fine", amount: opts.fine.amount, reason: opts.fine.reason, date: today(), method: opts.fine.method });
        if (opts.cleaning) update((d) => ({ ...d, cleanings: [...d.cleanings, { id: uid("c"), itemId: b.itemId, bookingId: id, sentAt: today() }] }));
      },
      refuseBooking: (id: string, reason: string) =>
        patchBooking(id, (b) => ({ ...b, status: "refused", refusedAt: today(), refuseReason: reason, log: [...b.log, { date: today(), text: `Отказ: ${reason}` }] })),
      moveBooking: (id: string, eventDate: string, issueDate: string, returnDate: string) =>
        patchBooking(id, (b) => ({
          ...b,
          eventDate,
          issueDate,
          returnDate,
          log: [...b.log, { date: today(), text: `Перенос даты с ${b.eventDate} на ${eventDate}` }],
        })),
      addPayment,
      confirmPayment: (id: string) =>
        update((d) => ({ ...d, payments: d.payments.map((p) => (p.id === id ? { ...p, confirmedAt: today() } : p)) })),

      sendCleaning: (itemId: string, note?: string) =>
        update((d) => ({ ...d, cleanings: [...d.cleanings, { id: uid("c"), itemId, sentAt: today(), note }] })),
      cleaningBack: (id: string) => update((d) => ({ ...d, cleanings: d.cleanings.map((c) => (c.id === id ? { ...c, backAt: today() } : c)) })),

      saveItem: (input: Omit<DressItem, "id"> & { id?: string }) => {
        const item: DressItem = { ...input, id: input.id ?? uid("i") };
        update((d) => ({ ...d, items: input.id ? d.items.map((x) => (x.id === item.id ? item : x)) : [...d.items, item] }));
        return item;
      },
      setRate: (cur: "EUR" | "USD", value: number) => update((d) => ({ ...d, rates: { ...d.rates, [cur]: value || undefined } })),
      saveSupplier: (input: Omit<Supplier, "id"> & { id?: string }) => {
        const s: Supplier = { ...input, id: input.id ?? uid("s") };
        update((d) => ({ ...d, suppliers: input.id ? d.suppliers.map((x) => (x.id === s.id ? s : x)) : [...d.suppliers, s] }));
        return s;
      },
      saveStaff: (input: Omit<Staff, "id"> & { id?: string }) => {
        const s: Staff = { ...input, id: input.id ?? uid("u") };
        update((d) => ({ ...d, staff: input.id ? d.staff.map((x) => (x.id === s.id ? s : x)) : [...d.staff, s] }));
        return s;
      },
      setAttendance: (a: Omit<Attendance, "id">) =>
        update((d) => {
          const ex = d.attendance.find((x) => x.staffId === a.staffId && x.date === a.date);
          return {
            ...d,
            attendance: ex ? d.attendance.map((x) => (x === ex ? { ...ex, ...a } : x)) : [...d.attendance, { ...a, id: uid("a") }],
          };
        }),

      /** Платье с историей снимается с проката (отчёты сохраняются), без истории — удаляется полностью */
      removeItem: (id: string): "archived" | "deleted" => {
        const used = db.bookings.some((b) => b.itemId === id) || db.cleanings.some((c) => c.itemId === id);
        const item = db.items.find((i) => i.id === id);
        if (used) {
          update((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, retired: true } : i)) }));
          return "archived";
        }
        deletePhoto(item?.photo);
        update((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
        return "deleted";
      },
      restoreItem: (id: string) => update((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, retired: false } : i)) })),
      /** Платья удаляемого поставщика переходят к другому поставщику или становятся «поставщик не указан» */
      removeSupplier: (id: string, moveTo: string) =>
        update((d) => ({
          ...d,
          items: d.items.map((i) => (i.supplierId === id ? { ...i, supplierId: moveTo } : i)),
          suppliers: d.suppliers.filter((s) => s.id !== id),
        })),
      /**
       * Сотрудник без истории удаляется полностью.
       * С историей — доступ закрывается, имя остаётся в старых записях и отчётах,
       * а его невесты переходят к другому консультанту.
       */
      removeStaff: (id: string, moveBridesTo?: string): "archived" | "deleted" => {
        const used =
          db.visits.some((v) => v.consultantId === id) ||
          db.bookings.some((b) => b.consultantId === id || b.createdBy === id) ||
          db.payments.some((p) => p.recordedBy === id);
        update((d) => {
          const brides = moveBridesTo ? d.brides.map((b) => (b.consultantId === id ? { ...b, consultantId: moveBridesTo } : b)) : d.brides;
          if (used) return { ...d, brides, staff: d.staff.map((s) => (s.id === id ? { ...s, active: false } : s)) };
          return { ...d, brides, staff: d.staff.filter((s) => s.id !== id), attendance: d.attendance.filter((a) => a.staffId !== id) };
        });
        return used ? "archived" : "deleted";
      },
      /** Пример данных за год — чтобы посмотреть отчёты. Учётные записи остаются как есть. */
      fillDemo: (): string | null => {
        try {
          const demo = createDemo(db.staff);
          setDb(demo);
          setSheet(null);
          setDialog(null);
          return null;
        } catch (e) {
          return e instanceof Error ? e.message : "Не получилось";
        }
      },
      /** Полная очистка: удаляются все невесты, записи, платья и поставщики; учётные записи остаются */
      /**
       * Табель к началу: все отметки и выходные удаляются, сотрудники — снова тестовые
       * (Администратор, Консультант 1–3 с исходными паролями). Невесты и записи не трогаем;
       * добавленные сотрудники, у которых уже есть записи, остаются в истории с закрытым доступом.
       */
      resetTabel: () =>
        update((d) => {
          const used = (id: string) =>
            d.visits.some((v) => v.consultantId === id) || d.bookings.some((b) => b.consultantId === id || b.createdBy === id) || d.payments.some((p) => p.recordedBy === id);
          const defaults = new Set(TEST_ACCOUNTS.map((s) => s.id));
          const owner = d.staff.find((s) => s.id === "u-owner");
          return {
            ...d,
            staff: [
              ...TEST_ACCOUNTS.map((s) => (s.id === "u-owner" && owner ? owner : { ...s })),
              ...d.staff.filter((s) => !defaults.has(s.id) && used(s.id)).map((s) => ({ ...s, active: false })),
            ],
            attendance: [],
          };
        }),
      clearAll: () => {
        setDb((d) => ({ ...createInitial(), staff: d?.staff ?? createInitial().staff }));
        clearPhotos();
        setSheet(null);
        setDialog(null);
      },
    };
  }, [db, userId, sheet, dialog, toasts, toast, update, kiosk]);
}

export type Store = NonNullable<ReturnType<typeof useStoreValue>>;

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const store = useStoreValue();
  if (!store) {
    return (
      <div className="boot" aria-busy="true">
        <span className="wordmark">LORI</span>
      </div>
    );
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
