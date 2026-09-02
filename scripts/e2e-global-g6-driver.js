/**
 * Global 流程页内 E2E 驱动（浏览器里跑，不是 node 脚本）。
 *
 * 用途：headless 冒烟 Global 主流程 G1→G3→G4→G6，配合 browser-eyes/playwright：
 *   1. 静态起服（仓库根）：python -m http.server 4173
 *   2. 打开 /docs/global/index.html?lang=en 后在页面里执行：
 *      fetch("/scripts/e2e-global-g6-driver.js").then(r=>r.text()).then(t=>(0,eval)(t))
 *   3. 轮询 window.__e2eResult（"done" / 错误串），console 里看 [E2E] 日志。
 *
 * 地图点选：map.js 以 pointerdown+pointerup（位移≤阈值）判定点选，
 * 这里对画布按网格扫描合成事件，直到命中美国某州（美国数据全量可算）。
 */
window.__e2eResult = "running";
window.__e2e = (async () => {
  const log = (...a) => console.log("[E2E]", ...a);
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  try {
    // ---- 1) G1：网格扫描点选美国 ----
    const canvas = document.querySelector("#g1Panel canvas") || document.querySelector("canvas");
    if (!canvas) throw new Error("map canvas not found");
    const tap = (cx, cy) => {
      const opts = { bubbles: true, cancelable: true, pointerId: 7, pointerType: "mouse", isPrimary: true, clientX: cx, clientY: cy, button: 0, buttons: 1 };
      canvas.dispatchEvent(new PointerEvent("pointerdown", opts));
      canvas.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0 }));
    };
    let hit = null;
    outer: for (let fy = 0.22; fy <= 0.48; fy += 0.03) {
      for (let fx = 0.14; fx <= 0.42; fx += 0.02) {
        const r = canvas.getBoundingClientRect();
        tap(r.left + r.width * fx, r.top + r.height * fy);
        await sleep(25);
        const geo = window.G1Location.getResolution();
        if (window.G1Location.hasLocation() && geo && geo.country_iso3 === "USA" && geo.admin1_code) {
          hit = geo;
          break outer;
        }
      }
    }
    if (!hit) throw new Error("map scan never hit a US state");
    log("G1 hit:", hit.admin1_code, hit.admin1_name_en);
    await sleep(400); // 让气候卡渲染

    // ---- 2) G2 ----
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (!el) throw new Error("missing #" + id);
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("g2Income", 60000);
    set("g2FloorArea", 120);
    set("g2HeatingSpend", 900);
    set("g2CoolingSpend", 300);

    // ---- 3) G3：一套能产生可排名结果的答案 ----
    const pick = (name, value) => {
      const el = document.querySelector(`[name="${name}"][value="${value}"]`);
      if (!el) throw new Error(`missing option ${name}=${value}`);
      el.checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    pick("housing_status", "owner");
    pick("building_type", "detached");
    pick("renovation_tolerance", "major");
    pick("outdoor_space", "large_private_land");
    pick("current_energy_services", "electricity");
    pick("current_energy_services", "piped_gas");
    pick("current_heating_methods", "piped_gas_heating");
    pick("current_cooling_methods", "room_air_conditioning");
    pick("upfront_cost_preference", "moderate_investment");
    document.getElementById("submitG3").click();

    // ---- 4) 等 G4 出分 ----
    let shared = null;
    for (let i = 0; i < 80; i += 1) {
      await sleep(250);
      shared = window.buildSharedAiInput();
      if (shared.rankedPaths && shared.rankedPaths.length) break;
    }
    if (!shared || !shared.rankedPaths.length) throw new Error("scoring produced no ranked paths");
    const top = shared.rankedPaths[0];
    log("G4 top:", top.display_name_en, "fitness", top.fitness, "estimates", JSON.stringify(top.estimates));
    log("RLPD:", JSON.stringify(shared.relevantLocalPublicData));
    if (!shared.relevantLocalPublicData.length) throw new Error("relevantLocalPublicData empty for a US state");

    // ---- 5) G6 ----
    const saveBtn = document.getElementById("saveSummaryButton");
    if (saveBtn.classList.contains("hidden")) throw new Error("saveSummaryButton hidden after rankable scoring");
    saveBtn.click();
    await sleep(400);
    if (document.getElementById("g6Panel").classList.contains("hidden")) throw new Error("g6Panel still hidden");
    if (!document.getElementById("g6CardNode")) throw new Error("g6 card not rendered");
    // PNG 导出路径（headless 下 toBlob 可用；下载本身不校验落盘）
    document.getElementById("g6Download").click();
    await sleep(1200);
    log("g6 status:", document.getElementById("g6Status").textContent);

    window.__e2eResult = "done";
    log("DONE");
  } catch (error) {
    window.__e2eResult = "FAIL: " + (error && error.message ? error.message : String(error));
    log(window.__e2eResult);
  }
})();
