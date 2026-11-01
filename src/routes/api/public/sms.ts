import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleSmsRequest } = await import("@/lib/sms-http.server");
        return handleSmsRequest(request);
      },
      OPTIONS: async ({ request }) => {
        const { handleSmsRequest } = await import("@/lib/sms-http.server");
        return handleSmsRequest(request);
      },
    },
  },
});