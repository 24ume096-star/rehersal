/**
 * AlertToastPanel — stacked toast panel (fixed top-right).
 * Critical: red, manual dismiss · Warning: amber, 30s · Info: teal, 15s
 */
import { Bell, Volume2, VolumeX, X, MapPin } from "lucide-react";
import type { FloodAlert, AlertType } from "../utils/alertEngine";

const ICON: Record<AlertType, string> = {
  CRITICAL: "🚨",
  RAPID_RISE: "📈",
  EXTREME_RAINFALL: "🌧️",
  DATA_QUALITY: "⚠️",
};

const STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  critical: {
    bg:     "bg-red-950/95",
    border: "border-red-500/70",
    text:   "text-red-200",
    badge:  "bg-red-500/20 text-red-300 ring-red-500/40",
  },
  warning: {
    bg:     "bg-amber-950/95",
    border: "border-amber-500/60",
    text:   "text-amber-200",
    badge:  "bg-amber-500/20 text-amber-300 ring-amber-500/40",
  },
  info: {
    bg:     "bg-teal-950/95",
    border: "border-teal-500/60",
    text:   "text-teal-200",
    badge:  "bg-teal-500/20 text-teal-300 ring-teal-500/40",
  },
};

interface ToastProps {
  alert: FloodAlert;
  onDismiss: (id: string) => void;
  onViewOnMap: (zoneId: string) => void;
}

function AlertToast({ alert, onDismiss, onViewOnMap }: ToastProps) {
  const s = STYLES[alert.severity];

  return (
    <div
      className={`rounded-xl border-l-4 ${s.bg} ${s.border} backdrop-blur-md shadow-2xl px-4 py-3 w-80 ${
        alert.severity === "critical" ? "ring-1 ring-red-500/30 animate-[pulse_3s_ease-in-out_infinite]" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg shrink-0">{ICON[alert.type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ${s.badge}`}>
              {alert.type.replace("_", " ")}
            </span>
            <button
              onClick={() => onDismiss(alert.id)}
              className="shrink-0 rounded-full p-0.5 text-white/30 hover:text-white transition"
              aria-label="Dismiss alert"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className={`text-xs font-semibold ${s.text} leading-snug mb-1`}>{alert.message}</p>
          <p className="text-[10px] text-white/45 leading-relaxed mb-2">{alert.recommendedAction}</p>
          <div className="flex items-center gap-2">
            {alert.zoneId && (
              <button
                onClick={() => onViewOnMap(alert.zoneId!)}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-white/20 transition"
              >
                <MapPin className="h-3 w-3" /> View on Map
              </button>
            )}
            {alert.riskScore > 0 && (
              <span className="text-[10px] text-white/40">
                Risk: {alert.riskScore.toFixed(0)}/100
              </span>
            )}
            <span className="ml-auto text-[9px] text-white/25">
              {alert.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
interface Props {
  alerts: FloodAlert[];
  onDismiss: (id: string) => void;
  onViewOnMap: (zoneId: string) => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  unreadCount: number;
}

export function AlertToastPanel({
  alerts, onDismiss, onViewOnMap, soundEnabled, onSoundToggle, unreadCount,
}: Props) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col items-end gap-2">
      {/* Bell + sound controls row */}
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1f14]/90 px-3 py-1.5 backdrop-blur-md shadow-lg">
        <Bell className="h-4 w-4 text-white/60" />
        {unreadCount > 0 && (
          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
            {unreadCount}
          </span>
        )}
        <span className="text-[10px] text-white/40 ml-1">Alerts</span>
        <button
          onClick={onSoundToggle}
          className="ml-2 rounded-full p-1 text-white/40 hover:text-accent transition"
          title={soundEnabled ? "Disable sound" : "Enable sound"}
        >
          {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-accent" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Toast stack */}
      {alerts.map(alert => (
        <AlertToast
          key={alert.id}
          alert={alert}
          onDismiss={onDismiss}
          onViewOnMap={onViewOnMap}
        />
      ))}
    </div>
  );
}
