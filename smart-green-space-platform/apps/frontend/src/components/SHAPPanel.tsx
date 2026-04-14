/**
 * SHAPPanel — slide-in right drawer showing SHAP waterfall chart,
 * risk grade, confidence arc, and human-readable explanations
 * for a clicked flood zone.
 */
import type { ZonePrediction } from "../hooks/useFloodPredictions";

interface Props {
  open: boolean;
  onClose: () => void;
  zoneName: string;
  prediction: ZonePrediction | null;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "#1D9E7530", text: "#5DCAA5", border: "#1D9E7560" },
  B: { bg: "#2ECC7130", text: "#5DCAA5", border: "#2ECC7160" },
  C: { bg: "#F59E0B30", text: "#FAC775", border: "#F59E0B60" },
  D: { bg: "#EF444430", text: "#FCA5A5", border: "#EF444460" },
  E: { bg: "#B91C1C30", text: "#FCA5A5", border: "#B91C1C60" },
};

const FEATURE_LABELS: Record<string, string> = {
  ndvi:                    "Vegetation (NDVI)",
  elevation_m:             "Elevation",
  rainfall_24h_mm:         "Rainfall 24h",
  soil_moisture:           "Soil Moisture",
  river_discharge_m3s:     "River Discharge",
  distance_to_yamuna_km:   "Yamuna Distance",
  drainage_capacity_score: "Drainage Capacity",
  green_cover_pct:         "Green Cover",
};

// ── SHAP Waterfall Chart (inline SVG) ─────────────────────────────────────────
function WaterfallChart({ topFactors }: { topFactors: ZonePrediction["topFactors"] }) {
  if (!topFactors || topFactors.length === 0) return null;

  const svgW       = 320;
  const labelW     = 118;
  const chartW     = svgW - labelW - 8;
  const barH       = 22;
  const rowH       = 34;
  const svgH       = topFactors.length * rowH + 20;
  const baseline   = labelW + chartW / 2;  // center x for the baseline

  const maxAbs = Math.max(...topFactors.map((f) => Math.abs(f.contribution)), 0.001);
  const scale  = (chartW / 2 - 8) / maxAbs;  // px per unit

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} aria-label="SHAP waterfall">
      {/* Baseline */}
      <line
        x1={baseline} y1={0} x2={baseline} y2={svgH - 8}
        stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 3"
      />

      {topFactors.map((f, i) => {
        const barW  = Math.abs(f.contribution) * scale;
        const isPos = f.contribution > 0;
        const barX  = isPos ? baseline : baseline - barW;
        const barY  = i * rowH + 4;
        const fill  = isPos ? "#E24B4A" : "#1D9E75";
        const label = FEATURE_LABELS[f.factor] ?? f.factor;
        const valTxt = (f.contribution >= 0 ? "+" : "") + f.contribution.toFixed(3);
        const valX  = isPos ? baseline + barW + 4 : baseline - barW - 4;
        const valAnchor = isPos ? "start" : "end";

        return (
          <g key={f.factor}>
            {/* Feature label */}
            <text
              x={labelW - 6} y={barY + barH / 2 + 4}
              textAnchor="end" fontSize={10}
              fill={`rgba(255,255,255,${i === 0 ? 0.85 : 0.6})`}
              fontWeight={i === 0 ? 600 : 400}
            >
              {label}
            </text>

            {/* Bar */}
            <rect
              x={barX} y={barY} width={Math.max(barW, 2)} height={barH}
              rx={3} fill={fill} fillOpacity={0.82}
            />

            {/* Value label */}
            <text
              x={valX} y={barY + barH / 2 + 4}
              textAnchor={valAnchor} fontSize={9} fontWeight={600}
              fill={fill}
            >
              {valTxt}
            </text>
          </g>
        );
      })}

      {/* "Increases risk" / "Reduces risk" legend */}
      <text x={baseline + 6} y={svgH - 2} fontSize={8} fill="rgba(226,75,74,0.7)">▶ increases risk</text>
      <text x={baseline - 6} y={svgH - 2} fontSize={8} fill="rgba(29,158,117,0.7)" textAnchor="end">reduces risk ◀</text>
    </svg>
  );
}

