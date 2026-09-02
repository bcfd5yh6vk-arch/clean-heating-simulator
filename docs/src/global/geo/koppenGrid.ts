/* ---------------------------------------------------------------------------
 * Köppen-Geiger 栅格点查（§G1 Step 3 的 "query Köppen at (lat, lon)"）
 *
 * 栅格以 8 位灰度 PNG 的形式随站点分发，像素值就是分类索引（0 = 无数据）。
 * 之所以能这么简单，是因为上游 GeoTIFF 是 EPSG:4326 等距圆柱网格：
 * 经纬度到像素是纯线性映射，不需要任何投影反算。
 *
 * 本模块**不碰 canvas**。取像素的动作由调用方以 PixelReader 注入，
 * 于是全部换算逻辑都能在 node 里测，不需要浏览器。
 * ------------------------------------------------------------------------- */

export interface KoppenGridSpec {
  width: number;
  height: number;
  lon_min: number;
  lat_max: number;
  cell_size_deg: number;
  nodata_index: number;
}

export interface KoppenClass {
  index: number;
  code: string;
  description_en: string;
}

export interface KoppenSelfCheckProbe {
  label: string;
  lon: number;
  lat: number;
  x: number;
  y: number;
  expected_index: number;
}

export interface KoppenLegend {
  grid: KoppenGridSpec;
  classes: KoppenClass[];
  self_check?: KoppenSelfCheckProbe[];
  resolution_note_en?: string;
  resolution_note_zh?: string;
}

/** 读 (x, y) 处的分类索引。越界或读不到时返回 null。 */
export type PixelReader = (x: number, y: number) => number | null;

export interface PixelCoord {
  x: number;
  y: number;
}

/**
 * 经纬度 → 像素坐标。
 *
 * 经度按 360° 归一到 [lon_min, lon_min + 360)，所以 181° 与 -179° 等价；
 * 纬度不做环绕（-91° 不是 89°，它根本不存在），越界返回 null。
 */
export function lonLatToPixel(lon: number, lat: number, grid: KoppenGridSpec): PixelCoord | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lat > 90 || lat < -90) return null;
  if (!(grid.cell_size_deg > 0) || !(grid.width > 0) || !(grid.height > 0)) return null;

  let wrapped = (lon - grid.lon_min) % 360;
  if (wrapped < 0) wrapped += 360;

  let x = Math.floor(wrapped / grid.cell_size_deg);
  let y = Math.floor((grid.lat_max - lat) / grid.cell_size_deg);

  // 纬度 -90（正南极）会算到 height，是闭区间端点造成的，夹回最后一行
  if (y === grid.height) y = grid.height - 1;
  if (x === grid.width) x = grid.width - 1;
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return null;
  return { x, y };
}

/** 分类索引 → Köppen 码。0（无数据）与未知索引都返回 null。 */
export function codeFromIndex(index: number | null | undefined, classes: KoppenClass[]): string | null {
  if (index == null || !Number.isFinite(index)) return null;
  const found = classes.find((c) => c.index === index);
  return found ? found.code : null;
}

export function classFromCode(code: string | null | undefined, classes: KoppenClass[]): KoppenClass | null {
  if (!code) return null;
  return classes.find((c) => c.code === code) ?? null;
}

/** 细分类 → 主类（§G1 Step 3 的 A/B/C/D/E 回退）。 */
export function mainGroupOf(code: string | null | undefined): string | null {
  if (typeof code !== "string" || code.length === 0) return null;
  const head = code.charAt(0).toUpperCase();
  return "ABCDE".includes(head) ? head : null;
}

/** 在给定经纬度处查 Köppen 码。读到 nodata（海洋等）或未知索引时返回 null。 */
export function koppenCodeAt(
  lon: number,
  lat: number,
  legend: KoppenLegend,
  readPixel: PixelReader,
): string | null {
  const px = lonLatToPixel(lon, lat, legend.grid);
  if (!px) return null;
  const index = readPixel(px.x, px.y);
  if (index == null || index === legend.grid.nodata_index) return null;
  return codeFromIndex(index, legend.classes);
}

export interface SelfCheckResult {
  ok: boolean;
  failures: { label: string; expected: number; actual: number | null }[];
}

/**
 * 逐条核对 legend 里的自检探针。
 *
 * 为什么需要：浏览器如果对 PNG 做了色彩管理转换，像素值会被悄悄改掉，
 * 而 canvas 不会报任何错 —— 用户只会看到一个错的气候区。这类静默错误必须
 * 在加载时就抓住，宁可整块功能显示「不可用」，也不要给出看似正常的错误答案。
 */
export function runSelfCheck(legend: KoppenLegend, readPixel: PixelReader): SelfCheckResult {
  const probes = legend.self_check ?? [];
  const failures: SelfCheckResult["failures"] = [];
  for (const probe of probes) {
    const actual = readPixel(probe.x, probe.y);
    if (actual !== probe.expected_index) {
      failures.push({ label: probe.label, expected: probe.expected_index, actual });
    }
  }
  return { ok: failures.length === 0, failures };
}
