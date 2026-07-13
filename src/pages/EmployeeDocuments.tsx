import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
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
import { Download, FileUp, FolderOpen, Loader2, Plus } from "lucide-react";

const db = supabase as any;
const KINDS = ["CV","CERTIFICATE","LICENSE","CONTRACT","PASSPORT","ID_COPY","OTHER"] as const;

interface Doc {
  id: string;
  kind: string;
  title: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  expires_at: string | null;
}

export default function EmployeeDocuments() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const [params] = useSearchParams();
  const adminViewId = params.get("employeeId");
  const isAdmin = hasRole("ADMIN");
  const denied = !!(adminViewId && !isAdmin);
  const employeeId = denied ? "" : (adminViewId || user?.id || "");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("OTHER");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!employeeId) return;
    setLoading(true);
    const { data, error } = await db.from("employee_documents")
      .select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs((data as Doc[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [employeeId]);

  if (denied) return <Navigate to="/my-documents" replace />;

  const upload = async () => {
    if (!file || !employeeId) return toast.error("Select a file");
    if (!title.trim()) return toast.error("Title required");
    setUploading(true);
    const path = `${employeeId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("employee-documents").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await db.from("employee_documents").insert({
      employee_id: employeeId,
      kind,
      title: title.trim(),
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by: user!.id,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Document uploaded");
    setOpen(false); setTitle(""); setFile(null); setKind("OTHER"); load();
  };

  const download = async (doc: Doc) => {
    const { data, error } = await supabase.storage.from("employee-documents").createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message || "Download failed");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{adminViewId ? "Employee Documents" : "My Documents"}</h1>
          <p className="text-muted-foreground">CVs, certificates, licenses, and contracts.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Upload</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label>Kind</Label>
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
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
                  <TableHead>Kind</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No documents.</TableCell></TableRow>
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
