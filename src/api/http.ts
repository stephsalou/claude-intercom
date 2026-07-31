import * as presence from "../valkey/presenceStore.js";
import * as messages from "../valkey/messageStore.js";
import { onNewMessage } from "../valkey/subscribe.js";
import { resolveWorkspace, extractBearerToken } from "./auth.js";
import { history } from "../pg/historyRepo.js";
import { isRateLimited } from "./rateLimit.js";
import { registerWebhook, listWebhooks, deleteWebhook } from "../valkey/webhookStore.js";

const PORT = Number(process.env.PORT ?? 8787);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function handleEvents(workspace: string, url: URL): Promise<Response> {
  const code = url.searchParams.get("code");
  if (!code) return json({ error: "code query param required" }, 400);

  let unsubscribe: () => void = () => {};
  let heartbeatTimer: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      try {
        unsubscribe = onNewMessage(workspace, code, (messageId) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ messageId })}\n\n`));
        });
      } catch (err) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${(err as Error).message}\n\n`));
        controller.close();
        return;
      }
      heartbeatTimer = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15_000);
    },
    cancel() {
      unsubscribe();
      clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

Bun.serve({
  port: PORT,
  // Default is 10s — shorter than the SSE heartbeat (15s) in handleEvents, so every
  // /events connection was getting killed by the server itself right before its first
  // ping. Bun's max is 255s; comfortably above our ping interval.
  idleTimeout: 255,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return json({ status: "ok" });
    }

    if (url.pathname === "/dashboard") {
      // No server-side auth check here — the page itself prompts for a token and
      // sends it on every API call it makes (query param for SSE, header otherwise).
      const file = Bun.file(new URL("../../public/dashboard.html", import.meta.url));
      return new Response(file, { headers: { "content-type": "text/html" } });
    }

    const workspace = await resolveWorkspace(extractBearerToken(req));
    if (!workspace) {
      return json({ error: "unauthorized" }, 401);
    }

    try {
      if (url.pathname === "/register" && req.method === "POST") {
        const body = await readJson(req);
        if (!body?.code || !body?.project) return json({ error: "code and project required" }, 400);
        await presence.register(body.code, body.project, workspace);
        return json({ ok: true });
      }

      if (url.pathname === "/heartbeat" && req.method === "POST") {
        const body = await readJson(req);
        if (!body?.code) return json({ error: "code required" }, 400);
        const ok = await presence.heartbeat(body.code, workspace);
        return json({ ok });
      }

      if (url.pathname === "/who" && req.method === "GET") {
        const scope = url.searchParams.get("scope") ?? "project";
        const project = url.searchParams.get("project") ?? undefined;
        const filter = scope === "project" ? project : undefined;
        const agents = await presence.listAgents(workspace, filter);
        return json({ agents });
      }

      if (url.pathname === "/send" && req.method === "POST") {
        const body = await readJson(req);
        if (!body?.from || !body?.to || !body?.message) {
          return json({ error: "from, to and message required" }, 400);
        }
        if (await isRateLimited(workspace)) {
          return new Response(JSON.stringify({ error: "rate limit exceeded" }), {
            status: 429,
            headers: { "content-type": "application/json", "retry-after": "60" },
          });
        }
        const projectOnly = body.to === "all" ? body.project : undefined;
        const msg = await messages.sendMessage(
          workspace,
          body.from,
          body.to,
          body.message,
          body.reply_to,
          projectOnly,
        );
        return json({ message: msg });
      }

      if (url.pathname === "/reply" && req.method === "POST") {
        const body = await readJson(req);
        if (!body?.from || !body?.message_id || !body?.message) {
          return json({ error: "from, message_id and message required" }, 400);
        }
        const inbox = await messages.peekMessages(workspace, body.from);
        const original = inbox.find((m) => m.id === body.message_id);
        if (!original) return json({ error: "message not found" }, 404);
        const msg = await messages.sendMessage(
          workspace,
          body.from,
          original.from,
          body.message,
          body.message_id,
        );
        await messages.ackMessage(workspace, body.from, body.message_id);
        return json({ message: msg });
      }

      if (url.pathname === "/peek" && req.method === "GET") {
        const code = url.searchParams.get("code");
        if (!code) return json({ error: "code query param required" }, 400);
        const inbox = await messages.peekMessages(workspace, code);
        return json({ messages: inbox });
      }

      if (url.pathname === "/ack" && req.method === "POST") {
        const body = await readJson(req);
        if (!body?.code || !body?.message_id) return json({ error: "code and message_id required" }, 400);
        const ok = await messages.ackMessage(workspace, body.code, body.message_id);
        return json({ ok }, ok ? 200 : 404);
      }

      if (url.pathname === "/ack_all" && req.method === "POST") {
        const body = await readJson(req);
        if (!body?.code) return json({ error: "code required" }, 400);
        const count = await messages.ackAll(workspace, body.code);
        return json({ count });
      }

      if (url.pathname === "/events" && req.method === "GET") {
        return handleEvents(workspace, url);
      }

      if (url.pathname === "/history" && req.method === "GET") {
        const code = url.searchParams.get("code");
        if (!code) return json({ error: "code query param required" }, 400);
        const since = url.searchParams.get("since") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? 100);
        const rows = await history(workspace, code, since, limit);
        return json({ messages: rows });
      }

      if (url.pathname === "/webhooks" && req.method === "POST") {
        const body = await readJson(req);
        if (!body?.url || !Array.isArray(body?.events) || body.events.length === 0) {
          return json({ error: "url and non-empty events array required" }, 400);
        }
        const webhook = await registerWebhook(workspace, body.url, body.events);
        return json({ webhook });
      }

      if (url.pathname === "/webhooks" && req.method === "GET") {
        const hooks = await listWebhooks(workspace);
        return json({ webhooks: hooks });
      }

      if (url.pathname.startsWith("/webhooks/") && req.method === "DELETE") {
        const id = url.pathname.slice("/webhooks/".length);
        const ok = await deleteWebhook(workspace, id);
        return json({ ok }, ok ? 200 : 404);
      }

      return json({ error: "not found" }, 404);
    } catch (err) {
      return json({ error: (err as Error).message }, 400);
    }
  },
});

console.log(`intercom API listening on :${PORT}`);
