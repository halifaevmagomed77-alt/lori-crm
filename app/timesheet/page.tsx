"use client";

import { useState } from "react";
import { PageHead } from "@/components/Shell";
import { Chip, Icon } from "@/components/ui";
import { addDays, fmtDay, fmtShort, today, weekday } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { Attendance } from "@/lib/types";

/** Часы между «пришла» и «ушла», например «8 ч 30 мин» */
function hours(a?: Attendance) {
  if (!a?.in || !a.out) return "";
  const [h1, m1] = a.in.split(":").map(Number);
  const [h2, m2] = a.out.split(":").map(Number);
  const min = h2 * 60 + m2 - (h1 * 60 + m1);
  if (min <= 0) return "";
  return `${Math.floor(min / 60)} ч${min % 60 ? ` ${min % 60} мин` : ""}`;
}

export default function TimesheetPage() {
  const { can, user } = useStore();
  return (
    <div className="page">
      {can("attendance") && <Table />}
      {user?.role !== "owner" && <CheckIn />}
      {can("manageStaff") && <SalonDevice />}
    </div>
  );
}

/** Отметка консультанта: два раза в день — пришла и ушла, только с устройства салона */
function CheckIn() {
  const { db, user, isSalonDevice, salonDeviceSet, checkIn, toast } = useStore();
  const a = db.attendance.find((x) => x.staffId === user?.id && x.date === today());
  const history = db.attendance
    .filter((x) => x.staffId === user?.id && x.date < today() && x.date >= addDays(today(), -14))
    .sort((x, y) => y.date.localeCompare(x.date));
  const wd = weekday(today());

  return (
    <>
      <PageHead title="Отметка" sub={`${fmtDay(today())}, ${wd}`} />
      <section className="paper checkin">
        <div className="checkin-row">
          <div className="checkin-cell">
            <span className="checkin-label">Пришла</span>
            <span className="checkin-time">{a?.in ?? "—"}</span>
          </div>
          <div className="checkin-cell">
            <span className="checkin-label">Ушла</span>
            <span className="checkin-time">{a?.out ?? "—"}</span>
          </div>
        </div>
        {isSalonDevice ? (
          a?.dayOff ? (
            <p className="muted">Сегодня у вас выходной.</p>
          ) : !a?.in ? (
            <button
              type="button"
              className="btn btn-block checkin-btn"
              onClick={() => {
                checkIn("in");
                toast("Отмечено: пришла");
              }}
            >
              <Icon name="door" size={20} /> Я пришла
            </button>
          ) : !a.out ? (
            <button
              type="button"
              className="btn btn-block btn-ghost checkin-btn"
              onClick={() => {
                checkIn("out");
                toast("Отмечено: ушла");
              }}
            >
              <Icon name="logout" size={20} /> Я ушла
            </button>
          ) : (
            <p className="muted">На сегодня всё отмечено · {hours(a)}</p>
          )
        ) : (
          <p className="callout callout-info">
            <Icon name="alert" size={18} />
            {salonDeviceSet
              ? "Отметиться можно только с устройства салона."
              : "Владелец ещё не выбрал устройство салона. Отметки заработают после этого."}
          </p>
        )}
      </section>
      {history.length > 0 && (
        <section className="panel checkin-history">
          <h2 className="section-label">Последние две недели</h2>
          <ul className="mini-list">
            {history.map((h) => (
              <li key={h.id} className="mini-row is-static">
                <span>{fmtShort(h.date)}</span>
                <span className="tabular">{h.dayOff ? "выходной" : `${h.in ?? "—"} – ${h.out ?? "—"}`}</span>
                <span className="muted small">{hours(h)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Табель всех сотрудников: видят владелец и администратор */
function Table() {
  const { db, can, setAttendance } = useStore();
  const [date, setDate] = useState(today());
  const team = db.staff.filter((s) => s.role !== "owner" && s.active);
  const day = db.attendance.filter((a) => a.date === date);
  const onShift = day.filter((a) => a.in && !a.dayOff).length;
  const month = addDays(today(), -29);

  return (
    <>
      <PageHead title="Табель" sub={`На смене ${onShift} из ${team.length}`} />
      <div className="date-bar date-bar-inline">
        <button type="button" className="icon-btn" aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>
          <Icon name="chevronL" />
        </button>
        <label className="date-pick">
          <span className="date-big">{fmtDay(date)}</span>
          <span className="date-wd">
            {weekday(date)}
            {date === today() && " · сегодня"}
          </span>
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Выбрать дату" />
        </label>
        <button type="button" className="icon-btn" aria-label="Следующий день" disabled={date >= today()} onClick={() => setDate(addDays(date, 1))}>
          <Icon name="chevronR" />
        </button>
      </div>

      <div className="paper timesheet">
        <table className="attendance">
          <thead>
            <tr>
              <th scope="col">Сотрудник</th>
              <th scope="col">Пришла</th>
              <th scope="col">Ушла</th>
              <th scope="col">Часов</th>
            </tr>
          </thead>
          <tbody>
            {team.map((st) => {
              const a = day.find((x) => x.staffId === st.id);
              const set = (patch: Partial<Attendance>) =>
                setAttendance({ staffId: st.id, date, in: a?.in, out: a?.out, dayOff: a?.dayOff, ...patch });
              return (
                <tr key={st.id} className={a?.dayOff ? "is-off" : undefined}>
                  <th scope="row">{st.name}</th>
                  {a?.dayOff ? (
                    <td colSpan={3} className="off">
                      выходной{" "}
                      <button type="button" className="link-btn small" onClick={() => set({ dayOff: false })}>
                        отменить
                      </button>
                    </td>
                  ) : (
                    <>
                      <td>
                        <input type="time" className="time-cell" value={a?.in ?? ""} onChange={(e) => set({ in: e.target.value, dayOff: false })} aria-label={`${st.name}: пришла`} />
                      </td>
                      <td>
                        <input type="time" className="time-cell" value={a?.out ?? ""} onChange={(e) => set({ out: e.target.value })} aria-label={`${st.name}: ушла`} />
                      </td>
                      <td className="tabular small">
                        {hours(a) ||
                          (!a?.in && (
                            <button type="button" className="link-btn small" onClick={() => set({ dayOff: true, in: undefined, out: undefined })}>
                              выходной
                            </button>
                          ))}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">Консультанты отмечаются сами с устройства салона. Здесь время можно поправить вручную.</p>
      </div>

      <section className="panel">
        <h2 className="section-label">Смен за 30 дней</h2>
        <ul className="cons-lines">
          {team.map((st) => {
            const n = db.attendance.filter((a) => a.staffId === st.id && a.in && !a.dayOff && a.date >= month).length;
            return (
              <li key={st.id}>
                <span>{st.name}</span>
                <span className="tabular">{n}</span>
                <span />
              </li>
            );
          })}
        </ul>
        {!can("manageStaff") && <p className="muted small">Добавлять и удалять сотрудников может владелец.</p>}
      </section>
    </>
  );
}

/** Владелец выбирает устройство салона — только с него консультанты входят и отмечаются */
function SalonDevice() {
  const { isSalonDevice, salonDeviceSet, setSalonDevice, toast } = useStore();
  return (
    <section className="panel salon-device">
      <h2 className="panel-title">Устройство салона</h2>
      <p className="small">
        Консультанты входят в CRM и отмечают «пришла / ушла» только с одного устройства — телефона или планшета, который лежит в салоне. Откройте CRM на нём под владельцем и нажмите кнопку ниже.
      </p>
      <p>
        {isSalonDevice ? (
          <Chip tone="good">Это устройство — устройство салона</Chip>
        ) : salonDeviceSet ? (
          <Chip tone="warn">Выбрано другое устройство</Chip>
        ) : (
          <Chip>Устройство салона не выбрано</Chip>
        )}
      </p>
      <div className="inline-row">
        {!isSalonDevice && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSalonDevice(true);
              toast("Это устройство стало устройством салона");
            }}
          >
            Сделать это устройство устройством салона
          </button>
        )}
        {salonDeviceSet && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSalonDevice(false);
              toast("Привязка снята: консультанты могут входить с любого устройства");
            }}
          >
            Снять привязку
          </button>
        )}
      </div>
    </section>
  );
}
