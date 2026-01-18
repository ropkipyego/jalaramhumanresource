import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Department } from '@/types/database';

interface DepartmentSelectorProps {
  departments: Department[];
  selectedId: string | null;
  onChange: (departmentId: string) => void;
}

export function DepartmentSelector({
  departments,
  selectedId,
  onChange,
}: DepartmentSelectorProps) {
  if (departments.length === 0) {
    return null;
  }

  if (departments.length === 1) {
    return (
      <div className="text-sm text-muted-foreground">
        Department: <span className="font-medium text-foreground">{departments[0].name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Department:</span>
      <Select value={selectedId || ''} onValueChange={onChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select department" />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
