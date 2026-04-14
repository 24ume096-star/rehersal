/**
 * LiveWeatherPanel — floating weather widget rendered on top of the Mapbox map.
 * Shows real-time Delhi weather from useWeatherFeed with rain animation,
 * temperature colour coding, 72h SVG sparkline, and live/estimated status badge.
 */
import type { WeatherData } from '../hooks/useWeatherFeed';

interface Props {
  weather: WeatherData;
}

/** Animated rain drops using inline <style> + CSS keyframes */
function RainDrops() {
  const drops = [
    { left: '12%', animDelay: '0s',    dur: '1.1s' },
    { left: '28%', animDelay: '0.3s',  dur: '0.9s' },
    { left: '44%', animDelay: '0.15s', dur: '1.2s' },
    { left: '60%', animDelay: '0.45s', dur: '0.85s' },
    { left: '76%', animDelay: '0.6s',  dur: '1.0s' },
    { left: '88%', animDelay: '0.2s',  dur: '1.3s' },
  ];
  return (
    <>
      <style>{`
        @keyframes rain-fall {
          0%   { transform: translateY(-8px); opacity: 0; }
          20%  { opacity: 0.7; }
          100% { transform: translateY(32px); opacity: 0; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 overflow-hidden rounded-t-xl">
        {drops.map((d, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: d.left,
              top: 0,
              width: 1.5,
              height: 8,
              borderRadius: 2,
              background: 'rgba(131,195,240,0.65)',
              animation: `rain-fall ${d.dur} ${d.animDelay} infinite linear`,
            }}
          />
        ))}
      </div>
    </>
  );
}

/** Inline SVG 3-bar sparkline for the 72-hour rainfall forecast */
function RainfallSparkline({ values }: { values: number[] }) {
  const svgW = 120;
  const svgH = 36;
  const barW = 22;
  const gap  = 14;
  const maxV = Math.max(...values, 1);
  const days = ['Today', 'D+1', 'D+2'];

  return (
    <svg width={svgW} height={svgH + 16} viewBox={`0 0 ${svgW} ${svgH + 16}`} aria-label="72h forecast">
      {values.slice(0, 3).map((v, i) => {
        const barH  = Math.max(3, (v / maxV) * svgH);
        const x     = i * (barW + gap);
        const y     = svgH - barH;
        const fill  = v > 10 ? '#378ADD' : v > 3 ? '#85B7EB' : 'rgba(255,255,255,0.25)';
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={fill} />
            <text x={x + barW / 2} y={svgH + 13} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.45)">
              {days[i]}
            </text>
            {v > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.65)">
                {v.toFixed(1)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function LiveWeatherPanel({ weather }: Props) {
  const {
    currentRainfall, temperature, soilMoisture,
    rainfall24h, rainfall72hForecast, riverDischarge,
    lastUpdated, isLoading, error,
  } = weather;

  const isRaining  = currentRainfall > 5;
  const minutesAgo = lastUpdated.getTime() > 0
    ? Math.floor((Date.now() - lastUpdated.getTime()) / 60_000)
    : null;
  const isFresh    = minutesAgo !== null && minutesAgo < 15;
  const isEstimated = !!error;

  // Temperature colour
  const tempColor = temperature < 35 ? '#2ECC71' : temperature < 40 ? '#F59E0B' : '#EF4444';

  // Normalise river discharge (0–15 000 m³/s → 0–100)
  const riverLevel = Math.round(Math.min(100, (riverDischarge / 15_000) * 100));

  return (
    <div className="relative w-80 overflow-hidden rounded-xl border border-white/10 bg-[#0d1f14]/90 backdrop-blur-md shadow-glass">
      {/* Rain animation overlay */}
      {isRaining && <RainDrops />}

      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/[0.07]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
          Delhi NCR · Live Weather
        </p>
        <div className="flex items-center gap-2">
          {isEstimated ? (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 ring-1 ring-amber-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Estimated
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-accent/30">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Live
            </span>
          )}
        </div>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-3 gap-px bg-white/[0.04] border-b border-white/[0.07]">
        {/* Rainfall */}
        <div className="flex flex-col items-center py-3 bg-[#0d1f14]/60">
          <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">
            {isRaining ? '🌧️ Rain/hr' : '🌤️ Rain/hr'}
          </p>
          <p className="text-xl font-bold text-[#85B7EB]">
            {currentRainfall.toFixed(1)}
          </p>
          <p className="text-[9px] text-white/35">mm</p>
        </div>

        {/* Temperature */}
        <div className="flex flex-col items-center py-3 bg-[#0d1f14]/60">
          <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">🌡️ Temp</p>
          <p className="text-xl font-bold" style={{ color: tempColor }}>
            {temperature.toFixed(1)}
          </p>
          <p className="text-[9px] text-white/35">°C</p>
        </div>

        {/* River level */}
        <div className="flex flex-col items-center py-3 bg-[#0d1f14]/60">
          <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">🌊 River</p>
          <p className="text-xl font-bold text-sky-400">{riverLevel}</p>
          <p className="text-[9px] text-white/35">% capacity</p>
        </div>
      </div>

      {/* Secondary row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07]">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/40">24h Rainfall</p>
          <p className="text-sm font-semibold text-white">{rainfall24h.toFixed(1)} mm</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/40">Soil Moisture</p>
          <p className="text-sm font-semibold text-white">{(soilMoisture * 100).toFixed(0)}%</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-widest text-white/40">River Q</p>
          <p className="text-sm font-semibold text-white">
            {riverDischarge < 1000
              ? `${riverDischarge.toFixed(0)}`
              : `${(riverDischarge / 1000).toFixed(1)}k`} m³/s
          </p>
        </div>
      </div>

      {/* 72h forecast sparkline */}
      <div className="px-4 py-3 border-b border-white/[0.07]">
        <p className="text-[9px] uppercase tracking-widest text-white/40 mb-2">72h Rainfall Forecast</p>
        <RainfallSparkline values={rainfall72hForecast} />
      </div>

      {/* Footer: last updated */}
      <div className="flex items-center gap-2 px-4 py-2">
        {isLoading && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40" />
        )}
        <p className="text-[10px] text-white/35">
          {minutesAgo === null
            ? 'Fetching...'
            : minutesAgo === 0
            ? 'Updated just now'
            : `Last updated: ${minutesAgo}m ago`}
          {!isFresh && minutesAgo !== null && minutesAgo >= 15 && ' · ⚠️ stale'}
        </p>
      </div>
    </div>
  );
}
