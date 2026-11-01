import { connection } from "next/server";
import { gunzipSync } from "zlib";
import { Conflict, readFile, syncEnabled, writeFile } from "@/lib/server/storage";

/*
 * Общая демо-база. Тело — JSON базы, сжатый gzip (так в 8–10 раз меньше).
 * GET  → 200 + заголовок x-etag | 204 (базы ещё нет) | 503 (синхронизация выключена)
 * PUT  ← заголовок x-if-match: etag версии, на которой основаны изменения ("" — базы ещё нет)
 *      → 200 { etag } | 409 + свежая база (её успели изменить с другого устройства)
 */

const FILE = "db/current.json.gz";
const MAX_BYTES = 4 * 1024 * 1024;

const off = () => Response.json({ sync: false }, { status: 503, headers: { "cache-control": "no-store" } });

export async function GET() {
  await connection();
  if (!syncEnabled) return off();
  const cur = await readFile(FILE);
  if (!cur) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  return new Response(new Uint8Array(cur.data), {
    headers: { "content-type": "application/octet-stream", "x-etag": cur.etag, "cache-control": "no-store" },
  });
}

export async function PUT(request: Request) {
  if (!syncEnabled) return off();
  const body = Buffer.from(await request.arrayBuffer());
  if (!body.length || body.length > MAX_BYTES) return Response.json({ error: "size" }, { status: 413 });
  // проверяем, что прислали именно базу CRM, а не что-то случайное
  try {
    const db = JSON.parse(gunzipSync(body).toString("utf8"));
    if (db?.version !== 3 || !Array.isArray(db.staff)) throw new Error("shape");
  } catch {
    return Response.json({ error: "bad" }, { status: 400 });
  }
  const h = request.headers.get("x-if-match");
  try {
    const etag = await writeFile(FILE, body, "application/octet-stream", h ? h : null);
    return Response.json({ etag }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (!(e instanceof Conflict)) throw e;
    const cur = await readFile(FILE);
    return new Response(cur ? new Uint8Array(cur.data) : null, {
      status: 409,
      headers: { "content-type": "application/octet-stream", "x-etag": cur?.etag ?? "", "cache-control": "no-store" },
    });
  }
}
