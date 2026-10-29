"use client";

import { useMemo, useState } from "react";
import { addDays, diffDays, fmtDate, fmtShort, today } from "@/lib/dates";
import { idx, isOverdue, itemConflict, itemState, paid, rub, shortName } from "@/lib/derive";
import { deletePhoto, savePhoto, usePhoto } from "@/lib/photos";
import { useStore } from "@/lib/store";
import { CURRENCIES, MAX_EMPLOYEES, ROLE_LABEL, type Booking, type Bride, type Currency, type DressItem, type Payment, type Role, type Staff } from "@/lib/types";
import { FeedbackForm } from "./Demo";
import { Field, Icon, Modal, Segmented } from "./ui";

export function DialogHost() {
  const { dialog, closeDialog } = useStore();
  if (!dialog) return null;
  const close = closeDialog;
  switch (dialog.kind) {
    case "visit":
      return <VisitForm key="v" brideId={dialog.brideId} date={dialog.date} startMode={dialog.mode} onClose={close} />;
    case "booking":
      return <BookingForm key="b" {...dialog} onClose={close} />;
    case "issue":
      return <IssueForm key="i" bookingId={dialog.bookingId} onClose={close} />;
    case "return":
      return <ReturnForm key="r" bookingId={dialog.bookingId} onClose={close} />;
    case "refuse":
      return <RefuseForm key="x" bookingId={dialog.bookingId} onClose={close} />;
    case "move":
      return <MoveForm key="m" bookingId={dialog.bookingId} onClose={close} />;
    case "payment":
      return <PaymentForm key="p" bookingId={dialog.bookingId} kind={dialog.paymentKind} onClose={close} />;
    case "bride":
      return <BrideForm key="br" bride={dialog.bride} onClose={close} />;
    case "item":
      return <ItemForm key="it" item={dialog.item} onClose={close} />;
    case "staff":
      return <StaffForm key="st" staff={dialog.staff} onClose={close} />;
    case "feedback":
      return <FeedbackForm key="fb" onClose={close} />;
    case "comment":
      return <CommentForm key="cm" target={dialog.target} id={dialog.id} onClose={close} />;
  }
}

/* ---------- Комментарий: консультант может дописать после сохранения ---------- */

function CommentForm({ target, id, onClose }: { target: "bride" | "booking"; id: string; onClose: () => void }) {
  const { db, saveComment, toast } = useStore();
  const current = target === "bride" ? db.brides.find((b) => b.id === id)?.notes : db.bookings.find((b) => b.id === id)?.notes;
  const [text, setText] = useState(current ?? "");
  return (
    <Modal
      title="Комментарий"
      onClose={onClose}
      footer={
        <Foot
          onClose={onClose}
          label="Сохранить"
          onSubmit={() => {
            saveComment(target, id, text.trim());
            toast("Комментарий сохранён");
            onClose();
          }}
        />
      }
    >
      <Field label={target === "bride" ? "Комментарий к невесте" : "Комментарий к записи"}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus />
      </Field>
    </Modal>
  );
}

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function Foot({ onClose, label, onSubmit, danger }: { onClose: () => void; label: string; onSubmit: () => void; danger?: boolean }) {
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={onClose}>
        Отмена
      </button>
      <button type="button" className={`btn${danger ? " btn-red" : ""}`} onClick={onSubmit}>
        {label}
      </button>
    </>
  );
}

