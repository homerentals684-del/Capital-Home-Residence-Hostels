import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Signed URLs (1h) for property photos stored in the private property-images bucket. */
export function usePropertyImages(residences: { id: string; image_path?: string | null }[] | undefined) {
  const withImg = (residences ?? []).filter((r) => r.image_path);
  const paths = withImg.map((r) => r.image_path as string);
  const { data } = useQuery({
    queryKey: ["property-images", paths],
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("property-images").createSignedUrls(paths, 3600);
      const out: Record<string, string> = {};
      withImg.forEach((r, i) => { const u = data?.[i]?.signedUrl; if (u) out[r.id] = u; });
      return out;
    },
  });
  return data ?? {};
}
