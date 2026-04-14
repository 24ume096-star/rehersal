/**
 * useFloodPredictions — debounced batch ML prediction hook.
 * Calls the Python ML service every time rainfallMm / riverLevel changes,
 * waiting 600 ms after the last change before firing the request.
 */
import { useEffect, useRef, useState } from "react";
import { FLOOD_ZONES } from "../data/floodZones";

const ML_URL =
  (import.meta as any).env?.VITE_ML_SERVICE_URL ?? "http://localhost:8001";

export interface ZonePrediction {
  parkId: string;
  riskScore: number;
  floodProbability: number;
  riskGrade: "A" | "B" | "C" | "D" | "E";
  confidence: number;
  shapValues: Record<string, number>;
  topFactors: {
    factor: string;
    contribution: number;
    direction: string;
    humanReadable: string;
  }[];
}

export interface FloodPredictionsResult {
  predictions: Map<string, ZonePrediction>;
  isLoading: boolean;
  isEstimated: boolean;
  lastUpdated: Date | null;
  cityRiskScore: number;
  criticalZones: string[];
}

/** Build the zone-feature payload for the ML batch endpoint */
function buildZonePayload(
  rainfallMm: number,
  soilMoisture: number,
  riverDischarge: number
) {
  return FLOOD_ZONES.map((z) => ({
    parkId:                 z.id,
    ndvi:                   z.ndvi,
    elevation_m:            z.elevation_m,
    rainfall_24h_mm:        Math.max(0, rainfallMm),
    soil_moisture:          Math.min(1, Math.max(0, soilMoisture)),
    river_discharge_m3s:    Math.max(0, riverDischarge),
    distance_to_yamuna_km:  z.distance_to_yamuna_km,
    drainage_capacity_score: z.drainage_capacity_score,
    green_cover_pct:        Math.min(100, z.ndvi * 100),
  }));
}

const EMPTY: FloodPredictionsResult = {
  predictions: new Map(),
  isLoading: false,
  isEstimated: false,
  lastUpdated: null,
  cityRiskScore: 0,
  criticalZones: [],
};

export function useFloodPredictions(
  rainfallMm: number,
  riverLevel: number,
  soilMoisture: number,
  riverDischarge: number
): FloodPredictionsResult {
  const [result, setResult] = useState<FloodPredictionsResult>(EMPTY);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  useEffect(() => {
    // Debounce: wait 600ms after the last change
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setResult((prev) => ({ ...prev, isLoading: true }));

      try {
        const zones = buildZonePayload(rainfallMm, soilMoisture, riverDischarge);
        const res = await fetch(`${ML_URL}/predict/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zones }),
          signal: ctrl.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const predMap = new Map<string, ZonePrediction>(
          (data.predictions as ZonePrediction[]).map((p) => [p.parkId, p])
        );

        setResult({
          predictions:   predMap,
          isLoading:     false,
          isEstimated:   false,
          lastUpdated:   new Date(),
          cityRiskScore: data.cityRiskScore ?? 0,
          criticalZones: data.criticalZones ?? [],
        });
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.warn("[useFloodPredictions] ML service unreachable:", err.message);
        setResult((prev) => ({
          ...prev,
          isLoading:   false,
          isEstimated: true,
        }));
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rainfallMm, riverLevel, soilMoisture, riverDischarge]);

  return result;
}
