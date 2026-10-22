import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handlePaymentRequest } = await import("@/lib/payments-http.server");
        return handlePaymentRequest(request);
      },
      OPTIONS: async ({ request }) => {
        const { handlePaymentRequest } = await import("@/lib/payments-http.server");
        return handlePaymentRequest(request);
      },
    },
  },
});