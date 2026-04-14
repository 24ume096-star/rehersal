import { useCallback, useEffect, useRef, useState } from "react";
import {
  alertKey, checkAlerts, loadAlertHistory, playAlertBeep, saveAlertHistory,
} from "../utils/alertEngine";
import type { FloodAlert } from "../utils/alertEngine";
import type { ZonePrediction } from "./useFloodPredictions";

export interface AlertEngineResult {
  alerts: FloodAlert[];         // visible (not dismissed), up to 5
  unreadCount: number;
  dismiss: (id: string) => void;
  markAllRead: () => void;
}

export function useAlertEngine(
  predictions: Map<string, ZonePrediction>,
  rainfall24h: number,
  soundEnabled: boolean
): AlertEngineResult {
  const [allAlerts, setAllAlerts] = useState<FloodAlert[]>(() => loadAlertHistory());
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs for values used inside the check callback
  const predictionsRef    = useRef(predictions);
  const prevPredictionsRef = useRef<Map<string, ZonePrediction>>(new Map());
  const rainfallRef       = useRef(rainfall24h);
  const soundRef          = useRef(soundEnabled);
  const allAlertsRef      = useRef(allAlerts);

  // Keep refs in sync without triggering re-runs
  predictionsRef.current  = predictions;
  rainfallRef.current     = rainfall24h;
  soundRef.current        = soundEnabled;
  allAlertsRef.current    = allAlerts;

  const runCheck = useCallback(() => {
    const activeKeys = new Set<string>(
      allAlertsRef.current
        .filter(a => !a.dismissed)
        .map(a => alertKey(a.type, a.zoneId))
    );

    const newAlerts = checkAlerts(
      predictionsRef.current,
      prevPredictionsRef.current,
      rainfallRef.current,
      activeKeys
    );

    if (newAlerts.length > 0) {
      if (soundRef.current && newAlerts.some(a => a.severity === "critical")) {
        playAlertBeep();
      }
      setAllAlerts(prev => {
        const updated = [...newAlerts, ...prev];
        saveAlertHistory(updated);
        return updated;
      });
      setUnreadCount(prev => prev + newAlerts.length);
    }

    if (predictionsRef.current.size > 0) {
      prevPredictionsRef.current = new Map(predictionsRef.current);
    }
  }, []); // stable — reads from refs

  // Check immediately whenever predictions update
  useEffect(() => {
    if (predictions.size > 0) runCheck();
  }, [predictions, runCheck]);

  // Then re-check every 60 seconds
  useEffect(() => {
    const id = setInterval(runCheck, 60_000);
    return () => clearInterval(id);
  }, [runCheck]);

  // Auto-dismiss timers
  useEffect(() => {
    const timers = allAlerts
      .filter(a => a.autoDismissMs && !a.dismissed)
      .map(a =>
        setTimeout(() => {
          setAllAlerts(prev => {
            const updated = prev.map(x => x.id === a.id ? { ...x, dismissed: true } : x);
            saveAlertHistory(updated);
            return updated;
          });
        }, a.autoDismissMs!)
      );
    return () => timers.forEach(clearTimeout);
  }, [allAlerts]);

  const dismiss = useCallback((id: string) => {
    setAllAlerts(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, dismissed: true } : a);
      saveAlertHistory(updated);
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  const visibleAlerts = allAlerts.filter(a => !a.dismissed).slice(0, 5);

  return { alerts: visibleAlerts, unreadCount, dismiss, markAllRead };
}
