import { connection } from "next/server";
import { readFile, removeFile, syncEnabled, writeFile } from "@/lib/server/storage";

/* Фото платьев и снимки табеля. id — тот же, что в "idb:<id>" в базе. */

const MAX_BYTES = 3 * 1024 * 1024;
const valid = (id: string) => /^[a-z0-9]{6,40}$/.test(id);
const name = (id: string) => `photos/${id}.jpg`;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  if (!syncEnabled) return new Response(null, { status: 503 });
  if (!valid(id)) return new Response(null, { status: 400 });
  const f = await readFile(name(id));
  if (!f) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  // фото с одним id не меняется — пусть браузер держит его в кэше
  return new Response(new Uint8Array(f.data), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable" } });
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!syncEnabled) return new Response(null, { status: 503 });
  if (!valid(id)) return new Response(null, { status: 400 });
  const body = Buffer.from(await request.arrayBuffer());
  if (!body.length || body.length > MAX_BYTES) return new Response(null, { status: 413 });
  await writeFile(name(id), body, request.headers.get("content-type") ?? "image/jpeg");
  return new Response(null, { status: 204 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!syncEnabled) return new Response(null, { status: 503 });
  if (!valid(id)) return new Response(null, { status: 400 });
  await removeFile(name(id));
  return new Response(null, { status: 204 });
}
