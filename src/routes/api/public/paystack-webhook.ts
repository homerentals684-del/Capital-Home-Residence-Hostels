import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { reconcileReference, verifySignature } = await import("@/lib/paystack.server");
        const raw = await request.text();
        const ok = await verifySignature(raw, request.headers.get("x-paystack-signature")).catch(() => false);
        if (!ok) return new Response("Invalid signature", { status: 401 });
        let event: { event?: string; data?: { reference?: string } };
        try { event = JSON.parse(raw); } catch { return new Response("Bad payload", { status: 400 }); }
        const ref = event.data?.reference;
        if (ref && typeof ref === "string" && ref.length <= 64 && (event.event === "charge.success" || event.event === "charge.failed")) {
          // Never trust the payload amount alone: re-verify with Paystack, then settle idempotently.
          try { await reconcileReference(ref); } catch (e) { console.error("webhook reconcile failed", e); return new Response("Retry", { status: 500 }); }
        }
        return new Response("ok");
      },
    },
  },
});
