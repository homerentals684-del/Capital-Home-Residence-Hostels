import { createFileRoute } from "@tanstack/react-router";

const handle = async ({ request }: { request: Request }) => {
  const { handlePropertyImagesRequest } = await import("@/lib/property-images-http.server");
  return handlePropertyImagesRequest(request);
};

export const Route = createFileRoute("/api/public/property-images")({
  server: { handlers: { GET: handle, OPTIONS: handle } },
});