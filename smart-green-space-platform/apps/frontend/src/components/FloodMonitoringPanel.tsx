import { useEffect, useRef, useState } from "react";
import { Waves, AlertTriangle, Clock, Map, CheckCircle, Navigation, ShieldAlert, Cpu, Layers } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { useMapbox } from "../hooks/useMapbox";
import { useWeatherFeed } from "../hooks/useWeatherFeed";
import { PARK_POLYGONS, PARK_POINTS } from "../data/parkData";
import { LiveWeatherPanel } from "./LiveWeatherPanel";
import { ScenarioControlPanel } from "./ScenarioControlPanel";
import { CityRiskBadge } from "./CityRiskBadge";
import { SHAPPanel } from "./SHAPPanel";
import { FloodStatusBar } from "./FloodStatusBar";
import { AlertToastPanel } from "./AlertToastPanel";
import { useFloodPredictions } from "../hooks/useFloodPredictions";
import { FLOOD_ZONES_GEOJSON, FLOOD_ZONES } from "../data/floodZones";
import { useAlertEngine } from "../hooks/useAlertEngine";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:3000";

// ─── Yamuna River Centreline (WGS84) ─────────────────────────────────────────
const YAMUNA_COORDS: [number, number][] = [
  [77.235, 28.735], [77.238, 28.720], [77.245, 28.700],
  [77.248, 28.682], [77.258, 28.660], [77.270, 28.645],
  [77.280, 28.628], [77.290, 28.610], [77.292, 28.590],
  [77.291, 28.570], [77.286, 28.550], [77.280, 28.528],
];

/**
 * Build a simple buffer polygon around the Yamuna centreline.
 * @param offsetFactor Multiplier for expansion (1.0 = base ~1200m)
 */
function buildYamunaBuffer(offsetFactor: number = 1.0): [number, number][] {
  const LNG_OFF = 0.01233 * offsetFactor;
  const LAT_OFF = 0.01081 * offsetFactor;

  const right: [number, number][] = YAMUNA_COORDS.map(([lng, lat]) => [lng + LNG_OFF, lat - LAT_OFF]);
  const left: [number, number][]  = [...YAMUNA_COORDS].reverse().map(([lng, lat]) => [lng - LNG_OFF, lat + LAT_OFF]);

  return [...right, ...left, right[0]]; // close the ring
}

