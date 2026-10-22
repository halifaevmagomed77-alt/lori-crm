"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { DialogHost } from "./forms";
import { DrawerHost } from "./drawers";
import { Icon } from "./ui";

const NAV = [
  { href: "/", label: "Сегодня", icon: "today" },
  { href: "/calendar", label: "Календарь", icon: "calendar" },
  { href: "/clients", label: "Клиентки", icon: "clients" },
  { href: "/dresses", label: "Платья", icon: "dress" },
  { href: "/reports", label: "Отчёты", icon: "reports", owner: true },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { role, setRole, openDialog, toasts, resetDemo, toast } = useStore();
  const nav = NAV.filter((n) => !n.owner || role === "owner");
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Lori CRM, на главную">
          <span className="wordmark">LORI</span>
          <span className="brand-sub">CRM салона</span>
        </Link>
        <button type="button" className="btn btn-block" onClick={() => openDialog({ kind: "fitting" })}>
          <Icon name="plus" size={18} /> Записать на примерку
        </button>
        <nav className="side-nav" aria-label="Разделы">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <label className="role-switch">
            <span className="field-label">Вы вошли как</span>
            <select value={role} onChange={(e) => setRole(e.target.value as "owner" | "admin")}>
              <option value="owner">Владелец</option>
              <option value="admin">Администратор</option>
            </select>
          </label>
          <p className="demo-note">Демо-версия. Все клиентки и сделки вымышленные, изменения сохраняются только в этом браузере.</p>
          <button
            type="button"
            className="link-btn small"
            onClick={() => {
              resetDemo();
              toast("Демо-данные восстановлены");
            }}
          >
            <Icon name="reset" size={14} /> Сбросить демо-данные
          </button>
        </div>
      </aside>

      <header className="topbar">
        <Link href="/" className="wordmark">
          LORI
        </Link>
        <select className="role-mini" value={role} onChange={(e) => setRole(e.target.value as "owner" | "admin")} aria-label="Роль">
          <option value="owner">Владелец</option>
          <option value="admin">Администратор</option>
        </select>
      </header>

      <main className="main" id="main">
        {children}
      </main>

      <button type="button" className="fab" onClick={() => openDialog({ kind: "fitting" })} aria-label="Записать на примерку">
        <Icon name="plus" size={26} />
      </button>

      <nav className="tabbar" aria-label="Разделы">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>

      <DrawerHost />
      <DialogHost />

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <Icon name="check" size={16} />
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
