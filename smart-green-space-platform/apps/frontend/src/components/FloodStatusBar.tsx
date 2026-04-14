/**
 * FloodStatusBar — full-width metric bar rendered above the 3D map.
 * 5 cards: City Risk · Critical Zones · Population at Risk · Rainfall · ML Confidence
 * Each card has an inline-SVG 7-day sparkline.
 */
import { useEffect, useRef, useState } from "react";
import type { ZonePrediction } from "../hooks/useFloodPredictions";

// ── Approximate 2025 population per flood zone ──────────────────────────────
const ZONE_POP: Record<string, number> = {
  "yamuna-north": 44_800,
  "civil-lines":  82_000,
  "shahdara":    181_000,
  "laxmi-nagar": 224_000,
  "mayur-vihar": 166_000,
  "okhla":        96_000,
  "ito-central":  38_000,
  "lodhi-zone":   57_000,
  "saket":        89_000,
  "rohini":      278_000,
  "dwarka":      312_000,
  "kalindi-kunj": 73_000,
};

// ── Animated count-up ────────────────────────────────────────────────────────
function useCountUp(target: number, ms = 1200) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(target);
  useEffect(() => {
    const start = prevRef.current;
    const t0   = Date.now();
    let raf: number;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / ms);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + (target - start) * ease));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return display;
}

// ── Tiny inline SVG sparkline ─────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-7 w-20 opacity-30 bg-white/5 rounded" />;
  const w = 80, h = 28;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
    </svg>
  );
}

// ── Mock 7-day sparkline history around a current value ───────────────────────
function mockHistory(current: number, days = 7): number[] {
  const seed = Math.abs(Math.round(current * 13.7)) % 100;
  const xs = Array.from({ length: days }, (_, i) => {
    const t = ((seed * (i + 1) * 7919) % 100) / 100;
    return Math.max(0, Math.min(100, current * 0.7 + t * current * 0.6 - current * 0.1));
  });
  xs.push(current);
  return xs;
}

// ── Individual metric card ────────────────────────────────────────────────────
interface CardProps {
  label: string;
  value: string | number;
  sub?: string;
  color: string;   // text colour
  sparkData: number[];
  sparkColor: string;
  isLoading?: boolean;
}

function MetricCard({ label, value, sub, color, sparkData, sparkColor, isLoading }: CardProps) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 min-w-0 px-4 py-3 border-r border-white/[0.07] last:border-r-0">
      <p className="text-[9px] uppercase tracking-[0.16em] text-white/40 truncate">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          {isLoading ? (
            <div className="h-7 w-12 animate-pulse rounded bg-white/10" />
          ) : (
            <p className="text-2xl font-black leading-none" style={{ color }}>{value}</p>
          )}
          {sub && <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>}
        </div>
        <Sparkline data={sparkData} color={sparkColor} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  cityRiskScore: number;
  criticalZones: string[];
  predictions: Map<string, ZonePrediction>;
  rainfall24h: number;
  rainfall72hForecast: number[];
  isLoading: boolean;
}

export function FloodStatusBar({
  cityRiskScore, criticalZones, predictions, rainfall24h, rainfall72hForecast, isLoading,
}: Props) {
  const animScore = useCountUp(cityRiskScore);

  const critCount = criticalZones.length;

  const popAtRisk = Array.from(predictions.entries())
    .filter(([, p]) => p.riskScore >= 60)
    .reduce((sum, [id]) => sum + (ZONE_POP[id] ?? 0), 0);

  const avgConf =
    predictions.size > 0
      ? Array.from(predictions.values()).reduce((s, p) => s + p.confidence, 0) / predictions.size
      : 0;

  const rainfallTrend =
    rainfall24h > (rainfall72hForecast[0] ?? 0) * 1.1 ? "▲" :
    rainfall24h < (rainfall72hForecast[0] ?? 0) * 0.9 ? "▼" : "—";

  // Dynamic gradient bar wash based on city risk
  const riskBg =
    cityRiskScore >= 70 ? "rgba(127,29,29,0.75)" :
    cityRiskScore >= 40 ? "rgba(120,53,15,0.72)" :
                          "rgba(5,46,35,0.70)";
  const riskAccent =
    cityRiskScore >= 70 ? "#EF4444" :
    cityRiskScore >= 40 ? "#F59E0B" :
                          "#10B981";

  const scoreColor =
    animScore >= 70 ? "#F87171" :
    animScore >= 40 ? "#FCD34D" :
                      "#34D399";

  return (
    <div
      className="flex w-full overflow-hidden rounded-xl border border-white/10 backdrop-blur-md"
      style={{
        background: `linear-gradient(to right, ${riskBg}, rgba(13,31,20,0.88))`,
        borderColor: `${riskAccent}30`,
        boxShadow: `0 0 20px ${riskAccent}18`,
      }}
    >
      <MetricCard
        label="City Risk Score"
        value={animScore}
        sub={cityRiskScore >= 70 ? "Critical" : cityRiskScore >= 40 ? "Elevated" : "Normal"}
        color={scoreColor}
        sparkData={mockHistory(cityRiskScore)}
        sparkColor={riskAccent}
        isLoading={isLoading && !cityRiskScore}
      />
      <MetricCard
        label="Critical Zones"
        value={critCount}
        sub={critCount > 0 ? `${critCount} zone${critCount > 1 ? "s" : ""} above 80` : "All clear"}
        color={critCount > 0 ? "#F87171" : "#34D399"}
        sparkData={mockHistory(critCount * 10)}
        sparkColor={critCount > 0 ? "#EF4444" : "#10B981"}
        isLoading={false}
      />
      <MetricCard
        label="Population at Risk"
        value={popAtRisk > 0 ? `${(popAtRisk / 1000).toFixed(0)}k` : "0"}
        sub="residents in ≥60 risk zones"
        color={popAtRisk > 200_000 ? "#F87171" : popAtRisk > 50_000 ? "#FCD34D" : "#34D399"}
        sparkData={mockHistory(Math.min(100, popAtRisk / 5000))}
        sparkColor={popAtRisk > 200_000 ? "#EF4444" : "#F59E0B"}
        isLoading={false}
      />
      <MetricCard
        label="Rainfall – Live"
        value={`${rainfall24h.toFixed(1)} mm`}
        sub={`${rainfallTrend} vs forecast`}
        color={rainfall24h > 100 ? "#F87171" : rainfall24h > 30 ? "#FCD34D" : "#93C5FD"}
        sparkData={rainfall72hForecast.length ? [rainfall24h, ...rainfall72hForecast].slice(0, 8) : mockHistory(rainfall24h)}
        sparkColor="#93C5FD"
        isLoading={!rainfall24h && isLoading}
      />
      <MetricCard
        label="Model Confidence"
        value={`${(avgConf * 100).toFixed(0)}%`}
        sub={avgConf < 0.6 ? "Below threshold" : avgConf < 0.75 ? "Moderate" : "High"}
        color={avgConf < 0.6 ? "#FBBF24" : avgConf < 0.75 ? "#FCD34D" : "#34D399"}
        sparkData={mockHistory(avgConf * 100)}
        sparkColor={avgConf < 0.6 ? "#F59E0B" : "#10B981"}
        isLoading={isLoading && !avgConf}
      />
    </div>
  );
}