const BASE_YAMUNA_BUFFER_COORDS = buildYamunaBuffer(1.0);

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
  const [shapPanelOpen,  setShapPanelOpen]  = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [soundEnabled,   setSoundEnabled]   = useState(false);
  const [ndviVisible, setNdviVisible] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { mapRef, mapLoaded } = useMapbox(mapContainerRef);

  // ── Live weather feed (Open-Meteo, 10-min poll) ───────────────────────────
  const weather = useWeatherFeed();
  const rainfallMm  = weather.rainfall24h;
  const riverLevel  = Math.min(100, (weather.riverDischarge / 15_000) * 100);

  // ── Scenario state (sliders + presets) ────────────────────────────────────
  const [scenarioRain,  setScenarioRain]  = useState(rainfallMm);
  const [scenarioRiver, setScenarioRiver] = useState(riverLevel);
  const [activePreset,  setActivePreset]  = useState<string | null>('baseline');
  const [isMegaFlood,   setIsMegaFlood]   = useState(false);
  const [heatOverlay,   setHeatOverlay]   = useState(false);
  // heatOverlay is used below to render the orange tint layer

  // Initialise sliders from live values once weather loads
  const liveInitialised = useRef(false);
  useEffect(() => {
    if (!liveInitialised.current && !weather.isLoading && weather.lastUpdated.getTime() > 0) {
      setScenarioRain(rainfallMm);
      setScenarioRiver(riverLevel);
      liveInitialised.current = true;
    }
  }, [weather.isLoading, rainfallMm, riverLevel, weather.lastUpdated]);

  // Ref that the breathing RAF reads to skip setting opacity during mega-flood
  const megaFloodActiveRef = useRef(false);
  // Ref tracking previous scenario values for the 800ms lerp
  const prevScenarioRef = useRef({ rain: rainfallMm, river: riverLevel });
  // RAF handle for the scenario transition animation
  const scenarioRafRef  = useRef<number | null>(null);
  const zoneShimmerRef  = useRef<number | null>(null);

  // ── ML batch predictions (debounced 600ms, re-runs when scenario sliders move) ─────
  const mlPredictions = useFloodPredictions(
    scenarioRain, scenarioRiver, weather.soilMoisture, weather.riverDischarge
  );

  // ── Alert engine (60s checks + localStorage persistence) ──────────────────────
  const alertSystem = useAlertEngine(
    mlPredictions.predictions, weather.rainfall24h, soundEnabled
  );

  // Fly to zone (used by Alert "View on Map" button)
  const flyToZone = (zoneId: string) => {
    const zone = FLOOD_ZONES.find(z => z.id === zoneId);
    if (!zone || !mapRef.current) return;
    (mapRef.current as any).flyTo({
      center: zone.center, zoom: 14, pitch: 52, bearing: -12, duration: 1500,
    });
  };

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
        const res = await fetch(`${API_BASE}/api/v1/flood/${parkId}/risk`).catch(() => null);
        if (res && res.ok && mounted) {
           const data = await res.json();
           setRiskData(data);
        }

        // (GeoJSON heatmap replaced by live ML predictions via useFloodPredictions)

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

  // ── Yamuna River Layers ────────────────────────────────────────────────────
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current as any;

    // --- Sources ---
    if (!map.getSource('yamuna-line')) {
      map.addSource('yamuna-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: YAMUNA_COORDS },
          properties: {},
        },
      });
    }

    if (!map.getSource('yamuna-buffer')) {
      map.addSource('yamuna-buffer', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [BASE_YAMUNA_BUFFER_COORDS] },
          properties: {},
        },
      });
    }

    // --- Layer 1: Floodplain fill (animated opacity) ---
    if (!map.getLayer('yamuna-floodplain-fill')) {
      map.addLayer({
        id: 'yamuna-floodplain-fill',
        type: 'fill',
        source: 'yamuna-buffer',
        paint: {
          'fill-color': '#378ADD',
          'fill-opacity': 0.12,
        },
      });
    }

    // --- Layer 2: Floodplain dashed outline ---
    if (!map.getLayer('yamuna-floodplain-outline')) {
      map.addLayer({
        id: 'yamuna-floodplain-outline',
        type: 'line',
        source: 'yamuna-buffer',
        paint: {
          'line-color': '#378ADD',
          'line-opacity': 0.35,
          'line-width': 1.5,
          'line-dasharray': [4, 3],
        },
      });
    }

    // --- Layer 3: Main river line (18px, #378ADD) ---
    if (!map.getLayer('yamuna-river')) {
      map.addLayer({
        id: 'yamuna-river',
        type: 'line',
        source: 'yamuna-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#378ADD',
          'line-width': 18,
          'line-opacity': 0.75,
        },
      });
    }

    // --- Layer 4: Glow overlay (8px, #85B7EB) ---
    if (!map.getLayer('yamuna-river-glow')) {
      map.addLayer({
        id: 'yamuna-river-glow',
        type: 'line',
        source: 'yamuna-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#85B7EB',
          'line-width': 8,
          'line-opacity': 0.5,
        },
      });
    }

    // --- Layer 5: "Yamuna River" text label along centreline ---
    if (!map.getLayer('yamuna-label')) {
      map.addLayer({
        id: 'yamuna-label',
        type: 'symbol',
        source: 'yamuna-line',
        layout: {
          'symbol-placement': 'line',
          'text-field': 'Yamuna River',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 13,
          'text-offset': [0, -1.2],
          'text-letter-spacing': 0.08,
        },
        paint: {
          'text-color': '#85B7EB',
          'text-halo-color': '#091410',
          'text-halo-width': 1.5,
        },
      });
    }

    // --- Animated floodplain opacity (0.08 → 0.22, 3-second loop) ---
    const PERIOD_MS = 3000;
    let startTs: number | null = null;

    function animate(ts: number) {
      if (!startTs) startTs = ts;
      const elapsed = (ts - startTs) % PERIOD_MS;
      // Skip breathing when mega-flood is overriding opacity
      if (!megaFloodActiveRef.current) {
        const t = (Math.sin((elapsed / PERIOD_MS) * 2 * Math.PI - Math.PI / 2) + 1) / 2;
        const opacity = 0.08 + t * (0.22 - 0.08);
        try {
          map.setPaintProperty('yamuna-floodplain-fill', 'fill-opacity', opacity);
        } catch (_) { /* map may have been removed */ }
      }
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      // Clean up layers and sources to avoid duplicate-source errors on hot reload
      const layers = [
        'yamuna-label', 'yamuna-river-glow', 'yamuna-river',
        'yamuna-floodplain-outline', 'yamuna-floodplain-fill',
      ];
      layers.forEach((id) => { try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {} });
      ['yamuna-line', 'yamuna-buffer'].forEach((id) => {
        try { if (map.getSource(id)) map.removeSource(id); } catch (_) {}
      });
    };
  }, [mapLoaded, mapRef]);

  // ── Park resilience polygons + NDVI heatmap ───────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current as any;

    // --- Park polygon source ---
    if (!map.getSource('park-polygons')) {
      map.addSource('park-polygons', { type: 'geojson', data: PARK_POLYGONS });

      map.addLayer({
        id: 'park-fill',
        type: 'fill',
        source: 'park-polygons',
        paint: {
          'fill-color': '#1D9E75',
          'fill-opacity': 0.35,
        },
      });

      map.addLayer({
        id: 'park-outline',
        type: 'line',
        source: 'park-polygons',
        paint: {
          'line-color': '#5DCAA5',
          'line-width': 1.5,
          'line-opacity': 0.9,
        },
      });
    }

    // --- NDVI heatmap source (weighted point cloud) ---
    if (!map.getSource('park-ndvi')) {
      map.addSource('park-ndvi', { type: 'geojson', data: PARK_POINTS });

      map.addLayer({
        id: 'ndvi-heatmap',
        type: 'heatmap',
        source: 'park-ndvi',
        maxzoom: 14,
        paint: {
          // Weight each point by its ndvi value (0–1)
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'ndvi'], 0, 0, 1, 1],
          // Intensity scales with zoom
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 1, 13, 3],
          // Colour ramp: transparent → green → deep green
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(0,0,0,0)',
            0.3, 'rgba(151,196,89,0.2)',
            0.6, 'rgba(29,158,117,0.4)',
            1.0, 'rgba(8,80,65,0.6)',
          ],
          // Radius grows with zoom
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 25, 13, 60],
          // Fade out after zoom 13, invisible at 14+
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 13, 0.5, 14, 0],
        },
      });
    }

    // --- Hover popup on park polygons ---
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'park-popup',
      maxWidth: '260px',
    });

    const onMouseEnter = (e: any) => {
      map.getCanvas().style.cursor = 'pointer';
      const feat = e.features?.[0];
      if (!feat) return;
      const { name, resilienceScore, ndvi, floodBufferNote } = feat.properties as any;

      const grade = resilienceScore >= 88 ? '🟢 Excellent' : resilienceScore >= 78 ? '🟡 Good' : '🟠 Moderate';

      popup
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family:system-ui;background:#0d1f14;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:14px 16px;color:#fff;min-width:220px">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#5DCAA5;letter-spacing:.04em">${name}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:8px">
                <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.08em">Resilience</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#fff">${resilienceScore}<span style="font-size:11px;color:rgba(255,255,255,0.4)">/100</span></p>
                <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.5)">${grade}</p>
              </div>
              <div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:8px">
                <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.08em">NDVI</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#97C459">${ndvi.toFixed(2)}</p>
                <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.5)">Vegetation density</p>
              </div>
            </div>
            <p style="margin:0;font-size:10px;color:rgba(93,202,165,0.8);background:rgba(93,202,165,0.08);border-radius:5px;padding:5px 8px">💧 ${floodBufferNote}</p>
          </div>
        `)
        .addTo(map);
    };

    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    };

    map.on('mouseenter', 'park-fill', onMouseEnter);
    map.on('mouseleave', 'park-fill', onMouseLeave);

    return () => {
      map.off('mouseenter', 'park-fill', onMouseEnter);
      map.off('mouseleave', 'park-fill', onMouseLeave);
      popup.remove();
      ['ndvi-heatmap', 'park-outline', 'park-fill'].forEach((id) => {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {}
      });
      ['park-ndvi', 'park-polygons'].forEach((id) => {
        try { if (map.getSource(id)) map.removeSource(id); } catch (_) {}
      });
    };
  }, [mapLoaded, mapRef]);

  // ── Toggle NDVI heatmap visibility ────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current as any;
    try {
      if (map.getLayer('ndvi-heatmap')) {
        map.setLayoutProperty('ndvi-heatmap', 'visibility', ndviVisible ? 'visible' : 'none');
      }
    } catch (_) {}
  }, [ndviVisible, mapLoaded, mapRef]);

  // ── Flood zone polygons (ML-driven, feature-state coloured) ─────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current as any;

    if (!map.getSource('flood-zones')) {
      map.addSource('flood-zones', { type: 'geojson', data: FLOOD_ZONES_GEOJSON });

      map.addLayer({
        id: 'flood-zones-fill',
        type: 'fill',
        source: 'flood-zones',
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'hasData'], false],
            [
              'interpolate', ['linear'],
              ['coalesce', ['feature-state', 'riskScore'], 30],
              0, '#1D9E75', 40, '#F59E0B', 70, '#EF4444', 100, '#B91C1C',
            ],
            'rgba(200,200,200,0.06)',
          ],
          'fill-opacity': 0.42,
        },
      });

      map.addLayer({
        id: 'flood-zones-outline',
        type: 'line',
        source: 'flood-zones',
        paint: {
          'line-color': [
            'interpolate', ['linear'],
            ['coalesce', ['feature-state', 'riskScore'], 30],
            0, '#5DCAA5', 40, '#FAC775', 70, '#EF4444', 100, '#B91C1C',
          ],
          'line-width': 1.5,
          'line-opacity': 0.75,
        },
      });
    }

    // Zone click → open SHAP drawer
    const onZoneClick  = (e: any) => {
      const feat = e.features?.[0];
      if (!feat) return;
      setSelectedZoneId(feat.properties?.id ?? null);
      setShapPanelOpen(true);
    };
    const onZoneEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onZoneLeave = () => { map.getCanvas().style.cursor = ''; };

    map.on('click',      'flood-zones-fill', onZoneClick);
    map.on('mouseenter', 'flood-zones-fill', onZoneEnter);
    map.on('mouseleave', 'flood-zones-fill', onZoneLeave);

    return () => {
      map.off('click',      'flood-zones-fill', onZoneClick);
      map.off('mouseenter', 'flood-zones-fill', onZoneEnter);
      map.off('mouseleave', 'flood-zones-fill', onZoneLeave);
      ['flood-zones-outline', 'flood-zones-fill'].forEach(id => {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {}
      });
      try { if (map.getSource('flood-zones')) map.removeSource('flood-zones'); } catch (_) {}
    };
  }, [mapLoaded, mapRef]);

  // ── Prediction → setFeatureState (re-colours zones when ML returns) ──────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current as any;
    mlPredictions.predictions.forEach((pred, zoneId) => {
      const zone = FLOOD_ZONES.find(z => z.id === zoneId);
      if (!zone) return;
      try {
        map.setFeatureState(
          { source: 'flood-zones', id: zone.numId },
          { riskScore: pred.riskScore, hasData: true }
        );
      } catch (_) {}
    });
  }, [mlPredictions.predictions, mapLoaded, mapRef]);

  // ── Loading shimmer (opacity pulse while predictions are fetching) ───────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current as any;
    if (mlPredictions.isLoading) {
      let t0: number | null = null;
      function shimmer(ts: number) {
        if (!t0) t0 = ts;
        const opacity = 0.22 + 0.18 * Math.sin((ts - t0) / 500);
        try { map.setPaintProperty('flood-zones-fill', 'fill-opacity', opacity); } catch (_) {}
        zoneShimmerRef.current = requestAnimationFrame(shimmer);
      }
      zoneShimmerRef.current = requestAnimationFrame(shimmer);
    } else {
      if (zoneShimmerRef.current) { cancelAnimationFrame(zoneShimmerRef.current); zoneShimmerRef.current = null; }
      try { map.setPaintProperty('flood-zones-fill', 'fill-opacity', 0.42); } catch (_) {}
    }
    return () => { if (zoneShimmerRef.current) cancelAnimationFrame(zoneShimmerRef.current); };
  }, [mlPredictions.isLoading, mapLoaded, mapRef]);

  // ── Scenario slider 800ms animated transition ─────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current as any;

    const startRain  = prevScenarioRef.current.rain;
    const startRiver = prevScenarioRef.current.river;
    const endRain    = scenarioRain;
    const endRiver   = scenarioRiver;

    if (scenarioRafRef.current) cancelAnimationFrame(scenarioRafRef.current);

    const DURATION = 800;
    let t0: number | null = null;

    function tick(ts: number) {
      if (!t0) t0 = ts;
      const progress = Math.min(1, (ts - t0) / DURATION);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);

      const rain  = startRain  + (endRain  - startRain)  * ease;
      const river = startRiver + (endRiver - startRiver) * ease;

      // Realtime width factors for Yamuna expansion
      const widthFactor = Math.max(0, (river - 15) / 85); // 0 at normal(15%), 1 at critical(100+)
      const rainFactor  = Math.max(0, (rain - 8) / 200);  // 0 at normal(8mm), 1 at mega(208mm+)
      // Average the two to determine massive physical flood scale:
      const totalFactor = Math.min(1.0, (widthFactor * 0.6) + (rainFactor * 0.4));

      try {
        if (map.getLayer('flood-risk-extrusion')) {
          const adj    = (rain - 65) * 0.18 + (river - 30) * 0.22;
          const factor = 1 + Math.max(-0.3, Math.min(0.5, adj / 100));
          map.setPaintProperty('flood-risk-extrusion', 'fill-extrusion-height', [
            '*', ['+', ['get', 'riskScore'], 0.2], 300 * factor,
          ]);
        }

        // --- EXPANDING YAMUNA RIVER ---
        if (!isMegaFlood && map.getLayer('yamuna-river')) {
          // Color intensity transition
          const f = Math.min(1, rain / 80);
          const r = Math.round(55  - f * 20);
          const g = Math.round(138 - f * 40);
          const b = Math.round(221 + f * 20);
          map.setPaintProperty('yamuna-river', 'line-color', `rgb(${r},${g},${b})`);

          // Line width physically expands to simulate flooding outwards
          const baseRiverWidth = 18;
          const maxRiverWidth = 85; 
          map.setPaintProperty('yamuna-river', 'line-width', baseRiverWidth + (maxRiverWidth - baseRiverWidth) * totalFactor);
        }

        if (map.getLayer('yamuna-river-glow')) {
          const baseGlowWidth = 8;
          const maxGlowWidth = 35;
          map.setPaintProperty('yamuna-river-glow', 'line-width', baseGlowWidth + (maxGlowWidth - baseGlowWidth) * totalFactor);
        }

        // --- EXPANDING FLOODPLAIN POLYGON BUFFER AREA ---
        if (map.getSource('yamuna-buffer')) {
          // offset goes from 1.0 (base buffer) to 3.5 (massive inundation footprint)
          const areaOffset = 1.0 + (2.5 * totalFactor);
          const expandedCoords = buildYamunaBuffer(areaOffset);

          map.getSource('yamuna-buffer').setData({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [expandedCoords] },
            properties: {}
          });
        }
      } catch (_) {}

      if (progress < 1) {
        scenarioRafRef.current = requestAnimationFrame(tick);
      } else {
        prevScenarioRef.current = { rain: endRain, river: endRiver };
        scenarioRafRef.current  = null;
      }
    }
    scenarioRafRef.current = requestAnimationFrame(tick);

    return () => { if (scenarioRafRef.current) cancelAnimationFrame(scenarioRafRef.current); };
  }, [scenarioRain, scenarioRiver, mapLoaded, mapRef, isMegaFlood]);

  // ── Mega-Flood visual takeover ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current as any;
    megaFloodActiveRef.current = isMegaFlood;

    if (isMegaFlood) {
      // 1.5s tween: floodplain opacity 0.12 → 0.55
      const DURATION = 1500;
      let t0: number | null = null;
      const start = 0.12;
      const end   = 0.55;
      const megaRaf = { id: 0 };
      function tweenOpacity(ts: number) {
        if (!t0) t0 = ts;
        const p = Math.min(1, (ts - t0) / DURATION);
        try {
          map.setPaintProperty('yamuna-floodplain-fill', 'fill-opacity', start + (end - start) * p);
        } catch (_) {}
        if (p < 1) megaRaf.id = requestAnimationFrame(tweenOpacity);
      }
      megaRaf.id = requestAnimationFrame(tweenOpacity);
      // River colour → danger red
      try {
        if (map.getLayer('yamuna-river'))     map.setPaintProperty('yamuna-river',     'line-color', '#E24B4A');
        if (map.getLayer('yamuna-river-glow')) map.setPaintProperty('yamuna-river-glow', 'line-color', '#FF7B7A');
      } catch (_) {}
      return () => cancelAnimationFrame(megaRaf.id);
    } else {
      // Restore colours
      try {
        if (map.getLayer('yamuna-river'))     map.setPaintProperty('yamuna-river',     'line-color', '#378ADD');
        if (map.getLayer('yamuna-river-glow')) map.setPaintProperty('yamuna-river-glow', 'line-color', '#85B7EB');
      } catch (_) {}
    }
  }, [isMegaFlood, mapLoaded, mapRef]);

  // Scenario preset handler
  const handlePreset = (id: string, rain: number, river: number, opts?: { heat?: boolean; mega?: boolean }) => {
    setActivePreset(id);
    setScenarioRain(rain);
    setScenarioRiver(river);
    setHeatOverlay(!!opts?.heat);
    setIsMegaFlood(!!opts?.mega);
  };

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
    if (level === "EMERGENCY") return "text-red-400 bg-red-400/20 border-red-400/40";
    if (level === "WARNING") return "text-orange-400 bg-orange-400/20 border-orange-400/40";
    if (level === "WATCH") return "text-yellow-400 bg-yellow-400/20 border-yellow-400/40";
    return "text-accent bg-accent/20 border-accent/40";
  };

  return (
    <div className="relative h-[calc(100vh-100px)] min-h-[750px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#091410] shadow-2xl">
      
      {/* ── BACKGROUND LAYER: 3D Mapbox Map ── */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Heatwave ambient tint */}
      {heatOverlay && (
        <div
          className="pointer-events-none absolute inset-0 z-[2] transition-opacity duration-700"
          style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(239,159,39,0.13) 0%, rgba(239,159,39,0.04) 60%, transparent 100%)' }}
        />
      )}

      {/* Loading shimmer */}
      {loading && !riskData && (
        <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center bg-[#091410]/70 backdrop-blur-sm pointer-events-none">
          <Cpu className="h-8 w-8 animate-pulse text-accent mb-4" />
          <span className="text-sm font-medium text-white tracking-widest uppercase">Calculating hydrological models...</span>
        </div>
      )}

      {/* Fixed alert toasts — always on top regardless of layout */}
      <div className="z-[100] absolute">
        <AlertToastPanel
          alerts={alertSystem.alerts}
          onDismiss={alertSystem.dismiss}
          onViewOnMap={flyToZone}
          soundEnabled={soundEnabled}
          onSoundToggle={() => setSoundEnabled(v => !v)}
          unreadCount={alertSystem.unreadCount}
        />
      </div>

      {/* ── FOREGROUND LAYER: Interactive HUD Overlay ── */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col p-5 gap-4">
        
        {/* ROW 1: Header + Badges */}
        <header className="pointer-events-auto flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between rounded-xl border border-white/10 bg-[#0d1f14]/80 p-4 shadow-glass backdrop-blur-md">
          {/* Left: Titles */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Map className="h-5 w-5 text-accent" /> Flood Monitoring
            </h1>
            <p className="mt-1 text-sm text-white/60">Real-time hydrological oversight and automated drainage orchestration</p>
          </div>

          {/* Center: City Risk Badge (injected flex) */}
          <div className="hidden lg:flex justify-center items-start mt-[-8px]">
             <CityRiskBadge rainfall={scenarioRain} riverLevel={scenarioRiver} isMegaFlood={isMegaFlood} />
          </div>

          {/* Right: Controls */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <select
              value={parkId}
              onChange={(e) => setParkId(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 py-2 pl-3 pr-8 text-sm font-medium text-white shadow-sm outline-none transition-all hover:bg-black/60 focus:ring-2 focus:ring-accent/50"
            >
              <option value="test_park" className="bg-[#091410]">Lodhi Garden (Live NASA Feed)</option>
              {parks.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#091410]">{p.name}</option>
              ))}
            </select>

            <button
              onClick={() => setNdviVisible((v) => !v)}
              title={ndviVisible ? 'Hide NDVI heatmap' : 'Show NDVI heatmap'}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold outline-none transition-all ring-1 shadow-glass ${
                ndviVisible
                  ? 'bg-[#1D9E75]/25 text-[#5DCAA5] ring-[#5DCAA5]/40 hover:bg-[#1D9E75]/35'
                  : 'bg-white/5 text-white/50 ring-white/15 hover:bg-white/10'
              }`}
            >
              <Layers className="h-4 w-4" /> NDVI
            </button>

            {mlPredictions.lastUpdated && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider ring-1 ${
                mlPredictions.isEstimated
                  ? 'bg-amber-500/15 text-amber-400 ring-amber-500/30'
                  : 'bg-accent/15 text-accent ring-accent/30'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${mlPredictions.isEstimated ? 'bg-amber-400' : 'animate-ping bg-accent'}`} />
                {mlPredictions.isEstimated ? 'Estimated' : 'ML Live'}
              </span>
            )}

            <button
              onClick={triggerResponse}
              disabled={!riskData || riskData.riskLevel === "LOW"}
              className="flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-500 outline-none transition-all hover:bg-red-500/30 ring-1 ring-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed shadow-glass"
            >
              <ShieldAlert className="h-4 w-4" /> Trigger Workflow
            </button>
          </div>
        </header>

        {/* Mega-Flood alert banner (replaces Row 2 if active) */}
        {isMegaFlood && (
          <div className="pointer-events-auto flex items-center justify-center gap-3 rounded-xl bg-red-600/90 px-6 py-2.5 backdrop-blur-md shadow-glass w-full">
            <span className="animate-pulse text-sm font-bold tracking-wide text-white uppercase">
              🌊 MEGA-FLOOD SCENARIO — Projected inundation across 7 zones
            </span>
            <button
              onClick={() => { setIsMegaFlood(false); setActivePreset('baseline'); setScenarioRain(rainfallMm); setScenarioRiver(riverLevel); }}
              className="ml-auto rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30 transition"
            >Dismiss</button>
          </div>
        )}

        {/* ROW 2: Flood Status Bar */}
        <div className="pointer-events-auto w-full">
          <FloodStatusBar
            cityRiskScore={mlPredictions.cityRiskScore ?? 0}
            criticalZones={mlPredictions.criticalZones ?? []}
            predictions={mlPredictions.predictions}
            rainfall24h={weather.rainfall24h ?? 0}
            rainfall72hForecast={(weather as any).rainfall72hForecast ?? []}
            isLoading={mlPredictions.isLoading}
          />
        </div>

        {/* ROW 3: Sidebars content flex */}
        <div className="flex-1 min-h-0 flex items-start justify-between gap-4 pointer-events-none mt-2">
          
          {/* Left Column */}
          <div className="w-[270px] pointer-events-auto flex flex-col gap-4 overflow-y-auto scrollbar-none h-full pb-4">
            <div className="shrink-0">
              <ScenarioControlPanel
                rainfall={scenarioRain}
                riverLevel={scenarioRiver}
                activePreset={activePreset}
                liveRainfall={rainfallMm}
                liveRiverLevel={riverLevel}
                onRainfallChange={(v) => { setScenarioRain(v); setActivePreset(null); setIsMegaFlood(false); }}
                onRiverLevelChange={(v) => { setScenarioRiver(v); setActivePreset(null); setIsMegaFlood(false); }}
                onPreset={handlePreset}
              />
            </div>

            {/* KPI Cards */}
            <div className="shrink-0 rounded-xl border border-white/10 bg-[#0d1f14]/85 p-4 shadow-glass backdrop-blur-md">
              <div className="mb-3 flex items-center gap-3">
                <div className={`p-2 rounded-lg border ${getRiskColor(riskData?.riskLevel)}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/70">Risk Status</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Current Level</p>
                </div>
              </div>
              <span className="font-display text-3xl font-bold tracking-tight text-white drop-shadow-sm">
                {riskData?.riskLevel || "LOW"}
              </span>
            </div>

            <div className="shrink-0 rounded-xl border border-white/10 bg-[#0d1f14]/85 p-4 shadow-glass backdrop-blur-md">
              <div className="mb-3 flex items-center gap-3">
                <div className="p-2 rounded-lg border border-accent/30 bg-accent/20 text-accent">
                  <Waves className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/70">Calculated Score</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Index (0-100)</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold tracking-tight text-white drop-shadow-sm">
                  {riskData?.riskScore || 0}
                </span>
                <span className="text-xs font-bold text-white/40">/ 100</span>
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-white/10 bg-[#0d1f14]/85 p-4 shadow-glass backdrop-blur-md">
              <div className="mb-3 flex items-center gap-3">
                <div className="p-2 rounded-lg border border-blue-400/30 bg-blue-400/20 text-blue-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/70">Time to Overflow</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Est. Arrival</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold tracking-tight text-white drop-shadow-sm">
                  {(riskData?.timeToOverflowMin === null || riskData?.timeToOverflowMin === Infinity || !riskData)
                    ? "Safe"
                    : riskData?.timeToOverflowMin?.toFixed(0)}
                </span>
                {riskData?.timeToOverflowMin && riskData?.timeToOverflowMin !== Infinity && (
                  <span className="text-xs font-bold text-white/40">mins</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="hidden xl:flex w-[320px] pointer-events-auto flex-col gap-4 h-full pb-4">
            <LiveWeatherPanel weather={weather} />

            <div className="flex flex-col flex-1 rounded-xl border border-white/10 bg-[#0d1f14]/85 shadow-glass backdrop-blur-md overflow-hidden min-h-0">
              <div className="p-4 border-b border-white/10 bg-white/[0.02] shrink-0">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-accent" /> Automated Protocol
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {riskData?.recommendedActions && riskData.recommendedActions.length > 0 ? (
                  <ul className="space-y-3">
                    {riskData.recommendedActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-black/40 border border-white/5 transition hover:border-white/10">
                        <div className="mt-0.5 rounded-full bg-accent/20 p-1 text-accent ring-1 ring-accent/30 shadow-glass shrink-0">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm font-medium text-white/90 leading-relaxed shadow-sm">{action}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/30 border-2 border-dashed border-white/5 rounded-xl bg-black/20 p-6 text-center">
                    System nominal. Drainage networks operating at safe capacities. No protocols active.
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SHAP Panel Component */}
      <SHAPPanel
        open={shapPanelOpen}
        onClose={() => setShapPanelOpen(false)}
        zoneName={FLOOD_ZONES.find(z => z.id === selectedZoneId)?.name ?? ''}
        prediction={selectedZoneId ? (mlPredictions.predictions.get(selectedZoneId) ?? null) : null}
      />
    </div>
  );
}
