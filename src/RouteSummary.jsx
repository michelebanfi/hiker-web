// src/RouteSummaryCard.jsx
import React from "react";
import "./RouteSummaryCard.css";
import ElevationProfileChart from "./ElevationProfileChart";

// --- Helper Functions ---

// Format duration (seconds) into HH:MM:SS or similar
const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return "N/A";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  let formatted = "";
  if (hours > 0) {
    formatted += `${hours}h `;
  }
  formatted += `${minutes.toString().padStart(2, "0")}min`;
  return formatted;
};

// Format distance (meters) into km or miles
const formatDistance = (meters) => {
  if (meters === null || meters === undefined) return "N/A";
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const kilometers = meters / 1000;
  return `${kilometers.toFixed(1)} km`;
};

// Format elevation (meters)
const formatElevation = (meters) => {
  if (meters === null || meters === undefined) return "N/A";
  return `${Math.round(meters)} m`;
};

// Surface type dictionary
const SURFACE_TYPES = {
  0: "Unknown",
  1: "Paved",
  2: "Unpaved",
  3: "Asphalt",
  4: "Concrete",
  5: "Cobblestone",
  6: "Metal",
  7: "Wood",
  8: "Compacted Gravel",
  9: "Fine Gravel",
  10: "Gravel",
  11: "Dirt",
  12: "Ground",
  13: "Ice",
  14: "Paving Stones",
  15: "Sand",
  16: "Woodchips",
  17: "Grass",
  18: "Grass Paver",
};

// Waytype dictionary
const WAYTYPE_TYPES = {
  0: "Unknown",
  1: "State Road",
  2: "Road",
  3: "Street",
  4: "Path",
  5: "Track",
  6: "Cycleway",
  7: "Footway",
  8: "Steps",
  9: "Ferry",
  10: "Construction",
};

// Trail difficulty dictionary
const TRAIL_DIFFICULTY = {
  foot: {
    0: "No tag",
    1: "Hiking (T1)",
    2: "Mountain hiking (T2)",
    3: "Demanding mountain hiking (T3)",
    4: "Alpine hiking (T4)",
    5: "Demanding alpine hiking (T5)",
    6: "Difficult alpine hiking (T6)",
  },
  cycling: {
    0: "No tag",
    1: "MTB: Easy (S0)",
    2: "MTB: Medium (S1)",
    3: "MTB: Difficult (S2)",
    4: "MTB: Very difficult (S3)",
    5: "MTB: Extremely difficult (S4)",
    6: "MTB: Trials (S5)",
    7: "MTB: Insane (S6)",
  },
};

// --- Color Mapping for Surfaces/Waytypes (Updated with numeric keys) ---
const SURFACE_COLORS = {
  0: "#A9A9A9", // Unknown - gray
  1: "#708090", // Paved - slate gray
  2: "#8B4513", // Unpaved - brown
  3: "#686de0", // Asphalt - blueish (from original)
  4: "#B0C4DE", // Concrete - light gray blue
  5: "#a4b0be", // Cobblestone - grey (from original)
  6: "#C0C0C0", // Metal - silver
  7: "#a0522d", // Wood - wood (from original)
  8: "#B8860B", // Compacted Gravel - dark goldenrod
  9: "#D2B48C", // Fine Gravel - tan
  10: "#ccae62", // Gravel - gravel (from original)
  11: "#8c6c3f", // Dirt - brown (from original)
  12: "#8c6c3f", // Ground - brown (from original)
  13: "#E0FFFF", // Ice - light cyan
  14: "#a4b0be", // Paving Stones - grey (from original)
  15: "#f1d780", // Sand - sand (from original)
  16: "#D2691E", // Woodchips - chocolate
  17: "#4caf50", // Grass - green (from original)
  18: "#9ACD32", // Grass Paver - yellow green
  default: "#cccccc", // Fallback color
};

const WAYTYPE_COLORS = {
  0: "#A9A9A9", // Unknown - gray
  1: "#1E90FF", // State Road - dodger blue
  2: "#4169E1", // Road - royal blue
  3: "#6495ED", // Street - cornflower blue
  4: "#FFA500", // Path - orange
  5: "#DAA520", // Track - goldenrod
  6: "#32CD32", // Cycleway - lime green
  7: "#8B4513", // Footway - saddle brown
  8: "#708090", // Steps - slate gray
  9: "#00BFFF", // Ferry - deep sky blue
  10: "#FF6347", // Construction - tomato
  default: "#cccccc", // Fallback color
};

