// Delhi Parks — GeoJSON data for resilience and NDVI layers
// Polygons are 16-point circle approximations in WGS84.

export interface ParkFeatureProperties {
  name: string;
  resilienceScore: number;
  ndvi: number;
  floodBufferNote: string;
}

/** Generate a 16-point circle polygon (degrees) centred at [lng, lat] with radius r. */
function circle(center: [number, number], r: number): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * 2 * Math.PI;
    pts.push([center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)]);
  }
  return pts;
}

const PARKS: Array<{
  name: string;
  center: [number, number];
  r: number;
  resilienceScore: number;
  ndvi: number;
}> = [
  { name: "Lodhi Garden",               center: [77.220, 28.591], r: 0.004, resilienceScore: 88, ndvi: 0.58 },
  { name: "Nehru Park",                 center: [77.174, 28.589], r: 0.003, resilienceScore: 82, ndvi: 0.52 },
  { name: "Sanjay Van",                 center: [77.186, 28.527], r: 0.005, resilienceScore: 91, ndvi: 0.61 },
  { name: "India Gate Lawns",           center: [77.229, 28.612], r: 0.004, resilienceScore: 79, ndvi: 0.52 },
  { name: "Deer Park",                  center: [77.204, 28.563], r: 0.003, resilienceScore: 85, ndvi: 0.55 },
  { name: "Yamuna Biodiversity Park",   center: [77.152, 28.713], r: 0.006, resilienceScore: 76, ndvi: 0.48 },
  { name: "Aravalli Biodiversity Park", center: [77.128, 28.551], r: 0.007, resilienceScore: 89, ndvi: 0.63 },
  { name: "Okhla Bird Sanctuary",       center: [77.308, 28.528], r: 0.005, resilienceScore: 84, ndvi: 0.57 },
];

/** GeoJSON FeatureCollection of park polygons for the fill/outline layers. */
export const PARK_POLYGONS: GeoJSON.FeatureCollection<GeoJSON.Polygon, ParkFeatureProperties> = {
  type: "FeatureCollection",
  features: PARKS.map((p) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [circle(p.center, p.r)] },
    properties: {
      name: p.name,
      resilienceScore: p.resilienceScore,
      ndvi: p.ndvi,
      floodBufferNote: "Reduces peak runoff by ~28%",
    },
  })),
};

/** GeoJSON FeatureCollection of park centre points for the NDVI heatmap. */
export const PARK_POINTS: GeoJSON.FeatureCollection<GeoJSON.Point, ParkFeatureProperties> = {
  type: "FeatureCollection",
  features: PARKS.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: p.center },
    properties: {
      name: p.name,
      resilienceScore: p.resilienceScore,
      ndvi: p.ndvi,
      floodBufferNote: "Reduces peak runoff by ~28%",
    },
  })),
};
