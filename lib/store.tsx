"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createSeed } from "./seed";
import { today } from "./dates";
import type { Client, DB, Dress, Fitting, FittingStatus, Order, OrderStatus, Role } from "./types";

const KEY = "lori-crm:v1";
const ROLE_KEY = "lori-crm:role";

export type Drawer = { kind: "client"; id: string } | { kind: "dress"; id: string } | null;

export type DialogState =
  | { kind: "fitting"; fitting?: Fitting; clientId?: string; date?: string; time?: string }
  | { kind: "client"; client?: Client; then?: "fitting" }
  | { kind: "order"; type: Order["type"]; clientId?: string; dressId?: string; fittingId?: string; order?: Order }
  | { kind: "dress"; dress?: Dress }
  | null;

type Toast = { id: number; text: string };

type Store = {
  db: DB;
  role: Role;
  setRole: (r: Role) => void;
  drawer: Drawer;
  openClient: (id: string) => void;
  openDress: (id: string) => void;
  closeDrawer: () => void;
  dialog: DialogState;
  openDialog: (d: DialogState) => void;
  closeDialog: () => void;
  toast: (text: string) => void;
  toasts: Toast[];
  saveClient: (c: Omit<Client, "id" | "createdAt"> & { id?: string }) => Client;
  saveFitting: (f: Omit<Fitting, "id"> & { id?: string }) => Fitting;
  setFittingStatus: (id: string, status: FittingStatus) => void;
  saveOrder: (o: Omit<Order, "id" | "createdAt" | "status"> & { id?: string; status?: OrderStatus }) => Order;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  saveDress: (d: Omit<Dress, "id" | "createdAt"> & { id?: string }) => Dress;
  resetDemo: () => void;
};

const Ctx = createContext<Store | null>(null);

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function load(): DB {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    /* хранилище недоступно — работаем в памяти */
  }
  return createSeed();
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [role, setRoleState] = useState<Role>("owner");
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const data = load();
    let r: Role = "owner";
    try {
      if (window.localStorage.getItem(ROLE_KEY) === "admin") r = "admin";
    } catch {}
    // единоразовая загрузка из localStorage после монтирования
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDb(data);
    setRoleState(r);
  }, []);

  useEffect(() => {
    if (!db) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(db));
    } catch {}
  }, [db]);

  const update = useCallback((fn: (d: DB) => DB) => setDb((d) => (d ? fn(d) : d)), []);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const store = useMemo<Store | null>(() => {
    if (!db) return null;
    return {
      db,
      role,
      setRole: (r) => {
        setRoleState(r);
        try {
          window.localStorage.setItem(ROLE_KEY, r);
        } catch {}
      },
      drawer,
      openClient: (id) => setDrawer({ kind: "client", id }),
      openDress: (id) => setDrawer({ kind: "dress", id }),
      closeDrawer: () => setDrawer(null),
      dialog,
      openDialog: setDialog,
      closeDialog: () => setDialog(null),
      toast,
      toasts,
      saveClient: (input) => {
        const existing = input.id ? db.clients.find((c) => c.id === input.id) : undefined;
        const client: Client = existing
          ? { ...existing, ...input, id: existing.id }
          : { ...input, id: uid("c"), createdAt: today() };
        update((d) => ({
          ...d,
          clients: existing ? d.clients.map((c) => (c.id === client.id ? client : c)) : [...d.clients, client],
        }));
        return client;
      },
      saveFitting: (input) => {
        const fitting: Fitting = { ...input, id: input.id ?? uid("f") };
        update((d) => {
          const others = d.fittings.filter((f) => f.id !== fitting.id);
          const all = [...others, fitting].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
          return { ...d, fittings: all };
        });
        return fitting;
      },
      setFittingStatus: (id, status) =>
        update((d) => ({ ...d, fittings: d.fittings.map((f) => (f.id === id ? { ...f, status } : f)) })),
      saveOrder: (input) => {
        const existing = input.id ? db.orders.find((o) => o.id === input.id) : undefined;
        const order: Order = existing
          ? { ...existing, ...input, id: existing.id, status: input.status ?? existing.status }
          : { ...input, id: uid("o"), createdAt: today(), status: input.status ?? "booked" };
        update((d) => ({
          ...d,
          orders: existing ? d.orders.map((o) => (o.id === order.id ? order : o)) : [...d.orders, order],
        }));
        return order;
      },
      setOrderStatus: (id, status) =>
        update((d) => ({ ...d, orders: d.orders.map((o) => (o.id === id ? { ...o, status } : o)) })),
      saveDress: (input) => {
        const existing = input.id ? db.dresses.find((x) => x.id === input.id) : undefined;
        const dress: Dress = existing
          ? { ...existing, ...input, id: existing.id }
          : { ...input, id: uid("d"), createdAt: today() };
        update((d) => ({
          ...d,
          dresses: existing ? d.dresses.map((x) => (x.id === dress.id ? dress : x)) : [...d.dresses, dress],
        }));
        return dress;
      },
      resetDemo: () => {
        const fresh = createSeed();
        setDb(fresh);
        setDrawer(null);
        setDialog(null);
      },
    };
  }, [db, role, drawer, dialog, toasts, toast, update]);

  if (!store) {
    return (
      <div className="boot" aria-busy="true">
        <span className="wordmark">LORI</span>
      </div>
    );
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

export function useClient(id?: string) {
  const { db } = useStore();
  return id ? db.clients.find((c) => c.id === id) : undefined;
}

export function useDress(id?: string) {
  const { db } = useStore();
  return id ? db.dresses.find((d) => d.id === id) : undefined;
}
