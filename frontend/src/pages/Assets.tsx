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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Laptop, Loader2, Plus, UserCheck } from "lucide-react";

const db = supabase as any;
const TYPES = ["LAPTOP","DESKTOP","TABLET","PHONE","UNIFORM","LOCKER_KEY","ACCESS_CARD","OTHER"] as const;

interface Asset {
  id: string; asset_tag: string; asset_type: string; name: string;
  serial_number: string | null; status: string; notes: string | null;
}
interface Assignment {
  id: string; asset_id: string; employee_id: string; assigned_at: string; returned_at: string | null;
  asset?: Asset; employee?: { full_name: string; staff_id: string };
}
interface StaffOpt { id: string; full_name: string; staff_id: string }

const empty = { asset_tag: "", asset_type: "LAPTOP", name: "", serial_number: "", notes: "" };

export default function Assets() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const canManage = hasRole("ADMIN");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetOpen, setAssetOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [assignForm, setAssignForm] = useState({ asset_id: "", employee_id: "" });

  const load = async () => {
    setLoading(true);
    if (canManage) {
      const { data: a, error } = await db.from("assets").select("*").order("asset_tag");
      if (error) toast.error(error.message);
      setAssets((a as Asset[]) || []);
      const { data: asg } = await db.from("asset_assignments")
        .select("*, asset:assets(*), employee:profiles!asset_assignments_employee_id_fkey(full_name, staff_id)")
        .is("returned_at", null).order("assigned_at", { ascending: false });
      setAssignments((asg as Assignment[]) || []);
    } else if (user) {
      const { data: asg, error } = await db.from("asset_assignments")
        .select("*, asset:assets(*)")
        .eq("employee_id", user.id).is("returned_at", null);
      if (error) toast.error(error.message);
      setAssignments((asg as Assignment[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (canManage) {
      supabase.from("profiles").select("id, full_name, staff_id").eq("is_active", true).order("full_name")
        .then(({ data }) => setStaff((data as StaffOpt[]) || []));
    }
  }, [canManage]);

  useEffect(() => { if (user) load(); }, [user, canManage]);

  const addAsset = async () => {
    if (!form.asset_tag.trim() || !form.name.trim()) return toast.error("Tag and name required");
    const { error } = await db.from("assets").insert({
      asset_tag: form.asset_tag.trim().toUpperCase(),
      asset_type: form.asset_type,
      name: form.name.trim(),
      serial_number: form.serial_number.trim() || null,
      notes: form.notes.trim() || null,
      status: "AVAILABLE",
    });
    if (error) return toast.error(error.message);
    toast.success("Asset created");
    setAssetOpen(false); setForm(empty); load();
  };

  const assign = async () => {
    if (!assignForm.asset_id || !assignForm.employee_id) return toast.error("Asset and employee required");
    const { error } = await db.from("asset_assignments").insert({
      asset_id: assignForm.asset_id,
      employee_id: assignForm.employee_id,
      assigned_by: user!.id,
    });
    if (error) return toast.error(error.message);
    await db.from("assets").update({ status: "ASSIGNED" }).eq("id", assignForm.asset_id);
    toast.success("Asset assigned");
    setAssignOpen(false); setAssignForm({ asset_id: "", employee_id: "" }); load();
  };

  const returnAsset = async (asg: Assignment) => {
    const { error } = await db.from("asset_assignments").update({
      returned_at: format(new Date(), "yyyy-MM-dd"),
    }).eq("id", asg.id);
    if (error) return toast.error(error.message);
    await db.from("assets").update({ status: "AVAILABLE" }).eq("id", asg.asset_id);
    toast.success("Asset returned");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{canManage ? "Assets" : "My Assets"}</h1>
          <p className="text-muted-foreground">{canManage ? "Manage company assets and assignments." : "Assets currently assigned to you."}</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
              <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-2" />Asset</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Asset</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div><Label>Asset tag</Label><Input value={form.asset_tag} onChange={(e) => setForm({ ...form, asset_tag: e.target.value.toUpperCase() })} /></div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Serial</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
                  <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={addAsset}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild><Button><UserCheck className="h-4 w-4 mr-2" />Assign</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Assign Asset</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div>
                    <Label>Asset</Label>
                    <Select value={assignForm.asset_id} onValueChange={(v) => setAssignForm({ ...assignForm, asset_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Available assets" /></SelectTrigger>
                      <SelectContent>
                        {assets.filter((a) => a.status === "AVAILABLE").map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.asset_tag} — {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Employee</Label>
                    <Select value={assignForm.employee_id} onValueChange={(v) => setAssignForm({ ...assignForm, employee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={assign}>Assign</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Laptop className="h-5 w-5" />Inventory</CardTitle>
            <CardDescription>{assets.length} asset{assets.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.asset_tag}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.asset_type}</TableCell>
                      <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active assignments</CardTitle>
          <CardDescription>{assignments.length} assigned</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                {canManage && <TableHead>Employee</TableHead>}
                <TableHead>Assigned</TableHead>
                {canManage && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No assignments.</TableCell></TableRow>
              ) : assignments.map((asg) => (
                <TableRow key={asg.id}>
                  <TableCell>
                    <div className="font-medium">{asg.asset?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{asg.asset?.asset_tag}</div>
                  </TableCell>
                  {canManage && <TableCell>{asg.employee?.full_name}</TableCell>}
                  <TableCell>{format(new Date(asg.assigned_at + "T00:00:00"), "dd MMM yyyy")}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => returnAsset(asg)}>Return</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
