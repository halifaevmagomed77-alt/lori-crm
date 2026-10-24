"use client";

import { useState } from "react";
import { PageHead } from "@/components/Shell";
import { Empty, Icon, Segmented } from "@/components/ui";
import { diffDays, fmtDate, fmtShort, today } from "@/lib/dates";
import { cleaningByModel, idx, inP, presetPeriod, type PresetId } from "@/lib/derive";
import { useStore } from "@/lib/store";

export default function CleaningPage() {
  const { db, open, cleaningBack, toast } = useStore();
  const I = idx(db);
  const [preset, setPreset] = useState<Exclude<PresetId, "custom" | "day">>("month");
  const p = presetPeriod(preset);
  const now = db.cleanings.filter((c) => !c.backAt).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const byModel = cleaningByModel(db, p);
  const total = db.cleanings.filter((c) => inP(c.sentAt, p)).length;
  const max = Math.max(1, ...byModel.map((m) => m.count));

  return (
    <div className="page">
      <PageHead title="Химчистка" sub={`Сейчас в химчистке: ${now.length}`} />

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Сейчас в химчистке</h2>
        </div>
        {now.length ? (
          <ul className="entries">
            {now.map((c) => {
              const it = I.item.get(c.itemId);
              const days = diffDays(today(), c.sentAt);
              return (
                <li key={c.id} className="entry-li">
                  <button type="button" className="entry-row" onClick={() => it && open({ kind: "item", id: it.id })}>
                    <span className="entry-time">{fmtShort(c.sentAt)}</span>
                    <span className="entry-name">{it?.model}</span>
                    <span className="entry-cons">р. {it?.size}</span>
                    <span className={`entry-cons${days > 5 ? " text-bad" : ""}`}>{days} дн.</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      cleaningBack(c.id);
                      toast(`${it?.model} вернулось из химчистки`);
                    }}
                  >
                    Вернулось
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="Все платья в салоне" />
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Сколько ушло в химчистку</h2>
          <Segmented
            label="Период"
            value={preset}
            onChange={setPreset}
            options={[
              { value: "week", label: "7 дней" },
              { value: "month", label: "30 дней" },
              { value: "quarter", label: "3 месяца" },
              { value: "year", label: "Год" },
            ]}
          />
        </div>
        <p className="muted small">
          {fmtDate(p.from)} — {fmtDate(p.to)}: всего {total}
        </p>
        {byModel.length ? (
          <ul className="hbars">
            {byModel.map((m) => (
              <li key={m.model}>
                <span className="hbar-label">{m.model}</span>
                <span className="hbar-track">
                  <span className="hbar" style={{ width: `${(m.count / max) * 100}%` }} />
                </span>
                <span className="hbar-value">{m.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="За период платья в химчистку не отправляли" />
        )}
        <p className="muted small page-note">
          <Icon name="alert" size={14} /> Стоимость химчистки пока не учитываем — добавим, когда владелец решит.
        </p>
      </section>
    </div>
  );
}
