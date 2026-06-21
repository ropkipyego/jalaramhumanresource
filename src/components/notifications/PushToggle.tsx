import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { enablePush, disablePush, isPushEnabled, pushSupported } from "@/lib/push";

export function PushToggle() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  useEffect(() => { isPushEnabled().then(setEnabled); }, []);

  if (!supported) {
    return <p className="text-sm text-muted-foreground">Push notifications are not supported on this browser.</p>;
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast({ title: "Push notifications disabled" });
      } else {
        const res = await enablePush();
        if (res.ok) { setEnabled(true); toast({ title: res.message }); }
        else toast({ title: "Could not enable", description: res.message, variant: "destructive" });
      }
    } finally { setBusy(false); }
  };

  return (
    <Button variant={enabled ? "secondary" : "default"} onClick={toggle} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        : enabled ? <BellOff className="h-4 w-4 mr-2" />
        : <Bell className="h-4 w-4 mr-2" />}
      {enabled ? "Disable Push Notifications" : "Enable Push Notifications"}
    </Button>
  );
}
