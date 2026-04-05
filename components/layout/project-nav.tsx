'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ProjectMode } from '@/types';

const UNIFIED_STEPS = [
  { label: 'Reference Lab', href: 'references', icon: '📚' },
  { label: 'Story Studio', href: 'story-studio', icon: '✍️' },
  { label: 'Character', href: 'characterizer', icon: '🎨' },
];

const LEGACY_MJ_STEPS = [
  { label: 'Brief', href: 'brief', icon: '📝' },
  { label: 'Prompt Lab', href: 'prompt-lab', icon: '🔬' },
  { label: 'Select', href: 'select', icon: '✅' },
  { label: 'Variants', href: 'variants', icon: '🎯' },
  { label: 'Dataset', href: 'dataset', icon: '📦' },
];

export function ProjectNav({ projectId, projectName, mode }: { projectId: string; projectName: string; mode?: ProjectMode }) {
  const pathname = usePathname();
  const currentStep = pathname.split('/').pop();

  const isLegacyMJ = mode === 'midjourney_manual';
  const steps = isLegacyMJ ? LEGACY_MJ_STEPS : UNIFIED_STEPS;

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14 gap-4">
          <Link href="/projects" className="text-muted-foreground hover:text-foreground transition-colors text-sm shrink-0">
            ← Projects
          </Link>
          <div className="h-6 w-px bg-border shrink-0" />
          <span className="font-semibold text-sm truncate max-w-[180px]">{projectName}</span>
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0',
            isLegacyMJ ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white',
          )}>
            {isLegacyMJ ? 'MJ Legacy' : 'AI Studio'}
          </span>
          <div className="h-6 w-px bg-border shrink-0" />
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {steps.map((step, i) => {
              const isActive = currentStep === step.href;
              return (
                <div key={step.href} className="flex items-center shrink-0">
                  {i > 0 && (
                    <svg className="w-4 h-4 text-border mx-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  )}
                  <Link
                    href={`/projects/${projectId}/${step.href}`}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm transition-all whitespace-nowrap',
                      isActive
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    {step.label}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
