/**
 * Alert engine — evaluates flood predictions and generates typed alerts.
 */
import type { ZonePrediction } from "../hooks/useFloodPredictions";
import { FLOOD_ZONES } from "../data/floodZones";

export type AlertType = "CRITICAL" | "RAPID_RISE" | "EXTREME_RAINFALL" | "DATA_QUALITY";
export type AlertSeverity = "critical" | "warning" | "info";

export interface FloodAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  zoneId: string | null;
  zoneName: string;
  riskScore: number;
  message: string;
  recommendedAction: string;
  timestamp: Date;
  dismissed: boolean;
  autoDismissMs: number | null;   // null = manual only
}

const ACTIONS: Record<AlertType, string> = {
  CRITICAL:
    "Activate emergency drainage pumps immediately and issue evacuation advisory for low-lying areas.",
  RAPID_RISE:
    "Alert field response teams. Check drainage capacity and prepare mobile flood barriers.",
  EXTREME_RAINFALL:
    "Close low-water crossings. Activate stormwater overflow protocol and open diversion channels.",
  DATA_QUALITY:
    "Cross-check with satellite imagery. Manual field assessment recommended before deploying resources.",
};

const AUTO_DISMISS: Record<AlertType, number | null> = {
  CRITICAL: null,
  RAPID_RISE: null,
  EXTREME_RAINFALL: 30_000,
  DATA_QUALITY: 15_000,
};

function uid() {
  return `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

/** Derive a stable dedup key for an alert (used to prevent repeats). */
export function alertKey(type: AlertType, zoneId: string | null): string {
  return `${type}:${zoneId ?? "_global"}`;
}

export function checkAlerts(
  predictions: Map<string, ZonePrediction>,
  prevPredictions: Map<string, ZonePrediction>,
  rainfall24h: number,
  activeKeys: Set<string>
): FloodAlert[] {
  const alerts: FloodAlert[] = [];
  let totalConf = 0;
  let count = 0;

  predictions.forEach((pred, zoneId) => {
    const zone = FLOOD_ZONES.find(z => z.id === zoneId);
    const zoneName = zone?.name ?? zoneId;

    if (pred.riskScore > 85 && !activeKeys.has(alertKey("CRITICAL", zoneId))) {
      alerts.push({
        id: uid(), type: "CRITICAL", severity: "critical",
        zoneId, zoneName, riskScore: pred.riskScore,
        message: `${zoneName} has entered critical flood risk territory (score: ${pred.riskScore.toFixed(0)}/100).`,
        recommendedAction: ACTIONS.CRITICAL,
        timestamp: new Date(), dismissed: false, autoDismissMs: null,
      });
    }

    const prev = prevPredictions.get(zoneId);
    if (prev && pred.riskScore - prev.riskScore > 15 && !activeKeys.has(alertKey("RAPID_RISE", zoneId))) {
      alerts.push({
        id: uid(), type: "RAPID_RISE", severity: "critical",
        zoneId, zoneName, riskScore: pred.riskScore,
        message: `Risk in ${zoneName} jumped +${(pred.riskScore - prev.riskScore).toFixed(0)} pts since last check.`,
        recommendedAction: ACTIONS.RAPID_RISE,
        timestamp: new Date(), dismissed: false, autoDismissMs: null,
      });
    }

    totalConf += pred.confidence;
    count++;
  });

  if (rainfall24h > 150 && !activeKeys.has(alertKey("EXTREME_RAINFALL", null))) {
    alerts.push({
      id: uid(), type: "EXTREME_RAINFALL", severity: "warning",
      zoneId: null, zoneName: "Delhi NCR", riskScore: 0,
      message: `Extreme 24-hour rainfall: ${rainfall24h.toFixed(0)} mm — exceeds 150 mm threshold.`,
      recommendedAction: ACTIONS.EXTREME_RAINFALL,
      timestamp: new Date(), dismissed: false, autoDismissMs: AUTO_DISMISS.EXTREME_RAINFALL,
    });
  }

  if (count > 0 && totalConf / count < 0.6 && !activeKeys.has(alertKey("DATA_QUALITY", null))) {
    alerts.push({
      id: uid(), type: "DATA_QUALITY", severity: "info",
      zoneId: null, zoneName: "ML Model", riskScore: 0,
      message: `Average model confidence is ${((totalConf / count) * 100).toFixed(0)}% — below the 60% reliability threshold.`,
      recommendedAction: ACTIONS.DATA_QUALITY,
      timestamp: new Date(), dismissed: false, autoDismissMs: AUTO_DISMISS.DATA_QUALITY,
    });
  }

  return alerts;
}

// ── Web Audio beep ────────────────────────────────────────────────────────────
export function playAlertBeep(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (_) { /* Web Audio not supported */ }
}

// ── localStorage persistence ──────────────────────────────────────────────────
const LS_KEY = "flood_alert_history_v1";

export function loadAlertHistory(): FloodAlert[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map(a => ({ ...a, timestamp: new Date(a.timestamp) }));
  } catch { return []; }
}

export function saveAlertHistory(alerts: FloodAlert[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(alerts.slice(0, 50))); } catch (_) {}
}
