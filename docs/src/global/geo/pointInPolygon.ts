/* ---------------------------------------------------------------------------
 * GeoJSON 多边形命中判定（§G1 Step 3 的 "spatial join"）
 *
 * 不引第三方库 —— 仓库其余部分是零运行时依赖的，这里也保持一致。
 *
 * 坐标一律是 [经度, 纬度]，与 GeoJSON 规范一致（注意与「纬度在前」的口头习惯相反）。
 * 判定在平面 lon/lat 上做，不做球面修正：Natural Earth 已按反经线把跨越 ±180° 的
 * 国家拆成了多个部分，每个环都落在 [-180, 180] 内，因此平面判定是正确的。
 * 若将来换成未拆分的边界源，这个前提会失效 —— buildBoundaryIndex 会检查并报警。
 * ------------------------------------------------------------------------- */

/** [经度, 纬度] */
export type Position = number[];

/** 一个闭合环。GeoJSON 要求首尾点相同。 */
export type Ring = Position[];

/** [外环, 内环（洞）...] */
export type PolygonCoords = Ring[];

/** [最小经度, 最小纬度, 最大经度, 最大纬度] */
export type BBox = [number, number, number, number];

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: PolygonCoords;
}

export interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: PolygonCoords[];
}

export type AreaGeometry = PolygonGeometry | MultiPolygonGeometry;

/**
 * 把 Polygon / MultiPolygon 统一成多边形数组，调用方不必再分支。
 * 其他几何类型（Point / LineString 等）返回空数组而不是抛错 ——
 * 边界文件里混进非面要素时应当被忽略，而不是让整张地图不可用。
 */
export function toPolygonList(geometry: unknown): PolygonCoords[] {
  if (!geometry || typeof geometry !== "object") return [];
  const g = geometry as { type?: unknown; coordinates?: unknown };
  if (g.type === "Polygon" && Array.isArray(g.coordinates)) {
    return [g.coordinates as PolygonCoords];
  }
  if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
    return g.coordinates as PolygonCoords[];
  }
  return [];
}

/** 环的经纬度包围盒。空环返回 null。 */
export function ringBBox(ring: Ring): BBox | null {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const p of ring) {
    const lon = p[0];
    const lat = p[1];
    if (typeof lon !== "number" || typeof lat !== "number") continue;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;
  return [minLon, minLat, maxLon, maxLat];
}

/** 多个包围盒的并。全部为空时返回 null。 */
export function unionBBox(boxes: (BBox | null)[]): BBox | null {
  let out: BBox | null = null;
  for (const b of boxes) {
    if (!b) continue;
    if (!out) {
      out = [b[0], b[1], b[2], b[3]];
      continue;
    }
    if (b[0] < out[0]) out[0] = b[0];
    if (b[1] < out[1]) out[1] = b[1];
    if (b[2] > out[2]) out[2] = b[2];
    if (b[3] > out[3]) out[3] = b[3];
  }
  return out;
}

/** 包围盒粗筛。边界上算命中（宁可多做一次精确判定，也不要漏掉边界上的点）。 */
export function bboxContains(bbox: BBox | null | undefined, lon: number, lat: number): boolean {
  if (!bbox) return false;
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

/**
 * 射线法（crossing number）。奇数次穿越为内部。
 *
 * 已知边界：点恰好落在环的边上时结果未定义（取决于浮点比较方向）。
 * 对本产品无实际影响 —— 用户点在国界线上时归到相邻两国的哪一个都算合理，
 * 而气候数据本身的空间精度（Köppen 网格 0.1°，约 11 km）远粗于这个量级。
 */
export function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    // (yi > lat) !== (yj > lat) 同时排除了水平边和不跨越射线的边
    if (yi > lat !== yj > lat) {
      const xCross = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (lon < xCross) inside = !inside;
    }
  }
  return inside;
}

/** 在外环内且不在任何内环（洞）内。 */
export function pointInPolygon(lon: number, lat: number, polygon: PolygonCoords): boolean {
  if (!Array.isArray(polygon) || polygon.length === 0) return false;
  if (!pointInRing(lon, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(lon, lat, polygon[i])) return false;
  }
  return true;
}
