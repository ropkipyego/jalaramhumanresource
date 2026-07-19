import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";

const db = supabase as any;

type Props = {
  /** e.g. KRA_PIN, NSSF, SHIF, LICENSE, BANK_PROOF, ID_COPY */
  docType: string;
  title: string;
  label?: string;
  onUploaded?: () => void;
};

/** Upload a supporting file into employee_documents (staff self-service). */
export function ProfileDocUpload({ docType, title, label = "Upload supporting file", onUploaded }: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (file: File | null) => {
    if (!file || !user) return;
    setBusy(true);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("employee-documents").upload(path, file);
    if (upErr) {
      setBusy(false);
      toast.error(upErr.message);
      return;
    }

    // Prefer live schema (doc_type / file_url); fall back to kind / file_path if needed
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
        kind: docType === "LICENSE" ? "LICENSE" : docType === "ID_COPY" ? "ID_COPY" : "OTHER",
        title,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        uploaded_by: user.id,
      }));
    }

    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${title} uploaded`);
      onUploaded?.();
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
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
        {label}
      </Button>
    </div>
  );
}
