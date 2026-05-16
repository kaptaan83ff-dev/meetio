import { PropsWithChildren } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { DashboardTopNav } from '@/components/navigation/DashboardTopNav';

export function AppShell({ children }: PropsWithChildren) {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-[100dvh] bg-cream-canvas text-ink-black">
      <div className="fixed inset-0 bg-dot-grid" aria-hidden="true" />
      <div className="relative z-10">
        <DashboardTopNav user={user} />
        {children}
      </div>
    </div>
  );
}
