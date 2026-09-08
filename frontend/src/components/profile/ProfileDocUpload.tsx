import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadEmployeeDocument, downloadEmployeeDocument } from "@/lib/storage";
import { docTypeKey } from "@/lib/profileCompleteness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Eye, FileUp, Loader2 } from "lucide-react";

const db = supabase as any;

type Props = {
  docType: string;
  title: string;
  label?: string;
  onUploaded?: () => void;
};

interface ExistingDoc {
  id: string;
  file_name: string;
  file_path: string;
}

function resolvePath(row: Record<string, unknown>): string {
  return String(row.file_path || row.file_url || "");
}

/** Upload / view a supporting file in employee_documents (staff self-service). */
export function ProfileDocUpload({ docType, title, label = "Upload supporting file", onUploaded }: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<ExistingDoc | null>(null);

  const loadExisting = useCallback(async () => {
    if (!user) return;
    const { data } = await db
      .from("employee_documents")
      .select("*")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false });
    const match = ((data as any[]) || []).find((row) => docTypeKey(row) === docType.toUpperCase());
    if (match) {
      setExisting({
        id: match.id,
        file_name: match.file_name || "Document",
        file_path: resolvePath(match),
      });
    } else {
      setExisting(null);
    }
  }, [user, docType]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const onPick = async (file: File | null) => {
    if (!file || !user) return;
    setBusy(true);
    try {
      const path = await uploadEmployeeDocument(file, user.id);

      let { error } = await db.from("employee_documents").insert({
        employee_id: user.id,
        doc_type: docType,
        title,
        file_url: path,
        file_name: file.name,
        uploaded_by: user.id,
      });

      if (error && /column|doc_type|file_url/i.test(error.message)) {
        ({ error } = await db.from("employee_documents").insert({
          employee_id: user.id,
          kind: docType,
          title,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
          uploaded_by: user.id,
        }));
      }

      if (error) toast.error(error.message);
      else {
        toast.success(`${title} uploaded`);
        await loadExisting();
        onUploaded?.();
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const view = async () => {
    if (!existing?.file_path) return;
    try {
      await downloadEmployeeDocument(existing.file_path);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    }
  };

  return (
    <div className="space-y-2">
      {existing && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Uploaded:</span>
          <span className="font-medium truncate max-w-[200px]">{existing.file_name}</span>
          <Button type="button" variant="outline" size="sm" onClick={view}>
            <Eye className="h-4 w-4 mr-1" /> View
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="max-w-xs text-sm"
          disabled={busy}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileUp className="h-4 w-4 mr-1" />}
          {existing ? "Replace file" : label}
        </Button>
      </div>
    </div>
  );
}
