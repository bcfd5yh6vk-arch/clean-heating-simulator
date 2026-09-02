import {
  bboxContains,
  pointInPolygon,
  ringBBox,
  toPolygonList,
  unionBBox,
  type BBox,
  type PolygonCoords,
} from "./pointInPolygon";

/* ---------------------------------------------------------------------------
 * 把一份 GeoJSON FeatureCollection 变成可点查的索引。
 *
 * 逐要素做射线法在 242 个国家 × 上万个点上是够快的，但每个 MultiPolygon 的
 * 各个部分都单独存包围盒能省掉绝大多数无谓计算 —— 俄罗斯、美国、加拿大这类
 * 要素的整体包围盒几乎覆盖半个地球，只有分块粗筛才有意义。
 * ------------------------------------------------------------------------- */

export interface IndexedPolygon {
  coords: PolygonCoords;
  bbox: BBox;
}

export interface IndexedFeature<P> {
  properties: P;
  polygons: IndexedPolygon[];
  bbox: BBox;
}

export interface BoundaryIndex<P> {
  features: IndexedFeature<P>[];
  /** 构建期发现的可疑之处。不抛错，但调用方应当把它显示出来而不是丢掉。 */
  warnings: string[];
}

interface RawFeature {
  properties?: unknown;
  geometry?: unknown;
}

/**
 * 单个多边形的包围盒宽度超过这个度数就存疑：说明它可能跨越了反经线而没有被
 * 上游拆分，此时平面射线法会给出错误结果。南极洲是合法例外（它绕极一圈，
 * 且必然触及 -90° 纬度），单独放行。
 */
const SUSPICIOUS_SPAN_DEG = 180;

export function buildBoundaryIndex<P>(collection: unknown): BoundaryIndex<P> {
  const warnings: string[] = [];
  const out: IndexedFeature<P>[] = [];

  const fc = collection as { type?: unknown; features?: unknown } | null;
  if (!fc || !Array.isArray(fc.features)) {
    warnings.push("边界数据不是合法的 FeatureCollection，索引为空");
    return { features: out, warnings };
  }

  for (const raw of fc.features as RawFeature[]) {
    const polygonList = toPolygonList(raw?.geometry);
    if (polygonList.length === 0) continue;

    const polygons: IndexedPolygon[] = [];
    for (const coords of polygonList) {
      const bbox = ringBBox(coords[0]);
      if (!bbox) continue;
      const spansTooWide = bbox[2] - bbox[0] > SUSPICIOUS_SPAN_DEG;
      const touchesPole = bbox[1] <= -85 || bbox[3] >= 85;
      if (spansTooWide && !touchesPole) {
        warnings.push(
          `要素 ${describe(raw?.properties)} 有一个跨度 ${(bbox[2] - bbox[0]).toFixed(1)}° 的多边形，` +
            "疑似跨越反经线且未被拆分；平面命中判定对这类几何是错的",
        );
      }
      polygons.push({ coords, bbox });
    }
    if (polygons.length === 0) continue;

    const bbox = unionBBox(polygons.map((p) => p.bbox));
    if (!bbox) continue;
    out.push({ properties: (raw.properties ?? {}) as P, polygons, bbox });
  }

  if (out.length === 0) warnings.push("边界数据里没有任何可用的面要素");
  return { features: out, warnings };
}

function describe(properties: unknown): string {
  const p = properties as Record<string, unknown> | null;
  if (!p) return "(无属性)";
  const name = p.name_en ?? p.iso3 ?? p.admin1_code;
  return typeof name === "string" ? name : "(无名)";
}

/**
 * 返回所有覆盖该点的要素属性，按文件顺序。
 *
 * 返回数组而不是单个结果，是因为争议地区可能被多个要素同时覆盖。
 * 由调用方决定怎么呈现 —— 悄悄取第一个等于替产品对归属表态，这不是 CS 该做的事。
 */
export function findFeaturesAt<P>(index: BoundaryIndex<P>, lon: number, lat: number): P[] {
  const hits: P[] = [];
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return hits;
  for (const feature of index.features) {
    if (!bboxContains(feature.bbox, lon, lat)) continue;
    for (const polygon of feature.polygons) {
      if (!bboxContains(polygon.bbox, lon, lat)) continue;
      if (pointInPolygon(lon, lat, polygon.coords)) {
        hits.push(feature.properties);
        break;
      }
    }
  }
  return hits;
}
