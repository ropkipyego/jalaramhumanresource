import { useEffect, useState } from "react";
import { Link, useSearchParams, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, FileUp, FolderOpen, Loader2, Plus, User } from "lucide-react";

const db = supabase as any;

const KINDS = [
  "ID_COPY", "KRA_PIN", "NSSF", "SHIF", "LICENSE", "BANK_PROOF",
  "CV", "CERTIFICATE", "CONTRACT", "PASSPORT", "OTHER",
] as const;

interface Doc {
  id: string;
  kind: string;
  title: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

function normalizeDoc(row: any): Doc {
  return {
    id: row.id,
    kind: row.kind || row.doc_type || "OTHER",
    title: row.title || "Document",
    file_path: row.file_path || row.file_url || "",
    file_name: row.file_name || "file",
    created_at: row.created_at,
  };
}

export default function EmployeeDocuments() {
  const { user } = useAuth();
  const { canManageStaffLogins } = useRole();
  const [params] = useSearchParams();
  const adminViewId = params.get("employeeId");
  const denied = !!(adminViewId && !canManageStaffLogins);
  const employeeId = denied ? "" : (adminViewId || user?.id || "");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("ID_COPY");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!employeeId) return;
    setLoading(true);
    const { data, error } = await db.from("employee_documents")
      .select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs(((data as any[]) || []).map(normalizeDoc));
    setLoading(false);
  };

  useEffect(() => { load(); }, [employeeId]);

  if (denied) return <Navigate to="/my-documents" replace />;

  const upload = async () => {
    if (!file || !employeeId) return toast.error("Select a file");
    if (!title.trim()) return toast.error("Title required");
    setUploading(true);
    const path = `${employeeId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("employee-documents").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }

    let { error } = await db.from("employee_documents").insert({
      employee_id: employeeId,
      doc_type: kind,
      title: title.trim(),
      file_url: path,
      file_name: file.name,
      uploaded_by: user!.id,
    });

    if (error && /column|doc_type|file_url/i.test(error.message)) {
      ({ error } = await db.from("employee_documents").insert({
        employee_id: employeeId,
        kind: ["CV", "CERTIFICATE", "LICENSE", "CONTRACT", "PASSPORT", "ID_COPY", "OTHER"].includes(kind)
          ? kind
          : "OTHER",
        title: title.trim(),
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        uploaded_by: user!.id,
      }));
    }

    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Document uploaded");
    setOpen(false); setTitle(""); setFile(null); setKind("ID_COPY"); load();
  };

  const download = async (doc: Doc) => {
    if (!doc.file_path) return toast.error("Missing file path");
    const { data, error } = await supabase.storage.from("employee-documents").createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message || "Download failed");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{adminViewId ? "Employee Documents" : "My Documents"}</h1>
          <p className="text-muted-foreground">
            ID, KRA, NSSF, SHIF, license, bank proof, and other files.
            {" "}You can also upload from <Link to="/my-profile" className="underline">My Profile</Link>.
          </p>
        </div>
        <div className="flex gap-2">
          {!adminViewId && (
            <Button asChild variant="outline">
              <Link to="/my-profile"><User className="h-4 w-4 mr-2" />My Profile</Link>
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Upload</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>Type</Label>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div>
                  <Label>File</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={upload} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileUp className="h-4 w-4 mr-2" />}
                  Upload
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderOpen className="h-5 w-5" />Documents</CardTitle>
          <CardDescription>{docs.length} file{docs.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No documents yet.</TableCell></TableRow>
                ) : docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell><Badge variant="outline">{d.kind}</Badge></TableCell>
                    <TableCell className="text-sm">{d.file_name}</TableCell>
                    <TableCell>{format(new Date(d.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => download(d)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
