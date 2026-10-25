"use client";

import { useEffect, useState } from "react";

/*
 * Фото платьев хранятся в IndexedDB браузера (а не в localStorage: там мало места).
 * В рабочей версии фото будут загружаться на сервер.
 */

const DB_NAME = "lori-crm-photos";
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Уменьшает фото до 1000px по длинной стороне и сохраняет. Возвращает ссылку вида "idb:<id>". */
export async function savePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.82));
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  await tx("readwrite", (s) => s.put(blob, id));
  return `idb:${id}`;
}

export async function deletePhoto(ref?: string) {
  if (!ref?.startsWith("idb:")) return;
  try {
    await tx("readwrite", (s) => s.delete(ref.slice(4)));
  } catch {}
}

export async function clearPhotos() {
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {}
}

/** URL для <img>: обычный путь отдаётся как есть, "idb:" читается из IndexedDB */
export function usePhoto(ref?: string): string | undefined {
  const [loaded, setLoaded] = useState<{ ref: string; url: string } | null>(null);
  const isIdb = !!ref && ref.startsWith("idb:");
  useEffect(() => {
    if (!ref || !isIdb) return;
    let alive = true;
    let objectUrl: string | undefined;
    tx<Blob | undefined>("readonly", (s) => s.get(ref.slice(4)))
      .then((blob) => {
        if (!alive || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ ref, url: objectUrl });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ref, isIdb]);
  if (!ref) return undefined;
  if (!isIdb) return ref;
  return loaded?.ref === ref ? loaded.url : undefined;
}
