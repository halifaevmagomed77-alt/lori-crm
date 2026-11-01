"use client";

/*
 * Клиент общей демо-базы (/api/sync). База ходит по сети сжатой gzip.
 * Если сервер отвечает 503 — синхронизация выключена, CRM работает только в браузере, как раньше.
 */
import type { DB } from "./types";

export type Pulled = { kind: "off" } | { kind: "empty" } | { kind: "db"; db: DB; etag: string } | { kind: "error" };
export type Pushed = { kind: "ok"; etag: string } | { kind: "conflict"; db: DB | null; etag: string | null } | { kind: "off" } | { kind: "error" };

async function gzip(text: string): Promise<Blob> {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(s).blob();
}

async function gunzipJson(res: Response): Promise<DB> {
  const s = res.body!.pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(s).text()) as DB;
}

export async function pullDb(): Promise<Pulled> {
  try {
    const r = await fetch("/api/sync", { cache: "no-store" });
    if (r.status === 503) return { kind: "off" };
    if (r.status === 204) return { kind: "empty" };
    if (!r.ok) return { kind: "error" };
    return { kind: "db", db: await gunzipJson(r), etag: r.headers.get("x-etag") ?? "" };
  } catch {
    return { kind: "error" };
  }
}

export async function pushDb(db: DB, etag: string | null): Promise<Pushed> {
  try {
    const r = await fetch("/api/sync", {
      method: "PUT",
      headers: { "content-type": "application/octet-stream", "x-if-match": etag ?? "" },
      body: await gzip(JSON.stringify(db)),
    });
    if (r.status === 503) return { kind: "off" };
    if (r.status === 409) {
      const fresh = r.headers.get("x-etag");
      return { kind: "conflict", db: fresh ? await gunzipJson(r) : null, etag: fresh || null };
    }
    if (!r.ok) return { kind: "error" };
    const j = (await r.json()) as { etag: string };
    return { kind: "ok", etag: j.etag };
  } catch {
    return { kind: "error" };
  }
}
