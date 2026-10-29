"use client";

import { useMemo, useState } from "react";
import { addDays, today, weekday } from "@/lib/dates";
import { brideHistory, findBrides, idx, itemConflict, rub, staffShort } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { ItemPicker } from "./forms";
import { RecordCard } from "./sheets";
import { Icon } from "./ui";

const PAY_WAYS = ["Наличные", "ВТБ", "Сбер", "Т-Банк", "Другой перевод"];
const ddmmyyyy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

/**
 * Экран консультанта — как страница бумажной тетради:
 * дата и имя сверху, «Новая запись», поля записи и «Отправить на подтверждение».
 */
export function ConsultantBook() {
  const { db, user, logout } = useStore();
  const [writing, setWriting] = useState(false);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(10);
  const t = today();
  const I = idx(db);

  const todays = db.bookings.filter((b) => b.createdAt === t).sort((a, b) => b.depositNo - a.depositNo);
  const all = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return db.bookings
      .filter((b) => b.createdAt !== t)
      .filter((b) => {
        if (!s) return true;
        const br = I.bride.get(b.brideId);
        return (
          br?.name.toLowerCase().includes(s) ||
          I.item.get(b.itemId)?.model.toLowerCase().includes(s) ||
          (b.contractDeposit ?? String(b.depositNo)).toLowerCase() === s ||
          (digits.length >= 4 && br?.phones.some((p) => p.replace(/\D/g, "").includes(digits)))
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.depositNo - a.depositNo);
  }, [db.bookings, q, t, I]);

  return (
    <div className="page cbook">
      <header className="cbook-head">
        <div>
          <p className="cbook-date">{ddmmyyyy(t)}</p>
          <p className="cbook-wd">{weekday(t)}</p>
        </div>
        <div className="cbook-me">
          <p className="cbook-name">{user ? staffShort(user.name) : ""}</p>
          <button type="button" className="link-btn small" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      {writing ? (
        <EntryForm onDone={() => setWriting(false)} />
      ) : (
        <button type="button" className="btn btn-block cbook-new" onClick={() => setWriting(true)}>
          <Icon name="plus" size={20} /> Новая запись
        </button>
      )}

      <section className="cbook-section" aria-label="Сегодня записали">
        <h2 className="cbook-title">
          Сегодня записали <span className="today-count">{todays.length}</span>
        </h2>
        {todays.length ? (
          <div className="record-book">
            {todays.map((b) => (
              <RecordCard key={b.id} b={b} />
            ))}
          </div>
        ) : (
          <p className="muted small">Сегодня ещё никого не записали.</p>
        )}
      </section>

      <section className="cbook-section" aria-label="Все записи">
        <h2 className="cbook-title">Все записи</h2>
        <div className="search-input book-search">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => (setQ(e.target.value), setShown(10))} placeholder="Имя, телефон, платье или № договора" aria-label="Поиск записей" />
        </div>
        {all.length ? (
          <div className="record-book">
            {all.slice(0, shown).map((b) => (
              <RecordCard key={b.id} b={b} />
            ))}
            {all.length > shown && (
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setShown((n) => n + 10)}>
                Показать ещё ({all.length - shown})
              </button>
            )}
          </div>
        ) : (
          <p className="muted small">{q ? "Ничего не нашлось." : "Других записей пока нет."}</p>
        )}
      </section>
    </div>
  );
}

/* ---------- Новая запись: поля как в тетради ---------- */

