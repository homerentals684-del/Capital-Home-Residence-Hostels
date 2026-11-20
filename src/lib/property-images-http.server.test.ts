import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signedUrls: vi.fn(),
  residences: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          not: () => ({
            limit: mocks.residences,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({ createSignedUrls: mocks.signedUrls }),
    },
  },
}));

import { handlePropertyImagesRequest } from "./property-images-http.server";

const origin = "https://capital-home-residence-hostels.vercel.app";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://backend.example");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-public");
  mocks.residences.mockResolvedValue({
    data: [
      { id: "active-residence", image_path: "active-residence/photo.webp" },
      { id: "without-photo", image_path: null },
    ],
    error: null,
  });
  mocks.signedUrls.mockResolvedValue({
    data: [{ signedUrl: "https://storage.example/temporary-photo" }],
    error: null,
  });
});

describe("public property photo links", () => {
  it("allows the Vercel site to request only server-selected active photos", async () => {
    const response = await handlePropertyImagesRequest(new Request("https://service.example/api/public/property-images", {
      method: "GET",
      headers: { Origin: origin },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(await response.json()).toEqual({ "active-residence": "https://storage.example/temporary-photo" });
    expect(mocks.signedUrls).toHaveBeenCalledWith(["active-residence/photo.webp"], 3600);
  });

  it("rejects unapproved origins before reading or signing photos", async () => {
    const response = await handlePropertyImagesRequest(new Request("https://service.example/api/public/property-images", {
      method: "GET",
      headers: { Origin: "https://attacker.example" },
    }));

    expect(response.status).toBe(403);
    expect(mocks.residences).not.toHaveBeenCalled();
    expect(mocks.signedUrls).not.toHaveBeenCalled();
  });

  it("supports the approved Vercel preflight without exposing storage access", async () => {
    const response = await handlePropertyImagesRequest(new Request("https://service.example/api/public/property-images", {
      method: "OPTIONS",
      headers: { Origin: origin },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(mocks.residences).not.toHaveBeenCalled();
  });
});