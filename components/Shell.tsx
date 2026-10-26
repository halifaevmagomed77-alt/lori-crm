"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TEST_ACCOUNTS } from "@/lib/seed";
import { useStore, type Permission } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/types";
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
          {user.name === ROLE_LABEL[user.role] ? user.name : `${user.name} · ${ROLE_LABEL[user.role].toLowerCase()}`}
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
  const { login } = useStore();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(login(name, password));
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <p className="wordmark login-mark">LORI</p>
        <h1 className="login-title">Вход в CRM</h1>
        <label className="field">
          <span className="field-label">Логин</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Пароль</span>
          <span className="pass-wrap">
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="button" className="link-btn small" onClick={() => setShow((v) => !v)}>
              {show ? "Скрыть" : "Показать"}
            </button>
          </span>
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-block">
          Войти
        </button>
        <details className="details test-accounts">
          <summary>Тестовые учётные записи</summary>
          <table className="table table-compact">
            <thead>
              <tr>
                <th scope="col">Роль</th>
                <th scope="col">Логин</th>
                <th scope="col">Пароль</th>
              </tr>
            </thead>
            <tbody>
              {TEST_ACCOUNTS.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="tabular">{a.login}</td>
                  <td className="tabular">{a.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="field-hint">Владелец может сменить логины и пароли в разделе «Сотрудники». Эту подсказку уберём в рабочей версии.</p>
        </details>
      </form>
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
