import React, { useState, useCallback } from "react";
import axios from "axios";
import MapComponent from "./mapComponent"; // Assuming MapComponent.jsx is in the same folder
import "./App.css"; // Or your main CSS file

// Load ORS API Key from environment
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;
const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions";

function App() {
  // State for routing
  const [startPoint, setStartPoint] = useState(null); // { lng, lat }
  const [endPoint, setEndPoint] = useState(null); // { lng, lat }
  const [profile, setProfile] = useState("driving-car"); // Default profile
  const [routeGeojson, setRouteGeojson] = useState(null); // GeoJSON data for the route
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showInputs, setShowInputs] = useState(false); // Toggle visibility of controls
  const [settingPointMode, setSettingPointMode] = useState(null); // 'start' or 'end'

  // --- Map Click Handler ---
  // useCallback ensures this function reference doesn't change on every render
  // unless its dependencies change, optimizing MapComponent rendering.
  const handleMapClick = useCallback(
    (coords) => {
      if (!showInputs) return; // Only set points if controls are visible

      console.log(
        `Map clicked at: ${coords.lng}, ${coords.lat}. Mode: ${settingPointMode}`
      );

      if (settingPointMode === "start") {
        setStartPoint(coords);
        setSettingPointMode("end"); // Automatically switch to setting the end point next
        console.log("Start point set:", coords);
      } else if (settingPointMode === "end") {
        setEndPoint(coords);
        setSettingPointMode(null); // Stop setting points after end point is set
        console.log("End point set:", coords);
      }
    },
    [showInputs, settingPointMode]
  ); // Recreate callback if showInputs or mode changes

  // --- Function to Fetch Route from ORS ---
  const fetchRoute = async () => {
    if (!startPoint || !endPoint) {
      setError("Please set both a start and an end point on the map.");
      return;
    }
    if (!ORS_API_KEY) {
      setError(
        "OpenRouteService API Key is missing. Check environment variables."
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setRouteGeojson(null); // Clear previous route

    // ORS expects coordinates in [longitude, latitude] format
    const coordinates = [
      [startPoint.lng, startPoint.lat],
      [endPoint.lng, endPoint.lat],
    ];

    try {
      console.log(`Fetching route for profile: ${profile}`, coordinates);
      const response = await axios.post(
        `${ORS_DIRECTIONS_URL}/${profile}/geojson`,
        { coordinates: coordinates },
        {
          headers: {
            Authorization: ORS_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("ORS Response:", response.data);
      setRouteGeojson(response.data); // Store the entire GeoJSON response
    } catch (err) {
      console.error("Error fetching route:", err);
      let message = "Failed to fetch route.";
      if (err.response) {
        console.error("Error Response Data:", err.response.data);
        message += ` Status: ${err.response.status}. ${
          err.response.data?.error?.message || ""
        }`;
      } else if (err.request) {
        message += " No response received from server.";
      } else {
        message += ` ${err.message}`;
      }
      setError(message);
      setRouteGeojson(null); // Clear potentially partial data
    } finally {
      setIsLoading(false);
    }
  };

  // --- Helper Function to Clear Route ---
  const clearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRouteGeojson(null);
    setError(null);
    setSettingPointMode(null); // Reset point setting mode
    // Keep showInputs as it is, user might want to plot a new route
  };

  return (
    // Ensure the main App container can act as a positioning context if needed
    <div className="App">
      {/* --- Route Card --- */}
      {/* We'll style this div using CSS */}
      <div className="route-card">
        {" "}
        {/* Renamed from control-panel */}
        {!showInputs ? (
          <button
            onClick={() => {
              setShowInputs(true);
              setSettingPointMode("start");
              clearRoute();
            }}
          >
            Get Directions 🗺️
          </button>
        ) : (
          <>
            <h3>Plan Route</h3>
            {/* Profile Selector */}
            <div>
              <label>Mode: </label>
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
              >
                <option value="driving-car">Car</option>
                <option value="cycling-road">Road Bike</option>
                <option value="cycling-mountain">Mountain Bike</option>
                <option value="foot-hiking">Foot (Hiking)</option>
              </select>
            </div>
            {/* Point Setting Buttons/Indicators */}
            <div>
              <button
                onClick={() => setSettingPointMode("start")}
                disabled={settingPointMode === "start"}
                title={
                  startPoint
                    ? `Start: ${startPoint.lng.toFixed(
                        4
                      )}, ${startPoint.lat.toFixed(4)}`
                    : "Click map to set start"
                }
              >
                {settingPointMode === "start"
                  ? "Click Map for Start"
                  : startPoint
                  ? "Start Set ✓"
                  : "Set Start Point"}
              </button>
              <button
                onClick={() => setSettingPointMode("end")}
                disabled={!startPoint || settingPointMode === "end"} // Disable if start not set or already setting end
                title={
                  endPoint
                    ? `End: ${endPoint.lng.toFixed(4)}, ${endPoint.lat.toFixed(
                        4
                      )}`
                    : "Click map to set end"
                }
              >
                {settingPointMode === "end"
                  ? "Click Map for End"
                  : endPoint
                  ? "End Set ✓"
                  : "Set End Point"}
              </button>
            </div>
            {settingPointMode && (
              <p>Click on the map to set the {settingPointMode} point.</p>
            )}
            {/* Action Buttons */}
            <div>
              {" "}
              {/* Optional: Wrap buttons for better layout control */}
              <button
                onClick={fetchRoute}
                disabled={!startPoint || !endPoint || isLoading}
              >
                {isLoading ? "Calculating..." : "Calculate Route"}
              </button>
              <button onClick={clearRoute} disabled={isLoading}>
                Clear
              </button>
              <button onClick={() => setShowInputs(false)}>
                Hide Controls
              </button>
            </div>

            {error && <p className="error-message">Error: {error}</p>}
          </>
        )}
      </div>

      {/* --- Map Component --- */}
      {/* MapComponent takes up the full space behind the card */}
      <MapComponent
        routeGeojson={routeGeojson}
        startPoint={startPoint}
        endPoint={endPoint}
        onMapClick={handleMapClick}
      />
    </div>
  );
}

export default App;
