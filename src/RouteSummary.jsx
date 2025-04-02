// src/RouteSummaryCard.jsx
import React from "react";
import "./RouteSummaryCard.css"; // We'll create this CSS file
import ElevationProfileChart from "./ElevationProfileChart"; // <<< Import

// --- Helper Functions ---

// Format duration (seconds) into HH:MM:SS or similar
const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return "N/A";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  // const secs = Math.floor(seconds % 60);

  let formatted = "";
  if (hours > 0) {
    formatted += `${hours}h `;
  }
  formatted += `${minutes.toString().padStart(2, "0")}min`;
  // Optional: add seconds if needed
  // formatted += `:${secs.toString().padStart(2, '0')}`;
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
  // To use miles:
  // const miles = meters / 1609.34;
  // return `${miles.toFixed(1)} mi`;
};

// Format elevation (meters)
const formatElevation = (meters) => {
  if (meters === null || meters === undefined) return "N/A";
  return `${Math.round(meters)} m`;
  // To use feet:
  // const feet = meters * 3.28084;
  // return `${Math.round(feet)} ft`;
};

// --- Color Mapping for Surfaces/Waytypes (Example) ---
// You can customize these colors
const SURFACE_COLORS = {
  paved: "#686de0", // Blueish
  asphalt: "#686de0",
  concrete: "#777",
  unpaved: "#f0932b", // Orange
  gravel: "#ccae62",
  compacted: "#d39c43",
  ground: "#8c6c3f", // Brown
  dirt: "#8c6c3f",
  grass: "#4caf50", // Green
  sand: "#f1d780",
  cobblestone: "#a4b0be", // Grey
  sett: "#a4b0be",
  metal: "#576574",
  wood: "#a0522d",
  // Add more as needed based on ORS possible values
  default: "#cccccc", // Fallback color
};

const WAYTYPE_COLORS = {
  road: "#686de0",
  street: "#747ae1",
  path: "#f0932b",
  track: "#ccae62",
  footway: "#d39c43",
  steps: "#a4b0be",
  cycleway: "#4caf50",
  bridleway: "#8c6c3f",
  // Add more
  default: "#cccccc",
};

// --- Breakdown Bar Component ---
const BreakdownBar = ({ title, data, totalDistance, colorMap }) => {
  if (!data || data.length === 0 || !totalDistance) return null;

  return (
    <div className="breakdown">
      <span className="breakdown-title">{title}:</span>
      <div className="breakdown-bar">
        {data.map((item) => {
          const percentage = (item.distance / totalDistance) * 100;
          const color = colorMap[item.value.toLowerCase()] || colorMap.default;
          // Tooltip shows details on hover
          const tooltip = `${item.value}: ${formatDistance(
            item.distance
          )} (${percentage.toFixed(1)}%)`;

          return (
            <div
              key={item.value}
              className="bar-segment"
              style={{ width: `${percentage}%`, backgroundColor: color }}
              title={tooltip}
            />
          );
        })}
      </div>
    </div>
  );
};

// --- Main Summary Card Component ---
function RouteSummaryCard({ summary, profile }) {
  if (!summary) return null;

  // Could add profile-specific icons later
  // const profileIcon = ...

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
      </div>

      {summary.coordinates && summary.coordinates.length > 0 && (
        <div className="elevation-profile-container">
          {" "}
          {/* Add a container */}
          <ElevationProfileChart coordinates={summary.coordinates} />
        </div>
      )}

      {/* Bottom Row: Breakdown Bars */}
      <div className="summary-breakdowns">
        {/* <BreakdownBar
          title="Way Types"
          data={summary.waytype}
          totalDistance={summary.distance}
          colorMap={WAYTYPE_COLORS}
        />
        <BreakdownBar
          title="Surfaces"
          data={summary.surface}
          totalDistance={summary.distance}
          colorMap={SURFACE_COLORS}
        /> */}
        {/* Add Trail Difficulty similarly if available and relevant */}
        {/*
        <BreakdownBar
            title="Difficulty"
            data={summary.traildifficulty}
            totalDistance={summary.distance}
            colorMap={TRAILDIFFICULTY_COLORS} // Define these colors
        />
        */}
      </div>
    </div>
  );
}

export default RouteSummaryCard;
