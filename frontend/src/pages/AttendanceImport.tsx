import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Info,
} from "lucide-react";
import {
  parseBiometricSheet,
  matchPunchesToEmployees,
  summarizeUnmatched,
  SUPPORTED_FORMATS,
  buildZktecoAttendanceRecordTemplate,
  inferReferenceMonthFromFileName,
  type ParsedPunch,
  type ParseError,
  type EnrollSuggestion,
  type EmployeeLite,
} from "@/lib/biometricParser";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AttendanceImport() {
  const { hasRole } = useRole();
  const canAccess = hasRole("ADMIN");

  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [fileName, setFileName] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(currentMonthIso());
  const [format, setFormat] = useState("");
  const [punches, setPunches] = useState<ParsedPunch[]>([]);
  const [rawPunches, setRawPunches] = useState<ParsedPunch[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [unmatched, setUnmatched] = useState<ParseError[]>([]);
  const [suggestions, setSuggestions] = useState<EnrollSuggestion[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  const [savingMap, setSavingMap] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [needsReferenceMonth, setNeedsReferenceMonth] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [lastAoa, setLastAoa] = useState<unknown[][] | null>(null);

  const loadEmployees = async () => {
    const [profRes, deptRes] = await Promise.all([
      supabase.from("profiles").select("id, staff_id, biometric_enroll_id, full_name").eq("hr_status", "ACTIVE"),
      supabase.from("employee_departments").select("employee_id, departments(name)"),
    ]);
    const deptMap = new Map<string, string[]>();
    for (const row of deptRes.data || []) {
      const name = (row as { employee_id: string; departments: { name: string } | null }).departments?.name;
      if (!name) continue;
      const list = deptMap.get(row.employee_id) || [];
      list.push(name.toLowerCase());
      deptMap.set(row.employee_id, list);
    }
    const emps: EmployeeLite[] = ((profRes.data as EmployeeLite[]) || []).map((e) => ({
      ...e,
      department_names: deptMap.get(e.id) || [],
    }));
    setEmployees(emps);
    return emps;
  };

  useEffect(() => {
    if (!canAccess) return;
    loadEmployees();
  }, [canAccess]);

  if (!canAccess) return <Navigate to="/attendance" replace />;

  const downloadTemplate = () => {
    const aoa = buildZktecoAttendanceRecordTemplate(referenceMonth);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Record Report");
    XLSX.writeFile(wb, `zkteco-attendance-record-report-${referenceMonth}.xlsx`);
    toast.success("Downloaded ZKTeco Attendance Record Report layout");
  };

  const runMatch = (aoa: unknown[][], emps = employees, month = referenceMonth, fname = fileName) => {
    const parsed = parseBiometricSheet(aoa, { referenceMonth: month, fileName: fname });
    setFormat(parsed.format);
    setParseErrors(parsed.errors);
    setDateRange(parsed.dateRange);
    setNeedsReferenceMonth(!!parsed.needsReferenceMonth);
    setRawPunches(parsed.punches);
    if (parsed.needsReferenceMonth) {
      setPunches([]);
      setUnmatched(parsed.errors);
      setSuggestions([]);
      toast.error("Select the report month (YYYY-MM) for this Attendance Record Report file.");
      return;
    }
    const { matched, unmatched: um } = matchPunchesToEmployees(parsed.punches, emps);
    setPunches(matched);
    setUnmatched([...parsed.errors, ...um]);
    const sugs = summarizeUnmatched(um, emps, parsed.punches);
    setSuggestions(sugs);
    const initSel: Record<string, string> = {};
    for (const s of sugs) if (s.suggestions[0]) initSel[s.enroll_id] = s.suggestions[0].employee_id;
    setSelectedMap(initSel);
    if (matched.length === 0) toast.error("No matched punches — check Enroll ID on staff profiles or map below.");
    else toast.success(`Parsed ${matched.length} punches (${parsed.format})`);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    const inferred = inferReferenceMonthFromFileName(file.name);
    const month = inferred || referenceMonth;
    if (inferred) setReferenceMonth(inferred);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    setLastAoa(aoa);
    runMatch(aoa, employees, month, file.name);
  };

  useEffect(() => {
    if (lastAoa) runMatch(lastAoa, employees, referenceMonth, fileName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceMonth]);

  const saveMapping = async () => {
    const map = Object.entries(selectedMap)
      .filter(([, empId]) => !!empId)
      .map(([enroll_id, employee_id]) => ({ enroll_id, employee_id }));
    if (!map.length) return toast.error("Select at least one staff member to map");
    setSavingMap(true);
    const { error } = await supabase.rpc("bulk_map_biometric_ids" as any, { _map: map });
    if (error) {
      setSavingMap(false);
      return toast.error(error.message);
    }
    const fresh = await loadEmployees();
    if (lastAoa) runMatch(lastAoa, fresh, referenceMonth, fileName);
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
    setRawPunches([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Biometric Import</h1>
        <p className="text-muted-foreground">
          Upload the ZKTeco <strong>Attendance Record Report</strong> Excel export. Staff are matched by device{" "}
          <strong>Enroll ID</strong> (the number after <code className="text-xs">ID:</code> in the file), with name and department used to suggest mappings.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Device export: Attendance → Reports → Attendance Record Report → Excel</AlertTitle>
        <AlertDescription>
          The file should start with the title row <strong>Attendance Record Report</strong>, then weekday / day-of-month headers,
          then blocks like <code className="text-xs">ID: 18 Name: Maina Dept.: Reception</code> and a row of daily punches.
          Concatenated cells such as <code className="text-xs">08:1318:04</code> are split and alternated IN / OUT.
          <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
            {SUPPORTED_FORMATS.map((f) => (
              <li key={f.name}>
                <strong>{f.name}:</strong> {f.columns}
              </li>
            ))}
          </ul>
          Set each staff member&apos;s <strong>Biometric Enroll ID</strong> on their profile (same as device ID) so imports match rota and overtime automatically.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Template &amp; upload
            </CardTitle>
            <CardDescription>Reference layout only — real data comes from the ZKTeco export.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ref-month">Report month (if file has no date range)</Label>
              <Input
                id="ref-month"
                type="month"
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used for day numbers in the matrix (e.g. August file with days 14–31). Auto-detected from filenames like{" "}
                <code className="text-xs">PAYROLL_AUGUST_2026.xlsx</code>.
              </p>
            </div>
            <Button variant="default" className="w-full" onClick={downloadTemplate}>
              Download Attendance Record Report template
            </Button>
            <div className="pt-2 border-t">
              <LabelledUpload onFile={handleFile} fileName={fileName} />
            </div>
            {needsReferenceMonth && (
              <Alert variant="destructive">
                <AlertTitle>Report month required</AlertTitle>
                <AlertDescription>Choose the month above and the file will re-parse.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Preview
                </CardTitle>
                <CardDescription>
                  {punches.length > 0
                    ? `${punches.length} matched punches · ${rawPunches.length} raw · format: ${format}`
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
                  Inserted {(result as any).inserted} punches, skipped {(result as any).skipped}. View results in{" "}
                  <a href="/attendance/records" className="underline">
                    Daily Records
                  </a>
                  .
                </AlertDescription>
              </Alert>
            )}

            {suggestions.length > 0 && (
              <div className="mb-4 rounded-lg border border-warning/40 bg-warning/5 p-4 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      Map device Enroll IDs to HR profiles
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Suggestions use name + department from the file vs staff on each department rota.
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
                        <TableHead>Dept.</TableHead>
                        <TableHead>Punches</TableHead>
                        <TableHead>Assign to staff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suggestions.map((s) => (
                        <TableRow key={s.enroll_id}>
                          <TableCell className="font-mono">{s.enroll_id}</TableCell>
                          <TableCell>{s.name || "—"}</TableCell>
                          <TableCell>{s.department || "—"}</TableCell>
                          <TableCell>{s.count}</TableCell>
                          <TableCell>
                            <Select
                              value={selectedMap[s.enroll_id] || ""}
                              onValueChange={(v) => setSelectedMap({ ...selectedMap, [s.enroll_id]: v })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Pick staff…" />
                              </SelectTrigger>
                              <SelectContent>
                                {s.suggestions.map((sg) => (
                                  <SelectItem key={sg.employee_id} value={sg.employee_id}>
                                    ⭐ {sg.full_name}
                                  </SelectItem>
                                ))}
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
                <AlertTitle>{parseErrors.length} issue(s)</AlertTitle>
                <AlertDescription className="max-h-32 overflow-auto text-xs">
                  {parseErrors.slice(0, 20).map((e, i) => (
                    <div key={i}>
                      Row {e.row}: {e.error}
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {preview.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Enroll ID</TableHead>
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
                        <TableCell>
                          <Badge variant="outline">{p.punch_type}</Badge>
                        </TableCell>
                        <TableCell>{emp?.full_name ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-12">No data yet — upload a ZKTeco Attendance Record Report (.xlsx).</p>
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
      <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {fileName && <p className="text-xs text-muted-foreground mt-2">{fileName}</p>}
    </div>
  );
}
