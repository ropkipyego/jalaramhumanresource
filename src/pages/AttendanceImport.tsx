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
  const [suggestions, setSuggestions] = useState<EnrollSuggestion[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  const [savingMap, setSavingMap] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [lastAoa, setLastAoa] = useState<unknown[][] | null>(null);

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

  const runMatch = (aoa: unknown[][], emps = employees) => {
    const parsed = parseBiometricSheet(aoa);
    setFormat(parsed.format);
    setParseErrors(parsed.errors);
    setDateRange(parsed.dateRange);
    const { matched, unmatched: um } = matchPunchesToEmployees(parsed.punches, emps);
    setPunches(matched);
    setUnmatched([...parsed.errors, ...um]);
    const sugs = summarizeUnmatched(um, emps);
    setSuggestions(sugs);
    const initSel: Record<string, string> = {};
    for (const s of sugs) if (s.suggestions[0]) initSel[s.enroll_id] = s.suggestions[0].employee_id;
    setSelectedMap(initSel);
    if (matched.length === 0) toast.error("No valid punches found. Check the file format.");
    else toast.success(`Parsed ${matched.length} punches (${parsed.format})`);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    setLastAoa(aoa);
    runMatch(aoa);
  };

  const saveMapping = async () => {
    const map = Object.entries(selectedMap)
      .filter(([, empId]) => !!empId)
      .map(([enroll_id, employee_id]) => ({ enroll_id, employee_id }));
    if (!map.length) return toast.error("Select at least one staff member to map");
    setSavingMap(true);
    const { error } = await supabase.rpc("bulk_map_biometric_ids" as any, { _map: map });
    if (error) { setSavingMap(false); return toast.error(error.message); }
    // Refresh employees then re-run matching
    const { data } = await supabase.from("profiles")
      .select("id, staff_id, biometric_enroll_id, full_name").eq("hr_status", "ACTIVE");
    const fresh = (data as typeof employees) || [];
    setEmployees(fresh);
    if (lastAoa) runMatch(lastAoa, fresh);
    setSavingMap(false);
    toast.success(`Mapped ${map.length} enroll ID(s). Punches re-matched.`);
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

            {suggestions.length > 0 && (
              <div className="mb-4 rounded-lg border border-warning/40 bg-warning/5 p-4 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      Map unmapped Enroll IDs to staff
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Names below were auto-suggested from the file. Confirm each and save — the file will re-match automatically.
                    </div>
                  </div>
                  <Button size="sm" onClick={saveMapping} disabled={savingMap}>
                    {savingMap && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save mapping
                  </Button>
                </div>
                <div className="max-h-64 overflow-auto border rounded bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Enroll ID</TableHead>
                        <TableHead>Name in file</TableHead>
                        <TableHead>Punches</TableHead>
                        <TableHead>Assign to staff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suggestions.map((s) => (
                        <TableRow key={s.enroll_id}>
                          <TableCell className="font-mono">{s.enroll_id}</TableCell>
                          <TableCell>{s.name || "—"}</TableCell>
                          <TableCell>{s.count}</TableCell>
                          <TableCell>
                            <Select
                              value={selectedMap[s.enroll_id] || ""}
                              onValueChange={(v) => setSelectedMap({ ...selectedMap, [s.enroll_id]: v })}
                            >
                              <SelectTrigger className="h-8"><SelectValue placeholder="Pick staff…" /></SelectTrigger>
                              <SelectContent>
                                {s.suggestions.length > 0 && (
                                  <>
                                    {s.suggestions.map((sg) => (
                                      <SelectItem key={sg.employee_id} value={sg.employee_id}>
                                        ⭐ {sg.full_name}
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                                {employees
                                  .filter((e) => !s.suggestions.some((sg) => sg.employee_id === e.id))
                                  .map((e) => (
                                    <SelectItem key={e.id} value={e.id}>
                                      {e.full_name} ({e.staff_id})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {parseErrors.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{parseErrors.length} parse error(s)</AlertTitle>
                <AlertDescription className="max-h-32 overflow-auto text-xs">
                  {parseErrors.slice(0, 20).map((e, i) => (
                    <div key={i}>Row {e.row}: {e.error}</div>
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
