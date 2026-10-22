import type { DateStr } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s: DateStr): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today(): DateStr {
  return toDateStr(new Date());
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);
}

export function startOfWeek(s: DateStr): DateStr {
  const d = parseDate(s);
  const wd = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - wd);
  return toDateStr(d);
}

export function startOfMonth(s: DateStr): DateStr {
  return s.slice(0, 8) + "01";
}

export function addMonths(s: DateStr, n: number): DateStr {
  const d = parseDate(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toDateStr(d);
}

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

/** 22 октября */
export function fmtDay(s: DateStr): string {
  const d = parseDate(s);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

/** 22 октября 2026, год только если не текущий */
export function fmtDate(s: DateStr): string {
  const d = parseDate(s);
  const y = d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${y}`;
}

export function fmtShort(s: DateStr): string {
  const d = parseDate(s);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function fmtMonth(s: DateStr, withYear = false): string {
  const d = parseDate(s);
  return MONTHS_NOM[d.getMonth()] + (withYear ? ` ${d.getFullYear()}` : "");
}

export function monthShort(s: DateStr): string {
  return MONTHS_SHORT[parseDate(s).getMonth()];
}

export function weekday(s: DateStr): string {
  return WEEKDAYS[parseDate(s).getDay()];
}

export function weekdayShort(s: DateStr): string {
  return WEEKDAYS_SHORT[parseDate(s).getDay()];
}

/** «сегодня», «завтра», «через 5 дней», «3 дня назад» */
export function relDay(s: DateStr, from: DateStr = today()): string {
  const n = diffDays(s, from);
  if (n === 0) return "сегодня";
  if (n === 1) return "завтра";
  if (n === -1) return "вчера";
  if (n > 0) return `через ${n} ${plural(n, "день", "дня", "дней")}`;
  return `${-n} ${plural(-n, "день", "дня", "дней")} назад`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const TIME_SLOTS = (() => {
  const out: string[] = [];
  for (let h = 10; h <= 18; h++) {
    out.push(`${pad(h)}:00`);
    if (h < 18) out.push(`${pad(h)}:30`);
  }
  return out;
})();
