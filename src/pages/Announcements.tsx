import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, Loader2, Megaphone, Plus } from "lucide-react";

const db = supabase as any;

interface Announcement {
  id: string;
  title: string;
  body: string;
  department_id: string | null;
  is_emergency: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  department?: { name: string };
}
interface Dept { id: string; name: string }

const empty = { title: "", body: "", department_id: "", is_emergency: false, publish: true };

export default function Announcements() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const canManage = hasRole("ADMIN");
  const [rows, setRows] = useState<Announcement[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [deptFilter, setDeptFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    let q = db.from("announcements")
      .select("*, department:departments(name)")
      .order("created_at", { ascending: false });
    if (!canManage) q = q.not("published_at", "is", null);
    if (deptFilter !== "all") q = q.or(`department_id.eq.${deptFilter},department_id.is.null`);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as Announcement[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from("departments").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setDepts((data as Dept[]) || []));
  }, []);

  useEffect(() => { load(); }, [canManage, deptFilter]);

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) return toast.error("Title and body required");
    const { error } = await db.from("announcements").insert({
      title: form.title.trim(),
      body: form.body.trim(),
      department_id: form.department_id || null,
      is_emergency: form.is_emergency,
      published_at: form.publish ? new Date().toISOString() : null,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success(form.publish ? "Announcement published" : "Draft saved");
    setOpen(false); setForm(empty); load();
  };

  const publish = async (id: string) => {
    const { error } = await db.from("announcements").update({ published_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Published"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Organisation and department notices.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div><Label>Body</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
                  <div>
                    <Label>Department (optional)</Label>
                    <Select value={form.department_id || "all"} onValueChange={(v) => setForm({ ...form, department_id: v === "all" ? "" : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Organisation-wide</SelectItem>
                        {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_emergency} onCheckedChange={(v) => setForm({ ...form, is_emergency: v })} />
                    <Label>Emergency</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.publish} onCheckedChange={(v) => setForm({ ...form, publish: v })} />
                    <Label>Publish now</Label>
                  </div>
                </div>
                <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No announcements.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {rows.map((a) => (
            <Card key={a.id} className={a.is_emergency ? "border-destructive/50" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      {a.is_emergency ? <AlertCircle className="h-5 w-5 text-destructive" /> : <Megaphone className="h-5 w-5" />}
                      {a.title}
                    </CardTitle>
                    <CardDescription className="mt-1 space-x-2">
                      {a.published_at
                        ? <span>{format(new Date(a.published_at), "dd MMM yyyy HH:mm")}</span>
                        : <Badge variant="secondary">Draft</Badge>}
                      {a.department?.name && <Badge variant="outline">{a.department.name}</Badge>}
                      {a.is_emergency && <Badge variant="destructive">Emergency</Badge>}
                    </CardDescription>
                  </div>
                  {canManage && !a.published_at && (
                    <Button size="sm" onClick={() => publish(a.id)}>Publish</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
