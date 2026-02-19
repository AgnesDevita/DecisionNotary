import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '../utils/cn';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationProps {
  type: NotificationType;
  message: string;
  onClose?: () => void;
  duration?: number;
  className?: string;
}

export const Notification: React.FC<NotificationProps> = ({
  type,
  message,
  onClose,
  duration = 5000,
  className,
}) => {
  useEffect(() => {
    if (duration > 0 && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-notary-success" />,
    error: <XCircle className="w-5 h-5 text-notary-error" />,
    warning: <AlertCircle className="w-5 h-5 text-notary-warning" />,
    info: <AlertCircle className="w-5 h-5 text-bnb-400" />,
  };

  const backgrounds = {
    success: 'bg-notary-success/10 border-notary-success/30',
    error: 'bg-notary-error/10 border-notary-error/30',
    warning: 'bg-notary-warning/10 border-notary-warning/30',
    info: 'bg-bnb-500/10 border-bnb-500/30',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border animate-fadeIn',
        backgrounds[type],
        className
      )}
    >
      {icons[type]}
      <p className="flex-1 text-sm text-gray-200">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      )}
    </div>
  );
};

// Container for managing multiple notifications
interface NotificationContainerProps {
  notifications: Array<{ id: string; type: NotificationType; message: string }>;
  onClose: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onClose,
}) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          type={notification.type}
          message={notification.message}
          onClose={() => onClose(notification.id)}
        />
      ))}
    </div>
  );
};
