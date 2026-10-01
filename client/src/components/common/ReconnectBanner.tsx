import React from "react";
import { AlertTriangle } from "lucide-react";

interface ReconnectBannerProps {
  isReconnecting: boolean;
}

export const ReconnectBanner: React.FC<ReconnectBannerProps> = ({
  isReconnecting,
}) => {
  if (!isReconnecting) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="w-full bg-amber/20 border-b border-amber text-amber px-4 py-2 flex items-center justify-center gap-2 text-xs font-mono tracking-widest uppercase z-40"
    >
      <AlertTriangle className="w-4 h-4 animate-bounce" />
      <span>SIGNAL LOST // RECONNECTING</span>
    </div>
  );
};
