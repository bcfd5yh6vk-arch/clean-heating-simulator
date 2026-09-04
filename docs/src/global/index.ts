export * from "./types";
export * from "./homeFeasibility";
export * from "./screening";
export * from "./feedback";
export * from "../technologies/loadTechnologyCatalog";

/* §G1 地图选点：点在哪个国家/省州/气候区。不含任何气候数值。 */
export * from "./geo/pointInPolygon";
export * from "./geo/boundaryIndex";
export * from "./geo/koppenGrid";
export * from "./geo/resolveLocation";
export * from "./natureEducation";

/* 四维打分引擎（§7.5–§7.10）。旧五维 scoreAndSort 已按规格移除。 */
export * from "../scoring";
export * from "../scoring/config";
export * from "../scoring/dataPoint";
export * from "../scoring/derived";
export * from "../scoring/affordability";
export * from "../scoring/climate";
export * from "../scoring/environment";
export * from "../scoring/practicality";
export * from "../scoring/fitness";
export * from "../scoring/carriers";
