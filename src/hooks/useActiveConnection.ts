import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listConnections } from "@/lib/identus.functions";

/** Returns the connection currently marked active for the console, if any. */
export function useActiveConnection() {
  const fetchConnections = useServerFn(listConnections);
  const { data } = useQuery({
    queryKey: ["connections"],
    queryFn: () => fetchConnections(),
    staleTime: 15_000,
  });
  return (data ?? []).find((c: any) => c.is_active) ?? null;
}
