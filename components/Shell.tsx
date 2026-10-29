"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TEST_ACCOUNTS } from "@/lib/seed";
import { useStore, type Permission } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/types";
import { DemoBar } from "./Demo";
import { DialogHost } from "./forms";
import { SheetHost } from "./sheets";
import { Icon } from "./ui";

type NavItem = { href: string; label: string; short?: string; icon: string; need?: Permission; also?: string[] };

/** Пять блоков по порядку владельца: журнал, книга записей, редактор, табель, отчёты */
const NAV: NavItem[] = [
  { href: "/", label: "Журнал", icon: "book", need: "editAll" },
  { href: "/records", label: "Книга записей", short: "Книга записей", icon: "file" },
  { href: "/brides", label: "Редактор", icon: "edit", need: "editAll", also: ["/dresses", "/cleaning"] },
  { href: "/timesheet", label: "Табель", icon: "clock", need: "attendance" },
  { href: "/reports", label: "Отчёты", icon: "reports", need: "reports", also: ["/staff"] },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, can, openDialog, toasts, logout } = useStore();
  const router = useRouter();
  // у консультанта нет журнала: его главная страница — «Книга записей»
  const home = user && !can("editAll") ? "/records" : "/";
  useEffect(() => {
    if (user && path === "/" && home !== "/") router.replace(home);
  }, [user, path, home, router]);

  // табель для планшета — отдельное приложение со своим входом, без меню CRM
  if (path.startsWith("/tabel")) return <>{children}</>;
  if (!user) return <Login />;

  // у консультанта нет «Редактора»: невесты и платья — вкладки «Книги записей»
  const nav = NAV.filter((n) => !n.need || can(n.need)).map((n) =>
    n.href === "/records" && !can("editAll") ? { ...n, also: ["/brides", "/dresses"] } : n,
  );
  const isActive = (n: NavItem) =>
    n.href === "/" ? path === "/" : [n.href, ...(n.also ?? [])].some((h) => path.startsWith(h));
  const allowed =
    nav.some(isActive) && (!path.startsWith("/staff") || can("manageStaff")) && (!path.startsWith("/cleaning") || can("cleaning"));
  const label = (n: NavItem) => n.label;

  return (
    <div className={`app${nav.length > 1 ? "" : " no-tabbar"}`}>
      <aside className="sidebar">
        <Link href={home} className="brand" aria-label="Lori CRM, главная">
          <span className="wordmark">LORI</span>
          <span className="brand-sub">журнал салона</span>
        </Link>
        <div className="quick">
          <button type="button" className="btn btn-block" onClick={() => openDialog({ kind: "visit" })}>
            <Icon name="plus" size={18} /> Новая запись
          </button>
        </div>
        <nav className="side-nav" aria-label="Разделы">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n) ? "page" : undefined}>
              <Icon name={n.icon} />
              {label(n)}
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
        <Link href={home} className="wordmark">
          LORI
        </Link>
        <button type="button" className="me-mini" onClick={logout} aria-label="Сменить пользователя">
          {user.name === ROLE_LABEL[user.role] ? user.name : `${user.name} · ${ROLE_LABEL[user.role].toLowerCase()}`}
        </button>
      </header>

      <main className="main" id="main">
        {allowed ? (
          children
        ) : path === "/" && home !== "/" ? null : (
          <div className="page">
            <p className="empty-title">Этот раздел недоступен для роли «{ROLE_LABEL[user.role]}».</p>
          </div>
        )}
        <DemoBar />
      </main>

      <div className="fab-group">
        <button type="button" className="fab" onClick={() => openDialog({ kind: "visit" })} aria-label="Новая запись">
          <Icon name="plus" size={26} />
        </button>
      </div>

      {nav.length > 1 && (
      <nav className="tabbar" aria-label="Разделы">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(n) ? "page" : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{label(n)}</span>
          </Link>
        ))}
      </nav>
      )}

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

  const router = useRouter();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = login(name, password);
    setError(err);
    // после входа — всегда журнал: прошлый раздел может быть закрыт для новой роли
    if (!err) router.push("/");
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

/** Вкладки внутри блока: Редактор → Невесты / Платья / Химчистка; Отчёты → Отчёты / Сотрудники */
export function SubTabs({ items }: { items: { href: string; label: string; show?: boolean }[] }) {
  const path = usePathname();
  const list = items.filter((i) => i.show !== false);
  if (list.length < 2) return null;
  return (
    <nav className="subtabs" aria-label="Подразделы">
      {list.map((i) => (
        <Link key={i.href} href={i.href} aria-current={path.startsWith(i.href) ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function EditorTabs() {
  const { can } = useStore();
  // консультант попадает к невестам и платьям из «Книги записей»
  if (!can("editAll")) return <BookTabs />;
  return (
    <SubTabs
      items={[
        { href: "/brides", label: "Невесты" },
        { href: "/dresses", label: "Платья" },
        { href: "/cleaning", label: "Химчистка", show: can("cleaning") },
      ]}
    />
  );
}

/** Вкладки «Книги записей» у консультанта */
export function BookTabs() {
  const { can } = useStore();
  if (can("editAll")) return null;
  return (
    <SubTabs
      items={[
        { href: "/records", label: "Записи" },
        { href: "/brides", label: "Невесты" },
        { href: "/dresses", label: "Платья" },
      ]}
    />
  );
}

export function OwnerTabs() {
  const { can } = useStore();
  return (
    <SubTabs
      items={[
        { href: "/reports", label: "Отчёты", show: can("reports") },
        { href: "/staff", label: "Сотрудники", show: can("manageStaff") },
      ]}
    />
  );
}
