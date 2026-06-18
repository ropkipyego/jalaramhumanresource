import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";

interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
}

export default function Departments() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  const canAccess = role === "SUPER_ADMIN";

  useEffect(() => {
    if (!canAccess) {
      navigate("/dashboard");
      return;
    }
    load();
  }, [canAccess, navigate]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("departments").select("*").order("name");
    setDepartments((data || []) as Department[]);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast({ title: "Missing fields", description: "Name and code are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("departments").insert({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      is_active: true,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Department created" });
    setName(""); setCode(""); setDescription("");
    load();
  };

  const toggleActive = async (dept: Department) => {
    const { error } = await supabase
      .from("departments")
      .update({ is_active: !dept.is_active })
      .eq("id", dept.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: !dept.is_active ? "Activated" : "Inactivated" });
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) {
      toast({
        title: "Cannot delete",
        description: "Department is in use. Inactivate it instead.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Department deleted" });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Departments</h1>
        <p className="text-muted-foreground">Add new departments or inactivate/remove existing ones.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />New Department</CardTitle>
            <CardDescription>Code must be unique (e.g. ICU, ER).</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Intensive Care Unit" />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ICU" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />All Departments</CardTitle>
            <CardDescription>{departments.length} total — toggle active or remove.</CardDescription>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No departments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="font-medium">{d.name}</div>
                        {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{d.code}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={d.is_active} onCheckedChange={() => toggleActive(d)} />
                          <span className="text-xs text-muted-foreground">
                            {d.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {d.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes the department. If it has staff, rotas or rules attached,
                                deletion will fail — inactivate it instead.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(d.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