// Helper function to get surface type name
const getSurfaceType = (value) => {
  return SURFACE_TYPES[value] || "Unknown";
};

// Helper function to get waytype name
const getWaytypeName = (value) => {
  return WAYTYPE_TYPES[value] || "Unknown";
};

// Helper function to get trail difficulty description
const getTrailDifficultyName = (value, profile) => {
  const profileType = profile.startsWith("foot") ? "foot" : "cycling";
  const difficultyDict = TRAIL_DIFFICULTY[profileType];
  return difficultyDict ? difficultyDict[value] || "Unknown" : "Unknown";
};

// Helper function to find the maximum trail difficulty
const getMaxTrailDifficulty = (difficulties) => {
  if (!difficulties || !difficulties.length) return null;

  // Find the maximum difficulty value
  let maxDifficulty = 0;
  difficulties.forEach((item) => {
    const val = parseInt(item.value);
    if (val > maxDifficulty) maxDifficulty = val;
  });

  return maxDifficulty;
};

// --- Breakdown Bar Component ---
const BreakdownBar = ({ title, data, colorMap, typeNameFn }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="breakdown">
      <span className="breakdown-title">{title}:</span>
      <div className="breakdown-bar">
        {data.map((item) => {
          const percentage = parseFloat(item.amount);
          const value = parseInt(item.value);
          const color = colorMap[value] || colorMap.default;
          const typeName = typeNameFn(value);

          // Tooltip shows details on hover
          const tooltip = `${typeName}: ${formatDistance(
            item.distance
          )} (${percentage.toFixed(1)}%)`;

          return (
            <div
              key={value}
              className="bar-segment"
              style={{ width: `${percentage}%`, backgroundColor: color }}
              title={tooltip}
            />
          );
        })}
      </div>
      <div className="breakdown-legend">
        {data.map((item) => {
          const percentage = parseFloat(item.amount);
          if (percentage < 5) return null; // Only show significant segments
          const value = parseInt(item.value);
          const color = colorMap[value] || colorMap.default;
          const typeName = typeNameFn(value);

          return (
            <div key={value} className="legend-item">
              <span className="color-box" style={{ backgroundColor: color }} />
              <span className="legend-text">
                {typeName} ({percentage.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Main Summary Card Component ---
function RouteSummaryCard({ summary, profile }) {
  if (!summary) return null;

  // Find maximum trail difficulty (if available)
  const maxTrailDifficulty =
    summary.traildifficulty && summary.traildifficulty.length > 0
      ? getMaxTrailDifficulty(summary.traildifficulty)
      : null;

  // Determine if we should show trail difficulty based on profile
  const showTrailDifficulty =
    (profile.startsWith("foot") || profile.startsWith("cycling")) &&
    maxTrailDifficulty;

  return (
    <div className="route-summary-card">
      {/* Top Row: Main Stats */}
      <div className="summary-stats">
        <div className="stat-item">
          <span className="label">Time</span>
          <span className="value">{formatDuration(summary.duration)}</span>
        </div>
        <div className="stat-item">
          <span className="label">Distance</span>
          <span className="value">{formatDistance(summary.distance)}</span>
        </div>
        <div className="stat-item">
          <span className="label">Ascent</span>
          <span className="value">{formatElevation(summary.ascent)} ↑</span>
        </div>
        <div className="stat-item">
          <span className="label">Descent</span>
          <span className="value">{formatElevation(summary.descent)} ↓</span>
        </div>
        {showTrailDifficulty && (
          <div className="stat-item difficulty-item">
            <span className="label">Max Difficulty</span>
            <span className="value difficulty-value">
              {getTrailDifficultyName(maxTrailDifficulty, profile)}
            </span>
          </div>
        )}
      </div>

      {summary.coordinates && summary.coordinates.length > 0 && (
        <div className="elevation-profile-container">
          <ElevationProfileChart coordinates={summary.coordinates} />
        </div>
      )}

      {/* Bottom Row: Breakdown Bars */}
      <div className="summary-breakdowns">
        {summary.surface && summary.surface.length > 0 && (
          <BreakdownBar
            title="Surfaces"
            data={summary.surface}
            colorMap={SURFACE_COLORS}
            typeNameFn={getSurfaceType}
          />
        )}

        {summary.waytype && summary.waytype.length > 0 && (
          <BreakdownBar
            title="Way Types"
            data={summary.waytype}
            colorMap={WAYTYPE_COLORS}
            typeNameFn={getWaytypeName}
          />
        )}

        {/* Trail difficulty breakdown could be added here if needed */}
      </div>
    </div>
  );
}

export default RouteSummaryCard;
