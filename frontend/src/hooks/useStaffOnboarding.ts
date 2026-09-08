import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  type DocRow,
  staffOnboardingStatus,
} from "@/lib/profileCompleteness";

export function useStaffOnboarding() {
  const { user, profile, role } = useAuth();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("employee_documents")
      .select("kind, doc_type, title, file_name, file_path, file_url, created_at")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false });
    setDocs((data as DocRow[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const exempt = role === "SUPER_ADMIN";
  const status = staffOnboardingStatus(profile, docs);
  const complete = exempt || status.complete;

  return { docs, loading, complete, status, reload, exempt };
}
