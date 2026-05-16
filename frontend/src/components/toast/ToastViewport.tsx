import { useEffect, useState } from 'react';

import { AuthToast } from '@/components/auth/AuthToast';
import { dismissToast, subscribeToToasts, type GlobalToast } from '@/lib/toast';

export function ToastViewport() {
  const [toasts, setToasts] = useState<GlobalToast[]>([]);

  useEffect(() => {
    return subscribeToToasts(setToasts);
  }, []);

  return (
    <div className="pointer-events-none fixed right-2 top-4 z-50 flex w-[calc(100%-1rem)] max-w-[420px] flex-col gap-3 sm:right-4 sm:w-[calc(100%-2rem)]">
      {toasts.map((toast) => (
        <AuthToast
          key={toast.id}
          title={toast.title}
          message={toast.message}
          tone={toast.tone}
          action={toast.action}
          durationMs={toast.durationMs}
          onDismiss={() => {
            dismissToast(toast.id);
          }}
        />
      ))}
    </div>
  );
}
