'use client';

import { useI18n } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n/messages/en';

type Stage = 'search' | 'verdict' | 'estimate' | 'complaint';

const STEPS: { id: Stage; labelKey: MessageKey; numeral: string }[] = [
  { id: 'search',    labelKey: 'stepper.locate',   numeral: '1' },
  { id: 'verdict',   labelKey: 'stepper.verdict',  numeral: '2' },
  { id: 'estimate',  labelKey: 'stepper.estimate', numeral: '3' },
  { id: 'complaint', labelKey: 'stepper.draft',    numeral: '4' },
];

type Props = {
  current: Stage;
  reachable: Set<Stage>;
  onJump?: (stage: Stage) => void;
};

export default function StageStepper({ current, reachable, onJump }: Props) {
  const { t } = useI18n();
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="flex items-stretch w-full select-none">
      {STEPS.map((step, i) => {
        const reached = reachable.has(step.id);
        const isCurrent = step.id === current;
        const isPast = i < currentIndex;
        const accent =
          isCurrent
            ? 'text-brass'
            : isPast || reached
            ? 'text-secondary'
            : 'text-muted';
        const isLast = i === STEPS.length - 1;

        return (
          <li key={step.id} className="flex items-center min-w-0 flex-1">
            <button
              type="button"
              disabled={!reached || !onJump}
              onClick={() => onJump?.(step.id)}
              className={`group flex items-center gap-2.5 min-w-0 ${
                reached && onJump ? 'cursor-pointer' : 'cursor-default'
              }`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={`relative inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border ${
                  isCurrent
                    ? 'border-brass bg-brass-wash text-brass-deep animate-brass-pulse'
                    : isPast
                    ? 'border-brass bg-brass text-white'
                    : reached
                    ? 'border-rule-strong bg-bone text-secondary'
                    : 'border-rule bg-paper-soft text-muted'
                } font-display text-[11px] font-semibold tracking-wide`}
                aria-hidden
              >
                {isPast ? (
                  <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 7.5l3 3 6-7" />
                  </svg>
                ) : (
                  step.numeral
                )}
              </span>
              <span className="min-w-0 truncate">
                <span className={`block text-[10px] tracking-[0.18em] font-semibold uppercase ${accent}`}>
                  {t('stepper.step', { n: step.numeral })}
                </span>
                <span className={`font-display text-[15px] leading-tight ${
                  isCurrent ? 'text-ink-text font-semibold' : reached ? 'text-ink-text' : 'text-muted'
                }`}>
                  {t(step.labelKey)}
                </span>
              </span>
            </button>
            {!isLast && (
              <div className="mx-3 h-px flex-1 bg-rule relative overflow-hidden">
                <span
                  className={`absolute inset-y-0 left-0 bg-brass transition-[width] duration-700 ${
                    i < currentIndex ? 'w-full' : 'w-0'
                  }`}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export type { Stage };
