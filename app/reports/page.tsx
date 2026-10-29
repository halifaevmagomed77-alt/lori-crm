"use client";

import { useState } from "react";
import { BarChart } from "@/components/BarChart";
import { OwnerTabs, PageHead } from "@/components/Shell";
import { Chip, Empty, Icon, Segmented } from "@/components/ui";
import { fmtDate, fmtShort, today } from "@/lib/dates";
import {
  buckets,
  byConsultant,
  byModel,
  bySupplier,
  cleaningByModel,
  finesStats,
  fmtMoney,
  funnel,
  idx,
  modelSupplierCompare,
  money,
  pct,
  presetPeriod,
  previousPeriod,
  refusals,
  rub,
  shortName,
  type Period,
  type PresetId,
} from "@/lib/derive";
import { useStore } from "@/lib/store";

const SERIES = [
  { key: "visits", label: "Зашли", color: "#3d6fc4" },
  { key: "records", label: "Записались", color: "#c98a24" },
  { key: "issued", label: "Выдано", color: "#c2507e" },
];

const PRESETS: { value: PresetId; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "7 дней" },
  { value: "month", label: "30 дней" },
  { value: "quarter", label: "3 месяца" },
  { value: "year", label: "Год" },
  { value: "custom", label: "Свой период" },
];

function Line({
  label,
  value,
  share,
  was,
  strong,
  alert,
}: {
  label: string;
  value: number | string;
  share?: string;
  was?: number | string;
  strong?: boolean;
  alert?: boolean;
}) {
  return (
    <div className={`rline${strong ? " is-strong" : ""}${alert ? " is-alert" : ""}`}>
      <span className="rline-label">{label}</span>
      <span className="rline-value">{value}</span>
      <span className="rline-note">
        {share}
        {was !== undefined && <span className="rline-was">{share ? " · " : ""}было {was}</span>}
      </span>
    </div>
  );
}

