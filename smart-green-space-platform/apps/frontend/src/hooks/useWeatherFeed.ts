/**
 * useWeatherFeed — fetches live Delhi weather from Open-Meteo (no API key needed).
 * Polls every 10 minutes. Falls back to last localStorage-cached values on error.
 */
import { useEffect, useRef, useState } from 'react';

const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=28.6139&longitude=77.2090' +
  '&current=precipitation,temperature_2m,soil_moisture_0_to_1cm,river_discharge' +
  '&hourly=precipitation' +
  '&daily=precipitation_sum' +
  '&timezone=Asia%2FKolkata' +
  '&forecast_days=3';

const CACHE_KEY = 'sgs_weather_v1';
const POLL_MS   = 10 * 60 * 1000; // 10 minutes

export interface WeatherData {
  currentRainfall:    number;        // mm in last hour
  temperature:        number;        // °C
  soilMoisture:       number;        // 0–1
  rainfall24h:        number;        // total mm: sum of last 24 hourly readings
  rainfall72hForecast: number[];     // 3-element array of daily totals
  riverDischarge:     number;        // m³/s
  lastUpdated:        Date;
  isLoading:          boolean;
  error:              string | null;
}

interface CacheShape {
  currentRainfall:    number;
  temperature:        number;
  soilMoisture:       number;
  rainfall24h:        number;
  rainfall72hForecast: number[];
  riverDischarge:     number;
  lastUpdated:        string; // ISO
}

/** Read last-good data from localStorage, or null. */
function readCache(): (CacheShape & { lastUpdated: string }) | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape & { lastUpdated: string };
  } catch {
    return null;
  }
}

function writeCache(data: CacheShape) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

function cacheToWeather(c: CacheShape, err: string | null): WeatherData {
  return {
    currentRainfall:    c.currentRainfall,
    temperature:        c.temperature,
    soilMoisture:       c.soilMoisture,
    rainfall24h:        c.rainfall24h,
    rainfall72hForecast: c.rainfall72hForecast,
    riverDischarge:     c.riverDischarge,
    lastUpdated:        new Date(c.lastUpdated),
    isLoading:          false,
    error:              err,
  };
}

/** Derive the blank fallback state used before any fetch completes. */
const BLANK: WeatherData = {
  currentRainfall:    0,
  temperature:        34,
  soilMoisture:       0.2,
  rainfall24h:        0,
  rainfall72hForecast: [0, 0, 0],
  riverDischarge:     800,
  lastUpdated:        new Date(0),
  isLoading:          true,
  error:              null,
};

export function useWeatherFeed(): WeatherData {
  const [data, setData] = useState<WeatherData>(() => {
    // Hydrate from cache on first render so numbers are visible immediately
    const cached = readCache();
    return cached ? cacheToWeather(cached, null) : BLANK;
  });

  const abortRef = useRef<AbortController | null>(null);

  async function fetchWeather() {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      setData((prev) => ({ ...prev, isLoading: true }));

      const res = await fetch(OPEN_METEO_URL, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // --- Parse fields ---
      const cur = json.current ?? {};
      const hourlyPrecip: number[] = json.hourly?.precipitation ?? [];
      const dailySum: number[]     = json.daily?.precipitation_sum ?? [0, 0, 0];

      // Last 24 hourly readings (may be <24 at start of day)
      const last24 = hourlyPrecip.slice(-24);
      const rainfall24h = last24.reduce((a: number, b: number) => a + (b ?? 0), 0);

      const parsed: CacheShape = {
        currentRainfall:    cur.precipitation        ?? 0,
        temperature:        cur.temperature_2m       ?? 34,
        soilMoisture:       cur.soil_moisture_0_to_1cm ?? 0.2,
        rainfall24h:        Math.round(rainfall24h * 10) / 10,
        rainfall72hForecast: dailySum.slice(0, 3).map((v: number) => v ?? 0),
        riverDischarge:     cur.river_discharge      ?? 800,
        lastUpdated:        new Date().toISOString(),
      };

      writeCache(parsed);

      setData({
        ...parsed,
        lastUpdated: new Date(parsed.lastUpdated),
        isLoading:   false,
        error:       null,
      });

    } catch (err: any) {
      if (err.name === 'AbortError') return; // intentionally cancelled

      // Fall back to cache with error flag
      const cached = readCache();
      setData(
        cached
          ? cacheToWeather(cached, 'Open-Meteo unreachable — showing estimated values')
          : { ...BLANK, isLoading: false, error: err.message ?? 'Fetch failed' }
      );
    }
  }

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, POLL_MS);
    return () => {
      abortRef.current?.abort();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return data;
}
