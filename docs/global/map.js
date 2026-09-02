/* ---------------------------------------------------------------------------
 * G1 气候地图 —— canvas 矢量渲染器
 *
 * 规格 §G1 要求「可缩放全球地图，前台不要染色」。这里直接把 Natural Earth 的
 * GeoJSON 画在 canvas 上，不用瓦片、不用第三方地图库、不需要 API key：
 *   - 识别本来就靠这份 GeoJSON，瓦片只是装饰；
 *   - 项目相当一部分用户在中国境内，公共瓦片服务经常加载不出来；
 *   - 站点是纯静态部署，多一个外部运行时依赖就多一个坏掉的理由。
 *
 * 投影用**等距圆柱**（经纬度直接线性映射到屏幕）。选它不只是为了简单：
 * Köppen 栅格本身就是 EPSG:4326 等距圆柱网格，同一套换算能同时服务
 * 绘制和点查，不会因为投影反算引入偏差。代价是高纬度横向被压扁
 * （40°N 约 1.3 倍），对「点选自己所在的省」这件事没有影响。
 *
 * 本文件只管画和交互，不做任何地理判定 —— 那是 docs/src/global/geo/ 的事，
 * 在 node 里有测试覆盖。
 * ------------------------------------------------------------------------- */

(function () {
  "use strict";

  var MIN_SCALE_FIT_MARGIN = 1.0;   // 最小缩放：整个世界刚好铺满宽度
  var MAX_SCALE = 400;              // 最大缩放：像素/度
  var DRAG_THRESHOLD_PX = 4;        // 位移超过这个距离算拖动，不算点击
  var ADMIN1_MIN_SCALE = 1.6;       // 省/州界从这个缩放开始画
  var PLACES_MIN_SCALE = 1.2;
  var MAX_LABELS = 90;              // 每帧最多画多少个城市名，防止糊成一片

  var COLORS = {
    ocean: "#e6eef0",
    land: "#f3f1ea",
    landStroke: "#8ea396",
    admin1Stroke: "#b3c0b7",
    highlightFill: "rgba(47, 107, 79, 0.16)",
    highlightStroke: "#2f6b4f",
    marker: "#2f6b4f",
    markerHalo: "#ffffff",
    place: "#7d8a82",
    placeLabel: "#5a665f",
    graticule: "rgba(120, 138, 128, 0.16)"
  };

  /** 把 GeoJSON FeatureCollection 预处理成绘制用的结构（含每个多边形的包围盒） */
  function prepareLayer(collection) {
    var out = [];
    if (!collection || !Array.isArray(collection.features)) return out;
    for (var i = 0; i < collection.features.length; i += 1) {
      var f = collection.features[i];
      var g = f && f.geometry;
      if (!g) continue;
      var polys = null;
      if (g.type === "Polygon") polys = [g.coordinates];
      else if (g.type === "MultiPolygon") polys = g.coordinates;
      else continue;

      var parts = [];
      for (var p = 0; p < polys.length; p += 1) {
        var rings = polys[p];
        if (!rings || !rings.length) continue;
        var bbox = ringBBox(rings[0]);
        if (!bbox) continue;
        parts.push({ rings: rings, bbox: bbox });
      }
      if (!parts.length) continue;
      out.push({ properties: f.properties || {}, parts: parts, bbox: unionBBox(parts) });
    }
    return out;
  }

  function ringBBox(ring) {
    if (!ring || !ring.length) return null;
    var minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (var i = 0; i < ring.length; i += 1) {
      var lon = ring[i][0], lat = ring[i][1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return Number.isFinite(minLon) ? [minLon, minLat, maxLon, maxLat] : null;
  }

  function unionBBox(parts) {
    var b = null;
    for (var i = 0; i < parts.length; i += 1) {
      var c = parts[i].bbox;
      if (!b) { b = [c[0], c[1], c[2], c[3]]; continue; }
      if (c[0] < b[0]) b[0] = c[0];
      if (c[1] < b[1]) b[1] = c[1];
      if (c[2] > b[2]) b[2] = c[2];
      if (c[3] > b[3]) b[3] = c[3];
    }
    return b;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function normalizeLon(lon) {
    var x = (lon + 180) % 360;
    if (x < 0) x += 360;
    return x - 180;
  }

  function create(canvas, options) {
    var opts = options || {};
    var ctx = canvas.getContext("2d");
    var layers = { admin0: [], admin1: [], places: [] };
    var view = { centerLon: 10, centerLat: 25, scale: 1 };
    var highlight = { iso3: null, admin1Code: null };
    var marker = null;                 // { lon, lat }
    var cssWidth = 0, cssHeight = 0, dpr = 1;
    var frame = 0;
    var destroyed = false;

    var handlers = {
      select: typeof opts.onSelect === "function" ? opts.onSelect : function () {},
      viewChange: typeof opts.onViewChange === "function" ? opts.onViewChange : function () {}
    };

    /* ---- 投影 ---------------------------------------------------------- */

    /**
     * 最小缩放：让画布被地图填满，而不是上下留出两条海洋色空带。
     * 取宽高两个方向所需缩放的较大者 —— 较小的那个方向可以平移。
     */
    function minScale() {
      if (cssWidth <= 0 || cssHeight <= 0) return 1;
      return Math.max(cssWidth / 360, cssHeight / 180) * MIN_SCALE_FIT_MARGIN;
    }

    function lonToX(lon) {
      return (lon - view.centerLon) * view.scale + cssWidth / 2;
    }

    function latToY(lat) {
      return (view.centerLat - lat) * view.scale + cssHeight / 2;
    }

    function xToLon(x) {
      return view.centerLon + (x - cssWidth / 2) / view.scale;
    }

    function yToLat(y) {
      return view.centerLat - (y - cssHeight / 2) / view.scale;
    }

    /** 当前视口的经纬度范围（未做反经线拆分，仅用于粗筛） */
    function viewBounds() {
      return {
        west: xToLon(0),
        east: xToLon(cssWidth),
        south: yToLat(cssHeight),
        north: yToLat(0)
      };
    }

    function clampView() {
      var lo = minScale();
      view.scale = clamp(view.scale, lo, MAX_SCALE);
      // 纬度方向不允许露出上下极点之外的空白
      var halfLatSpan = cssHeight / 2 / view.scale;
      if (halfLatSpan >= 90) {
        view.centerLat = 0;
      } else {
        view.centerLat = clamp(view.centerLat, -90 + halfLatSpan, 90 - halfLatSpan);
      }
      view.centerLon = normalizeLon(view.centerLon);
    }

    /* ---- 绘制 ---------------------------------------------------------- */

    function schedule() {
      if (destroyed || frame) return;
      frame = window.requestAnimationFrame(function () {
        frame = 0;
        draw();
      });
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      cssWidth = Math.max(1, Math.round(rect.width));
      cssHeight = Math.max(1, Math.round(rect.height));
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      clampView();
      schedule();
    }

    /**
     * 画一个环。返回是否真的画了。
     *
     * 相邻两点在屏幕上不足 minStepPx 就跳过 —— 世界视图下这一步能把
     * 十万级坐标压到几千级，是纯矢量地图能流畅平移的关键。
     */
    function tracePolygon(rings, lonOffset, minStepPx) {
      for (var r = 0; r < rings.length; r += 1) {
        var ring = rings[r];
        if (!ring || ring.length < 4) continue;
        var lastX = NaN, lastY = NaN;
        var started = false;
        for (var i = 0; i < ring.length; i += 1) {
          var x = lonToX(ring[i][0] + lonOffset);
          var y = latToY(ring[i][1]);
          if (started) {
            var isLast = i === ring.length - 1;
            if (!isLast && Math.abs(x - lastX) < minStepPx && Math.abs(y - lastY) < minStepPx) continue;
            ctx.lineTo(x, y);
          } else {
            ctx.moveTo(x, y);
            started = true;
          }
          lastX = x;
          lastY = y;
        }
        if (started) ctx.closePath();
      }
    }

    /** 视口在经度方向可能横跨反经线，需要把要素在 -360 / 0 / +360 三处各试一次 */
    function lonOffsets() {
      var b = viewBounds();
      var offsets = [0];
      if (b.west < -180) offsets.push(-360);
      if (b.east > 180) offsets.push(360);
      return offsets;
    }

    function bboxVisible(bbox, lonOffset) {
      var b = viewBounds();
      return !(
        bbox[2] + lonOffset < b.west ||
        bbox[0] + lonOffset > b.east ||
        bbox[3] < b.south ||
        bbox[1] > b.north
      );
    }

    function drawLayer(features, fill, stroke, lineWidth, minStepPx, highlightTest) {
      var offsets = lonOffsets();
      for (var i = 0; i < features.length; i += 1) {
        var feature = features[i];
        var isHighlighted = highlightTest ? highlightTest(feature.properties) : false;
        for (var o = 0; o < offsets.length; o += 1) {
          var off = offsets[o];
          if (!bboxVisible(feature.bbox, off)) continue;
          ctx.beginPath();
          for (var p = 0; p < feature.parts.length; p += 1) {
            if (!bboxVisible(feature.parts[p].bbox, off)) continue;
            tracePolygon(feature.parts[p].rings, off, minStepPx);
          }
          // 高亮要素一定要填充，即使这一层平时只描边（省/州层就是这样）——
          // 否则「选中的是哪个省」在地图上完全看不出来，只有一条稍粗的线。
          if (isHighlighted) {
            ctx.fillStyle = COLORS.highlightFill;
            ctx.fill("evenodd");
          } else if (fill) {
            ctx.fillStyle = fill;
            ctx.fill("evenodd");
          }
          if (stroke) {
            ctx.strokeStyle = isHighlighted ? COLORS.highlightStroke : stroke;
            ctx.lineWidth = isHighlighted ? Math.max(lineWidth, 1.8) : lineWidth;
            ctx.stroke();
          }
        }
      }
    }

    function drawGraticule() {
      var b = viewBounds();
      var step = view.scale > 12 ? 5 : view.scale > 4 ? 10 : 30;
      ctx.beginPath();
      for (var lat = -90; lat <= 90; lat += step) {
        if (lat < b.south - step || lat > b.north + step) continue;
        var y = latToY(lat);
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
      }
      var startLon = Math.floor(b.west / step) * step;
      for (var lon = startLon; lon <= b.east + step; lon += step) {
        var x = lonToX(lon);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssHeight);
      }
      ctx.strokeStyle = COLORS.graticule;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function drawPlaces() {
      if (view.scale < PLACES_MIN_SCALE || !layers.places.length) return;
      // 缩放越大放越多城市；scalerank 越小的城市越重要
      var maxRank = view.scale > 12 ? 5 : view.scale > 5 ? 3 : 1;
      var b = viewBounds();
      var drawn = 0;
      ctx.font = "500 11px Inter, system-ui, sans-serif";
      ctx.textBaseline = "middle";

      // 贪心避让：已放下的标签占住矩形，后来的标签与之相交就整条跳过。
      // layers.places 按 scalerank 排过序，所以先到先得的正好是更重要的城市。
      // 不做这一步的话，世界视图下北美和东亚会糊成一团谁也读不出来。
      var placed = [];
      function collides(box) {
        for (var k = 0; k < placed.length; k += 1) {
          var p = placed[k];
          if (box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1]) return true;
        }
        return false;
      }

      for (var i = 0; i < layers.places.length && drawn < MAX_LABELS; i += 1) {
        var pl = layers.places[i];
        if (pl.rank > maxRank) continue;
        if (pl.lat < b.south || pl.lat > b.north) continue;
        var lon = pl.lon;
        if (lon < b.west) lon += 360;
        if (lon > b.east) lon -= 360;
        if (lon < b.west || lon > b.east) continue;
        var x = lonToX(lon);
        var y = latToY(pl.lat);
        var w = ctx.measureText(pl.label).width;
        var box = [x - 3, y - 7, x + 6 + w, y + 7];
        if (collides(box)) continue;
        placed.push(box);

        ctx.fillStyle = COLORS.place;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        // 描白边再填字：标签压在陆地和海洋交界上时仍然读得出来
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.strokeText(pl.label, x + 5, y);
        ctx.fillStyle = COLORS.placeLabel;
        ctx.fillText(pl.label, x + 5, y);
        drawn += 1;
      }
    }

    function drawMarker() {
      if (!marker) return;
      var b = viewBounds();
      var lon = marker.lon;
      if (lon < b.west) lon += 360;
      if (lon > b.east) lon -= 360;
      var x = lonToX(lon);
      var y = latToY(marker.lat);
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.markerHalo;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.marker;
      ctx.fill();
    }

    function draw() {
      if (destroyed || !ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = COLORS.ocean;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      drawGraticule();

      var step = view.scale > 20 ? 0.35 : 0.6;
      drawLayer(layers.admin0, COLORS.land, COLORS.landStroke, 0.9, step, function (p) {
        return !!highlight.iso3 && p.iso3 === highlight.iso3 && !highlight.admin1Code;
      });

      if (view.scale >= ADMIN1_MIN_SCALE && layers.admin1.length) {
        drawLayer(layers.admin1, null, COLORS.admin1Stroke, 0.7, step, function (p) {
          return (
            !!highlight.admin1Code &&
            p.admin1_code === highlight.admin1Code &&
            p.country_iso3 === highlight.iso3
          );
        });
      }

      drawPlaces();
      drawMarker();
      handlers.viewChange({
        scale: view.scale,
        centerLon: view.centerLon,
        centerLat: view.centerLat,
        bounds: viewBounds()
      });
    }

    /* ---- 交互 ---------------------------------------------------------- */

    var pointers = new Map();
    var dragState = null;
    var pinchState = null;

    function localPoint(evt) {
      var rect = canvas.getBoundingClientRect();
      return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }

    function zoomAt(x, y, factor) {
      var lonBefore = xToLon(x);
      var latBefore = yToLat(y);
      view.scale = clamp(view.scale * factor, minScale(), MAX_SCALE);
      // 让缩放锚定在光标处：缩放后该点仍对应同一经纬度
      view.centerLon = lonBefore - (x - cssWidth / 2) / view.scale;
      view.centerLat = latBefore + (y - cssHeight / 2) / view.scale;
      clampView();
      schedule();
    }

    function onPointerDown(evt) {
      // setPointerCapture 在 pointerId 不对应活动指针时会抛 NotFoundError。
      // 捕获失败只是拖动可能在移出画布后断掉，不该让整个点选功能失效。
      try {
        if (canvas.setPointerCapture) canvas.setPointerCapture(evt.pointerId);
      } catch (error) {
        /* 忽略：没有指针捕获也能用 */
      }
      pointers.set(evt.pointerId, localPoint(evt));
      if (pointers.size === 1) {
        var p = pointers.get(evt.pointerId);
        dragState = { startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, moved: 0 };
      } else if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        pinchState = {
          distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          midX: (pts[0].x + pts[1].x) / 2,
          midY: (pts[0].y + pts[1].y) / 2
        };
        dragState = null;
      }
    }

    function onPointerMove(evt) {
      if (!pointers.has(evt.pointerId)) return;
      var p = localPoint(evt);
      pointers.set(evt.pointerId, p);

      if (pointers.size >= 2 && pinchState) {
        var pts = Array.from(pointers.values());
        var distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinchState.distance > 0 && distance > 0) {
          zoomAt(pinchState.midX, pinchState.midY, distance / pinchState.distance);
        }
        pinchState.distance = distance;
        pinchState.midX = (pts[0].x + pts[1].x) / 2;
        pinchState.midY = (pts[0].y + pts[1].y) / 2;
        return;
      }

      if (!dragState) return;
      var dx = p.x - dragState.lastX;
      var dy = p.y - dragState.lastY;
      dragState.moved += Math.abs(dx) + Math.abs(dy);
      dragState.lastX = p.x;
      dragState.lastY = p.y;
      view.centerLon -= dx / view.scale;
      view.centerLat += dy / view.scale;
      clampView();
      schedule();
    }

    function onPointerUp(evt) {
      var wasDrag = dragState;
      pointers.delete(evt.pointerId);
      if (pointers.size < 2) pinchState = null;
      if (!wasDrag) return;
      dragState = null;
      if (wasDrag.moved > DRAG_THRESHOLD_PX) return;   // 是拖动，不是点选
      var p = localPoint(evt);
      emitSelect(xToLon(p.x), yToLat(p.y));
    }

    function onWheel(evt) {
      evt.preventDefault();
      var p = localPoint(evt);
      // deltaMode 0 = 像素，1 = 行；不同浏览器/触控板差异很大，这里只取方向和量级
      var unit = evt.deltaMode === 1 ? 16 : 1;
      var factor = Math.exp((-evt.deltaY * unit) / 320);
      zoomAt(p.x, p.y, factor);
    }

    function onKeyDown(evt) {
      var panPx = evt.shiftKey ? 120 : 40;
      var handled = true;
      switch (evt.key) {
        case "ArrowLeft": view.centerLon -= panPx / view.scale; break;
        case "ArrowRight": view.centerLon += panPx / view.scale; break;
        case "ArrowUp": view.centerLat += panPx / view.scale; break;
        case "ArrowDown": view.centerLat -= panPx / view.scale; break;
        case "+":
        case "=": zoomAt(cssWidth / 2, cssHeight / 2, 1.3); return;
        case "-":
        case "_": zoomAt(cssWidth / 2, cssHeight / 2, 1 / 1.3); return;
        case "Enter":
        case " ":
          emitSelect(view.centerLon, view.centerLat);
          evt.preventDefault();
          return;
        default: handled = false;
      }
      if (!handled) return;
      evt.preventDefault();
      clampView();
      schedule();
    }

    function emitSelect(lon, lat) {
      var normLat = clamp(lat, -90, 90);
      var normLon = normalizeLon(lon);
      marker = { lon: normLon, lat: normLat };
      schedule();
      handlers.select({ lon: normLon, lat: normLat });
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);

    var resizeObserver = null;
    if (typeof window.ResizeObserver === "function") {
      resizeObserver = new window.ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener("resize", resize);
    }
    resize();

    /* ---- 对外接口 ------------------------------------------------------ */

    return {
      setAdmin0: function (collection) {
        layers.admin0 = prepareLayer(collection);
        schedule();
      },
      setAdmin1: function (collection) {
        layers.admin1 = prepareLayer(collection);
        schedule();
      },
      setPlaces: function (collection) {
        var out = [];
        if (collection && Array.isArray(collection.features)) {
          for (var i = 0; i < collection.features.length; i += 1) {
            var f = collection.features[i];
            if (!f.geometry || f.geometry.type !== "Point") continue;
            var p = f.properties || {};
            out.push({
              lon: f.geometry.coordinates[0],
              lat: f.geometry.coordinates[1],
              rank: typeof p.scalerank === "number" ? p.scalerank : 99,
              label: p.name_en || p.name_zh || "",
              labels: { en: p.name_en || "", zh: p.name_zh || p.name_en || "" }
            });
          }
          out.sort(function (a, b) { return a.rank - b.rank; });
        }
        layers.places = out;
        schedule();
      },
      /** 切换城市标签语言。地图上是唯一有独立文案的地方，跟随全局语言。 */
      setLocale: function (locale) {
        for (var i = 0; i < layers.places.length; i += 1) {
          var pl = layers.places[i];
          pl.label = (locale === "zh" ? pl.labels.zh : pl.labels.en) || pl.labels.en;
        }
        schedule();
      },
      setHighlight: function (next) {
        highlight = { iso3: (next && next.iso3) || null, admin1Code: (next && next.admin1Code) || null };
        schedule();
      },
      setMarker: function (lon, lat) {
        marker = lon == null || lat == null ? null : { lon: normalizeLon(lon), lat: clamp(lat, -90, 90) };
        schedule();
      },
      /** 把视口移到给定经纬度；scale 省略时保持当前缩放 */
      flyTo: function (lon, lat, scale) {
        view.centerLon = normalizeLon(lon);
        view.centerLat = lat;
        if (typeof scale === "number") view.scale = scale;
        clampView();
        schedule();
      },
      zoomBy: function (factor) {
        zoomAt(cssWidth / 2, cssHeight / 2, factor);
      },
      getView: function () {
        return { scale: view.scale, centerLon: view.centerLon, centerLat: view.centerLat, bounds: viewBounds() };
      },
      resize: resize,
      destroy: function () {
        destroyed = true;
        if (frame) window.cancelAnimationFrame(frame);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("keydown", onKeyDown);
        if (resizeObserver) resizeObserver.disconnect();
        else window.removeEventListener("resize", resize);
      }
    };
  }

  window.ClimateMap = { create: create, ADMIN1_MIN_SCALE: ADMIN1_MIN_SCALE };
})();
