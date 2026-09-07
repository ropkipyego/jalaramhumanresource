import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Copy, Send, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { RotaStatus, Department } from '@/types/database';

interface WeekNavigatorProps {
  weekStartDate: Date;
  department: Department;
  status: RotaStatus;
  onNavigate: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  onCopyPreviousWeek: () => void;
  onSave: () => void;
  onPublish: () => void;
  canPublish: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  hasChanges: boolean;
  isEditable: boolean;
}

export function WeekNavigator({
  weekStartDate,
  department,
  status,
  onNavigate,
  onGoToToday,
  onCopyPreviousWeek,
  onSave,
  onPublish,
  canPublish,
  isSaving,
  isPublishing,
  hasChanges,
  isEditable,
}: WeekNavigatorProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                Week of {format(weekStartDate, 'MMMM d, yyyy')}
              </CardTitle>
              <Badge
                variant={status === 'published' ? 'default' : 'secondary'}
                className={status === 'published' ? 'bg-[hsl(var(--success))]' : ''}
              >
                {status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <CardDescription>{department.name}</CardDescription>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Week Navigation */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={onGoToToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => onNavigate('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => onNavigate('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Actions - only show when editable */}
            {isEditable && (
              <div className="flex items-center gap-2 ml-2 border-l pl-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCopyPreviousWeek}
                  disabled={isSaving || isPublishing}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Previous
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSave}
                  disabled={!hasChanges || isSaving || isPublishing}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
                
                <Button
                  size="sm"
                  onClick={onPublish}
                  disabled={!canPublish || isSaving || isPublishing || status === 'published'}
                >
                  {isPublishing ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Publish
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
