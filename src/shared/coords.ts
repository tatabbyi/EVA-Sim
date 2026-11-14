// Written with AI assistance (Claude).
// Shared contract: TEAM-PLAN.md section 2.1. Owner: Victor. Don't change without telling everyone.
// Local frame (metres): x = east, y = up (height - h0), z = south. Origin = Octavia E. Butler landing site.

export const CRS =
  '+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs';

export const ORIGIN = { X: 4354489, Y: 1093304, lon: 77.4508, lat: 18.4447 } as const;

/** Metres per degree on the Mars sphere (R = 3,396,190 m), longitude at the 18.4663° standard parallel. */
export const M_PER_DEG_LON = 56222.65;
export const M_PER_DEG_LAT = 59274.7;

/** Half the side of the 4,096 m working box. */
export const BOX_HALF = 2048;

export interface XZ { x: number; z: number }

export function lonLatToLocal(lon: number, lat: number): XZ {
  return { x: (lon - ORIGIN.lon) * M_PER_DEG_LON, z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT };
}

export function localToLonLat(x: number, z: number): { lon: number; lat: number } {
  return { lon: ORIGIN.lon + x / M_PER_DEG_LON, lat: ORIGIN.lat - z / M_PER_DEG_LAT };
}

/** From the projected CRS above (e.g. waypoint easting/northing) to the local frame. */
export function projectedToLocal(X: number, Y: number): XZ {
  return { x: X - ORIGIN.X, z: -(Y - ORIGIN.Y) };
}