// ── Confidence arc ─────────────────────────────────────────────────────────────
function ConfidenceArc({ confidence }: { confidence: number }) {
  const r = 26, cx = 34, cy = 32;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startAngle = -180;
  const span = confidence * 180;
  const endAngle = startAngle + span;

  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const xEnd = cx + r * Math.cos(toRad(0));
  const yEnd = cy + r * Math.sin(toRad(0));
  const largeArc = confidence > 0.5 ? 1 : 0;
  const color = confidence >= 0.75 ? "#5DCAA5" : confidence >= 0.5 ? "#F59E0B" : "#EF4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="68" height="40" viewBox="0 0 68 40" aria-label="confidence gauge">
        <path
          d={`M ${x1} ${y1} A ${r} ${r} 0 1 1 ${xEnd} ${yEnd}`}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" strokeLinecap="round"
        />
        {confidence > 0.01 && (
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
          {Math.round(confidence * 100)}%
        </text>
      </svg>
      <span className="text-[9px] uppercase tracking-widest text-white/40">Confidence</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SHAPPanel({ open, onClose, zoneName, prediction }: Props) {
  const grade = prediction?.riskGrade ?? "—";
  const gradeStyle = GRADE_COLORS[grade] ?? GRADE_COLORS["C"];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="absolute inset-0 z-20 bg-black/30 backdrop-blur-[1px]"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <div
        className={`absolute bottom-0 right-0 top-0 z-30 flex flex-col w-[340px] border-l border-white/10 bg-[#0a1a0f]/95 shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-label="SHAP explanation drawer"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/10 shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1">
              ML Flood Risk Analysis
            </p>
            <h2 className="text-base font-bold text-white leading-tight">{zoneName || "Zone"}</h2>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin scrollbar-thumb-white/10">
          {!prediction ? (
            <div className="flex h-full items-center justify-center text-sm text-white/30">
              Click a flood zone on the map
            </div>
          ) : (
            <>
              {/* Risk score + grade + confidence */}
              <div className="flex items-center justify-between rounded-xl border bg-black/30 px-4 py-3"
                style={{ borderColor: gradeStyle.border, background: gradeStyle.bg }}>
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: gradeStyle.text }}>
                    Risk Score
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white">
                      {prediction.riskScore.toFixed(1)}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: gradeStyle.border, color: gradeStyle.text }}
                    >
                      Grade {grade}
                    </span>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: gradeStyle.text }}>
                    Flood probability: {(prediction.floodProbability * 100).toFixed(1)}%
                  </p>
                </div>
                <ConfidenceArc confidence={prediction.confidence} />
              </div>

              {/* SHAP Waterfall */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">
                  Feature Contributions (SHAP)
                </p>
                <div className="rounded-lg bg-black/30 p-3 overflow-x-auto">
                  <WaterfallChart topFactors={prediction.topFactors} />
                </div>
              </div>

              {/* Human-readable bullets */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                  Plain-English Drivers
                </p>
                <ul className="space-y-2">
                  {prediction.topFactors.map((f) => (
                    <li key={f.factor} className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 shrink-0 text-sm"
                        style={{ color: f.direction === "increases_risk" ? "#E24B4A" : "#1D9E75" }}
                      >
                        {f.direction === "increases_risk" ? "▲" : "▼"}
                      </span>
                      <p className="text-xs text-white/70 leading-relaxed">{f.humanReadable}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 shrink-0">
          <p className="text-[9px] text-white/30 text-center">
            Powered by Random Forest · Delhi Flood ML v1 · SHAP TreeExplainer
          </p>
        </div>
      </div>
    </>
  );
}
