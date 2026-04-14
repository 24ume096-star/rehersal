/**
 * ScenarioControlPanel — 260px dark card overlaid on the map bottom-left.
 * Provides rainfall + river level sliders and 4 preset buttons.
 * Notifies parent via callbacks so the parent owns the map animation logic.
 */
interface Props {
  rainfall: number;
  riverLevel: number;
  activePreset: string | null;
  liveRainfall: number;
  liveRiverLevel: number;
  onRainfallChange: (v: number) => void;
  onRiverLevelChange: (v: number) => void;
  onPreset: (preset: string, rain: number, river: number, opts?: { heat?: boolean; mega?: boolean }) => void;
}

interface Preset {
  id: string;
  label: string;
  rain: number;
  river: number;
  heat?: boolean;
  mega?: boolean;
  color: string;
  activeColor: string;
}

function riverLabel(v: number) {
  if (v >= 85) return 'Critical';
  if (v >= 65) return 'High';
  if (v >= 40) return 'Moderate';
  if (v >= 20) return 'Low';
  return 'Very Low';
}

export function ScenarioControlPanel({
  rainfall, riverLevel, activePreset, liveRainfall, liveRiverLevel,
  onRainfallChange, onRiverLevelChange, onPreset,
}: Props) {
  const PRESETS: Preset[] = [
    {
      id: 'baseline', label: '📊 Baseline', rain: liveRainfall, river: liveRiverLevel,
      color: 'bg-white/5 ring-white/15 text-white/60',
      activeColor: 'bg-accent/20 ring-accent/40 text-accent',
    },
    {
      id: 'drought', label: '☀️ Drought', rain: 8, river: 15,
      color: 'bg-white/5 ring-white/15 text-white/60',
      activeColor: 'bg-amber-500/20 ring-amber-400/40 text-amber-300',
    },
    {
      id: 'heatwave', label: '🌡️ Heatwave', rain: 12, river: 20, heat: true,
      color: 'bg-white/5 ring-white/15 text-white/60',
      activeColor: 'bg-orange-500/20 ring-orange-400/40 text-orange-300',
    },
    {
      id: 'mega-flood', label: '🌊 Mega-Flood', rain: 210, river: 95, mega: true,
      color: 'bg-white/5 ring-white/15 text-white/60',
      activeColor: 'bg-red-500/25 ring-red-500/50 text-red-400',
    },
  ];

  return (
    <div
      className="w-[260px] rounded-xl border border-white/10 bg-[#0d1f14]/92 backdrop-blur-md shadow-glass overflow-hidden"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
    >
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.07]">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
          Scenario Controls
        </p>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Rainfall slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-white/70">🌧️ Rainfall</label>
            <span className="text-xs font-bold tabular-nums" style={{ color: rainfall > 80 ? '#E24B4A' : rainfall > 30 ? '#FAC775' : '#5DCAA5' }}>
              {Math.round(rainfall)} mm/hr
            </span>
          </div>
          <input
            type="range" min={0} max={250} step={1}
            value={rainfall}
            onChange={(e) => onRainfallChange(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #378ADD ${(rainfall / 250) * 100}%, rgba(255,255,255,0.08) ${(rainfall / 250) * 100}%)`,
              accentColor: '#378ADD',
            }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-white/25">0</span>
            <span className="text-[9px] text-white/25">250 mm</span>
          </div>
        </div>

        {/* River level slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-white/70">🌊 River Level</label>
            <span className="text-xs font-bold tabular-nums" style={{ color: riverLevel > 70 ? '#E24B4A' : riverLevel > 45 ? '#FAC775' : '#5DCAA5' }}>
              {Math.round(riverLevel)}% · {riverLabel(riverLevel)}
            </span>
          </div>
          <input
            type="range" min={0} max={100} step={1}
            value={riverLevel}
            onChange={(e) => onRiverLevelChange(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #85B7EB ${riverLevel}%, rgba(255,255,255,0.08) ${riverLevel}%)`,
              accentColor: '#85B7EB',
            }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-white/25">Very Low</span>
            <span className="text-[9px] text-white/25">Critical</span>
          </div>
        </div>

        {/* Preset buttons */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/35 mb-2">Presets</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => {
              const isActive = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onPreset(p.id, p.id === 'baseline' ? liveRainfall : p.rain, p.id === 'baseline' ? liveRiverLevel : p.river, { heat: p.heat, mega: p.mega })}
                  className={`rounded-lg px-1.5 py-2 text-[10px] font-semibold ring-1 transition-all duration-200 text-center leading-tight outline-none ${isActive ? p.activeColor : p.color}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
