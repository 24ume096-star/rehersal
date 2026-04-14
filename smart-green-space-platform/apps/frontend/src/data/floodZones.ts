/**
 * 12 Delhi flood zone polygons with hardcoded hydrological features.
 * Used as the per-zone GeoJSON source and as ML input feature values.
 */

export interface FloodZoneProperties {
  id: string;
  name: string;
  ndvi: number;
  elevation_m: number;
  distance_to_yamuna_km: number;
  drainage_capacity_score: number;
}

export interface FloodZone extends FloodZoneProperties {
  numId: number;           // numeric Mapbox feature ID for setFeatureState
  center: [number, number];
  coordinates: [number, number][];  // ring for Polygon
}

/** dx/dy half-sizes for each rectangular zone (degrees) */
const R = (cx: number, cy: number, dx: number, dy: number): [number, number][] => [
  [cx - dx, cy - dy], [cx + dx, cy - dy],
  [cx + dx, cy + dy], [cx - dx, cy + dy],
  [cx - dx, cy - dy],
];

export const FLOOD_ZONES: FloodZone[] = [
  {
    numId: 1, id: "yamuna-north", name: "Yamuna Floodplain North",
    center: [77.245, 28.722], ndvi: 0.30, elevation_m: 203,
    distance_to_yamuna_km: 0.4, drainage_capacity_score: 18,
    coordinates: R(77.245, 28.722, 0.028, 0.014),
  },
  {
    numId: 2, id: "civil-lines", name: "Civil Lines",
    center: [77.225, 28.690], ndvi: 0.42, elevation_m: 218,
    distance_to_yamuna_km: 3.1, drainage_capacity_score: 58,
    coordinates: R(77.225, 28.690, 0.024, 0.013),
  },
  {
    numId: 3, id: "shahdara", name: "Shahdara",
    center: [77.298, 28.668], ndvi: 0.26, elevation_m: 209,
    distance_to_yamuna_km: 1.6, drainage_capacity_score: 33,
    coordinates: R(77.298, 28.668, 0.026, 0.013),
  },
  {
    numId: 4, id: "laxmi-nagar", name: "Laxmi Nagar",
    center: [77.278, 28.632], ndvi: 0.24, elevation_m: 212,
    distance_to_yamuna_km: 3.8, drainage_capacity_score: 41,
    coordinates: R(77.278, 28.632, 0.022, 0.012),
  },
  {
    numId: 5, id: "mayur-vihar", name: "Mayur Vihar – East Delhi",
    center: [77.308, 28.610], ndvi: 0.28, elevation_m: 210,
    distance_to_yamuna_km: 2.4, drainage_capacity_score: 38,
    coordinates: R(77.308, 28.610, 0.024, 0.012),
  },
  {
    numId: 6, id: "okhla", name: "Okhla Industrial",
    center: [77.310, 28.542], ndvi: 0.33, elevation_m: 207,
    distance_to_yamuna_km: 1.9, drainage_capacity_score: 44,
    coordinates: R(77.310, 28.542, 0.022, 0.012),
  },
  {
    numId: 7, id: "ito-central", name: "ITO / Pragati Maidan",
    center: [77.252, 28.634], ndvi: 0.22, elevation_m: 212,
    distance_to_yamuna_km: 0.8, drainage_capacity_score: 55,
    coordinates: R(77.252, 28.634, 0.020, 0.010),
  },
  {
    numId: 8, id: "lodhi-zone", name: "South Central – Lodhi",
    center: [77.222, 28.584], ndvi: 0.55, elevation_m: 223,
    distance_to_yamuna_km: 5.6, drainage_capacity_score: 76,
    coordinates: R(77.222, 28.584, 0.022, 0.011),
  },
  {
    numId: 9, id: "saket", name: "Saket – South West",
    center: [77.218, 28.527], ndvi: 0.48, elevation_m: 228,
    distance_to_yamuna_km: 8.4, drainage_capacity_score: 82,
    coordinates: R(77.218, 28.527, 0.022, 0.011),
  },
  {
    numId: 10, id: "rohini", name: "Rohini – North West",
    center: [77.128, 28.722], ndvi: 0.38, elevation_m: 225,
    distance_to_yamuna_km: 13.2, drainage_capacity_score: 68,
    coordinates: R(77.128, 28.722, 0.026, 0.013),
  },
  {
    numId: 11, id: "dwarka", name: "Dwarka – West",
    center: [77.060, 28.588], ndvi: 0.35, elevation_m: 221,
    distance_to_yamuna_km: 19.5, drainage_capacity_score: 71,
    coordinates: R(77.060, 28.588, 0.026, 0.013),
  },
  {
    numId: 12, id: "kalindi-kunj", name: "Kalindi Kunj – South East",
    center: [77.328, 28.568], ndvi: 0.31, elevation_m: 205,
    distance_to_yamuna_km: 1.1, drainage_capacity_score: 29,
    coordinates: R(77.328, 28.568, 0.022, 0.011),
  },
];

/** Ready-to-use GeoJSON FeatureCollection for Mapbox */
export const FLOOD_ZONES_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon, FloodZoneProperties> = {
  type: "FeatureCollection",
  features: FLOOD_ZONES.map((z) => ({
    type: "Feature",
    id: z.numId,        // numeric id required for setFeatureState
    geometry: { type: "Polygon", coordinates: [z.coordinates] },
    properties: {
      id: z.id, name: z.name, ndvi: z.ndvi,
      elevation_m: z.elevation_m,
      distance_to_yamuna_km: z.distance_to_yamuna_km,
      drainage_capacity_score: z.drainage_capacity_score,
    },
  })),
};
