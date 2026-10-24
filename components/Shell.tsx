"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore, type Permission } from "@/lib/store";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { DialogHost } from "./forms";
import { SheetHost } from "./sheets";
import { Icon } from "./ui";

const NAV: { href: string; label: string; icon: string; need?: Permission }[] = [
  { href: "/", label: "Журнал", icon: "book" },
  { href: "/brides", label: "Невесты", icon: "clients" },
  { href: "/records", label: "Записи", icon: "file" },
  { href: "/dresses", label: "Платья", icon: "dress" },
  { href: "/cleaning", label: "Химчистка", icon: "drop", need: "cleaning" },
  { href: "/staff", label: "Сотрудники", icon: "team", need: "manageStaff" },
  { href: "/reports", label: "Отчёты", icon: "reports", need: "reports" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, can, openDialog, toasts, logout } = useStore();

  if (!user) return <Login />;

  const nav = NAV.filter((n) => !n.need || can(n.need));
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const allowed = nav.some((n) => isActive(n.href));
  // мобильная панель: 5 главных пунктов, остальное — в «Ещё»
  const tabs = nav.slice(0, 4);

  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Lori CRM, журнал">
          <span className="wordmark">LORI</span>
          <span className="brand-sub">журнал салона</span>
        </Link>
        <div className="quick">
          <button type="button" className="btn btn-block" onClick={() => openDialog({ kind: "visit" })}>
            <Icon name="door" size={18} /> Зашла невеста
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => openDialog({ kind: "booking" })}>
            <Icon name="file" size={18} /> Запись (залог)
          </button>
        </div>
        <nav className="side-nav" aria-label="Разделы">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <div className="me">
            <span className="me-name">{user.name}</span>
            <span className="me-role">{ROLE_LABEL[user.role]}</span>
          </div>
          <button type="button" className="link-btn small" onClick={logout}>
            <Icon name="logout" size={14} /> Сменить пользователя
          </button>
        </div>
      </aside>

      <header className="topbar">
        <Link href="/" className="wordmark">
          LORI
        </Link>
        <button type="button" className="me-mini" onClick={logout} aria-label="Сменить пользователя">
          {user.name} · {ROLE_LABEL[user.role].toLowerCase()}
        </button>
      </header>

      <main className="main" id="main">
        {allowed ? (
          children
        ) : (
          <div className="page">
            <p className="empty-title">Этот раздел недоступен для роли «{ROLE_LABEL[user.role]}».</p>
          </div>
        )}
      </main>

      <div className="fab-group">
        <button type="button" className="fab fab-secondary" onClick={() => openDialog({ kind: "booking" })} aria-label="Запись, договор на залог">
          <Icon name="file" size={22} />
        </button>
        <button type="button" className="fab" onClick={() => openDialog({ kind: "visit" })} aria-label="Зашла невеста">
          <Icon name="door" size={24} />
        </button>
      </div>

      <nav className="tabbar" aria-label="Разделы">
        {tabs.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </Link>
        ))}
        {nav.length > 4 && (
          <details className="tab-more">
            <summary aria-label="Ещё разделы">
              <Icon name="plus" size={22} />
              <span>Ещё</span>
            </summary>
            <div className="tab-more-menu">
              {nav.slice(4).map((n) => (
                <Link key={n.href} href={n.href} onClick={(e) => (e.currentTarget.closest("details") as HTMLDetailsElement).removeAttribute("open")}>
                  <Icon name={n.icon} size={18} /> {n.label}
                </Link>
              ))}
            </div>
          </details>
        )}
      </nav>

      <SheetHost />
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

function Login() {
  const { db, login, resetDemo, toast } = useStore();
  const groups: Role[] = ["owner", "admin", "employee"];
  return (
    <div className="login">
      <div className="login-card">
        <p className="wordmark login-mark">LORI</p>
        <h1 className="login-title">Кто работает?</h1>
        <p className="muted">В рабочей версии здесь вход по номеру телефона. В демо выберите учётную запись, чтобы увидеть, что доступно каждой роли.</p>
        {groups.map((g) => {
          const people = db.staff.filter((s) => s.role === g && s.active);
          return (
            <section key={g} className="login-group">
              <h2 className="section-label">{g === "employee" ? `Консультанты (${people.length} из 30)` : ROLE_LABEL[g]}</h2>
              <div className="login-list">
                {people.map((s) => (
                  <button key={s.id} type="button" className="login-btn" onClick={() => login(s.id)}>
                    <span className="login-name">{s.name}</span>
                    <span className="login-role">
                      {g === "owner" ? "всё, включая финансы и поставщиков" : g === "admin" ? "текущая работа, без финансов" : "первичная запись невест"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
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
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
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
