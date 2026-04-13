import { useEffect, useState } from "react";
import { Waves, AlertTriangle, Clock, Map, CheckCircle, Navigation, ShieldAlert, Cpu } from "lucide-react";
import { MapContainer, TileLayer, GeoJSON, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

type FloodRiskData = {
  riskScore: number;
  riskLevel: "LOW" | "WATCH" | "WARNING" | "EMERGENCY";
  timeToOverflowMin: number | null;
  affectedZones: string[];
  recommendedActions: string[];
};

export function FloodMonitoringPanel({ city }: { city: string }) {
  const [parkId, setParkId] = useState<string>("");
  const [parks, setParks] = useState<{ id: string; name: string }[]>([]);
  const [riskData, setRiskData] = useState<FloodRiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [geojsonData, setGeojsonData] = useState<any>(null);

  // Fetch parks for city
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/parks?cityId=${city}`);
        const data = await res.json();
        if (!mounted) return;
        if (data.data && data.data.length > 0) {
          setParks(data.data);
        }
        // Always default to test_park for our demo pipeline so the UI never hangs loading risks.
        setParkId("test_park");
      } catch (err) {
        console.error("Failed to fetch parks", err);
      }
    })();
    return () => { mounted = false; };
  }, [city]);

  // Fetch flood risk for park
  useEffect(() => {
    if (!parkId) return;
    let mounted = true;
    
    const fetchRisk = async () => {
      setLoading(true);
      try {
        // Fetch Realtime Service Numbers
        // Fallback for demo safety to catch empty backend instances
        const res = await fetch(`${API_BASE}/api/v1/flood/${parkId}/risk`).catch(() => null);
        if (res && res.ok && mounted) {
           const data = await res.json();
           setRiskData(data);
        }

        // Fetch ML Geotiff Heatmap Data (Python Output)
        const geoRes = await fetch(`${API_BASE}/public/heatmaps/${parkId}_heatmap.geojson`).catch(() => null);
        if (geoRes && geoRes.ok && mounted) {
           const gdata = await geoRes.json();
           setGeojsonData(gdata);
        }
      } catch (err) {
        console.error("Failed to fetch risk", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRisk();
    const interval = setInterval(fetchRisk, 30000); // 30s live updates
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [parkId]);

  const triggerResponse = async () => {
    if (!parkId || !riskData) return;
    if (riskData.riskLevel === "LOW") {
        alert("Cannot trigger workflow for LOW risk.");
        return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/flood/${parkId}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskLevel: riskData.riskLevel })
      });
      const data = await res.json();
      alert(data.message || "Trigger response initiated.");
    } catch (err) {
        console.error("Failed to trigger", err);
        alert("Failed to trigger response workflow.");
    }
  };

  const getRiskColor = (level?: string) => {
    if (level === "EMERGENCY") return "text-red-400 bg-red-400/10 border-red-400/30";
    if (level === "WARNING") return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    if (level === "WATCH") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    return "text-accent bg-accent/10 border-accent/30";
  };

  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties) {
       layer.bindPopup(`
          <div class="p-2">
            <strong class="text-sm border-b pb-1 text-black font-semibold mb-2 block">Zone Analysis</strong>
            <div class="text-xs text-black/80 space-y-1">
              <p>Risk Score: ${(feature.properties.riskScore * 100).toFixed(1)}%</p>
              <p>Risk Level: ${feature.properties.level}</p>
              <p>NDVI Ratio: ${feature.properties.ndvi}</p>
              <p>Live Rainfall: ${feature.properties.rainfall ?? 0} mm/hr</p>
              <p>Live Humidity: ${feature.properties.humidity ?? 0}%</p>
              <p>Elevation Map: ${feature.properties.elevation ?? 0} m</p>
              <p>Saturated Load (72h): ${feature.properties.saturatedLoad ?? 0} mm</p>
            </div>
          </div>
       `);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Flood Monitoring
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Real-time hydrological oversight and automated drainage orchestration
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={parkId}
            onChange={(e) => setParkId(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 py-2 pl-3 pr-8 text-sm font-medium text-white shadow-sm outline-none transition-all hover:bg-white/10 focus:ring-2 focus:ring-accent/50"
          >
            <option value="test_park" className="bg-forest">Lodhi Garden (Live NASA Feed)</option>
            {parks.map((p) => (
              <option key={p.id} value={p.id} className="bg-forest">
                {p.name}
              </option>
            ))}
          </select>
          <button 
           onClick={triggerResponse}
           disabled={!riskData || riskData.riskLevel === "LOW"}
           className="flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 outline-none transition-all hover:bg-red-500/30 ring-1 ring-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed">
            <ShieldAlert className="h-4 w-4" />
            Trigger Workflow
          </button>
        </div>
      </header>

      {loading && !riskData && !geojsonData ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3 text-white/40">
            <Cpu className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-medium">Calculating hydrological models...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-glass">
              <div className="mb-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg border ${getRiskColor(riskData?.riskLevel)}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/60">Risk Status</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Current Level</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight text-white">
                  {riskData?.riskLevel || "LOW"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-glass">
              <div className="mb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg border border-accent/20 bg-accent/10 text-accent">
                  <Waves className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/60">Calculated Score</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Index (0-100)</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight text-white">
                  {riskData?.riskScore || 0}
                </span>
                <span className="text-sm font-medium text-white/40">/ 100</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-glass">
              <div className="mb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg border border-blue-400/20 bg-blue-400/10 text-blue-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/60">Time to Overflow</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Est. Arrival</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight text-white">
                  {(riskData?.timeToOverflowMin === null || riskData?.timeToOverflowMin === Infinity || !riskData) 
                    ? "Safe" 
                    : riskData?.timeToOverflowMin?.toFixed(0)}
                </span>
                {riskData?.timeToOverflowMin && riskData?.timeToOverflowMin !== Infinity && (
                  <span className="text-sm font-medium text-white/40">mins</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-glass">
              <div className="mb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/70">
                  <Map className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/60">Affected Zones</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Drainage Sectors</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight text-white">
                  {riskData?.affectedZones?.length || 0}
                </span>
                <span className="text-sm font-medium text-white/40">sectors</span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* GIS Heatmap Leaflet Section */}
            <div className="lg:col-span-2 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-glass overflow-hidden h-[500px] flex flex-col">
              <div className="p-4 border-b border-white/10 bg-white/[0.02]">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Map className="h-4 w-4 text-accent" />
                  NDVI & Flood Risk Projections Map
                </h3>
              </div>
              <div className="flex-1 bg-gray-900 z-0">
                  <MapContainer center={[28.60, 77.10]} zoom={11} style={{ height: "100%", width: "100%" }}>
                      <LayersControl position="topright">
                        <LayersControl.BaseLayer checked name="Dark Matter (Voyager)">
                            <TileLayer
                              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            />
                        </LayersControl.BaseLayer>
                        
                        <LayersControl.Overlay checked name="Risk Heatmap (ML Model)">
                            {geojsonData && (
                                <GeoJSON 
                                    key={"geojson-heatmap-" + geojsonData?.features?.length}
                                    data={geojsonData} 
                                    style={(feature) => ({
                                        fillColor: feature?.properties?.fillColor || "#ffffff",
                                        weight: 1,
                                        opacity: 0,
                                        color: 'white',
                                        dashArray: '3',
                                        fillOpacity: feature?.properties?.fillOpacity || 0.4
                                    })}
                                    onEachFeature={onEachFeature}
                                />
                            )}
                        </LayersControl.Overlay>
                      </LayersControl>
                  </MapContainer>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 shadow-glass h-[500px] flex flex-col">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-accent" />
                    Recommended Protocol
                </h3>
                {riskData?.recommendedActions && riskData.recommendedActions.length > 0 ? (
                    <ul className="space-y-4 pt-2 overflow-y-auto">
                    {riskData.recommendedActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/5">
                            <div className="mt-0.5 rounded-full bg-accent/20 p-1 text-accent ring-1 ring-accent/30">
                                <CheckCircle className="h-4 w-4" />
                            </div>
                            <p className="text-sm font-medium text-white/80 leading-relaxed">{action}</p>
                        </li>
                    ))}
                    </ul>
                ) : (
                    <div className="flex flex-1 items-center justify-center text-sm text-white/40 border border-dashed border-white/10 rounded-lg">
                        System nominal. No actions required.
                    </div>
                )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
