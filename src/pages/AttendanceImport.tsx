import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Info,
} from "lucide-react";
import {
  parseBiometricSheet, matchPunchesToEmployees, summarizeUnmatched, SUPPORTED_FORMATS,
  type ParsedPunch, type ParseError, type EnrollSuggestion,
} from "@/lib/biometricParser";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AttendanceImport() {
  const { hasRole } = useRole();
  const canAccess = hasRole("ADMIN");

  const [employees, setEmployees] = useState<{ id: string; staff_id: string; biometric_enroll_id: string | null; full_name: string }[]>([]);
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState("");
  const [punches, setPunches] = useState<ParsedPunch[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [unmatched, setUnmatched] = useState<ParseError[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!canAccess) return;
    supabase.from("profiles").select("id, staff_id, biometric_enroll_id, full_name").eq("hr_status", "ACTIVE")
      .then(({ data }) => setEmployees((data as typeof employees) || []));
  }, [canAccess]);

  if (!canAccess) return <Navigate to="/attendance" replace />;

  const downloadTemplate = (type: "zkteco" | "daily") => {
    let aoa: unknown[][];
    if (type === "zkteco") {
      aoa = [
        ["User ID", "Name", "DateTime", "State"],
        ["EMP-001", "Jane Doe", "2026-07-01 08:02:00", "Check In"],
        ["EMP-001", "Jane Doe", "2026-07-01 18:05:00", "Check Out"],
        ["EMP-002", "John Smith", "2026-07-01 18:28:00", "Check In"],
        ["EMP-002", "John Smith", "2026-07-02 06:32:00", "Check Out"],
      ];
    } else {
      aoa = [
        ["Staff ID", "Full Name", "Date", "Time In", "Time Out"],
        ["EMP-001", "Jane Doe", "2026-07-01", "08:02", "18:05"],
        ["EMP-002", "John Smith", "2026-07-01", "18:28", "06:32"],
      ];
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `biometric-template-${type}.xlsx`);
    toast.success("Template downloaded");
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

    const parsed = parseBiometricSheet(aoa);
    setFormat(parsed.format);
    setParseErrors(parsed.errors);
    setDateRange(parsed.dateRange);

    const { matched, unmatched: um } = matchPunchesToEmployees(parsed.punches, employees);
    setPunches(matched);
    setUnmatched([...parsed.errors, ...um]);

    if (matched.length === 0) {
      toast.error("No valid punches found. Check column headers match a supported format.");
    } else {
      toast.success(`Parsed ${matched.length} punches (${parsed.format} format)`);
    }
  };

  const preview = useMemo(() => punches.slice(0, 50), [punches]);

  const doImport = async () => {
    if (!punches.length) return toast.error("Nothing to import");
    setImporting(true);
    const payload = punches.map((p) => ({
      row: p.row,
      staff_id: p.staff_id,
      employee_id: p.employee_id,
      punch_at: p.punch_at,
      punch_type: p.punch_type,
      source: "BIOMETRIC",
    }));

    const { data, error } = await supabase.rpc("import_attendance_punches", {
      _punches: payload,
      _file_name: fileName || "upload.xlsx",
    });

    setImporting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResult(data as Record<string, unknown>);
    toast.success(`Imported ${(data as any)?.inserted ?? 0} punches. Attendance computed automatically.`);
    setPunches([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Biometric Import</h1>
        <p className="text-muted-foreground">
          Upload Excel exports from ZKTeco, Hikvision, or any device using the templates below.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Primary format: ZKTeco "Attendance Record Report" (monthly matrix)</AlertTitle>
        <AlertDescription>
          Export directly from your biometric device (Attendance → Reports → Attendance Record Report → Export to Excel) and upload here. The parser reads the
          date range, day-of-month row, and every "ID: … Name: …" block automatically — concatenated punches like <code>08:1318:04</code> or triple punches
          like <code>08:2618:5618:59</code> are split correctly and alternated IN / OUT.
          <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
            {SUPPORTED_FORMATS.map((f) => (
              <li key={f.name}><strong>{f.name}:</strong> {f.columns}</li>
            ))}
          </ul>
          Staff are matched by <strong>Biometric Enroll ID</strong> (the number under "ID:" in the file) or <strong>Staff ID</strong>, and finally by full name.
          Set each staff member's enroll ID on their profile so imports match automatically.
        </AlertDescription>
      </Alert>


      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />Templates</CardTitle>
            <CardDescription>Download, fill from device export, or use as reference.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate("zkteco")}>
              ZKTeco / Punch Log
            </Button>
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate("daily")}>
              Daily In/Out Summary
            </Button>
            <div className="pt-4 border-t">
              <LabelledUpload onFile={handleFile} fileName={fileName} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />Preview
                </CardTitle>
                <CardDescription>
                  {punches.length > 0
                    ? `${punches.length} matched punches · format: ${format}`
                    : "Upload a file to preview"}
                  {dateRange.from && ` · ${dateRange.from} to ${dateRange.to}`}
                </CardDescription>
              </div>
              {punches.length > 0 && (
                <Button onClick={doImport} disabled={importing}>
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Import &amp; Compute
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result && (
              <Alert className="mb-4 border-success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Import complete</AlertTitle>
                <AlertDescription>
                  Inserted {(result as any).inserted} punches, skipped {(result as any).skipped}.
                  {" "}View results in <a href="/attendance/records" className="underline">Daily Records</a>.
                </AlertDescription>
              </Alert>
            )}

            {unmatched.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{unmatched.length} row(s) with issues</AlertTitle>
                <AlertDescription className="max-h-32 overflow-auto text-xs">
                  {unmatched.slice(0, 20).map((e, i) => (
                    <div key={i}>Row {e.row}: {e.staff_id ? `${e.staff_id} — ` : ""}{e.error}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {preview.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff ID</TableHead>
                    <TableHead>DateTime</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Employee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((p, i) => {
                    const emp = employees.find((e) => e.id === p.employee_id);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{p.staff_id}</TableCell>
                        <TableCell>{new Date(p.punch_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline">{p.punch_type}</Badge></TableCell>
                        <TableCell>{emp?.full_name ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-12">No data yet — upload a biometric Excel file.</p>
            )}
            {punches.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2">Showing first 50 of {punches.length} punches.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LabelledUpload({ onFile, fileName }: { onFile: (f: File) => void; fileName: string }) {
  return (
    <div>
      <Input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {fileName && <p className="text-xs text-muted-foreground mt-2">{fileName}</p>}
    </div>
  );
}
