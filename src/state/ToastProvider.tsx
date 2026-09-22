/** Toast notifications. Deliberately minimal: title + optional detail. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '../components/Icon';
import { AppError, toAppError } from '../lib/errors';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (tone: ToastTone, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (error: unknown, fallbackTitle?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastTone, 'check-circle' | 'alert-circle' | 'info'> = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info',
};

const DURATION = 5200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (tone: ToastTone, title: string, message?: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, tone, title, ...(message ? { message } : {}) }]);
      const timer = window.setTimeout(() => dismiss(id), DURATION);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const error = useCallback(
    (err: unknown, fallbackTitle = 'Something went wrong') => {
      const appError = err instanceof AppError ? err : toAppError(err);
      toast('error', appError.title || fallbackTitle, [appError.message, appError.hint].filter(Boolean).join(' '));
    },
    [toast],
  );

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      error,
      success: (title, message) => toast('success', title, message),
      info: (title, message) => toast('info', title, message),
    }),
    [toast, error],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toaster" role="region" aria-label="Notifications">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone}`}>
            <Icon name={ICONS[item.tone]} size={18} />
            <div className="toast__body">
              <div className="toast__title">{item.title}</div>
              {item.message ? <div className="toast__msg">{item.message}</div> : null}
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--icon btn--sm"
              aria-label="Dismiss notification"
              onClick={() => dismiss(item.id)}
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
