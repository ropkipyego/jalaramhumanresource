import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ShiftCode } from '@/types/database';
import { cn } from '@/lib/utils';
import type { TimedTemplateOption } from '@/lib/receptionShifts';

interface ShiftCellProps {
  value: ShiftCode | null;
  onChange: (value: ShiftCode | null) => void;
  disabled?: boolean;
  hasError?: boolean;
  hasWarning?: boolean;
  isOnLeave?: boolean;
  timedTemplates?: TimedTemplateOption[];
  templateId?: string | null;
  onTemplateChange?: (templateId: string | null) => void;
}

const SHIFT_OPTIONS: { value: ShiftCode | 'NONE'; label: string }[] = [
  { value: 'NONE', label: '—' },
  { value: 'D', label: 'Day' },
  { value: 'N', label: 'Night' },
  { value: 'OFF', label: 'Off' },
  { value: 'PH', label: 'Public Holiday' },
];

const getShiftBadgeClass = (shift: ShiftCode | null): string => {
  if (!shift) return '';
  const classes: Record<ShiftCode, string> = {
    D: 'shift-badge-d',
    N: 'shift-badge-n',
    OFF: 'shift-badge-off',
    PH: 'shift-badge-ph',
  };
  return classes[shift];
};

export function ShiftCell({
  value,
  onChange,
  disabled = false,
  hasError = false,
  hasWarning = false,
  isOnLeave = false,
  timedTemplates,
  templateId,
  onTemplateChange,
}: ShiftCellProps) {
  const handleChange = (newValue: string) => {
    onChange(newValue === 'NONE' ? null : (newValue as ShiftCode));
  };

  const showTimed =
    !disabled &&
    timedTemplates &&
    timedTemplates.length > 0 &&
    onTemplateChange &&
    (value === 'D' || value === 'N');

  const timedForShift = showTimed
    ? timedTemplates!.filter((t) => t.shift_code === value)
    : [];

  const timedSelect = showTimed && timedForShift.length > 0 && (
    <Select
      value={templateId || 'AUTO'}
      onValueChange={(v) => onTemplateChange!(v === 'AUTO' ? null : v)}
    >
      <SelectTrigger className="h-8 mt-1 text-[10px]">
        <SelectValue placeholder="Time slot" />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50 max-h-48">
        <SelectItem value="AUTO">Default slot</SelectItem>
        {timedForShift.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (disabled) {
    return (
      <div className="space-y-1">
        <div
          className={cn(
            'h-12 flex items-center justify-center rounded-md border bg-muted',
            hasError && 'border-destructive bg-destructive/10',
            hasWarning && !hasError && 'border-warning bg-warning/10',
            isOnLeave && 'bg-accent/50'
          )}
        >
          {value ? (
            <Badge className={cn(getShiftBadgeClass(value), 'px-2.5 py-1 text-sm')}>
              {value}
            </Badge>
          ) : isOnLeave ? (
            <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--warning))]">Leave</span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
    <Select value={value || 'NONE'} onValueChange={handleChange}>
      <SelectTrigger
        className={cn(
          'h-12 w-full text-base',
          hasError && 'border-destructive bg-destructive/10',
          hasWarning && !hasError && 'border-warning bg-warning/10',
          isOnLeave && 'bg-accent/50 border-[hsl(var(--warning))]'
        )}
      >
        <SelectValue>
          {value ? (
            <Badge className={cn(getShiftBadgeClass(value), 'px-2.5 py-1 text-sm')}>
              {value}
            </Badge>
          ) : isOnLeave ? (
            <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--warning))]">On leave</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {SHIFT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.value === 'NONE' ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <div className="flex items-center gap-2">
                <Badge className={cn(getShiftBadgeClass(option.value as ShiftCode), 'px-2 py-0.5 text-xs')}>
                  {option.value}
                </Badge>
                <span className="text-sm">{option.label}</span>
              </div>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {timedSelect}
    </div>
  );
}
