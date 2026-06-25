import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previousVersion?: string | null;
  currentVersion?: string | null;
}

interface ChangelogSection {
  version: string;
  date: string | null;
  lines: string[];
}

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function parseChangelog(changelog: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;

  for (const line of changelog.split(/\r?\n/)) {
    const match = line.match(/^## \[([^\]]+)\](?: - (.+))?$/);
    if (match) {
      if (current) sections.push(current);
      current = {
        version: match[1],
        date: match[2] ?? null,
        lines: [],
      };
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

function ChangelogLines({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-3 text-sm">
      {lines
        .filter((line) => line.trim().length > 0)
        .map((line, index) => {
          if (line.startsWith('### ')) {
            return (
              <h4
                key={`${index}-${line}`}
                className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {line.slice(4)}
              </h4>
            );
          }

          if (line.startsWith('- ')) {
            return (
              <div key={`${index}-${line}`} className="flex gap-2 leading-6">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{line.slice(2)}</span>
              </div>
            );
          }

          return (
            <p
              key={`${index}-${line}`}
              className="leading-6 text-muted-foreground"
            >
              {line}
            </p>
          );
        })}
    </div>
  );
}

export function ChangelogDialog({
  open,
  onOpenChange,
  previousVersion,
  currentVersion,
}: ChangelogDialogProps) {
  const [changelog, setChangelog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || changelog || error) return;

    api.app
      .getChangelog()
      .then(setChangelog)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [changelog, error, open]);

  const sections = useMemo(() => {
    if (!changelog) return [];
    const parsed = parseChangelog(changelog);

    if (!previousVersion) return parsed;

    return parsed.filter((section) => {
      if (compareVersions(section.version, previousVersion) <= 0) return false;
      if (!currentVersion) return true;
      return compareVersions(section.version, currentVersion) <= 0;
    });
  }, [changelog, currentVersion, previousVersion]);

  const title = previousVersion ? 'What Changed' : 'Changelog';
  const description = previousVersion
    ? `Updates since db-vwr ${previousVersion}.`
    : 'All notable changes in db-vwr.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/20 p-4">
          {!changelog && !error ? (
            <p className="text-sm text-muted-foreground">
              Loading changelog...
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive">
              Failed to load changelog: {error}
            </p>
          ) : null}
          {changelog && sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No changelog entries were found for this update.
            </p>
          ) : null}
          {sections.length > 0 ? (
            <div className="space-y-6">
              {sections.map((section) => (
                <section key={section.version} className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold">
                      v{section.version}
                    </h3>
                    {section.date ? (
                      <p className="text-xs text-muted-foreground">
                        {section.date}
                      </p>
                    ) : null}
                  </div>
                  <ChangelogLines lines={section.lines} />
                </section>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