function MethodPicker({ method, setMethod, bank, setBank }: { method: Payment["method"]; setMethod: (m: Payment["method"]) => void; bank: string; setBank: (b: string) => void }) {
  return (
    <div className="grid-2">
      <Field group label="Как оплатили">
        <Segmented
          label="Способ оплаты"
          value={method}
          onChange={setMethod}
          options={[
            { value: "cash", label: "Наличные" },
            { value: "transfer", label: "Перевод" },
          ]}
        />
      </Field>
      {method === "transfer" && (
        <Field label="Банк">
          <select value={bank} onChange={(e) => setBank(e.target.value)}>
            {["ВТБ", "Сбер", "Т-Банк", "Другой"].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}

/* ---------- Поиск невесты ---------- */

function BridePicker({ value, onChange }: { value?: string; onChange: (id?: string) => void }) {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const selected = value ? idx(db).bride.get(value) : undefined;
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const digits = s.replace(/\D/g, "");
    return db.brides
      .filter((b) => b.name.toLowerCase().includes(s) || (digits.length >= 4 && b.phones.some((p) => p.replace(/\D/g, "").includes(digits))))
      .slice(0, 6);
  }, [db.brides, q]);

  if (selected) {
    const cons = idx(db).staff.get(selected.consultantId);
    return (
      <div className="picked">
        <div>
          <p className="picked-name">{selected.name}</p>
          <p className="muted small">
            {selected.phones[0]} · консультант {cons?.name}
          </p>
        </div>
        <button type="button" className="link-btn" onClick={() => onChange(undefined)}>
          Изменить
        </button>
      </div>
    );
  }
  return (
    <div className="combo">
      <div className="search-input">
        <Icon name="search" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Фамилия, имя или телефон" aria-label="Найти невесту" autoFocus />
      </div>
      {results.length > 0 && (
        <ul className="combo-list">
          {results.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => onChange(b.id)}>
                <span>{b.name}</span>
                <span className="muted small">{b.phones[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Выбор модели / экземпляра ---------- */

export function ItemPicker({
  selected,
  onToggle,
  multi,
  from,
  to,
  ignoreBooking,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  multi?: boolean;
  from?: string;
  to?: string;
  ignoreBooking?: string;
}) {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const list = db.items.filter((i) => !i.retired && i.model.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.model.localeCompare(b.model));
  return (
    <div className="dress-picker">
      <div className="search-input">
        <Icon name="search" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название платья" aria-label="Найти платье" />
      </div>
      <ul className="dress-pick-grid">
        {list.map((i) => {
          const on = selected.includes(i.id);
          const conflict = from && to ? itemConflict(db, i.id, from, to, ignoreBooking) : undefined;
          const cleaning = !conflict && db.cleanings.some((c) => c.itemId === i.id && !c.backAt);
          return (
            <li key={i.id}>
              <button
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={on}
                className={`dress-pick${on ? " is-on" : ""}${conflict ? " is-busy" : ""}`}
                onClick={() => onToggle(i.id)}
              >
                <span className="dress-pick-img">
                  <DressPhoto src={i.photo} />
                  {on && (
                    <span className="dress-pick-check">
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </span>
                <span className="dress-pick-name">{i.model}</span>
                <span className="dress-pick-meta">
                  {conflict
                    ? `занято ${fmtShort(conflict.issueDate)}–${fmtShort(conflict.returnDate)}`
                    : `р. ${i.size} · ${rub(i.rentPrice)}${cleaning ? " · в химчистке" : ""}`}
                </span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="muted small">{db.items.length ? "Ничего не нашлось" : "Платьев пока нет — владелец добавляет их в «Редактор → Платья» → «Поступление»"}</li>
        )}
      </ul>
    </div>
  );
}

/* ---------- Новая запись: невеста пришла в салон (или онлайн — сразу договор) ---------- */

/** Один переключатель для всех трёх вариантов «Новой записи» — и в визите, и в онлайн-договоре */
function NewRecordSwitch({ value, onChange }: { value: "new" | "known" | "online"; onChange: (v: "new" | "known" | "online") => void }) {
  return (
    <Segmented
      label="Невеста"
      value={value}
      onChange={onChange}
      options={[
        { value: "new", label: "Первый раз" },
        { value: "known", label: "Уже была (возвратная)" },
        { value: "online", label: "Онлайн, без визита" },
      ]}
    />
  );
}

function VisitForm({ brideId, date, startMode, onClose }: { brideId?: string; date?: string; startMode?: "new" | "known"; onClose: () => void }) {
  const { db, user, addVisit, saveBride, toast, openDialog, can } = useStore();
  const I = idx(db);
  const consultants = db.staff.filter((s) => s.role === "employee" && s.active);
  const [mode, setMode] = useState<"new" | "known" | "online">(brideId ? "known" : startMode ?? "new");
  const [picked, setPicked] = useState<string | undefined>(brideId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [event, setEvent] = useState("");
  const [consultant, setConsultant] = useState(user?.role === "employee" ? user.id : consultants[0]?.id ?? "");
  const [tried, setTried] = useState(true);
  const [dresses, setDresses] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [d, setD] = useState(date ?? today());
  const [t, setT] = useState(nowTime());
  const [tried2, setTried2] = useState(false);
  const [thenBook, setThenBook] = useState(false);

  // защита от дублей: такой телефон уже есть в базе
  const digits = phone.replace(/\D/g, "").slice(-10);
  const dup = mode === "new" && digits.length >= 10 ? db.brides.find((b) => b.phones.some((p) => p.replace(/\D/g, "").endsWith(digits))) : undefined;

  const pickedBride = picked ? I.bride.get(picked) : undefined;
  const pickedCons = pickedBride ? I.staff.get(pickedBride.consultantId) : undefined;

  const submit = () => {
    setTried2(true);
    let bId = picked;
    if (mode === "new") {
      if (!name.trim() || !phone.trim() || dup) return;
      bId = saveBride({ name: name.trim(), phones: [phone.trim(), phone2.trim()].filter(Boolean), eventDate: event || undefined, consultantId: consultant, notes: "" }).id;
    }
    if (!bId) return;
    const v = addVisit({ brideId: bId, date: d, time: t, tried, dressIds: tried ? dresses : [], notes, consultantId: consultant });
    toast(mode === "known" ? `Возвратная невеста · консультант ${pickedCons?.name ?? ""}` : "Визит записан");
    if (thenBook) openDialog({ kind: "booking", brideId: bId, visitId: v.id });
    else onClose();
  };

  return (
    <Modal title="Новая запись" onClose={onClose} wide footer={<Foot onClose={onClose} label={thenBook ? "Дальше: договор на залог" : "Сохранить визит"} onSubmit={submit} />}>
      <NewRecordSwitch
        value={mode}
        onChange={(m) => {
          // онлайн-запись без визита — сразу договор на залог
          if (m === "online") return openDialog({ kind: "booking", online: true });
          setMode(m);
          setPicked(undefined);
        }}
      />

      {mode === "known" ? (
        <Field group label="Найти невесту" error={tried2 && !picked ? "Выберите невесту" : undefined}>
          <BridePicker value={picked} onChange={setPicked} />
          {pickedCons && (
            <p className="callout callout-info">
              <Icon name="user" size={18} /> Встречает её консультант: <strong>{pickedCons.name}</strong>
            </p>
          )}
        </Field>
      ) : (
        <>
          <Field label="Фамилия, имя, отчество" error={tried2 && !name.trim() ? "Укажите имя" : undefined}>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid-2">
            <Field label="Телефон" error={tried2 && !phone.trim() ? "Укажите телефон" : undefined}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="8 9__ ___ __ __" />
            </Field>
            <Field label="Второй телефон">
              <input value={phone2} onChange={(e) => setPhone2(e.target.value)} inputMode="tel" />
            </Field>
          </div>
          {dup && (
            <p className="callout callout-info" role="alert">
              <Icon name="alert" size={18} />
              <span>
                Этот номер уже есть: <strong>{dup.name}</strong>, консультант {I.staff.get(dup.consultantId)?.name}.{" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setMode("known");
                    setPicked(dup.id);
                  }}
                >
                  Это она — отметить как возвратную
                </button>
              </span>
            </p>
          )}
          <div className="grid-2">
            <Field label="Дата свадьбы">
              <input type="date" value={event} onChange={(e) => setEvent(e.target.value)} />
            </Field>
            <Field label="Консультант" hint="Невеста закрепится за ним">
              <select value={consultant} onChange={(e) => setConsultant(e.target.value)} disabled={user?.role === "employee"}>
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </>
      )}

      <label className="check">
        <input type="checkbox" checked={tried} onChange={(e) => setTried(e.target.checked)} />
        <span>Примеряла платья</span>
      </label>
      {tried && (
        <Field group label="Какие платья мерила" hint="Необязательно, но помогает понять, какие модели нравятся">
          <ItemPicker multi selected={dresses} onToggle={(id) => setDresses((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
        </Field>
      )}
      <div className="grid-2">
        <Field label="Дата">
          <input type="date" value={d} onChange={(e) => setD(e.target.value)} max={today()} disabled={!can("editAll")} />
        </Field>
        <Field label="Время">
          <input type="time" value={t} onChange={(e) => setT(e.target.value)} />
        </Field>
      </div>
      <Field label="Комментарий">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Например: понравилась модель с кружевом, придёт с мамой" />
      </Field>
      <label className="check">
        <input type="checkbox" checked={thenBook} onChange={(e) => setThenBook(e.target.checked)} />
        <span>Невеста вносит залог — оформить договор</span>
      </label>
    </Modal>
  );
}

/* ---------- Запись: договор на залог ---------- */

const ACC = ["Корона", "Серьги", "Обувь", "Фата", "Прочее"];

function BookingForm({
  brideId,
  visitId,
  itemId,
  booking,
  online: startOnline,
  onClose,
}: {
  brideId?: string;
  visitId?: string;
  itemId?: string;
  booking?: Booking;
  online?: boolean;
  onClose: () => void;
}) {
  const { db, user, createBooking, updateBooking, toast, open, openDialog, saveBride, can } = useStore();
  const I = idx(db);
  const visit = visitId ? db.visits.find((v) => v.id === visitId) : undefined;
  const consultants = db.staff.filter((s) => s.role === "employee" && s.active);
  const [bride, setBride] = useState<string | undefined>(booking?.brideId ?? brideId);
  const [online, setOnline] = useState(!!startOnline);
  const [nbName, setNbName] = useState("");
  const [nbPhone, setNbPhone] = useState("");
  const [nbCons, setNbCons] = useState(user?.role === "employee" ? user.id : consultants[0]?.id ?? "");
  const b = bride ? I.bride.get(bride) : undefined;
  const [item, setItem] = useState<string | undefined>(booking?.itemId ?? itemId ?? visit?.dressIds[0]);
  const it = item ? I.item.get(item) : undefined;
  const [event, setEvent] = useState(booking?.eventDate ?? b?.eventDate ?? addDays(today(), 30));
  const [issue, setIssue] = useState(booking?.issueDate ?? addDays(event, -1));
  const [ret, setRet] = useState(booking?.returnDate ?? addDays(event, 1));
  const [rent, setRent] = useState(String(booking?.rentPrice ?? it?.rentPrice ?? ""));
  const [deposit, setDeposit] = useState(String(booking?.deposit ?? ""));
  const [extra, setExtra] = useState(String(booking?.extra ?? 0));
  const [acc, setAcc] = useState<string[]>(booking?.accessories.map((a) => a.name) ?? []);
  const [veil, setVeil] = useState(booking?.veil ?? "");
  const [tasks, setTasks] = useState((booking?.tasks ?? []).join("\n"));
  const [method, setMethod] = useState<Payment["method"]>("cash");
  const [bank, setBank] = useState("ВТБ");
  const [passport, setPassport] = useState(b?.passport ?? "");
  const [birth, setBirth] = useState(b?.birthDate ?? "");
  const [address, setAddress] = useState(b?.address ?? "");
  const [tried, setTried] = useState(false);

  const conflict = item ? itemConflict(db, item, issue, ret, booking?.id) : undefined;
  const conflictBride = conflict ? I.bride.get(conflict.brideId) : undefined;

  /* ---- защита от двойных записей ---- */
  // онлайн-невеста с телефоном, который уже есть в базе
  const nbDigits = nbPhone.replace(/\D/g, "").slice(-10);
  const nbDup = online && !booking && nbDigits.length >= 10 ? db.brides.find((x) => x.phones.some((p) => p.replace(/\D/g, "").endsWith(nbDigits))) : undefined;
  // у этой невесты уже есть действующая запись
  const selBrideId = online && !booking ? nbDup?.id : bride;
  const activeOther = selBrideId
    ? db.bookings.find((k) => k.brideId === selBrideId && k.id !== booking?.id && (k.status === "booked" || k.status === "issued"))
    : undefined;
  // платье сейчас в химчистке, а выдача скоро
  const inCleaning = item ? db.cleanings.find((c) => c.itemId === item && !c.backAt) : undefined;
  const cleaningRisk = inCleaning && issue <= addDays(today(), 3);
  // даты в прошлом — только для новой записи
  const pastIssue = !booking && issue < today();
  const pastEvent = !booking && event < today();

  const setEventDate = (v: string) => {
    setEvent(v);
    setIssue(addDays(v, -1));
    setRet(addDays(v, 1));
  };
  const pickItem = (id: string) => {
    setItem(id);
    const x = I.item.get(id);
    if (x && !booking) setRent(String(x.rentPrice));
  };

  const submit = () => {
    setTried(true);
    if (!item || !rent || !deposit || conflict || ret < issue || pastIssue || pastEvent) return;
    let sel = b;
    if (online && !booking) {
      if (!nbName.trim() || !nbPhone.trim() || nbDup) return;
      sel = saveBride({ name: nbName.trim(), phones: [nbPhone.trim()], eventDate: event, consultantId: nbCons, notes: "Онлайн-запись без визита в салон" });
    }
    if (!sel) return;
    const contractData = { passport: passport || undefined, birthDate: birth || undefined, address: address || undefined };
    if (passport !== (sel.passport ?? "") || birth !== (sel.birthDate ?? "") || address !== (sel.address ?? "") || sel.eventDate !== event)
      saveBride({ ...sel, ...contractData, eventDate: booking ? sel.eventDate : event });
    const data = {
      brideId: sel.id,
      consultantId: booking?.consultantId ?? sel.consultantId,
      itemId: item,
      eventDate: event,
      issueDate: issue,
      returnDate: ret,
      rentPrice: Number(rent),
      deposit: Number(deposit),
      extra: Number(extra) || 0,
      accessories: acc.map((name) => ({ name, price: 0 })),
      veil: veil || undefined,
      tasks: tasks
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (booking) {
      updateBooking({ ...booking, ...data });
      toast("Запись изменена");
      onClose();
    } else {
      const k = createBooking(data, { method, bank: method === "transfer" ? bank : undefined });
      toast(`Записана · договор на залог № ${k.depositNo}`);
      onClose();
      open({ kind: "booking", id: k.id });
    }
  };

  const cons = b ? I.staff.get(b.consultantId) : undefined;

  return (
    <Modal
      title={booking ? `Запись № ${booking.depositNo}` : startOnline ? "Новая запись" : "Запись: договор на залог"}
      onClose={onClose}
      wide
      footer={<Foot onClose={onClose} label={booking ? "Сохранить" : `Записать, залог ${deposit ? rub(Number(deposit)) : ""}`} onSubmit={submit} />}
    >
      {!booking && startOnline && (
        <NewRecordSwitch value="online" onChange={(m) => m !== "online" && openDialog({ kind: "visit", mode: m })} />
      )}
      {!booking && !startOnline && (
        <Segmented
          label="Как записалась"
          value={online ? "online" : "salon"}
          onChange={(v) => {
            setOnline(v === "online");
            setBride(undefined);
          }}
          options={[
            { value: "salon", label: "Была в салоне" },
            { value: "online", label: "Онлайн, без визита" },
          ]}
        />
      )}
      {online && !booking ? (
        <div className="grid-3">
          <Field label="ФИО невесты" error={tried && !nbName.trim() ? "Укажите имя" : undefined}>
            <input value={nbName} onChange={(e) => setNbName(e.target.value)} autoFocus />
          </Field>
          <Field label="Телефон" error={tried && !nbPhone.trim() ? "Укажите телефон" : undefined}>
            <input value={nbPhone} onChange={(e) => setNbPhone(e.target.value)} inputMode="tel" />
          </Field>
          {nbDup && (
            <p className="callout callout-info grid-span" role="alert">
              <Icon name="alert" size={18} />
              <span>
                Этот номер уже есть: <strong>{nbDup.name}</strong>, консультант {I.staff.get(nbDup.consultantId)?.name}.{" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setOnline(false);
                    setBride(nbDup.id);
                  }}
                >
                  Это она — записать её
                </button>
              </span>
            </p>
          )}
          <Field label="Консультант">
            <select value={nbCons} onChange={(e) => setNbCons(e.target.value)} disabled={user?.role === "employee"}>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : (
        <Field group label="Невеста" error={tried && !bride ? "Выберите невесту или переключите на онлайн-запись" : undefined}>
          {booking ? <p className="picked-name">{b?.name}</p> : <BridePicker value={bride} onChange={setBride} />}
          {cons && <p className="field-hint">Консультант: {cons.name}{user?.id !== cons.id ? "" : " (вы)"}</p>}
        </Field>
      )}
      <div className="grid-3">
        <Field label="Дата мероприятия" error={pastEvent ? "Дата уже прошла" : undefined}>
          <input type="date" value={event} onChange={(e) => setEventDate(e.target.value)} />
        </Field>
        <Field label="Выдача" error={pastIssue ? "Дата уже прошла" : undefined}>
          <input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />
        </Field>
        <Field label="Возврат" error={ret < issue ? "Раньше выдачи" : undefined}>
          <input type="date" value={ret} min={issue} onChange={(e) => setRet(e.target.value)} />
        </Field>
      </div>
      <Field group label="Платье" error={tried && !item ? "Выберите платье" : undefined}>
        <ItemPicker selected={item ? [item] : []} onToggle={pickItem} from={issue} to={ret} ignoreBooking={booking?.id} />
      </Field>
      {conflict && (
        <p className="callout callout-bad" role="alert">
          <Icon name="alert" size={18} />
          Этот экземпляр занят с {fmtDate(conflict.issueDate)} по {fmtDate(conflict.returnDate)}
          {conflictBride ? ` — ${shortName(conflictBride.name)}` : ""}
          {conflict ? `, записала ${I.staff.get(conflict.consultantId)?.name ?? "—"}` : ""}. Выберите другой экземпляр или даты.
        </p>
      )}
      {cleaningRisk && (
        <p className="callout callout-info" role="alert">
          <Icon name="alert" size={18} />
          Это платье сейчас в химчистке (отправлено {fmtShort(inCleaning.sentAt)}), а выдача {fmtShort(issue)}. Уточните у администратора, успеет ли оно вернуться.
        </p>
      )}
      {activeOther && (
        <p className="callout callout-info" role="alert">
          <Icon name="alert" size={18} />
          У этой невесты уже есть запись № {activeOther.depositNo}: {I.item.get(activeOther.itemId)?.model}, свадьба {fmtShort(activeOther.eventDate)}, записала{" "}
          {I.staff.get(activeOther.consultantId)?.name}. Проверьте, не дубль ли это.
        </p>
      )}
      <div className="grid-3">
        <Field label="Аренда, ₽" error={tried && !rent ? "Укажите сумму" : undefined}>
          <input type="number" inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value)} />
        </Field>
        <Field label="Залог, ₽" hint="Не возвращается при отказе" error={tried && !deposit ? "Укажите залог" : undefined}>
          <input type="number" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} disabled={!!booking && !can("editAll")} />
        </Field>
        <Field label="Доп, ₽" hint="Фотосессия, серьги, фата…">
          <input type="number" inputMode="numeric" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </Field>
      </div>
      {!booking && <MethodPicker method={method} setMethod={setMethod} bank={bank} setBank={setBank} />}
      <Field group label="Аксессуары">
        <div className="check-row">
          {ACC.map((a) => (
            <label key={a} className="check">
              <input type="checkbox" checked={acc.includes(a)} onChange={() => setAcc((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))} />
              <span>{a}</span>
            </label>
          ))}
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Фата">
          <input value={veil} onChange={(e) => setVeil(e.target.value)} placeholder="Испанка с кромкой" />
        </Field>
        <Field label="Подгонка" hint="Каждый пункт с новой строки">
          <textarea value={tasks} onChange={(e) => setTasks(e.target.value)} rows={3} placeholder={"Пришить пуговицы\nПодол на 2 см"} />
        </Field>
      </div>
      <details className="details">
        <summary>Данные для договора: паспорт, дата рождения, адрес</summary>
        <div className="grid-3">
          <Field label="Паспорт">
            <input value={passport} onChange={(e) => setPassport(e.target.value)} placeholder="Серия и номер" />
          </Field>
          <Field label="Дата рождения">
            <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
          </Field>
          <Field label="Адрес">
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </div>
        <p className="field-hint">В рабочей версии эти данные хранятся на российском сервере и видны только владельцу и администратору.</p>
      </details>
    </Modal>
  );
}

/* ---------- Выдача ---------- */

function IssueForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { db, issueBooking, toast } = useStore();
  const b = db.bookings.find((x) => x.id === bookingId)!;
  const money = paid(db, b);
  const [amount, setAmount] = useState(String(money.due));
  const [method, setMethod] = useState<Payment["method"]>("cash");
  const [bank, setBank] = useState("ВТБ");
  const it = idx(db).item.get(b.itemId);
  return (
    <Modal
      title={`Выдать ${it?.model ?? "платье"}`}
      onClose={onClose}
      footer={
        <Foot
          onClose={onClose}
          label="Выдать и оформить договор аренды"
          onSubmit={() => {
            const no = issueBooking(b.id, Number(amount) || 0, method, method === "transfer" ? bank : undefined);
            toast(`Выдано · договор аренды № ${no}`);
            onClose();
          }}
        />
      }
    >
      <p>
        Сумма {rub(b.rentPrice + b.extra)}, внесено {rub(money.rent)}. Остаток к оплате: <strong>{rub(money.due)}</strong>
      </p>
      <Field label="Принято сейчас, ₽">
        <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <MethodPicker method={method} setMethod={setMethod} bank={bank} setBank={setBank} />
      <p className="field-hint">Возврат не позднее {fmtDate(b.returnDate)}, 16:00. Без паспорта платье не выдаётся.</p>
    </Modal>
  );
}

/* ---------- Приёмка ---------- */

const FINE_REASONS: [string, number][] = [
  ["Не принесли вешалку", 350],
  ["Не принесли чехол", 500],
  ["Грязная обувь", 500],
  ["Порвали фату", 2000],
  ["Дырка или поломка", 2000],
  ["Сильные пятна", 5000],
  ["Возврат с опозданием", 0],
];

function ReturnForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { db, returnBooking, toast } = useStore();
  const b = db.bookings.find((x) => x.id === bookingId)!;
  const late = isOverdue(b) ? diffDays(today(), b.returnDate) : 0;
  const [hasFine, setHasFine] = useState(late > 0);
  const [reason, setReason] = useState(late > 0 ? "Возврат с опозданием" : FINE_REASONS[0][0]);
  const [amount, setAmount] = useState(String(late > 0 ? Math.round(b.rentPrice * 0.1 * late) : FINE_REASONS[0][1]));
  const [method, setMethod] = useState<Payment["method"]>("cash");
  const [bank, setBank] = useState("ВТБ");
  const [cleaning, setCleaning] = useState(true);
  const it = idx(db).item.get(b.itemId);

  return (
    <Modal
      title={`Принять ${it?.model ?? "платье"}`}
      onClose={onClose}
      footer={
        <Foot
          onClose={onClose}
          label="Принять платье"
          onSubmit={() => {
            returnBooking(b.id, { cleaning, fine: hasFine ? { amount: Number(amount) || 0, reason, method } : undefined });
            toast(cleaning ? "Принято и отправлено в химчистку" : "Платье принято");
            onClose();
          }}
        />
      }
    >
      {late > 0 && (
        <p className="callout callout-bad">
          <Icon name="alert" size={18} /> Возврат просрочен на {late} дн. По договору — 10% от суммы аренды за каждые сутки.
        </p>
      )}
      <label className="check">
        <input type="checkbox" checked={hasFine} onChange={(e) => setHasFine(e.target.checked)} />
        <span>Есть штраф</span>
      </label>
      {hasFine && (
        <>
          <div className="grid-2">
            <Field label="За что">
              <select
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  const f = FINE_REASONS.find((x) => x[0] === e.target.value);
                  if (f && f[1]) setAmount(String(f[1]));
                  if (e.target.value === "Возврат с опозданием") setAmount(String(Math.round(b.rentPrice * 0.1 * Math.max(1, late))));
                }}
              >
                {FINE_REASONS.map(([r]) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Сумма, ₽">
              <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          </div>
          <MethodPicker method={method} setMethod={setMethod} bank={bank} setBank={setBank} />
        </>
      )}
      <label className="check">
        <input type="checkbox" checked={cleaning} onChange={(e) => setCleaning(e.target.checked)} />
        <span>Отправить в химчистку</span>
      </label>
    </Modal>
  );
}

/* ---------- Отказ ---------- */

function RefuseForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { db, refuseBooking, toast } = useStore();
  const b = db.bookings.find((x) => x.id === bookingId)!;
  const [reason, setReason] = useState("Нашла другое платье");
  return (
    <Modal
      title={`Отказ по записи № ${b.depositNo}`}
      onClose={onClose}
      footer={
        <Foot
          danger
          onClose={onClose}
          label="Оформить отказ"
          onSubmit={() => {
            refuseBooking(b.id, reason);
            toast("Отказ оформлен, платье освобождено");
            onClose();
          }}
        />
      }
    >
      <p>
        Сумма аренды {rub(b.rentPrice)}. Залог <strong>{rub(b.deposit)}</strong> не возвращается и остаётся салону по договору. Платье снова станет свободным на эти даты.
      </p>
      <Field label="Причина">
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {["Нашла другое платье", "Свадьба перенесена", "Передумала по фасону", "Не устроила цена подгонки", "Без объяснения причин"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
    </Modal>
  );
}

/* ---------- Перенос даты ---------- */

function MoveForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { db, moveBooking, toast } = useStore();
  const b = db.bookings.find((x) => x.id === bookingId)!;
  const [event, setEvent] = useState(b.eventDate);
  const issue = addDays(event, -1);
  const ret = addDays(event, 1);
  const conflict = itemConflict(db, b.itemId, issue, ret, b.id);
  return (
    <Modal
      title="Перенос даты"
      onClose={onClose}
      footer={
        <Foot
          onClose={onClose}
          label="Перенести"
          onSubmit={() => {
            if (conflict) return;
            moveBooking(b.id, event, issue, ret);
            toast(`Перенесено на ${fmtDate(event)}`);
            onClose();
          }}
        />
      }
    >
      <Field label="Новая дата мероприятия" hint={`Выдача ${fmtShort(issue)}, возврат ${fmtShort(ret)}`}>
        <input type="date" value={event} onChange={(e) => setEvent(e.target.value)} />
      </Field>
      {conflict && (
        <p className="callout callout-bad">
          <Icon name="alert" size={18} /> На эти даты платье уже занято ({fmtShort(conflict.issueDate)} — {fmtShort(conflict.returnDate)}).
        </p>
      )}
    </Modal>
  );
}

/* ---------- Оплата / штраф ---------- */

function PaymentForm({ bookingId, kind: initial, onClose }: { bookingId: string; kind?: Payment["kind"]; onClose: () => void }) {
  const { db, addPayment, toast } = useStore();
  const b = db.bookings.find((x) => x.id === bookingId)!;
  const money = paid(db, b);
  const [kind, setKind] = useState<Payment["kind"]>(initial ?? (b.status === "booked" ? "deposit" : "balance"));
  const [amount, setAmount] = useState(String(kind === "fine" ? 350 : money.due || ""));
  const [reason, setReason] = useState(FINE_REASONS[0][0]);
  const [method, setMethod] = useState<Payment["method"]>("cash");
  const [bank, setBank] = useState("ВТБ");
  return (
    <Modal
      title={kind === "fine" ? "Штраф невесты" : "Принять оплату"}
      onClose={onClose}
      footer={
        <Foot
          onClose={onClose}
          label="Записать"
          onSubmit={() => {
            if (!Number(amount)) return;
            addPayment({ bookingId, kind, amount: Number(amount), date: today(), method, bank: method === "transfer" ? bank : undefined, reason: kind === "fine" ? reason : undefined });
            toast(kind === "fine" ? "Штраф записан" : "Оплата записана, ждёт подтверждения владельца");
            onClose();
          }}
        />
      }
    >
      {initial !== "fine" && (
        <Segmented
          label="Что оплачено"
          value={kind}
          onChange={setKind}
          options={[
            { value: "deposit", label: "Залог" },
            { value: "balance", label: "Остаток" },
            { value: "extra", label: "Доп" },
          ]}
        />
      )}
      {kind === "fine" && (
        <Field label="За что">
          <select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              const f = FINE_REASONS.find((x) => x[0] === e.target.value);
              if (f && f[1]) setAmount(String(f[1]));
            }}
          >
            {FINE_REASONS.map(([r]) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Сумма, ₽" hint={kind !== "fine" && money.due ? `Остаток к оплате ${rub(money.due)}` : undefined}>
        <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </Field>
      <MethodPicker method={method} setMethod={setMethod} bank={bank} setBank={setBank} />
    </Modal>
  );
}

/* ---------- Невеста ---------- */

function BrideForm({ bride, onClose }: { bride?: Bride; onClose: () => void }) {
  const { db, saveBride, toast, can } = useStore();
  const consultants = db.staff.filter((s) => s.role === "employee");
  const [name, setName] = useState(bride?.name ?? "");
  const [phones, setPhones] = useState(bride?.phones.join(", ") ?? "");
  const [event, setEvent] = useState(bride?.eventDate ?? "");
  const [cons, setCons] = useState(bride?.consultantId ?? consultants[0]?.id);
  const [notes, setNotes] = useState(bride?.notes ?? "");
  return (
    <Modal
      title="Карточка невесты"
      onClose={onClose}
      footer={
        <Foot
          onClose={onClose}
          label="Сохранить"
          onSubmit={() => {
            if (!name.trim()) return;
            saveBride({
              ...(bride ?? { createdAt: today() }),
              id: bride?.id,
              name: name.trim(),
              phones: phones.split(",").map((p) => p.trim()).filter(Boolean),
              eventDate: event || undefined,
              consultantId: cons,
              notes,
            } as Bride);
            toast("Карточка сохранена");
            onClose();
          }}
        />
      }
    >
      <Field label="ФИО">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Телефоны" hint="Через запятую">
        <input value={phones} onChange={(e) => setPhones(e.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label="Дата свадьбы">
          <input type="date" value={event} onChange={(e) => setEvent(e.target.value)} />
        </Field>
        <Field label="Консультант" hint={can("editAll") ? undefined : "Меняет администратор"}>
          <select value={cons} onChange={(e) => setCons(e.target.value)} disabled={!can("editAll")}>
            {consultants.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Комментарий">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Field>
    </Modal>
  );
}

/* ---------- Фото с устройства ---------- */

export function DressPhoto({ src, alt = "", className }: { src?: string; alt?: string; className?: string }) {
  const url = usePhoto(src);
  if (!src) return <Icon name="dress" size={32} className={className} />;
  return url ? <img src={url} alt={alt} className={className} /> : <span className="photo-loading" aria-hidden="true" />;
}

function PhotoUpload({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="photo-upload">
      <div className="photo-preview">
        <DressPhoto src={value} alt="Фото платья" />
      </div>
      <div className="photo-actions">
        <label className="btn btn-ghost btn-small">
          <Icon name="plus" size={16} /> {value ? "Заменить фото" : "Загрузить фото"}
          <input
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true);
              setErr("");
              try {
                onChange(await savePhoto(f));
              } catch {
                setErr("Не получилось загрузить фото. Попробуйте другой файл.");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {value && (
          <button type="button" className="link-btn small" onClick={() => onChange(undefined)}>
            Убрать фото
          </button>
        )}
        <span className="field-hint">{busy ? "Загружаем…" : "С телефона можно сразу сфотографировать платье"}</span>
        {err && <span className="field-error">{err}</span>}
      </div>
    </div>
  );
}

/* ---------- Подтверждение опасного действия внутри формы ---------- */

function DangerZone({ label, note, confirmText, onConfirm, children }: { label: string; note: string; confirmText: string; onConfirm: () => void; children?: React.ReactNode }) {
  const [ask, setAsk] = useState(false);
  return (
    <div className="danger-zone">
      {!ask ? (
        <button type="button" className="btn btn-ghost btn-danger btn-small" onClick={() => setAsk(true)}>
          {label}
        </button>
      ) : (
        <div className="danger-confirm" role="alert">
          <p>{note}</p>
          {children}
          <div className="danger-actions">
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setAsk(false)}>
              Отмена
            </button>
            <button type="button" className="btn btn-small btn-red" onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Поступление платья (только владелец) ---------- */

/**
 * Поставщик прямо в форме платья: выбрать, добавить нового, переименовать или удалить —
 * без отдельного окна, чтобы заполненная форма платья не терялась.
 */
function SupplierPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { db, saveSupplier, removeSupplier, toast } = useStore();
  const current = db.suppliers.find((s) => s.id === value);
  const [mode, setMode] = useState<"pick" | "new" | "edit" | "delete">("pick");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const taken = !!name.trim() && db.suppliers.some((s) => s.id !== (mode === "edit" ? value : "") && s.name.toLowerCase() === name.trim().toLowerCase());
  const used = current ? db.items.filter((i) => i.supplierId === current.id).length : 0;

  if (mode === "pick")
    return (
      <div className="inline-row supplier-row">
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Поставщик">
          <option value="">Не указан</option>
          {db.suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {current && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => (setName(current.name), setPhone(current.phone ?? ""), setMode("edit"))}>
            <Icon name="edit" size={16} /> Изменить
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-small" onClick={() => (setName(""), setPhone(""), setMode("new"))}>
          <Icon name="plus" size={16} /> Новый
        </button>
      </div>
    );

  if (mode === "delete" && current)
    return (
      <div className="danger-confirm">
        <p>
          Удалить поставщика «{current.name}»?
          {used > 0 ? ` У него ${used} плат. — у них поставщик станет «Не указан». История аренды сохранится.` : ""}
        </p>
        <div className="danger-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setMode("edit")}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-red"
            onClick={() => {
              removeSupplier(current.id, "");
              onChange("");
              toast(`Поставщик ${current.name} удалён`);
              setMode("pick");
            }}
          >
            Удалить
          </button>
        </div>
      </div>
    );

  const save = () => {
    if (!name.trim() || taken) return;
    const s = saveSupplier({ id: mode === "edit" ? value : undefined, name: name.trim(), phone: phone.trim() || undefined });
    onChange(s.id);
    toast(mode === "edit" ? "Поставщик изменён" : `Поставщик ${s.name} добавлен`);
    setMode("pick");
  };
  return (
    <div className="inline-new">
      <p className="inline-new-title">{mode === "edit" ? "Изменить поставщика" : "Новый поставщик"}</p>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Название</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
            placeholder="Например, Bridal House, Стамбул"
            autoFocus
          />
          {taken && <span className="field-error">Такой поставщик уже есть</span>}
        </label>
        <label className="field">
          <span className="field-label">Телефон</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Необязательно" />
        </label>
      </div>
      <div className="inline-row supplier-actions">
        <button type="button" className="btn btn-small" disabled={!name.trim() || taken} onClick={save}>
          {mode === "edit" ? "Сохранить" : "Добавить"}
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setMode("pick")}>
          Отмена
        </button>
        {mode === "edit" && (
          <button type="button" className="btn btn-ghost btn-small btn-danger supplier-del" onClick={() => setMode("delete")}>
            Удалить поставщика
          </button>
        )}
      </div>
    </div>
  );
}

/** Сумма с выбором валюты; без onCurrency — только рубли */
function MoneyInput({
  value,
  onChange,
  currency = "RUB",
  onCurrency,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  currency?: Currency;
  onCurrency?: (c: Currency) => void;
  label?: string;
}) {
  return (
    <span className="money-input">
      <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
      {onCurrency ? (
        <select value={currency} onChange={(e) => onCurrency(e.target.value as Currency)} aria-label={label}>
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.sign}
            </option>
          ))}
        </select>
      ) : (
        <span className="money-sign" aria-hidden="true">
          ₽
        </span>
      )}
    </span>
  );
}

function ItemForm({ item, onClose }: { item?: DressItem; onClose: () => void }) {
  const { db, saveItem, removeItem, toast, open, closeDialogAndSheet } = useStore();
  const models = [...new Set(db.items.map((i) => i.model))].sort();
  const [model, setModel] = useState(item?.model ?? "");
  const [size, setSize] = useState(item?.size ?? "44");
  const [supplier, setSupplier] = useState(item?.supplierId ?? db.suppliers[0]?.id ?? "");
  const [purchase, setPurchase] = useState(String(item?.purchasePrice || ""));
  const [purchaseCur, setPurchaseCur] = useState<Currency>(item?.purchaseCurrency ?? "RUB");
  const [cost, setCost] = useState(String(item?.cost || ""));
  const [costCur, setCostCur] = useState<Currency>(item?.costCurrency ?? "RUB");
  const [rent, setRent] = useState(String(item?.rentPrice || ""));
  const [received, setReceived] = useState(item?.receivedAt ?? today());
  const [photo, setPhoto] = useState(item?.photo);
  const [tried, setTried] = useState(false);
  const used = item ? db.bookings.some((b) => b.itemId === item.id) : false;

  return (
    <Modal
      title={item ? `${item.model}, р. ${item.size}` : "Поступление платья"}
      onClose={onClose}
      wide
      footer={
        <Foot
          onClose={onClose}
          label={item ? "Сохранить" : "Добавить в салон"}
          onSubmit={() => {
            setTried(true);
            if (!model.trim() || !rent) return;
            if (item?.photo && item.photo !== photo) deletePhoto(item.photo);
            const saved = saveItem({
              ...(item ?? {}),
              id: item?.id,
              model: model.trim(),
              size,
              supplierId: supplier,
              purchasePrice: Number(purchase) || 0,
              purchaseCurrency: purchaseCur,
              cost: Number(cost) || 0,
              costCurrency: costCur,
              rentPrice: Number(rent),
              receivedAt: received,
              photo,
            });
            toast(item ? "Сохранено" : `${saved.model} добавлено`);
            onClose();
            if (!item) open({ kind: "item", id: saved.id });
          }}
        />
      }
    >
      <Field group label="Фото">
        <PhotoUpload value={photo} onChange={setPhoto} />
      </Field>
      <div className="grid-3">
        <Field label="Модель" error={tried && !model.trim() ? "Укажите модель" : undefined}>
          <input value={model} onChange={(e) => setModel(e.target.value)} list="models" placeholder="Например, Sara" />
          <datalist id="models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Размер">
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            {["38", "40", "42", "44", "46", "48", "50", "52", "54"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Дата поступления">
          <input type="date" value={received} onChange={(e) => setReceived(e.target.value)} />
        </Field>
      </div>
      <Field group label="Поставщик" hint="Видит только владелец">
        <SupplierPicker value={supplier} onChange={setSupplier} />
      </Field>
      <div className="grid-3 price-row">
        <Field label="Закупка" hint="Только владелец">
          <MoneyInput value={purchase} onChange={setPurchase} currency={purchaseCur} onCurrency={setPurchaseCur} label="Валюта закупки" />
        </Field>
        <Field label="Стоимость платья" hint="Пишется в договоре">
          <MoneyInput value={cost} onChange={setCost} currency={costCur} onCurrency={setCostCur} label="Валюта стоимости" />
        </Field>
        <Field label="Цена аренды" hint="Невеста платит в рублях" error={tried && !rent ? "Укажите цену" : undefined}>
          <MoneyInput value={rent} onChange={setRent} />
        </Field>
      </div>
      {item && (
        <DangerZone
          label={used ? "Снять с проката" : "Удалить платье"}
          confirmText={used ? "Снять с проката" : "Удалить навсегда"}
          note={
            used
              ? "По этому платью уже были записи. Оно исчезнет из списков и из выбора при записи, но останется в истории и отчётах. Вернуть можно в «Платья → Снятые с проката»."
              : "Платье ещё ни разу не записывали. Оно будет удалено полностью вместе с фото."
          }
          onConfirm={() => {
            const r = removeItem(item.id);
            toast(r === "archived" ? `${item.model} снято с проката` : `${item.model} удалено`);
            closeDialogAndSheet();
          }}
        />
      )}
    </Modal>
  );
}

/* ---------- Сотрудник ---------- */

function StaffForm({ staff, onClose }: { staff?: Staff; onClose: () => void }) {
  const { db, saveStaff, removeStaff, toast, user, logout } = useStore();
  const [name, setName] = useState(staff?.name ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [login, setLogin] = useState(staff?.login ?? "");
  const [password, setPassword] = useState(staff?.password ?? "");
  const [role, setRole] = useState<Role>(staff?.role ?? "employee");
  const [active, setActive] = useState(staff?.active ?? true);
  const [tried, setTried] = useState(false);
  const employees = db.staff.filter((s) => s.role === "employee" && s.active).length;
  const limit = !staff && role === "employee" && employees >= MAX_EMPLOYEES;
  const roles: Role[] = user?.role === "owner" ? ["employee", "admin"] : ["employee"];
  const loginTaken = db.staff.some((s) => s.id !== staff?.id && s.login.toLowerCase() === login.trim().toLowerCase());
  const brides = staff ? db.brides.filter((b) => b.consultantId === staff.id).length : 0;
  const colleagues = db.staff.filter((s) => s.role === "employee" && s.active && s.id !== staff?.id);
  const [moveTo, setMoveTo] = useState(colleagues[0]?.id ?? "");
  const isSelf = staff?.id === user?.id;

  return (
    <Modal
      title={staff ? staff.name : "Новый сотрудник"}
      onClose={onClose}
      footer={
        <Foot
          onClose={onClose}
          label={staff ? "Сохранить" : "Создать учётную запись"}
          onSubmit={() => {
            setTried(true);
            if (!name.trim() || !login.trim() || password.length < 4 || loginTaken || limit) return;
            saveStaff({ id: staff?.id, name: name.trim(), phone, role, active, login: login.trim(), password });
            toast(staff ? "Сохранено" : `Учётная запись создана: ${login.trim()}`);
            onClose();
          }}
        />
      }
    >
      <div className="grid-2">
        <Field label="Имя" error={tried && !name.trim() ? "Укажите имя" : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Телефон">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        <Field label="Логин" error={tried && !login.trim() ? "Придумайте логин" : loginTaken ? "Такой логин уже занят" : undefined}>
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoCapitalize="none" autoComplete="off" />
        </Field>
        <Field label="Пароль" hint="Не короче 4 символов" error={tried && password.length < 4 ? "Слишком короткий пароль" : undefined}>
          <input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      {staff?.role !== "owner" && (
        <Field label="Роль">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      )}
      {staff && staff.role !== "owner" && !active && (
        <label className="check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Вернуть доступ</span>
        </label>
      )}
      {limit && <p className="field-error">Достигнут лимит: {MAX_EMPLOYEES} консультантов.</p>}
      {staff && staff.role !== "owner" && !isSelf && staff.active && (
        <DangerZone
          label="Удалить сотрудника"
          confirmText="Удалить"
          note={
            brides
              ? `Сотрудник больше не сможет войти. За ним закреплено невест: ${brides}. Выберите, к кому из консультантов их перевести. Его имя останется в старых записях и отчётах.`
              : "Сотрудник больше не сможет войти. Если у него уже были записи, имя останется в истории и отчётах."
          }
          onConfirm={() => {
            const r = removeStaff(staff.id, brides ? moveTo : undefined);
            toast(r === "deleted" ? `${staff.name} удалён` : `${staff.name}: доступ закрыт, история сохранена`);
            onClose();
          }}
        >
          {brides > 0 && (
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Перевести невест к консультанту">
              {colleagues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </DangerZone>
      )}
      {isSelf && staff?.role !== "owner" && (
        <button type="button" className="link-btn small" onClick={logout}>
          Выйти из учётной записи
        </button>
      )}
    </Modal>
  );
}

export { itemState };