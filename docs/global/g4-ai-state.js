(function initG4AiState(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.G4AI = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createG4AiState() {
  const MODES = {
    selectedPath: "selected_path_explanation",
    householdReport: "household_analysis_report",
  };

  function normalizeLocale(locale) {
    return String(locale || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  function getInitialSelectedPathId(rankedPaths) {
    return rankedPaths && rankedPaths.length ? rankedPaths[0].path_id : null;
  }

  function getSelectedPath(rankedPaths, selectedPathId) {
    if (!rankedPaths || !rankedPaths.length) return null;
    return rankedPaths.find((path) => path.path_id === selectedPathId) || rankedPaths[0] || null;
  }

  function selectRankedPath(currentRankedPaths, clickedPathId) {
    return getSelectedPath(currentRankedPaths, clickedPathId)?.path_id || getInitialSelectedPathId(currentRankedPaths);
  }

  function compactRankedPath(path) {
    return {
      rank: path.rank,
      path_id: path.path_id,
      path_name: path.path_name,
      fitness: path.fitness,
      dimensions: path.dimensions,
      key_estimates: path.estimates,
      score_coverage: path.score_coverage,
      warnings: path.warnings || [],
    };
  }

  function nearbyRankedPaths(rankedPaths, selectedPathId) {
    const selectedIndex = rankedPaths.findIndex((path) => path.path_id === selectedPathId);
    if (selectedIndex < 0) return rankedPaths.slice(0, 3).map(compactRankedPath);
    return rankedPaths
      .slice(Math.max(0, selectedIndex - 1), selectedIndex + 2)
      .map(compactRankedPath);
  }

  function collectTechCards(paths, limit) {
    const seen = new Set();
    const cards = [];
    paths.forEach((path) => {
      (path.tech_cards || []).forEach((card) => {
        if (!seen.has(card.tech_id) && cards.length < limit) {
          seen.add(card.tech_id);
          cards.push({
            tech_id: card.tech_id,
            display_name: card.display_name,
            services: card.services || [],
            note: card.note || "",
          });
        }
      });
    });
    return cards;
  }

  function buildSelectedPathExplanationRequest(input) {
    const rankedPaths = input.rankedPaths || [];
    const selectedPath = getSelectedPath(rankedPaths, input.selectedPathId);
    if (!selectedPath) return null;
    return {
      mode: MODES.selectedPath,
      locale: normalizeLocale(input.locale),
      context: {
        region_summary: input.regionSummary || {},
        climate_summary: input.climateSummary || {},
        household_summary: input.householdSummary || {},
        home_feasibility_summary: input.homeFeasibilitySummary || {},
        baseline_summary: input.baselineSummary || {},
        selected_path: selectedPath,
        nearby_ranked_paths: nearbyRankedPaths(rankedPaths, selectedPath.path_id),
        relevant_tech_cards: collectTechCards([selectedPath], 4),
      },
    };
  }

  function buildHouseholdAnalysisReportRequest(input) {
    const rankedPaths = input.rankedPaths || [];
    if (!rankedPaths.length) return null;
    return {
      mode: MODES.householdReport,
      locale: normalizeLocale(input.locale),
      context: {
        region_summary: input.regionSummary || {},
        climate_summary: input.climateSummary || {},
        household_summary: input.householdSummary || {},
        home_feasibility_summary: input.homeFeasibilitySummary || {},
        baseline_summary: input.baselineSummary || {},
        selected_path_id: input.selectedPathId || getInitialSelectedPathId(rankedPaths),
        ranked_paths: rankedPaths.slice(0, 12).map(compactRankedPath),
        excluded_paths: (input.excludedPaths || []).map((item) => ({
          path_name: item.path_name,
          reason: item.reason,
        })),
        relevant_local_public_data: input.relevantLocalPublicData || [],
        relevant_tech_cards: collectTechCards(rankedPaths.slice(0, 3), 8),
      },
    };
  }

  function createIdleAiAnalysisState() {
    return {
      mode: null,
      status: "idle",
      content: "",
      error: "",
      targetPathId: null,
      targetPathName: "",
      scoringInputHash: null,
    };
  }

  function resetAIAnalysis(previous) {
    return {
      ...createIdleAiAnalysisState(),
      scoringInputHash: previous && previous.scoringInputHash != null ? previous.scoringInputHash : null,
    };
  }

  function buildScoringInputHash(parts) {
    return JSON.stringify(parts || {});
  }

  function shouldShowPathMismatchHint(aiAnalysis, selectedPathId) {
    if (!aiAnalysis || aiAnalysis.mode !== MODES.selectedPath) return false;
    if (aiAnalysis.status !== "success") return false;
    if (!aiAnalysis.targetPathId || !selectedPathId) return false;
    return aiAnalysis.targetPathId !== selectedPathId;
  }

  /**
   * §3.4 的临时处置（CS-DECISIONS D14）：辅助措施尚无「降低有用负荷」的公开口径，
   * 会出现只差辅助措施、四维与综合分完全相同的成对路径。展示层把主技术相同且
   * 四维+综合分完全一致的路径合并为一行（代表 = 组内 rank 最小者，即引擎并列
   * 次序的赢家），其余作为同分变体列名。只影响 G4 列表：引擎输出、
   * G6（rankedPaths[0]）与 AI 上下文仍是全量路径。
   */
  function groupRankedPathsForDisplay(rankedPaths) {
    const groups = [];
    const byKey = new Map();
    (rankedPaths || []).forEach((path) => {
      const d = path.dimensions || {};
      const key = [
        (path.primary_tech_ids || []).join("+"), path.fitness,
        d.affordability, d.climate_resilience, d.environment, d.practicality,
      ].join("|");
      const group = byKey.get(key);
      if (!group) {
        const fresh = { representative: path, variants: [] };
        byKey.set(key, fresh);
        groups.push(fresh);
      } else if (path.rank != null && (group.representative.rank == null || path.rank < group.representative.rank)) {
        group.variants.push(group.representative);
        group.representative = path;
      } else {
        group.variants.push(path);
      }
    });
    return groups;
  }

  function usesInlinePanelOnly() {
    return true;
  }

  return {
    MODES,
    normalizeLocale,
    getInitialSelectedPathId,
    getSelectedPath,
    selectRankedPath,
    buildSelectedPathExplanationRequest,
    buildHouseholdAnalysisReportRequest,
    createIdleAiAnalysisState,
    resetAIAnalysis,
    buildScoringInputHash,
    shouldShowPathMismatchHint,
    groupRankedPathsForDisplay,
    usesInlinePanelOnly,
  };
});
