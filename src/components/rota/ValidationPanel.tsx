import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import type { ValidationIssue } from '@/hooks/useRotaValidation';
import { cn } from '@/lib/utils';

interface ValidationPanelProps {
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
  canPublish: boolean;
}

export function ValidationPanel({ blockers, warnings, canPublish }: ValidationPanelProps) {
  const hasIssues = blockers.length > 0 || warnings.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Validation
            {canPublish ? (
              <Badge variant="outline" className="text-[hsl(var(--success))] border-[hsl(var(--success))]">
                <CheckCircle className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Issues Found
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasIssues ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />
            No issues found. Ready to publish.
          </div>
        ) : (
          <>
            {/* Blockers Section */}
            {blockers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <XCircle className="h-4 w-4" />
                  Blockers ({blockers.length})
                </div>
                <ul className="space-y-1.5 pl-6">
                  {blockers.map((issue) => (
                    <li
                      key={issue.id}
                      className={cn(
                        'text-sm p-2 rounded-md',
                        'bg-destructive/10 text-destructive border border-destructive/20'
                      )}
                    >
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings Section */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--warning))]">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings ({warnings.length})
                </div>
                <ul className="space-y-1.5 pl-6">
                  {warnings.map((issue) => (
                    <li
                      key={issue.id}
                      className={cn(
                        'text-sm p-2 rounded-md',
                        'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.2)]'
                      )}
                    >
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
