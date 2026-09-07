import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building, Loader2, MapPin, Plus, Save } from "lucide-react";
import type { Branch, OrganizationSettings } from "@/types/database";

export default function OrganizationSetup() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const canAccess = role === "SUPER_ADMIN";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [org, setOrg] = useState<Partial<OrganizationSettings>>({ name: "Jalaram Hospital" });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchForm, setBranchForm] = useState({ name: "", code: "", address: "", phone: "", email: "" });
  const [submittingBranch, setSubmittingBranch] = useState(false);

  useEffect(() => {
    if (!canAccess) return;
    (async () => {
      setLoading(true);
      const [orgRes, branchRes] = await Promise.all([
        supabase.from("organization_settings").select("*").limit(1).maybeSingle(),
        supabase.from("branches").select("*").order("name"),
      ]);
      if (orgRes.data) setOrg(orgRes.data as unknown as OrganizationSettings);
      setBranches((branchRes.data as Branch[]) || []);
      setLoading(false);
    })();
  }, [canAccess]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, any> = {
      name: org.name?.trim() || "Jalaram Hospital",
      organization_name: org.name?.trim() || "Jalaram Hospital",
      logo_url: org.logo_url || null,
      kra_pin: org.kra_pin || null,
      phone: org.phone || null,
      email: org.email || null,
      address: org.address || null,
      website: org.website || null,
      updated_by: user?.id || null,
    };
    if ((org as any).id) payload.id = (org as any).id;
    const { error } = await supabase.from("organization_settings").upsert(payload);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Organization settings saved" });
  };

  const addBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.code.trim()) {
      toast({ title: "Name and code are required", variant: "destructive" });
      return;
    }
    setSubmittingBranch(true);
    const { error } = await supabase.from("branches").insert({
      name: branchForm.name.trim(),
      code: branchForm.code.trim().toUpperCase(),
      address: branchForm.address.trim() || null,
      phone: branchForm.phone.trim() || null,
      email: branchForm.email.trim() || null,
      is_active: true,
    });
    setSubmittingBranch(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Branch created" });
      setBranchForm({ name: "", code: "", address: "", phone: "", email: "" });
      const { data } = await supabase.from("branches").select("*").order("name");
      setBranches((data as Branch[]) || []);
    }
  };

  const toggleBranch = async (b: Branch) => {
    const { error } = await supabase.from("branches").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      setBranches((prev) => prev.map((x) => (x.id === b.id ? { ...x, is_active: !b.is_active } : x)));
    }
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
        <h1 className="text-3xl font-bold">Organization Setup</h1>
        <p className="text-muted-foreground">Hospital information and branch locations.</p>
      </div>

      <Tabs defaultValue="hospital">
        <TabsList>
          <TabsTrigger value="hospital">Hospital Info</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
        </TabsList>

        <TabsContent value="hospital" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" />Hospital Information</CardTitle>
              <CardDescription>Legal name, contacts and statutory identifiers.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveOrg} className="grid gap-4 md:grid-cols-2 max-w-3xl">
                <div className="space-y-2 md:col-span-2">
                  <Label>Hospital Name *</Label>
                  <Input value={org.name ?? ""} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>KRA PIN</Label>
                  <Input value={org.kra_pin ?? ""} onChange={(e) => setOrg({ ...org, kra_pin: e.target.value })} placeholder="P051234567X" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={org.phone ?? ""} onChange={(e) => setOrg({ ...org, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={org.email ?? ""} onChange={(e) => setOrg({ ...org, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={org.website ?? ""} onChange={(e) => setOrg({ ...org, website: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Logo URL</Label>
                  <Input
                    value={org.logo_url ?? ""}
                    onChange={(e) => setOrg({ ...org, logo_url: e.target.value })}
                    placeholder="https://... or /jalaram-logo.svg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste a public image URL, or put a file in <code>public/jalaram-logo.svg</code> / <code>.webp</code>.
                    Shows on login and sidebar.
                  </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Input value={org.address ?? ""} onChange={(e) => setOrg({ ...org, address: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Settings
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />New Branch</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={addBranch} className="space-y-3">
                  <div className="space-y-2"><Label>Name *</Label><Input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} placeholder="Nairobi" /></div>
                  <div className="space-y-2"><Label>Code *</Label><Input value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })} placeholder="NBO" /></div>
                  <div className="space-y-2"><Label>Address</Label><Input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input value={branchForm.email} onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })} /></div>
                  <Button type="submit" className="w-full" disabled={submittingBranch}>
                    {submittingBranch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Add Branch
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Branches</CardTitle>
                <CardDescription>{branches.length} location{branches.length !== 1 ? "s" : ""}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-medium">{b.name}</div>
                          {b.address && <div className="text-xs text-muted-foreground">{b.address}</div>}
                        </TableCell>
                        <TableCell><Badge variant="outline">{b.code}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{b.phone || b.email || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={b.is_active} onCheckedChange={() => toggleBranch(b)} />
                            <span className="text-xs">{b.is_active ? "Active" : "Inactive"}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
