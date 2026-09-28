/** Reception & housekeeping shift template codes (see scripts/db/05-reception-housekeeping-shifts.sql). */
export const RECEPTION_SHIFT_CODES = [
  'RH_D0630_1430',
  'RH_D0800_1600',
  'RH_D1030_1830',
  'RH_N1830_0630',
] as const;

export function departmentUsesTimedShifts(departmentName: string | undefined | null): boolean {
  if (!departmentName) return false;
  const n = departmentName.toLowerCase();
  return (
    n.includes('reception') ||
    n.includes('housekeeping') ||
    n.includes('house keeping') ||
    n.includes('front office') ||
    n.includes('hk ')
  );
}

export type TimedTemplateOption = {
  id: string;
  code: string;
  label: string;
  shift_code: 'D' | 'N';
};

export function filterReceptionTemplates(
  rows: Array<{ id: string; code: string; name: string; start_time: string; end_time: string; is_night?: boolean | null }>,
): TimedTemplateOption[] {
  return rows
    .filter((r) => r.code.startsWith('RH_') || r.code.startsWith('DAY_') || r.code.startsWith('NIGHT_'))
    .map((r) => ({
      id: r.id,
      code: r.code,
      shift_code: r.is_night ? 'N' : 'D',
      label: `${r.name} (${String(r.start_time).slice(0, 5)}–${String(r.end_time).slice(0, 5)})`,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function defaultTemplateIdForShift(
  templates: TimedTemplateOption[],
  shift: 'D' | 'N',
): string | null {
  const pref =
    shift === 'N'
      ? templates.find((t) => t.code === 'RH_N1830_0630')
      : templates.find((t) => t.code === 'RH_D0800_1600');
  return pref?.id ?? templates.find((t) => t.shift_code === shift)?.id ?? null;
}
