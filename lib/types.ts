export type ID = string;
/** Календарная дата "YYYY-MM-DD" */
export type DateStr = string;

/* ---------- Люди ---------- */

export type Role = "owner" | "admin" | "employee";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Владелец",
  admin: "Администратор",
  employee: "Консультант",
};

export const MAX_EMPLOYEES = 30;

/** login + password — в прототипе хранятся в браузере; в рабочей версии пароль только в виде хэша на сервере */
export type Staff = { id: ID; name: string; role: Role; active: boolean; phone?: string; login: string; password: string };

/** Табель: кто во сколько пришёл и ушёл (видят владелец и администратор) */
export type Attendance = { id: ID; staffId: ID; date: DateStr; in?: string; out?: string; dayOff?: boolean };

/* ---------- Платья ---------- */

/** Видно только владельцу */
export type Supplier = { id: ID; name: string; phone?: string };

/** Конкретный экземпляр платья. Одна модель может прийти от разных поставщиков. */
export type DressItem = {
  id: ID;
  model: string;
  size: string;
  supplierId: ID; // только владелец; "" — не указан
  purchasePrice: number; // закупка, только владелец
  cost: number; // «стоимость платья» из договора — для компенсации ущерба
  rentPrice: number; // базовая цена проката
  receivedAt: DateStr;
  photo?: string; // "idb:<id>" — фото, загруженное с устройства
  retired?: boolean; // снято с проката: в списках не видно, в отчётах история сохраняется
};

/* ---------- Невесты и визиты ---------- */

export type Bride = {
  id: ID;
  name: string;
  phones: string[];
  eventDate?: DateStr;
  consultantId: ID; // закрепляется при первом визите, возвратную встречает тот же консультант
  createdAt: DateStr;
  birthDate?: DateStr;
  passport?: string;
  address?: string;
  notes: string;
};

/** «Зашли»: каждый приход невесты в салон */
export type Visit = {
  id: ID;
  brideId: ID;
  date: DateStr;
  time: string;
  consultantId: ID;
  tried: boolean; // «Примерка»
  dressIds: ID[];
  returning: boolean; // «Возвратная» — уже была в салоне раньше
  notes: string;
};

/* ---------- Договор ---------- */

/** booked — договор на залог; issued — выдано по договору аренды; returned — принято; refused — отказ, залог остаётся салону */
export type BookingStatus = "booked" | "issued" | "returned" | "refused";

export type Accessory = { name: string; price: number };

export type Booking = {
  id: ID;
  depositNo: number; // № договора на залог
  rentNo?: number; // № договора на аренду, появляется при выдаче
  brideId: ID;
  consultantId: ID;
  itemId: ID;
  createdAt: DateStr; // «Запись»
  eventDate: DateStr;
  issueDate: DateStr;
  returnDate: DateStr;
  rentPrice: number; // «Сумма»
  deposit: number; // «Залог», не возвращается при отказе
  extra: number; // «Доп»
  accessories: Accessory[];
  veil?: string;
  tasks: string[]; // подгонка: «пришить пуговицы», «вставка» и т. п.
  status: BookingStatus;
  issuedAt?: DateStr;
  returnedAt?: DateStr;
  refusedAt?: DateStr;
  refuseReason?: string;
  log: { date: DateStr; text: string }[]; // переносы даты и прочие отметки
  createdBy: ID;
  notes?: string; // комментарий — консультант может дописывать после сохранения
};

/* ---------- Деньги ---------- */

export type PaymentKind = "deposit" | "balance" | "extra" | "fine";
export type PayMethod = "cash" | "transfer";

export const PAY_KIND_LABEL: Record<PaymentKind, string> = {
  deposit: "Залог",
  balance: "Остаток",
  extra: "Доп",
  fine: "Штраф",
};

export type Payment = {
  id: ID;
  bookingId: ID;
  kind: PaymentKind;
  amount: number;
  date: DateStr;
  method: PayMethod;
  bank?: string;
  reason?: string; // для штрафа: «не принесли вешалку»
  recordedBy: ID;
  confirmedAt?: DateStr; // подпись владельца
};

export type Cleaning = { id: ID; itemId: ID; bookingId?: ID; sentAt: DateStr; backAt?: DateStr; note?: string };

export type DB = {
  version: 3;
  demo?: boolean; // в базе пример данных, а не реальная работа салона
  salonDevice?: string; // устройство салона: только с него консультанты входят и отмечают приход/уход
  staff: Staff[];
  attendance: Attendance[];
  suppliers: Supplier[];
  items: DressItem[];
  brides: Bride[];
  visits: Visit[];
  bookings: Booking[];
  payments: Payment[];
  cleanings: Cleaning[];
  nextDepositNo: number;
  nextRentNo: number;
};
