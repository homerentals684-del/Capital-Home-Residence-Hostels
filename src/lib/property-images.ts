import { useQuery } from "@tanstack/react-query";
import { propertyImagesEndpoint } from "@/lib/property-images-contract";

/** Temporary links for approved property photos in the private property-images bucket. */
export function usePropertyImages(residences: { id: string; image_path?: string | null }[] | undefined) {
  const withImg = (residences ?? []).filter((r) => r.image_path);
  const paths = withImg.map((r) => r.image_path as string);
  const { data } = useQuery({
    queryKey: ["property-images", paths],
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (typeof window === "undefined") return {};
      const response = await fetch(propertyImagesEndpoint(window.location.origin), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return {};
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) return {};
      const out: Record<string, string> = {};
      const links = data as Record<string, unknown>;
      withImg.forEach((r) => {
        const value = links[r.id];
        if (typeof value !== "string") return;
        try {
          if (new URL(value).protocol === "https:") out[r.id] = value;
        } catch {
          // Ignore malformed links returned by the public photo service.
        }
      });
      return out;
    },
  });
  return data ?? {};
}
