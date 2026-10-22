"use client";

import { useState } from "react";
import { PageHead } from "@/components/Shell";
import { BarChart } from "@/components/BarChart";
import { Empty, Icon, Segmented } from "@/components/ui";
import { diffDays, fmtDate, fmtShort, today } from "@/lib/dates";
import { buckets, presetPeriod, previousPeriod, rub, sourcesBreakdown, topDresses, totals, type Period, type PresetId } from "@/lib/derive";
import { useStore } from "@/lib/store";

const SERIES = [
  { key: "fittings", label: "Примерки", color: "#3d6fc4" },
  { key: "sales", label: "Продажи", color: "#c98a24" },
  { key: "rents", label: "Аренда", color: "#c2507e" },
];

const PRESETS: { value: PresetId; label: string }[] = [
  { value: "week", label: "7 дней" },
  { value: "month", label: "30 дней" },
  { value: "quarter", label: "3 месяца" },
  { value: "year", label: "Год" },
  { value: "custom", label: "Свой период" },
];

function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0 && now === 0) return <span className="delta">как и в прошлом периоде</span>;
  const diff = now - before;
  if (diff === 0) return <span className="delta">как и в прошлом периоде</span>;
  return (
    <span className={`delta ${diff > 0 ? "delta-up" : "delta-down"}`}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff)} к прошлому периоду
    </span>
  );
}

export default function ReportsPage() {
  const { db, role } = useStore();
  const [preset, setPreset] = useState<PresetId>("month");
  const [custom, setCustom] = useState<Period>(presetPeriod("month"));
  const [view, setView] = useState<"chart" | "table">("chart");

  if (role !== "owner") {
    return (
      <div className="page">
        <PageHead title="Отчёты" />
        <Empty title="Отчёты видит только владелец" text="Переключите роль внизу меню, чтобы посмотреть, как это выглядит у владельца." />
      </div>
    );
  }

  const period = preset === "custom" ? custom : presetPeriod(preset);
  const valid = period.from <= period.to;
  const prev = previousPeriod(period);
  const cur = totals(db, period);
  const was = totals(db, prev);
  const bs = valid ? buckets(db, period) : [];
  const len = diffDays(period.to, period.from) + 1;
  const unit = len <= 14 ? "по дням" : len <= 120 ? "по неделям" : "по месяцам";
  const top = topDresses(db, period);
  const sources = sourcesBreakdown(db, period);
  const srcMax = Math.max(1, ...sources.map((s) => s.count));

  const rows = bs.map((b) => ({
    label: b.label,
    title: b.from === b.to ? fmtDate(b.from) : `${fmtShort(b.from)} — ${fmtShort(b.to)}`,
    values: { fittings: b.fittings, sales: b.sales, rents: b.rents },
  }));

  return (
    <div className="page">
      <PageHead title="Отчёты" sub={`${fmtDate(period.from)} — ${fmtDate(period.to)}`} />

      <div className="toolbar">
        <Segmented label="Период" value={preset} onChange={setPreset} options={PRESETS} />
        {preset === "custom" && (
          <div className="custom-range">
            <label className="field field-inline">
              <span className="field-label">С</span>
              <input type="date" value={custom.from} max={today()} onChange={(e) => setCustom((p) => ({ ...p, from: e.target.value }))} />
            </label>
            <label className="field field-inline">
              <span className="field-label">по</span>
              <input type="date" value={custom.to} max={today()} onChange={(e) => setCustom((p) => ({ ...p, to: e.target.value }))} />
            </label>
            {!valid && <span className="field-error">Начало периода позже конца</span>}
          </div>
        )}
      </div>

      <section className="tiles" aria-label="Итоги периода">
        <div className="tile">
          <span className="tile-label">Примерок</span>
          <span className="tile-value">{cur.fittings}</span>
          <Delta now={cur.fittings} before={was.fittings} />
        </div>
        <div className="tile">
          <span className="tile-label">Продано платьев</span>
          <span className="tile-value">{cur.sales}</span>
          <Delta now={cur.sales} before={was.sales} />
        </div>
        <div className="tile">
          <span className="tile-label">Сдано в аренду</span>
          <span className="tile-value">{cur.rents}</span>
          <Delta now={cur.rents} before={was.rents} />
        </div>
        <div className="tile">
          <span className="tile-label">Купили или арендовали после примерки</span>
          <span className="tile-value">{Math.round(cur.conversion * 100)}%</span>
          <span className="delta">в прошлом периоде {Math.round(was.conversion * 100)}%</span>
        </div>
      </section>

      <p className="revenue">
        Выручка за период: <strong>{rub(cur.saleRevenue + cur.rentRevenue)}</strong>
        <span className="muted">
          {" "}
          · продажи {rub(cur.saleRevenue)} · аренда {rub(cur.rentRevenue)}
          {cur.noshow > 0 && ` · не пришли на примерку: ${cur.noshow}`}
        </span>
      </p>

      <section className="panel" aria-labelledby="r-chart">
        <div className="panel-head">
          <h2 id="r-chart" className="panel-title">Динамика {unit}</h2>
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
        {!valid ? (
          <Empty title="Проверьте даты периода" />
        ) : view === "chart" ? (
          <BarChart series={SERIES} rows={rows} />
        ) : (
          <div className="table-wrap">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th scope="col">Период</th>
                  <th scope="col" className="num">Примерки</th>
                  <th scope="col" className="num">Продажи</th>
                  <th scope="col" className="num">Аренда</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.title}>
                    <td>{r.title}</td>
                    <td className="num">{r.values.fittings}</td>
                    <td className="num">{r.values.sales}</td>
                    <td className="num">{r.values.rents}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Итого</td>
                  <td className="num">{cur.fittings}</td>
                  <td className="num">{cur.sales}</td>
                  <td className="num">{cur.rents}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="report-grid">
        <section className="panel" aria-labelledby="r-top">
          <div className="panel-head">
            <h2 id="r-top" className="panel-title">Популярные платья</h2>
          </div>
          {top.length ? (
            <div className="table-wrap">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th scope="col">Платье</th>
                    <th scope="col" className="num">Мерили</th>
                    <th scope="col" className="num">Продано</th>
                    <th scope="col" className="num">Аренда</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((t) => (
                    <tr key={t.dress.id}>
                      <td>
                        <span className="mini-dress">
                          {t.dress.photo && <img src={t.dress.photo} alt="" />}
                          {t.dress.name}
                        </span>
                      </td>
                      <td className="num">{t.tried}</td>
                      <td className="num">{t.sales}</td>
                      <td className="num">{t.rents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="За этот период сделок не было" />
          )}
        </section>

        <section className="panel" aria-labelledby="r-src">
          <div className="panel-head">
            <h2 id="r-src" className="panel-title">Откуда приходят новые клиентки</h2>
          </div>
          {sources.length ? (
            <ul className="hbars">
              {sources.map((s) => (
                <li key={s.source}>
                  <span className="hbar-label">{s.source}</span>
                  <span className="hbar-track">
                    <span className="hbar" style={{ width: `${(s.count / srcMax) * 100}%` }} />
                  </span>
                  <span className="hbar-value">{s.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Новых клиенток за период нет" />
          )}
        </section>
      </div>

      <p className="muted small report-note">
        <Icon name="alert" size={14} /> Продажи и аренда считаются по дате оформления сделки, примерки — только те, на которые клиентка пришла.
      </p>
    </div>
  );
}
