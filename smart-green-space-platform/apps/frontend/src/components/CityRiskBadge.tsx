/**
 * CityRiskBadge — floating top-centre overlay showing a live-computed
 * weighted city flood risk score that updates as scenario sliders move.
 */
interface Props {
  rainfall: number;
  riverLevel: number;
  isMegaFlood: boolean;
}

// 12-zone base risk scores (from the Delhi flood zone dataset)
const ZONE_BASE_RISKS = [88, 82, 85, 78, 91, 76, 62, 58, 73, 67, 22, 18];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function computeCityRisk(rainfall: number, riverLevel: number): number {
  const adjusted = ZONE_BASE_RISKS.map((base) =>
    clamp(base + (rainfall - 65) * 0.18 + (riverLevel - 30) * 0.22, 0, 100)
  );
  return Math.round(adjusted.reduce((a, b) => a + b, 0) / adjusted.length);
}

function riskLabel(score: number) {
  if (score >= 80) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 45) return 'MODERATE';
  return 'LOW';
}

function riskColors(score: number): { bg: string; border: string; text: string; glow: string } {
  if (score >= 80) return { bg: '#E24B4A22', border: '#E24B4A55', text: '#FF7B7A', glow: '#E24B4A' };
  if (score >= 65) return { bg: '#EF9F2722', border: '#EF9F2755', text: '#FAC775', glow: '#EF9F27' };
  if (score >= 45) return { bg: '#FAC77522', border: '#FAC77555', text: '#FDE68A', glow: '#FAC775' };
  return         { bg: '#1D9E7522', border: '#1D9E7555', text: '#5DCAA5', glow: '#1D9E75' };
}

export function CityRiskBadge({ rainfall, riverLevel, isMegaFlood }: Props) {
  const score = isMegaFlood ? 89 : computeCityRisk(rainfall, riverLevel);
  const label = riskLabel(score);
  const colors = riskColors(score);

  return (
    <div
      className="absolute left-1/2 top-6 z-20 -translate-x-1/2"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="flex items-center gap-2.5 rounded-full px-4 py-2 backdrop-blur-md"
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          boxShadow: `0 0 18px ${colors.glow}40`,
        }}
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: colors.glow }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ background: colors.glow }}
          />
        </span>

        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: colors.text }}>
          City Flood Risk
        </span>

        <span className="font-bold text-white text-base leading-none">{score}</span>

        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
          style={{ background: colors.border, color: colors.text }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
