import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CloudOff } from "lucide-react";
import { flyAppPresence } from "@/lib/identus/fly.functions";
import { Badge } from "@/components/ui/badge";

/**
 * Shows "not on Fly" when the Fly app behind a connection no longer exists, so
 * orphaned console rows read as orphaned rather than merely unreachable.
 */
export function FlyPresenceBadge({ connectionId }: { connectionId: string }) {
  const presence = useServerFn(flyAppPresence);
  const { data } = useQuery({
    queryKey: ["fly-presence", connectionId],
    queryFn: () => presence({ data: { id: connectionId } }),
    staleTime: 60_000,
    retry: false,
  });

  if (!data?.known || data.exists) return null;

  return (
    <Badge variant="outline" className="border-destructive/50 text-destructive">
      <CloudOff className="mr-1 h-3 w-3" />
      not on Fly
    </Badge>
  );
}
