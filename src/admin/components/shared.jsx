import { Badge } from '../ui/badge';
import { cn } from '../lib/utils';

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Confidence pill from a 0–1 OCR confidence (real value). */
export function ConfidenceBadge({ value }) {
  if (value == null) return <Badge variant="muted">신뢰도 —</Badge>;
  const pct = Math.round(value * 100);
  const variant = value >= 0.8 ? 'success' : value >= 0.6 ? 'warning' : 'destructive';
  return <Badge variant={variant}>신뢰도 {pct}%</Badge>;
}

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-muted-foreground" />}
      <div className="text-sm font-semibold">{title}</div>
      {description && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</div>}
    </div>
  );
}

export function StatTile({ label, value, sub, tone = 'default', icon: Icon }) {
  const tones = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning-foreground',
    danger: 'text-destructive',
  };
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className={cn('mt-2 text-2xl font-bold tabular-nums', tones[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Horizontal proportion bar (real counts). */
export function BarRow({ label, value, total, tone = 'bg-primary' }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums">
        {value}
        <span className="ml-1 font-normal text-muted-foreground">{pct}%</span>
      </span>
    </div>
  );
}
