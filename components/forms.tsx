"use client";

import { useMemo, useState } from "react";
import { addDays, fmtDate, TIME_SLOTS, today } from "@/lib/dates";
import { DRESS_STATE_LABEL, dressState, rentConflict, rub } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { CATEGORIES, SOURCES, type Category, type Client, type Dress, type Fitting, type Order, type Source } from "@/lib/types";
import { Field, Icon, Modal, Segmented } from "./ui";

export function DialogHost() {
  const { dialog, closeDialog } = useStore();
  if (!dialog) return null;
  if (dialog.kind === "fitting") return <FittingForm key="f" {...dialog} onClose={closeDialog} />;
  if (dialog.kind === "client") return <ClientForm key="c" client={dialog.client} then={dialog.then} onClose={closeDialog} />;
  if (dialog.kind === "order") return <OrderForm key="o" {...dialog} onClose={closeDialog} />;
  if (dialog.kind === "dress") return <DressForm key="d" dress={dialog.dress} onClose={closeDialog} />;
  return null;
}

/* ---------- Client picker with inline creation ---------- */

type ClientChoice = { id: string } | { newName: string; newPhone: string } | null;

function ClientPicker({ value, onChange, error }: { value: ClientChoice; onChange: (v: ClientChoice) => void; error?: string }) {
  const { db } = useStore();
  const [query, setQuery] = useState("");
  const selected = value && "id" in value ? db.clients.find((c) => c.id === value.id) : undefined;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, "");
    return db.clients
      .filter((c) => c.name.toLowerCase().includes(q) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      .slice(0, 6);
  }, [db.clients, query]);

  if (selected) {
    return (
      <div className="picked">
        <div>
          <p className="picked-name">{selected.name}</p>
          <p className="muted small">{selected.phone}</p>
        </div>
        <button type="button" className="link-btn" onClick={() => onChange(null)}>
          Изменить
        </button>
      </div>
    );
  }

  if (value && "newName" in value) {
    return (
      <div className="inline-new">
        <p className="inline-new-title">Новая клиентка</p>
        <div className="grid-2">
          <Field label="Имя и фамилия" error={error && !value.newName.trim() ? "Укажите имя" : undefined}>
            <input value={value.newName} onChange={(e) => onChange({ ...value, newName: e.target.value })} autoFocus />
          </Field>
          <Field label="Телефон" error={error && !value.newPhone.trim() ? "Укажите телефон" : undefined}>
            <input
              value={value.newPhone}
              onChange={(e) => onChange({ ...value, newPhone: e.target.value })}
              inputMode="tel"
              placeholder="+7 9__ ___-__-__"
            />
          </Field>
        </div>
        <button type="button" className="link-btn" onClick={() => onChange(null)}>
          Выбрать из базы
        </button>
      </div>
    );
  }

  return (
    <div className="combo">
      <div className={`search-input${error ? " has-error" : ""}`}>
        <Icon name="search" size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя или телефон"
          aria-label="Найти клиентку"
          autoFocus
        />
      </div>
      {error && <span className="field-error">{error}</span>}
      {query.trim() && (
        <ul className="combo-list" role="listbox">
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" role="option" aria-selected={false} onClick={() => onChange({ id: c.id })}>
                <span>{c.name}</span>
                <span className="muted small">{c.phone}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="combo-new"
              onClick={() => onChange({ newName: /\d/.test(query) ? "" : query.trim(), newPhone: /\d/.test(query) ? query.trim() : "" })}
            >
              <Icon name="plus" size={16} /> Новая клиентка «{query.trim()}»
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function useResolveClient() {
  const { saveClient } = useStore();
  return (choice: ClientChoice): string | null => {
    if (!choice) return null;
    if ("id" in choice) return choice.id;
    if (!choice.newName.trim() || !choice.newPhone.trim()) return null;
    return saveClient({
      name: choice.newName.trim(),
      phone: choice.newPhone.trim(),
      source: "Другое",
      measurements: {},
      notes: "",
    }).id;
  };
}

/* ---------- Dress picker ---------- */

function DressPicker({
  selected,
  onToggle,
  filter,
  multi,
  note,
  first = [],
}: {
  selected: string[];
  onToggle: (id: string) => void;
  filter?: (d: Dress) => boolean;
  multi?: boolean;
  note?: (d: Dress) => string | undefined;
  first?: string[];
}) {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const list = db.dresses
    .filter((d) => (!filter || filter(d)) && d.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(first.includes(b.id)) - Number(first.includes(a.id)));
  return (
    <div className="dress-picker">
      <div className="search-input">
        <Icon name="search" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название платья" aria-label="Найти платье" />
      </div>
      <ul className="dress-pick-grid" role={multi ? "group" : "radiogroup"}>
        {list.map((d) => {
          const on = selected.includes(d.id);
          const n = note?.(d);
          return (
            <li key={d.id}>
              <button
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={on}
                className={`dress-pick${on ? " is-on" : ""}`}
                onClick={() => onToggle(d.id)}
              >
                <span className="dress-pick-img">
                  {d.photo ? <img src={d.photo} alt="" /> : <Icon name="dress" size={28} />}
                  {on && (
                    <span className="dress-pick-check">
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </span>
                <span className="dress-pick-name">{d.name}</span>
                <span className="dress-pick-meta">{n ?? `${d.size} · ${d.category === "Свадебное" ? "свадебное" : "вечернее"}`}</span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="muted small">Ничего не нашлось</li>}
      </ul>
    </div>
  );
}

/* ---------- Fitting ---------- */

function FittingForm({
  fitting,
  clientId,
  date,
  time,
  onClose,
}: {
  fitting?: Fitting;
  clientId?: string;
  date?: string;
  time?: string;
  onClose: () => void;
}) {
  const { db, saveFitting, toast, openClient } = useStore();
  const resolve = useResolveClient();
  const [client, setClient] = useState<ClientChoice>(fitting ? { id: fitting.clientId } : clientId ? { id: clientId } : null);
  const [d, setD] = useState(fitting?.date ?? date ?? today());
  const [t, setT] = useState(fitting?.time ?? time ?? "12:00");
  const [dresses, setDresses] = useState<string[]>(fitting?.dressIds ?? []);
  const [notes, setNotes] = useState(fitting?.notes ?? "");
  const [tried, setTried] = useState(false);

  const busy = db.fittings.filter((f) => f.date === d && f.status === "planned" && f.id !== fitting?.id).map((f) => f.time);
  const clash = busy.includes(t);

  const submit = () => {
    setTried(true);
    const id = resolve(client);
    if (!id) return;
    saveFitting({ id: fitting?.id, clientId: id, date: d, time: t, dressIds: dresses, status: fitting?.status ?? "planned", notes });
    toast(fitting ? "Примерка изменена" : `Примерка записана на ${fmtDate(d)}, ${t}`);
    onClose();
    if (!fitting && client && "newName" in client) openClient(id);
  };

  return (
    <Modal
      title={fitting ? "Изменить примерку" : "Записать на примерку"}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn" onClick={submit}>
            {fitting ? "Сохранить" : "Записать"}
          </button>
        </>
      }
    >
      <Field group label="Клиентка">
        <ClientPicker value={client} onChange={setClient} error={tried && !resolveCheck(client) ? "Выберите клиентку или добавьте новую" : undefined} />
      </Field>
      <div className="grid-2">
        <Field label="Дата">
          <input type="date" value={d} onChange={(e) => setD(e.target.value)} />
        </Field>
        <Field label="Время" hint={clash ? "На это время уже есть запись, но можно записать вторую" : undefined}>
          <select value={t} onChange={(e) => setT(e.target.value)}>
            {TIME_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
                {busy.includes(s) ? " · занято" : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field group label="Подготовить платья" hint="Необязательно. Администратор заранее повесит их в примерочную">
        <DressPicker
          multi
          selected={dresses}
          onToggle={(id) => setDresses((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
        />
      </Field>
      <Field label="Комментарий">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Например: придёт с мамой, хочет закрытые плечи" />
      </Field>
    </Modal>
  );
}

function resolveCheck(c: ClientChoice) {
  if (!c) return false;
  if ("id" in c) return true;
  return !!c.newName.trim() && !!c.newPhone.trim();
}

/* ---------- Client ---------- */

function ClientForm({ client, then, onClose }: { client?: Client; then?: "fitting"; onClose: () => void }) {
  const { saveClient, toast, openDialog, openClient } = useStore();
  const [name, setName] = useState(client?.name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [wedding, setWedding] = useState(client?.weddingDate ?? "");
  const [source, setSource] = useState<Source>(client?.source ?? "Instagram");
  const [m, setM] = useState(client?.measurements ?? {});
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [tried, setTried] = useState(false);

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const submit = () => {
    setTried(true);
    if (!name.trim() || !phone.trim()) return;
    const saved = saveClient({ id: client?.id, name: name.trim(), phone: phone.trim(), weddingDate: wedding || undefined, source, measurements: m, notes });
    toast(client ? "Карточка обновлена" : "Клиентка добавлена");
    if (then === "fitting") openDialog({ kind: "fitting", clientId: saved.id });
    else {
      onClose();
      if (!client) openClient(saved.id);
    }
  };

  return (
    <Modal
      title={client ? "Редактировать карточку" : "Новая клиентка"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn" onClick={submit}>
            {client ? "Сохранить" : then === "fitting" ? "Дальше: записать на примерку" : "Добавить"}
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Имя и фамилия" error={tried && !name.trim() ? "Укажите имя" : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Телефон" error={tried && !phone.trim() ? "Укажите телефон" : undefined}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+7 9__ ___-__-__" />
        </Field>
        <Field label="Дата свадьбы">
          <input type="date" value={wedding} onChange={(e) => setWedding(e.target.value)} />
        </Field>
        <Field label="Откуда узнала о салоне">
          <select value={source} onChange={(e) => setSource(e.target.value as Source)}>
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset className="measure">
        <legend>Мерки, см</legend>
        {(
          [
            ["bust", "Грудь"],
            ["waist", "Талия"],
            ["hips", "Бёдра"],
            ["height", "Рост"],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label}>
            <input
              type="number"
              inputMode="numeric"
              value={m[k] ?? ""}
              onChange={(e) => setM((x) => ({ ...x, [k]: num(e.target.value) }))}
            />
          </Field>
        ))}
      </fieldset>
      <Field label="Заметки">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Пожелания, особенности фигуры, с кем приходила" />
      </Field>
    </Modal>
  );
}

/* ---------- Order: sale or rent ---------- */

function OrderForm({
  type: initialType,
  clientId,
  dressId,
  fittingId,
  order,
  onClose,
}: {
  type: Order["type"];
  clientId?: string;
  dressId?: string;
  fittingId?: string;
  order?: Order;
  onClose: () => void;
}) {
  const { db, saveOrder, toast, role } = useStore();
  const resolve = useResolveClient();
  const [type, setType] = useState<Order["type"]>(order?.type ?? initialType);
  const [client, setClient] = useState<ClientChoice>(order ? { id: order.clientId } : clientId ? { id: clientId } : null);
  const [dress, setDress] = useState<string | undefined>(order?.dressId ?? dressId);
  const dressObj = db.dresses.find((d) => d.id === dress);
  const [price, setPrice] = useState<string>(order ? String(order.price) : dressObj ? String(type === "sale" ? dressObj.salePrice : dressObj.rentPrice) : "");
  const [issue, setIssue] = useState(order?.issueDate ?? addDays(today(), type === "rent" ? 7 : 21));
  const [ret, setRet] = useState(order?.returnDate ?? addDays(issue, 2));
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [tried, setTried] = useState(false);

  const tryingFitting = fittingId ? db.fittings.find((f) => f.id === fittingId) : undefined;

  const pickDress = (id: string) => {
    setDress(id);
    const d = db.dresses.find((x) => x.id === id);
    if (d) setPrice(String(type === "sale" ? d.salePrice : d.rentPrice));
  };
  const switchType = (t: Order["type"]) => {
    setType(t);
    const d = db.dresses.find((x) => x.id === dress);
    if (d && ((t === "sale" && !d.forSale) || (t === "rent" && !d.forRent))) setDress(undefined);
    else if (d) setPrice(String(t === "sale" ? d.salePrice : d.rentPrice));
  };

  const conflict = dress && type === "rent" ? rentConflict(db, dress, issue, ret, order?.id) : undefined;
  const conflictClient = conflict ? db.clients.find((c) => c.id === conflict.clientId) : undefined;
  const badDates = type === "rent" && ret < issue;

  const submit = () => {
    setTried(true);
    if (!dress || !price || conflict || badDates) return;
    const id = resolve(client);
    if (!id) return;
    saveOrder({
      id: order?.id,
      type,
      clientId: id,
      dressId: dress,
      fittingId: order?.fittingId ?? fittingId,
      price: Number(price),
      issueDate: issue,
      returnDate: type === "rent" ? ret : undefined,
      notes,
    });
    toast(order ? "Сделка изменена" : type === "sale" ? "Продажа оформлена" : "Аренда оформлена");
    onClose();
  };

  return (
    <Modal
      title={order ? "Изменить сделку" : type === "sale" ? "Оформить продажу" : "Оформить аренду"}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn" onClick={submit}>
            {order ? "Сохранить" : type === "sale" ? "Оформить продажу" : "Оформить аренду"}
          </button>
        </>
      }
    >
      {!order && (
        <Segmented
          label="Тип сделки"
          value={type}
          onChange={switchType}
          options={[
            { value: "sale", label: "Продажа" },
            { value: "rent", label: "Аренда" },
          ]}
        />
      )}
      <Field group label="Клиентка">
        <ClientPicker value={client} onChange={setClient} error={tried && !resolveCheck(client) ? "Выберите клиентку или добавьте новую" : undefined} />
      </Field>
      <Field group
        label="Платье"
        hint={tryingFitting?.dressIds.length ? "Сначала показаны платья, которые она мерила" : undefined}
        error={tried && !dress ? "Выберите платье" : undefined}
      >
        <DressPicker
          selected={dress ? [dress] : []}
          onToggle={pickDress}
          first={tryingFitting?.dressIds}
          filter={(d) => {
            if (d.id === order?.dressId) return true;
            return type === "sale" ? d.forSale : d.forRent;
          }}
          note={(d) => {
            const st = dressState(db, d.id).state;
            const prefix = tryingFitting?.dressIds.includes(d.id) ? "мерила · " : "";
            const busy = type === "rent" && st !== "available" ? ` · ${DRESS_STATE_LABEL[st].toLowerCase()}` : "";
            return `${prefix}${rub(type === "sale" ? d.salePrice : d.rentPrice)}${busy}`;
          }}
        />
      </Field>
      <div className="grid-3">
        <Field label={type === "sale" ? "Цена продажи, ₽" : "Цена аренды, ₽"} error={tried && !price ? "Укажите цену" : undefined}>
          <input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} disabled={role === "admin" && !!order} />
        </Field>
        <Field label={type === "sale" ? "Дата выдачи" : "Выдать"}>
          <input
            type="date"
            value={issue}
            onChange={(e) => {
              setIssue(e.target.value);
              if (ret < e.target.value) setRet(addDays(e.target.value, 2));
            }}
          />
        </Field>
        {type === "rent" && (
          <Field label="Вернуть" error={badDates ? "Возврат раньше выдачи" : undefined}>
            <input type="date" value={ret} min={issue} onChange={(e) => setRet(e.target.value)} />
          </Field>
        )}
      </div>
      {conflict && (
        <p className="callout callout-bad" role="alert">
          <Icon name="alert" size={18} />
          {`Образец занят в аренде с ${fmtDate(conflict.issueDate)} по ${fmtDate(conflict.returnDate ?? conflict.issueDate)}${conflictClient ? ` — ${conflictClient.name}` : ""}. Выберите другие даты или другое платье.`}
        </p>
      )}
      <Field label="Комментарий">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Подгонка, фата, аксессуары" />
      </Field>
    </Modal>
  );
}

/* ---------- Dress ---------- */

const PHOTOS = Array.from({ length: 24 }, (_, i) => `/dresses/d${String(i + 1).padStart(2, "0")}.jpg`);

function DressForm({ dress, onClose }: { dress?: Dress; onClose: () => void }) {
  const { saveDress, toast, openDress } = useStore();
  const [name, setName] = useState(dress?.name ?? "");
  const [category, setCategory] = useState<Category>(dress?.category ?? "Свадебное");
  const [size, setSize] = useState(dress?.size ?? "44");
  const [color, setColor] = useState(dress?.color ?? "Белый");
  const [salePrice, setSalePrice] = useState(dress ? String(dress.salePrice) : "");
  const [rentPrice, setRentPrice] = useState(dress ? String(dress.rentPrice) : "");
  const [forSale, setForSale] = useState(dress?.forSale ?? true);
  const [forRent, setForRent] = useState(dress?.forRent ?? true);
  const [photo, setPhoto] = useState<string | undefined>(dress?.photo);
  const [tried, setTried] = useState(false);

  const submit = () => {
    setTried(true);
    if (!name.trim() || (!forSale && !forRent)) return;
    if ((forSale && !salePrice) || (forRent && !rentPrice)) return;
    const saved = saveDress({
      id: dress?.id,
      name: name.trim(),
      category,
      size,
      color,
      salePrice: Number(salePrice) || 0,
      rentPrice: Number(rentPrice) || 0,
      forSale,
      forRent,
      photo,
    });
    toast(dress ? "Платье обновлено" : "Платье добавлено");
    onClose();
    if (!dress) openDress(saved.id);
  };

  return (
    <Modal
      title={dress ? "Редактировать платье" : "Новое платье"}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn" onClick={submit}>
            {dress ? "Сохранить" : "Добавить платье"}
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Название модели" error={tried && !name.trim() ? "Укажите название" : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Категория">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Размер">
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            {["38", "40", "42", "44", "46", "48", "50", "52", "54"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Цвет">
          <input value={color} onChange={(e) => setColor(e.target.value)} />
        </Field>
      </div>
      <div className="grid-2">
        <div className="toggle-price">
          <label className="check">
            <input type="checkbox" checked={forSale} onChange={(e) => setForSale(e.target.checked)} />
            <span>Продаётся</span>
          </label>
          <Field label="Цена продажи, ₽" error={tried && forSale && !salePrice ? "Укажите цену" : undefined}>
            <input type="number" inputMode="numeric" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} disabled={!forSale} />
          </Field>
        </div>
        <div className="toggle-price">
          <label className="check">
            <input type="checkbox" checked={forRent} onChange={(e) => setForRent(e.target.checked)} />
            <span>Сдаётся в аренду</span>
          </label>
          <Field label="Цена аренды, ₽" error={tried && forRent && !rentPrice ? "Укажите цену" : undefined}>
            <input type="number" inputMode="numeric" value={rentPrice} onChange={(e) => setRentPrice(e.target.value)} disabled={!forRent} />
          </Field>
        </div>
      </div>
      {tried && !forSale && !forRent && <p className="field-error">Отметьте, продаётся платье или сдаётся в аренду</p>}
      <Field group label="Фото" hint="В рабочей версии здесь будет загрузка своих фото">
        <ul className="photo-pick" role="radiogroup" aria-label="Фото">
          {PHOTOS.map((p) => (
            <li key={p}>
              <button type="button" role="radio" aria-checked={photo === p} className={photo === p ? "is-on" : ""} onClick={() => setPhoto(p)}>
                <img src={p} alt="" />
              </button>
            </li>
          ))}
        </ul>
      </Field>
    </Modal>
  );
}
