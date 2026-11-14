import { createFileRoute } from "@tanstack/react-router";

const handle = async ({ request }: { request: Request }) => {
  const { handleRoomPayRequest } = await import("@/lib/room-pay-http.server");
  return handleRoomPayRequest(request);
};

export const Route = createFileRoute("/api/public/room-pay")({
  server: { handlers: { POST: handle, OPTIONS: handle } },
});
