// Written with AI assistance (Claude).
// Shape of public/data/meta.json. Contract: TEAM-PLAN.md section 2.4. Owner: Victor (o2 block: Nanda).

export interface GridInfo {
  file: string;
  type: 'float32' | 'uint8';
  n: number;    // samples per side
  cell: number; // metres between samples
}

export interface Meta {
  crs: string;
  origin: { X: number; Y: number; lon: number; lat: number; h0: number };
  boxMetres: number;
  home: { x: number; z: number };
  grids: Record<string, GridInfo>;
  tiles: { dir: string; count: number; samples: number; step: number; maxError: number };
  o2: { usableLitres: number; reserveMinutes: number; terrainFactor: number };
  lander: { antennaHeight: number; suitAntennaHeight: number };
}

export async function loadMeta(base: string = import.meta.env.BASE_URL): Promise<Meta> {
  const res = await fetch(`${base}data/meta.json`);
  if (!res.ok) throw new Error(`meta.json: HTTP ${res.status}`);
  return (await res.json()) as Meta;
}
