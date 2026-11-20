import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PAYMENT_ORIGINS } from "./payment-contract";

export async function handlePropertyImagesRequest(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const headers = new Headers({ Vary: "Origin", "Cache-Control": "no-store" });
  if (origin && !PAYMENT_ORIGINS.has(origin)) {
    return Response.json({ error: "Website not allowed." }, { status: 403, headers });
  }
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Accept, Content-Type");
  const reply = (data: unknown, status = 200, cache = false) => {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Cache-Control", cache ? "public, max-age=900, s-maxage=900" : "no-store");
    return Response.json(data, { status, headers: responseHeaders });
  };

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET") return reply({ error: "Method not allowed." }, 405);

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    console.error("Property photo service configuration incomplete");
    return reply({ error: "Property photos are temporarily unavailable." }, 503);
  }

  try {
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const requestHeaders = new Headers(
            typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
          );
          if (init?.headers) new Headers(init.headers).forEach((value, name) => requestHeaders.set(name, value));
          if (key.startsWith("sb_publishable_") && requestHeaders.get("Authorization") === `Bearer ${key}`) {
            requestHeaders.delete("Authorization");
          }
          requestHeaders.set("apikey", key);
          return fetch(input, { ...init, headers: requestHeaders });
        },
      },
    });
    const { data: residences, error: residenceError } = await client
      .from("residences")
      .select("id,image_path")
      .eq("active", true)
      .not("image_path", "is", null)
      .limit(500);
    if (residenceError) {
      console.error("Property photo list request failed");
      return reply({ error: "Property photos are temporarily unavailable." }, 503);
    }

    const entries = (residences ?? []).flatMap((residence) =>
      residence.image_path ? [{ id: residence.id, path: residence.image_path }] : [],
    );
    if (!entries.length) return reply({}, 200, true);

    // Only active, publicly listed residence image paths are signed; callers cannot submit paths.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signingError } = await supabaseAdmin.storage
      .from("property-images")
      .createSignedUrls(entries.map((entry) => entry.path), 3600);
    if (signingError) {
      console.error("Property photo signing failed");
      return reply({ error: "Property photos are temporarily unavailable." }, 503);
    }

    const result: Record<string, string> = {};
    signed?.forEach((item, index) => {
      const residence = entries[index];
      if (residence && item.signedUrl) result[residence.id] = item.signedUrl;
    });
    return reply(result, 200, true);
  } catch (error) {
    console.error("Property photo service failed", error instanceof Error ? error.name : "UnknownError");
    return reply({ error: "Property photos are temporarily unavailable." }, 503);
  }
}