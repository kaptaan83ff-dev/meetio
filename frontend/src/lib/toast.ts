import type { AuthToastState } from '@/components/auth/AuthToast';

export type GlobalToast = AuthToastState & {
  id: string;
  durationMs?: number;
};

type ToastListener = (toasts: GlobalToast[]) => void;

const listeners = new Set<ToastListener>();
let queue: GlobalToast[] = [];
let lastSignature: string | null = null;
let lastSignatureAt = 0;

const DEDUPE_WINDOW_MS = 500;

function randomId(): string {
  return `toast_${Math.random().toString(36).slice(2, 10)}`;
}

function notify() {
  const snapshot = [...queue];
  listeners.forEach((listener) => listener(snapshot));
}

function buildSignature(toast: Pick<GlobalToast, 'title' | 'message' | 'tone'>): string {
  return `${toast.tone}::${toast.title}::${toast.message}`;
}

export function showToast(toast: AuthToastState & { durationMs?: number; id?: string }) {
  const signature = buildSignature(toast);
  const now = Date.now();
  if (signature === lastSignature && now - lastSignatureAt < DEDUPE_WINDOW_MS) {
    return;
  }

  lastSignature = signature;
  lastSignatureAt = now;

  const nextToast: GlobalToast = {
    ...toast,
    id: toast.id ?? randomId(),
  };

  queue = [...queue, nextToast];
  notify();
}

export function dismissToast(id: string) {
  queue = queue.filter((toast) => toast.id !== id);
  notify();
}

export function subscribeToToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  listener([...queue]);
  return () => {
    listeners.delete(listener);
  };
}

export function clearToasts() {
  queue = [];
  lastSignature = null;
  lastSignatureAt = 0;
  notify();
}