function EntryForm({ onDone }: { onDone: () => void }) {
  const { db, user, saveBride, createBooking, addPayment, addVisit, toast } = useStore();
  const I = idx(db);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [brideId, setBrideId] = useState<string>();
  const [item, setItem] = useState<string>();
  const [event, setEvent] = useState("");
  const [sum, setSum] = useState("");
  const [deposit, setDeposit] = useState("");
  const [payWay, setPayWay] = useState("Наличные");
  const [extra, setExtra] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [fine, setFine] = useState("");
  const [fineWhy, setFineWhy] = useState("");
  const [rentNo, setRentNo] = useState("");
  const [depositNo, setDepositNo] = useState("");
  const [notes, setNotes] = useState("");
  const [visited, setVisited] = useState(true);
  const [tried, setTried] = useState(false);

  const issue = event ? addDays(event, -1) : "";
  const ret = event ? addDays(event, 1) : "";
  const picked = brideId ? I.bride.get(brideId) : undefined;

  // возвратная невеста: совпадения по фамилии или телефону показываются сразу при вводе
  const matches = picked ? [] : findBrides(db, name, phone);
  const dup = matches.find((m) => m.exactPhone)?.b; // точно такой же номер — новую карточку не создаём
  const hist = picked ? brideHistory(db, picked.id) : undefined;
  const conflict = item && event ? itemConflict(db, item, issue, ret) : undefined;
  const active = brideId ? db.bookings.find((k) => k.brideId === brideId && (k.status === "booked" || k.status === "issued")) : undefined;
  const takenNo = depositNo.trim() ? db.bookings.find((k) => (k.contractDeposit ?? "").trim() === depositNo.trim()) : undefined;
  const pastEvent = !!event && event < today();

  const errors = {
    name: !picked && !name.trim() ? "Укажите ФИО" : "",
    phone: !picked && !phone.trim() ? "Укажите телефон" : dup ? "Этот номер уже в базе — выберите невесту выше" : "",
    item: !item ? "Выберите платье" : conflict ? "Платье занято на эти даты" : "",
    event: !event ? "Укажите дату свадьбы" : pastEvent ? "Дата уже прошла" : "",
    sum: !Number(sum) ? "Укажите сумму" : "",
    deposit: !Number(deposit) ? "Укажите залог" : "",
    depositNo: takenNo ? "Такой номер уже есть" : "",
  };
  const ok = Object.values(errors).every((e) => !e);
  // «обязательное поле» — только после попытки отправить; дубль, занятое платье и прошедшая дата — сразу
  const instant = { phone: !!dup, item: !!conflict, depositNo: !!takenNo, event: pastEvent } as Record<string, boolean>;
  const err = (k: keyof typeof errors) => (tried || instant[k] ? errors[k] : "");

  const pickItem = (id: string) => {
    setItem(id);
    const x = I.item.get(id);
    if (x && !sum) setSum(String(x.rentPrice));
  };

  const submit = () => {
    setTried(true);
    if (!ok || !user) return;
    const bride =
      picked ??
      saveBride({ name: name.trim(), phones: [phone.trim()], eventDate: event, consultantId: user.id, notes: visited ? "" : "Онлайн-запись без визита в салон" });
    if (visited) addVisit({ brideId: bride.id, date: today(), time: new Date().toTimeString().slice(0, 5), tried: true, dressIds: item ? [item] : [], notes: "", consultantId: user.id });
    const transfer = payWay !== "Наличные";
    const k = createBooking(
      {
        brideId: bride.id,
        consultantId: bride.consultantId ?? user.id,
        itemId: item!,
        eventDate: event,
        issueDate: issue,
        returnDate: ret,
        rentPrice: Number(sum),
        deposit: Number(deposit),
        extra: Number(extra) || 0,
        extraNote: extraNote.trim() || undefined,
        fineNote: fineWhy.trim() || undefined,
        accessories: [],
        tasks: [],
        notes: notes.trim() || undefined,
        contractDeposit: depositNo.trim() || undefined,
        contractRent: rentNo.trim() || undefined,
      },
      { method: transfer ? "transfer" : "cash", bank: transfer ? payWay : undefined },
    );
    if (Number(fine) > 0) addPayment({ bookingId: k.id, kind: "fine", amount: Number(fine), reason: fineWhy.trim() || undefined, date: today(), method: "cash" });
    toast("Запись отправлена на подтверждение владельцу");
    onDone();
  };

  return (
    <section className="paper entry-form" aria-label="Новая запись">
      <div className="entry-form-head">
        <h2 className="entry-form-title">Новая запись</h2>
        <button type="button" className="icon-btn" aria-label="Закрыть без сохранения" onClick={onDone}>
          <Icon name="close" />
        </button>
      </div>

      {picked && hist ? (
        <div className="returning-box" role="status">
          <p className="returning-tag">
            <Icon name="reset" size={16} /> Возвратная невеста · {hist.count + (visited ? 1 : 0)}-й визит
          </p>
          <p className="returning-name">{picked.name}</p>
          <p className="returning-meta">
            {picked.phones.join(", ")}
            {hist.last ? ` · была ${ddmmyyyy(hist.last.date)}` : " · в салоне ещё не была (онлайн-запись)"}
          </p>
          <p className="returning-meta">
            Консультант: <strong>{I.staff.get(picked.consultantId)?.name ?? "—"}</strong>
            {picked.consultantId !== user?.id && " — запись засчитается ей, вы будете указаны как обслужившая"}
          </p>
          {hist.tried.length > 0 && <p className="returning-meta">Мерила: {hist.tried.join(", ")}</p>}
          {picked.notes && <p className="returning-meta">Комментарий: {picked.notes}</p>}
          <button type="button" className="link-btn small" onClick={() => setBrideId(undefined)}>
            Это другая невеста
          </button>
        </div>
      ) : (
        <>
          <Line label="ФИО невесты" error={err("name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Фамилия Имя Отчество" autoComplete="off" />
          </Line>
          <Line label="Тел." error={err("phone")}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="8 9__ ___ __ __" autoComplete="off" />
          </Line>
          {matches.length > 0 && (
            <div className="matches" role="region" aria-label="Уже были в салоне">
              <p className="matches-title">Уже были в салоне — если это она, нажмите:</p>
              <ul>
                {matches.map(({ b: m, exactPhone }) => {
                  const h = brideHistory(db, m.id);
                  return (
                    <li key={m.id}>
                      <button type="button" className={`match${exactPhone ? " is-exact" : ""}`} onClick={() => setBrideId(m.id)}>
                        <span className="match-name">{m.name}</span>
                        <span className="match-meta">
                          {m.phones[0]}
                          {h.last ? ` · была ${ddmmyyyy(h.last.date)}` : " · онлайн"} · визитов {h.count}
                        </span>
                        <span className="match-meta">
                          {staffShort(I.staff.get(m.consultantId)?.name ?? "—")}
                          {h.tried.length ? ` · мерила ${h.tried.slice(0, 3).join(", ")}` : ""}
                          {h.active ? ` · есть запись № ${h.active.contractDeposit ?? h.active.depositNo}` : ""}
                        </span>
                        <span className="match-go">Это она</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
      {active && (
        <p className="callout callout-info" role="alert">
          <Icon name="alert" size={18} />
          У этой невесты уже есть запись № {active.contractDeposit ?? active.depositNo}: {I.item.get(active.itemId)?.model}, свадьба {ddmmyyyy(active.eventDate)}. Проверьте, не дубль ли это.
        </p>
      )}

      <Line label="Дата свадьбы" error={err("event")}>
        <input type="date" value={event} min={today()} onChange={(e) => setEvent(e.target.value)} />
      </Line>
      {event && <p className="ef-hint">Выдача {ddmmyyyy(issue)}, возврат {ddmmyyyy(ret)} — администратор может поменять.</p>}

      <div className="ef-line ef-line-block">
        <span className="ef-label">Платье</span>
        <div className="ef-field">
          <ItemPicker selected={item ? [item] : []} onToggle={pickItem} from={issue || undefined} to={ret || undefined} />
          {err("item") && <span className="field-error">{err("item")}</span>}
        </div>
      </div>
      {conflict && (
        <p className="callout callout-bad" role="alert">
          <Icon name="alert" size={18} />
          Это платье уже записано на {ddmmyyyy(conflict.eventDate)} — {I.bride.get(conflict.brideId)?.name}, записала {I.staff.get(conflict.consultantId)?.name}. Выберите другое платье.
        </p>
      )}

      <Line label="Сумма" error={err("sum")}>
        <Money value={sum} onChange={setSum} />
      </Line>
      <Line label="Залог" error={err("deposit")} group>
        <span className="ef-pair">
          <Money value={deposit} onChange={setDeposit} label="Залог" />
          <select value={payWay} onChange={(e) => setPayWay(e.target.value)} aria-label="Как оплатили залог">
            {PAY_WAYS.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </span>
      </Line>
      <Line label="Доп" group>
        <span className="ef-pair">
          <Money value={extra} onChange={setExtra} label="Доп, сумма" />
          <input value={extraNote} onChange={(e) => setExtraNote(e.target.value)} placeholder="Что именно: серьги, фата, фотосессия…" aria-label="Доп, комментарий" />
        </span>
      </Line>
      <div className="ef-line ef-line-block">
        <span className="ef-label">Штраф</span>
        <div className="ef-field">
          <textarea
            aria-label="Штраф"
            value={fineWhy}
            onChange={(e) => setFineWhy(e.target.value)}
            rows={2}
            placeholder="За что штраф: не вернули вешалку, пятно на подоле…"
          />
          <Money value={fine} onChange={setFine} label="Сумма штрафа" placeholder="Сумма, если известна" />
        </div>
      </div>
      <Line label="№ договора аренды">
        <input value={rentNo} onChange={(e) => setRentNo(e.target.value)} inputMode="numeric" />
      </Line>
      <Line label="№ договора на залог" error={err("depositNo")}>
        <input value={depositNo} onChange={(e) => setDepositNo(e.target.value)} inputMode="numeric" />
      </Line>
      <div className="ef-line ef-line-block">
        <span className="ef-label">Комментарий</span>
        <div className="ef-field">
          <textarea aria-label="Комментарий" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Подгонка, пожелания невесты, когда пригласить на примерку" />
        </div>
      </div>

      <label className="check small">
        <input type="checkbox" checked={visited} onChange={(e) => setVisited(e.target.checked)} />
        <span>Невеста была в салоне (снимите галочку, если запись онлайн)</span>
      </label>

      {Number(sum) > 0 && Number(deposit) > 0 && (
        <p className="ef-summary">
          Остаток к выдаче: <strong>{rub(Math.max(0, Number(sum) + (Number(extra) || 0) - Number(deposit)))}</strong>
        </p>
      )}

      <button type="button" className="btn btn-block btn-red cbook-send" onClick={submit}>
        Отправить на подтверждение
      </button>
      {tried && !ok && <p className="field-error">Заполните отмеченные поля</p>}
    </section>
  );
}

/** Строка тетради: подпись курсивом слева, поле справа. group — несколько полей в строке */
function Line({ label, error, group, children }: { label: string; error?: string; group?: boolean; children: React.ReactNode }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={`ef-line${error ? " has-error" : ""}`} {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="ef-label">{label}</span>
      <span className="ef-field">
        {children}
        {error && <span className="field-error">{error}</span>}
      </span>
    </Tag>
  );
}

function Money({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  return (
    <span className="ef-money">
      <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
      <span aria-hidden="true">₽</span>
    </span>
  );
}
