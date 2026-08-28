import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  runAttendanceEngine,
  ENGINE_VERSION,
  type EngineShift,
  type EnginePunch,
} from "../_shared/attendanceEngine.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const { from, to } = body ?? {};
    if (!isDate(from) || !isDate(to)) {
      return json({ error: "from and to must be dates in YYYY-MM-DD format" }, 400);
    }
    if (from > to) return json({ error: "from must be on or before to" }, 400);

    // Role check happens inside the security-definer function too.
    const { data: input, error: inputErr } = await userClient.rpc("attendance_engine_input", {
      _from: from,
      _to: to,
    });
    if (inputErr) return json({ error: inputErr.message }, 403);

    const shifts = (input?.shifts ?? []) as EngineShift[];
    const punches = (input?.punches ?? []) as EnginePunch[];
    const settings = (input?.settings ?? {}) as Record<string, number>;

    const results = runAttendanceEngine({ shifts, punches, settings });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Keep overtime decisions that HR already made.
    const { data: existing } = await admin
      .from("attendance_records")
      .select(
        "employee_id, shift_date, shift_type, sequence, overtime_status, overtime_minutes, overtime_approved_by, overtime_approved_at, calculation_version, is_corrected",
      )
      .gte("shift_date", from)
      .lte("shift_date", to);

    const key = (r: { employee_id: string; shift_date: string; shift_type: string; sequence: number }) =>
      `${r.employee_id}|${r.shift_date}|${r.shift_type}|${r.sequence}`;
    const prior = new Map((existing ?? []).map((r) => [key(r as never), r]));

    const { data: run, error: runErr } = await admin
      .from("attendance_processing_runs")
      .insert({
        period_start: from,
        period_end: to,
        engine_version: ENGINE_VERSION,
        shift_count: shifts.length,
        record_count: results.length,
        anomaly_count: results.filter((r) => r.anomalies.length > 0).length,
        run_by: userData.user.id,
        status: "COMPLETED",
      })
      .select("id")
      .single();
    if (runErr) return json({ error: runErr.message }, 500);

    const rows = results
      .filter((r) => {
        const p = prior.get(key(r));
        return !p?.is_corrected; // never overwrite a manually corrected record
      })
      .map((r) => {
        const p = prior.get(key(r)) as
          | { overtime_status: string; overtime_minutes: number; overtime_approved_by: string | null; overtime_approved_at: string | null; calculation_version: number }
          | undefined;
        const keepDecision =
          p &&
          (p.overtime_status === "APPROVED" || p.overtime_status === "REJECTED") &&
          p.overtime_minutes === r.overtime_minutes;

        return {
          employee_id: r.employee_id,
          department_id: r.department_id,
          shift_instance_id: r.shift_instance_id,
          shift_date: r.shift_date,
          shift_type: r.shift_type,
          sequence: r.sequence,
          scheduled_start: r.scheduled_start,
          scheduled_end: r.scheduled_end,
          actual_start: r.actual_start,
          actual_end: r.actual_end,
          scheduled_minutes: r.scheduled_minutes,
          worked_minutes: r.worked_minutes,
          late_minutes: r.late_minutes,
          early_departure_minutes: r.early_departure_minutes,
          overtime_minutes: r.overtime_minutes,
          overtime_status: keepDecision ? p!.overtime_status : r.overtime_status,
          overtime_approved_by: keepDecision ? p!.overtime_approved_by : null,
          overtime_approved_at: keepDecision ? p!.overtime_approved_at : null,
          status: r.status,
          anomaly_code: r.anomaly_code,
          anomalies: r.anomalies,
          matched_punch_ids: r.matched_punch_ids,
          intervals: r.intervals,
          calculation_version: (p?.calculation_version ?? 0) + 1,
          processing_run_id: run.id,
        };
      });

    let written = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await admin
        .from("attendance_records")
        .upsert(chunk, { onConflict: "employee_id,shift_date,shift_type,sequence" });
      if (error) {
        await admin
          .from("attendance_processing_runs")
          .update({ status: "FAILED", notes: error.message })
          .eq("id", run.id);
        return json({ error: error.message }, 500);
      }
      written += chunk.length;
    }

    const summary = {
      run_id: run.id,
      engine_version: ENGINE_VERSION,
      from,
      to,
      shifts: shifts.length,
      punches: punches.length,
      records: written,
      skipped_corrected: results.length - rows.length,
      anomalies: results.filter((r) => r.anomalies.length > 0).length,
      overtime_pending: rows.filter((r) => r.overtime_status === "PENDING_APPROVAL").length,
      by_status: results.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {}),
    };

    await admin
      .from("attendance_processing_runs")
      .update({ record_count: written, notes: JSON.stringify(summary.by_status) })
      .eq("id", run.id);

    return json(summary);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
