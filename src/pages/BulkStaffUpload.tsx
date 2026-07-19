import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSpreadsheet, Download, Upload, CheckCircle2, AlertCircle, SkipForward } from "lucide-react";
import * as XLSX from "xlsx";

import { DEFAULT_TEMP_PASSWORD } from "@/lib/tempPassword";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

interface ParsedRow {
  staffId: string;
  fullName: string;
  email: string;
  role: string;
  departmentName: string;
  password: string;
}

interface ResultRow {
  row: number;
  staffId: string;
  email: string;
  status: "created" | "skipped" | "error";
  reason?: string;
  password?: string;
}

const BulkStaffUpload = () => {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const { role } = useRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<{ name: string; code: string }[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);

  const canAccess = role === "ADMIN" || role === "SUPER_ADMIN";

  useEffect(() => {
    if (authLoading) return;
    // Wait for role to load before deciding access (role loads after auth)
    if (role === null) return;
    if (!canAccess) {
      navigate("/dashboard");
      return;
    }
    (async () => {
      const { data } = await supabase.from("departments").select("name, code").eq("is_active", true).order("name");
      setDepartments(data || []);
      setLoading(false);
    })();
  }, [canAccess, authLoading, navigate, role]);

  const downloadTemplate = () => {
    const sample = [
      { "Staff ID": "EMP-001", "Full Name": "Jane Doe", Email: "jane.doe@jalaram.co.ke", Role: "STAFF", Department: departments[0]?.name || "" },
      { "Staff ID": "EMP-002", "Full Name": "John Smith", Email: "john.smith@jalaram.co.ke", Role: "HEAD", Department: departments[0]?.name || "" },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws["!cols"] = [{ wch: 14 }, { wch: 24 }, { wch: 28 }, { wch: 10 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff");
    // Departments reference sheet
    const dRows = departments.map((d) => ({ Name: d.name, Code: d.code }));
    if (dRows.length) {
      const dws = XLSX.utils.json_to_sheet(dRows);
      XLSX.utils.book_append_sheet(wb, dws, "Departments");
    }
    XLSX.writeFile(wb, "staff_bulk_template.xlsx");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      const mapped: ParsedRow[] = rows.map((r) => {
        const get = (keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(r).find((key) => key.toLowerCase().trim() === k.toLowerCase());
            if (found && r[found] !== "") return String(r[found]).trim();
          }
          return "";
        };
        return {
          staffId: get(["Staff ID", "StaffID", "staff_id", "ID"]),
          fullName: get(["Full Name", "Name", "full_name"]),
          email: get(["Email", "email"]),
          role: (get(["Role", "role"]) || "STAFF").toUpperCase(),
          departmentName: get(["Department", "department", "Dept"]),
          password: get(["Password"]) || DEFAULT_TEMP_PASSWORD,
        };
      }).filter((r) => r.staffId || r.email || r.fullName);
      setParsedRows(mapped);
      toast({ title: "File loaded", description: `${mapped.length} rows ready for review.` });
    } catch (err: any) {
      toast({ title: "Parse error", description: err.message, variant: "destructive" });
    }
  };

  const submit = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    setResults(null);
    try {
      const { data, error } = await invokeEdgeFunction<{
        results: ResultRow[];
        summary: { created: number; skipped: number; errors: number };
      }>("bulk-create-staff", { body: { rows: parsedRows } });
      if (error) throw new Error(error);
      setResults(data?.results || []);
      toast({
        title: "Upload complete",
        description: `${data?.summary?.created ?? 0} created, ${data?.summary?.skipped ?? 0} skipped, ${data?.summary?.errors ?? 0} errors.`,
      });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const downloadResults = () => {
    if (!results) return;
    const ws = XLSX.utils.json_to_sheet(results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, "bulk_upload_results.xlsx");
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Add Staff (Excel)</h1>
        <p className="text-muted-foreground">Upload a spreadsheet to create many accounts at once. Duplicate Staff IDs / emails are skipped.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Step 1 — Download Template</CardTitle>
          <CardDescription>
            Columns: Staff ID, Full Name, Email, Role (STAFF / HEAD / ADMIN), Department.
            Password optional — defaults to <code>ChangeMe123!</code> (forced change on first login).
            Email optional — if blank a login like <code>staffid@jalaram.co.ke</code> is created.
            All emails must be <code>@jalaram.co.ke</code>. Unknown departments are auto-created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline"><Download className="h-4 w-4 mr-2" />Download Template</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Step 2 — Upload Filled File</CardTitle>
          <CardDescription>Supports .xlsx and .xls. First sheet is read.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Excel file</Label>
            <Input id="file" type="file" accept=".xlsx,.xls" onChange={handleFile} />
            {fileName && <p className="text-xs text-muted-foreground">Loaded: {fileName}</p>}
          </div>

          {parsedRows.length > 0 && (
            <div className="rounded-lg border">
              <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                <span className="text-sm font-medium">{parsedRows.length} rows previewed</span>
                <Button onClick={submit} disabled={uploading}>
                  {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : <>Create {parsedRows.length} Accounts</>}
                </Button>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr><th className="text-left p-2">Staff ID</th><th className="text-left p-2">Name</th><th className="text-left p-2">Email</th><th className="text-left p-2">Role</th><th className="text-left p-2">Dept</th></tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono">{r.staffId}</td><td className="p-2">{r.fullName}</td>
                        <td className="p-2">{r.email}</td><td className="p-2">{r.role}</td><td className="p-2">{r.departmentName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 100 && <p className="p-2 text-xs text-muted-foreground">… {parsedRows.length - 100} more rows</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Step 3 — Results</CardTitle>
              <CardDescription>Download the report (includes generated passwords for created accounts).</CardDescription>
            </div>
            <Button variant="outline" onClick={downloadResults}><Download className="h-4 w-4 mr-2" />Download Report</Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 sticky top-0">
                  <tr><th className="text-left p-2">Row</th><th className="text-left p-2">Staff ID</th><th className="text-left p-2">Email</th><th className="text-left p-2">Status</th><th className="text-left p-2">Password / Reason</th></tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.row}</td>
                      <td className="p-2 font-mono">{r.staffId}</td>
                      <td className="p-2">{r.email}</td>
                      <td className="p-2">
                        {r.status === "created" && <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Created</Badge>}
                        {r.status === "skipped" && <Badge variant="secondary"><SkipForward className="h-3 w-3 mr-1" />Skipped</Badge>}
                        {r.status === "error" && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>}
                      </td>
                      <td className="p-2 font-mono text-xs">{r.password || r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkStaffUpload;
