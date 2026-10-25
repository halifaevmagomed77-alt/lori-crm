import type { DB, Staff } from "./types";

/**
 * Чистая база «из коробки»: только тестовые учётные записи.
 * Владелец меняет имена и пароли в разделе «Сотрудники».
 */
export const TEST_ACCOUNTS: Staff[] = [
  { id: "u-owner", name: "Владелец", role: "owner", active: true, login: "owner", password: "lori-owner" },
  { id: "u-admin", name: "Администратор", role: "admin", active: true, login: "admin", password: "lori-admin" },
  { id: "u-c1", name: "Консультант 1", role: "employee", active: true, login: "cons1", password: "lori-1" },
  { id: "u-c2", name: "Консультант 2", role: "employee", active: true, login: "cons2", password: "lori-2" },
  { id: "u-c3", name: "Консультант 3", role: "employee", active: true, login: "cons3", password: "lori-3" },
];

export function createInitial(): DB {
  return {
    version: 3,
    staff: TEST_ACCOUNTS.map((s) => ({ ...s })),
    attendance: [],
    suppliers: [],
    items: [],
    brides: [],
    visits: [],
    bookings: [],
    payments: [],
    cleanings: [],
    nextDepositNo: 1,
    nextRentNo: 1,
  };
}
