/*
 * Общее хранилище демо-базы и фото — чтобы данные были одинаковыми на всех устройствах.
 *
 * На Vercel — Vercel Blob (приватные файлы, нужен BLOB_READ_WRITE_TOKEN: Storage → Blob → Connect).
 * Локально без токена — временная папка (LORI_LOCAL_SYNC_DIR), если задано LORI_LOCAL_SYNC=1 (для проверки).
 * Ни того ни другого — синхронизация выключена, CRM работает как раньше, только в браузере.
 */
import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
// вне папки проекта: иначе сервер разработки перезагружает страницу при каждой записи
const LOCAL_DIR = process.env.LORI_LOCAL_SYNC_DIR || path.join(os.tmpdir(), "lori-crm-sync");
const USE_LOCAL = !USE_BLOB && process.env.LORI_LOCAL_SYNC === "1";

export const syncEnabled = USE_BLOB || USE_LOCAL;

export class Conflict extends Error {}

export type Stored = { data: Buffer; etag: string };

const md5 = (b: Buffer) => `"${createHash("md5").update(b).digest("hex")}"`;
const localPath = (name: string) => path.join(LOCAL_DIR, name.replace(/\//g, "__"));

export async function readFile(name: string): Promise<Stored | null> {
  if (USE_BLOB) {
    const r = await get(name, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return { data: Buffer.from(await new Response(r.stream).arrayBuffer()), etag: r.blob.etag };
  }
  try {
    const data = await fs.readFile(localPath(name));
    return { data, etag: md5(data) };
  } catch {
    return null;
  }
}

/**
 * Записать файл. ifMatch — etag версии, на которой основаны изменения:
 *   строка — файл должен быть именно этой версии; null — файла ещё не должно быть;
 *   undefined — перезаписать без проверки (фото).
 * Если файл успели изменить с другого устройства — Conflict.
 */
export async function writeFile(name: string, data: Buffer, contentType: string, ifMatch?: string | null): Promise<string> {
  if (USE_BLOB) {
    if (ifMatch === null && (await readFile(name))) throw new Conflict();
    try {
      const r = await put(name, data, {
        access: "private",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: ifMatch !== null,
        cacheControlMaxAge: 60,
        ...(ifMatch ? { ifMatch } : {}),
      });
      return (r as { etag?: string }).etag ?? md5(data);
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) throw new Conflict();
      throw e;
    }
  }
  const cur = await readFile(name);
  if (ifMatch === null && cur) throw new Conflict();
  if (ifMatch && cur && cur.etag !== ifMatch) throw new Conflict();
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(localPath(name), data);
  return md5(data);
}

export async function removeFile(name: string) {
  if (USE_BLOB) {
    await del(name).catch(() => {});
    return;
  }
  await fs.unlink(localPath(name)).catch(() => {});
}
