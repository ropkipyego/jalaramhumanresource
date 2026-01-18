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

interface ShiftCellProps {
  value: ShiftCode | null;
  onChange: (value: ShiftCode | null) => void;
  disabled?: boolean;
  hasError?: boolean;
  hasWarning?: boolean;
  isOnLeave?: boolean;
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
}: ShiftCellProps) {
  const handleChange = (newValue: string) => {
    onChange(newValue === 'NONE' ? null : (newValue as ShiftCode));
  };

  if (disabled) {
    return (
      <div
        className={cn(
          'h-10 flex items-center justify-center rounded-md border bg-muted',
          hasError && 'border-destructive bg-destructive/10',
          hasWarning && !hasError && 'border-warning bg-warning/10',
          isOnLeave && 'bg-accent/50'
        )}
      >
        {value ? (
          <Badge className={cn(getShiftBadgeClass(value), 'px-2 py-0.5 text-xs')}>
            {value}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </div>
    );
  }

  return (
    <Select value={value || 'NONE'} onValueChange={handleChange}>
      <SelectTrigger
        className={cn(
          'h-10 w-full',
          hasError && 'border-destructive bg-destructive/10',
          hasWarning && !hasError && 'border-warning bg-warning/10',
          isOnLeave && 'bg-accent/50'
        )}
      >
        <SelectValue>
          {value ? (
            <Badge className={cn(getShiftBadgeClass(value), 'px-2 py-0.5 text-xs')}>
              {value}
            </Badge>
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
  );
}
