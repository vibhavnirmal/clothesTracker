import { type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';

interface InstallBannerProps {
  title: string;
  description?: ReactNode;
  instructions?: string[];
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  icon?: ReactNode;
}

export function InstallBanner({
  title,
  description,
  instructions,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel = 'Dismiss',
  onSecondary,
  icon,
}: InstallBannerProps) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-1 text-blue-600">
          {icon ?? <Download className="h-5 w-5" />}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {description && <p className="mt-1 text-xs text-gray-600">{description}</p>}
            {instructions && instructions.length > 0 && (
              <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-gray-600">
                {instructions.map(step => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {primaryLabel && onPrimary && (
              <Button type="button" size="sm" onClick={onPrimary} disabled={primaryDisabled}>
                {primaryLabel}
              </Button>
            )}
            {secondaryLabel && (
              <Button type="button" size="sm" variant="ghost" onClick={onSecondary}>
                {secondaryLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
