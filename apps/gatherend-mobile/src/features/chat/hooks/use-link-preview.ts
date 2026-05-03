import { useQuery } from "@tanstack/react-query";
import { getLinkPreview } from "../api/get-link-preview";

export function useLinkPreview(url: string | null) {
  return useQuery({
    queryKey: ["link-preview", url],
    queryFn: () => getLinkPreview(url!),
    enabled: Boolean(url),
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
