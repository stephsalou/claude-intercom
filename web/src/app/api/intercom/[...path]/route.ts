import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getWorkspaceToken, getMemberRole } from "@/db/queries";

const API_URL = (process.env.INTERCOM_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

async function resolveToken(workspace: string | null, requireWrite: boolean): Promise<string | Response> {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!workspace) return new Response("workspace query param required", { status: 400 });
  const token = await getWorkspaceToken(session.userId, workspace);
  if (!token) return new Response("Forbidden", { status: 403 });
  if (requireWrite) {
    const role = await getMemberRole(session.userId, workspace);
    if (role === "lecture") return new Response("Read-only access", { status: 403 });
  }
  return token;
}

function upstreamUrl(path: string[], search: URLSearchParams): string {
  const url = new URL(`${API_URL}/${path.join("/")}`);
  search.forEach((value, key) => {
    if (key !== "workspace") url.searchParams.set(key, value);
  });
  return url.toString();
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const token = await resolveToken(req.nextUrl.searchParams.get("workspace"), false);
  if (token instanceof Response) return token;

  const { path } = await ctx.params;
  const upstream = await fetch(upstreamUrl(path, req.nextUrl.searchParams), {
    headers: { authorization: `Bearer ${token}` },
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const token = await resolveToken(req.nextUrl.searchParams.get("workspace"), true);
  if (token instanceof Response) return token;

  const { path } = await ctx.params;
  const body = await req.text();
  const upstream = await fetch(upstreamUrl(path, req.nextUrl.searchParams), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const token = await resolveToken(req.nextUrl.searchParams.get("workspace"), true);
  if (token instanceof Response) return token;

  const { path } = await ctx.params;
  const upstream = await fetch(upstreamUrl(path, req.nextUrl.searchParams), {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
