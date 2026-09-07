import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function ClockInOut({ onPunch }: { onPunch?: () => void }) {
  const [loading, setLoading] = useState<"IN" | "OUT" | null>(null);
  const [lastPunch, setLastPunch] = useState<{ type: string; at: string } | null>(null);

  const punch = async (type: "IN" | "OUT") => {
    setLoading(type);
    const { data, error } = await supabase.rpc("clock_punch", { _type: type });
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { ok: boolean; error?: string; punch_at?: string; punch_type?: string };
    if (!result.ok) {
      toast.error(result.error ?? "Punch failed");
      return;
    }
    setLastPunch({ type: result.punch_type ?? type, at: result.punch_at ?? new Date().toISOString() });
    toast.success(`${type === "IN" ? "Clocked in" : "Clocked out"} at ${format(new Date(result.punch_at!), "HH:mm")}`);
    onPunch?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Web Clock</CardTitle>
        <CardDescription>Clock in/out from this device. Records are included in daily attendance computation.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3 items-center">
        <Button onClick={() => punch("IN")} disabled={!!loading} className="gap-2">
          {loading === "IN" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Clock In
        </Button>
        <Button variant="outline" onClick={() => punch("OUT")} disabled={!!loading} className="gap-2">
          {loading === "OUT" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Clock Out
        </Button>
        {lastPunch && (
          <span className="text-sm text-muted-foreground ml-2">
            Last: {lastPunch.type} at {format(new Date(lastPunch.at), "HH:mm:ss")}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
