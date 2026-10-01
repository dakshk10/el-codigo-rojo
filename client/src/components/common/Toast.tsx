import React, { useEffect } from "react";

export interface ToastMessage {
  id: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({
  toasts,
  onDismiss,
}) => {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{
  toast: ToastMessage;
  onDismiss: () => void;
}> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-panel border border-line text-paper px-4 py-3 shadow-lg flex items-center justify-between gap-4 font-mono text-xs uppercase tracking-wider"
    >
      <span>{toast.message}</span>
      <button
        onClick={onDismiss}
        className="text-muted hover:text-paper focus:outline-none focus:ring-1 focus:ring-red-bright"
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
};
