'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ProjectNav } from '@/components/layout/project-nav';
import { useAppStore } from '@/lib/store';
import type { ProjectMode } from '@/types';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = params.id as string;
  const { currentProject, fetchProject } = useAppStore();

  useEffect(() => {
    if (id) fetchProject(id);
  }, [id, fetchProject]);

  return (
    <div className="min-h-screen flex flex-col">
      <ProjectNav
        projectId={id}
        projectName={currentProject?.name || 'Loading...'}
        mode={(currentProject?.mode || 'midjourney_manual') as ProjectMode}
      />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
