
export const TILE_SIZE = 256;


const EQUATOR_MPP = 156543.03392804097;

export interface Point {
  x: number;
  y: number;
}

const clampLat = (lat: number) => Math.max(Math.min(lat, 85.05112878), -85.05112878);


export function project(lng: number, lat: number, zoom: number): Point {
  const worldPx = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * worldPx;
  const latRad = (clampLat(lat) * Math.PI) / 180;
  const y = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * worldPx;
  return { x, y };
}


export function unproject(x: number, y: number, zoom: number): { lng: number; lat: number } {
  const worldPx = TILE_SIZE * 2 ** zoom;
  const lng = (x / worldPx) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / worldPx)));
  return { lng, lat: (latRad * 180) / Math.PI };
}


export function metersPerPixel(lat: number, zoom: number): number {
  return (EQUATOR_MPP * Math.cos((clampLat(lat) * Math.PI) / 180)) / 2 ** zoom;
}

export interface TileRef {
  
  x: number;
  
  y: number;
  z: number;
  
  left: number;
  top: number;
}


export function tilesForViewport(
  center: { lng: number; lat: number },
  zoom: number,
  width: number,
  height: number
): TileRef[] {
  const n = 2 ** zoom;
  const c = project(center.lng, center.lat, zoom);
  const originX = c.x - width / 2;
  const originY = c.y - height / 2;

  const minTileX = Math.floor(originX / TILE_SIZE);
  const maxTileX = Math.floor((originX + width) / TILE_SIZE);
  const minTileY = Math.floor(originY / TILE_SIZE);
  const maxTileY = Math.floor((originY + height) / TILE_SIZE);

  const tiles: TileRef[] = [];
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      tiles.push({
        x: ((tx % n) + n) % n,
        y: ty,
        z: zoom,
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}


export function panCenter(
  center: { lng: number; lat: number },
  zoom: number,
  dxPx: number,
  dyPx: number
): { lng: number; lat: number } {
  const c = project(center.lng, center.lat, zoom);
  return unproject(c.x - dxPx, c.y - dyPx, zoom);
}