export default function ReportsPage() {
  const store = useStore();
  const { db, open, confirmPayment, toast } = store;
  const I = idx(db);
  const [preset, setPreset] = useState<PresetId>("month");
  const [custom, setCustom] = useState<Period>(presetPeriod("month"));
  const [view, setView] = useState<"chart" | "table">("chart");
  const [modelQ, setModelQ] = useState("");

  const p = preset === "custom" ? custom : presetPeriod(preset);
  const valid = p.from <= p.to;
  const prev = previousPeriod(p);
  const f = funnel(db, p);
  const pf = funnel(db, prev);
  const cons = byConsultant(db, p);
  const m = money(db, p);
  const ref = refusals(db, p);
  const fines = finesStats(db, p);
  const models = byModel(db, p).filter((x) => x.model.toLowerCase().includes(modelQ.trim().toLowerCase()));
  const sups = bySupplier(db, p);
  const compare = modelSupplierCompare(db, p);
  const clean = cleaningByModel(db, p);
  const bs = valid && preset !== "day" ? buckets(db, p) : [];
  const rows = bs.map((b) => ({ label: b.label, title: b.title, values: { visits: b.visits, records: b.records, issued: b.issued } }));
  const maxIssued = Math.max(1, ...models.map((x) => x.issued));

  return (
    <div className="page">
      <OwnerTabs />
      <PageHead title="Отчёты" sub={valid ? `${fmtDate(p.from)} — ${fmtDate(p.to)}` : "Проверьте даты"} />

      <div className="filters">
        <Segmented label="Период" value={preset} onChange={setPreset} options={PRESETS} />
        {preset === "custom" && (
          <>
            <label className="field">
              <span className="field-label">С</span>
              <input type="date" value={custom.from} max={today()} onChange={(e) => setCustom((x) => ({ ...x, from: e.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">По</span>
              <input type="date" value={custom.to} max={today()} onChange={(e) => setCustom((x) => ({ ...x, to: e.target.value }))} />
            </label>
          </>
        )}
      </div>

      {/* ---- Воронка: каждая строка — один показатель ---- */}
      <section className="report-lines" aria-label="Невесты за период">
        <h2 className="lines-title">Невесты</h2>
        <Line label="Зашли" value={f.visits} was={pf.visits} />
        <Line label="Примерка" value={f.tried} share={`${pct(f.tried, f.visits)} от зашедших`} was={pf.tried} />
        <Line label="Возвратные" value={f.returning} share={`${pct(f.returning, f.visits)} от зашедших`} was={pf.returning} />
        <Line label="Запись" value={f.records} share={`${pct(f.records, f.visits)} от зашедших`} was={pf.records} strong />
        <Line label="Отказ" value={f.refusals} share={`${pct(f.refusals, f.records)} от записей`} was={pf.refusals} />
        <Line label="Выдано" value={f.issued} was={pf.issued} />
      </section>

      {/* ---- Деньги: отдельным цветом, тоже построчно ---- */}
      <section className="report-lines money-lines" aria-label="Деньги за период">
        <h2 className="lines-title">Деньги</h2>
        <Line label="Залог" value={rub(m.deposit)} share="внесено по договорам на залог" />
        <Line label="Аренда" value={rub(m.rentFull)} share="полная сумма выданных платьев" />
        <Line label="Доп" value={rub(m.extra)} share="фотосессия, серьги, фата и др." />
        <Line label="Штрафы" value={rub(m.fines)} share="только штрафы невест" />
        <Line label="Отказы" value={rub(ref.depositKept)} share="залоги, оставшиеся салону" />
        <Line label="Получено" value={rub(m.received)} share="всего поступило в кассу" strong />
        {m.unconfirmed.length > 0 && <Line label="Ждут" value={rub(m.unconfirmedSum)} share={`${m.unconfirmed.length} оплат ждут вашего подтверждения`} alert />}
      </section>
      {m.unconfirmed.length > 0 && (
        <details className="panel panel-tight">
          <summary className="panel-title-sm">Подтвердить получение оплат ({m.unconfirmed.length})</summary>
          <ul className="entries">
            {m.unconfirmed.map((pm) => {
              const k = db.bookings.find((x) => x.id === pm.bookingId);
              return (
                <li key={pm.id} className="entry-li">
                  <button type="button" className="entry-row" onClick={() => open({ kind: "booking", id: pm.bookingId })}>
                    <span className="entry-time">{fmtShort(pm.date)}</span>
                    <span className="entry-name">
                      {rub(pm.amount)} · {pm.kind === "deposit" ? "залог" : pm.kind === "balance" ? "остаток" : pm.kind === "fine" ? "штраф" : "доп"}
                    </span>
                    <span className="entry-cons">{k ? `№ ${k.depositNo}, ${shortName(I.bride.get(k.brideId)?.name ?? "")}` : ""}</span>
                    <span className="entry-cons">{pm.method === "cash" ? "наличные" : pm.bank ?? "перевод"}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-red"
                    onClick={() => {
                      confirmPayment(pm.id);
                      toast("Получение подтверждено");
                    }}
                  >
                    Подтвердить
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* ---- Динамика ---- */}
      {rows.length > 1 && (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Динамика</h2>
            <Segmented
              label="Вид"
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "График" },
                { value: "table", label: "Таблица" },
              ]}
            />
          </div>
          {view === "chart" ? (
            <BarChart series={SERIES} rows={rows} />
          ) : (
            <div className="table-wrap">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th scope="col">Период</th>
                    <th scope="col" className="num">Зашли</th>
                    <th scope="col" className="num">Записались</th>
                    <th scope="col" className="num">% записи</th>
                    <th scope="col" className="num">Выдано</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.title}>
                      <td>{r.title}</td>
                      <td className="num">{r.values.visits}</td>
                      <td className="num">{r.values.records}</td>
                      <td className="num">{pct(r.values.records, r.values.visits)}</td>
                      <td className="num">{r.values.issued}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ---- Консультанты ---- */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Консультанты</h2>
          <span className="panel-hint">встретила / записала — как в книжке</span>
        </div>
        <p className="cons-summary tabular">
          Итого {f.visits}/{f.records} — {pct(f.records, f.visits)}
        </p>
        <div className="table-wrap">
          <table className="table table-compact">
            <thead>
              <tr>
                <th scope="col">Консультант</th>
                <th scope="col" className="num">Встретила</th>
                <th scope="col" className="num">Примерили</th>
                <th scope="col" className="num">Возвратные</th>
                <th scope="col" className="num">Записала</th>
                <th scope="col" className="num">% записи</th>
                <th scope="col" className="num">Отказы</th>
                <th scope="col" className="num">Выдано</th>
                <th scope="col" className="num">Сумма записей</th>
              </tr>
            </thead>
            <tbody>
              {cons.map((r) => (
                <tr key={r.staff.id}>
                  <td>{r.staff.name}</td>
                  <td className="num">{r.visits}</td>
                  <td className="num">{r.tried}</td>
                  <td className="num">{r.returning}</td>
                  <td className="num">{r.records}</td>
                  <td className="num">
                    <strong>{pct(r.records, r.visits)}</strong>
                  </td>
                  <td className="num">{r.refusals}</td>
                  <td className="num">{r.issued}</td>
                  <td className="num">{rub(r.recordSum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Процент записи бывает больше 100%: онлайн-записи без визита и возвратные невесты, которые первый раз приходили раньше, тоже идут в «записала».
        </p>
      </section>

      <div className="report-grid">
        {/* ---- Модели ---- */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Какие модели лучше сдаются</h2>
          </div>
          <div className="search-input">
            <Icon name="search" size={18} />
            <input value={modelQ} onChange={(e) => setModelQ(e.target.value)} placeholder="Название платья" aria-label="Фильтр по названию платья" />
          </div>
          {models.length ? (
            <ul className="hbars hbars-wide">
              {models.slice(0, 12).map((x) => (
                <li key={x.model}>
                  <span className="hbar-label">{x.model}</span>
                  <span className="hbar-track">
                    <span className="hbar" style={{ width: `${(x.issued / maxIssued) * 100}%` }} />
                  </span>
                  <span className="hbar-value">{x.issued}</span>
                  <span className="hbar-note">{rub(x.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Выдач за период нет" />
          )}
          <p className="muted small">Число — выдано за период, справа — сумма аренды.</p>
        </section>

        {/* ---- Отказы ---- */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Отказы</h2>
            <span className="panel-hint">{ref.count} за период</span>
          </div>
          <p className="small">
            Сумма аренды платьев: <strong>{rub(ref.rentLost)}</strong> · залоги, оставшиеся салону: <strong>{rub(ref.depositKept)}</strong>
          </p>
          {ref.list.length ? (
            <ul className="entries">
              {ref.list.slice(0, 12).map((k) => (
                <li key={k.id}>
                  <button type="button" className="entry-row" onClick={() => open({ kind: "booking", id: k.id })}>
                    <span className="entry-time">{fmtShort(k.refusedAt!)}</span>
                    <span className="entry-name">
                      {I.item.get(k.itemId)?.model} · {shortName(I.bride.get(k.brideId)?.name ?? "")}
                    </span>
                    <span className="entry-cons">
                      {rub(k.rentPrice)} / залог {rub(k.deposit)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Отказов не было" />
          )}
        </section>

        {/* ---- Штрафы ---- */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Штрафы невест</h2>
            <span className="panel-hint">
              {fines.count} на {rub(fines.sum)}
            </span>
          </div>
          {fines.byReason.length ? (
            <table className="table table-compact">
              <thead>
                <tr>
                  <th scope="col">За что</th>
                  <th scope="col" className="num">Раз</th>
                  <th scope="col" className="num">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {fines.byReason.map((r) => (
                  <tr key={r.reason}>
                    <td>{r.reason}</td>
                    <td className="num">{r.count}</td>
                    <td className="num">{rub(r.sum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="Штрафов не было" />
          )}
        </section>

        {/* ---- Химчистка ---- */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Химчистка</h2>
            <span className="panel-hint">{clean.reduce((s, x) => s + x.count, 0)} платьев</span>
          </div>
          {clean.length ? (
            <table className="table table-compact">
              <tbody>
                {clean.slice(0, 10).map((c) => (
                  <tr key={c.model}>
                    <td>{c.model}</td>
                    <td className="num">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="В химчистку не отправляли" />
          )}
        </section>
      </div>

      {/* ---- Поставщики ---- */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Поставщики</h2>
          <Chip tone="ink">видит только владелец</Chip>
        </div>
        <div className="table-wrap">
          <table className="table table-compact">
            <thead>
              <tr>
                <th scope="col">Поставщик</th>
                <th scope="col" className="num">Платьев</th>
                <th scope="col" className="num">Выдано</th>
                <th scope="col" className="num">Выручка</th>
                <th scope="col" className="num">На одно платье</th>
                <th scope="col">Лидеры</th>
              </tr>
            </thead>
            <tbody>
              {sups.map((s) => (
                <tr key={s.supplier.id}>
                  <td>{s.supplier.name}</td>
                  <td className="num">{s.items}</td>
                  <td className="num">{s.issued}</td>
                  <td className="num">{rub(s.revenue)}</td>
                  <td className="num">{rub(s.perItem)}</td>
                  <td>{s.top.map(([model, n]) => `${model} (${n})`).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {compare.length > 0 && (
          <>
            <h3 className="section-label compare-title">Одна модель — разные поставщики: у кого выгоднее брать</h3>
            <div className="compare-grid">
              {compare.map((c) => (
                <div key={c.model} className="compare-card">
                  <p className="compare-model">{c.model}</p>
                  <ul className="compare-rows">
                    {c.rows
                      .slice()
                      .sort((a, b) => b.payback - a.payback)
                      .map((r, i) => (
                        <li key={r.item.id} className={i === 0 && r.payback > 0 ? "is-best" : undefined}>
                          <span className="compare-sup">{r.supplier.name}</span>
                          <span className="compare-nums">
                            закупка {fmtMoney(r.item.purchasePrice, r.item.purchaseCurrency)} · выдано {r.issued} · окупилось <strong>{Math.round(r.payback * 100)}%</strong>
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="muted small">«Окупилось» — выручка аренды за период к цене закупки этого экземпляра.</p>
          </>
        )}
      </section>
    </div>
  );
}
