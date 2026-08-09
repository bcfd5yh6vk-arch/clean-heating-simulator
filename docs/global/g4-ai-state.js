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
    usesInlinePanelOnly,
  };
});
