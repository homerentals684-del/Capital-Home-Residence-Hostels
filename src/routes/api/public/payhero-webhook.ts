import { createFileRoute } from "@tanstack/react-router";

// PayHero callbacks are unsigned: we never trust the payload, only use its reference
// to re-check the transaction with PayHero's API before settling.
export const Route = createFileRoute("/api/public/payhero-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 8192) return new Response("Too large", { status: 413 });
        let body: { response?: { ExternalReference?: unknown } };
        try { body = JSON.parse(raw); } catch { return new Response("Bad payload", { status: 400 }); }
        const ref = body.response?.ExternalReference;
        if (typeof ref !== "string" || !/^CHR-[A-Z0-9-]{4,60}$/.test(ref)) return new Response("ok");
        const { reconcileReference } = await import("@/lib/payhero.server");
        try { await reconcileReference(ref); } catch (e) { console.error("payhero webhook reconcile failed", e); return new Response("Retry", { status: 500 }); }
        return new Response("ok");
      },
    },
  },
});
