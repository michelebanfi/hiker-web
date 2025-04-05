import React, { useState, useCallback } from "react";
import axios from "axios";
import MapComponent from "./mapComponent"; // Assuming MapComponent.jsx is in the same folder
import "./App.css"; // Or your main CSS file
import RouteSummaryCard from "./RouteSummary"; // Import the new component

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
  const [routeSummary, setRouteSummary] = useState(null); // <<< New state for summary data
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
    setRouteSummary(null); // Clear previous summary

    // ORS expects coordinates in [longitude, latitude] format
    const coordinates = [
      [startPoint.lng, startPoint.lat],
      [endPoint.lng, endPoint.lat],
    ];

    // --- Body for ORS request ---
    const requestBody = {
      coordinates: coordinates,
      // Request elevation and extra info
      elevation: "true", // Request elevation profile data
      extra_info: ["steepness", "surface", "waytype", "traildifficulty"], // Request details
      units: "m", // Use metric units (meters)
      // You might want instructions_format: "text" or "html" if displaying turn-by-turn
      // geometry_simplify: "true", // Optional: simplify geometry for performance
      // preference: "recommended", // or "shortest" etc. depending on profile
    };

    try {
      console.log(`Fetching route for profile: ${profile}`, coordinates);
      const response = await axios.post(
        `${ORS_DIRECTIONS_URL}/${profile}/geojson`,
        requestBody,
        {
          headers: {
            Authorization: ORS_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("ORS Response:", response.data);
      if (
        response.data &&
        response.data.features &&
        response.data.features.length > 0
      ) {
        const feature = response.data.features[0];
        setRouteGeojson(response.data); // Store the entire GeoJSON

        // --- Extract summary data ---
        if (feature.properties) {
          const properties = feature.properties;
          const summary = properties.summary; // { distance, duration, ascent, descent }
          const extras = properties.extras; // { surface: { values, summary }, waytype: {...}, ... }
          const segments = properties.segments; // Array of segments, might contain steps
          const ascent = properties.ascent || 0; // Total ascent in meters
          const descent = properties.descent || 0; // Total descent in meters

          // Basic structure for summary state
          const extractedSummary = {
            distance: summary?.distance, // in meters
            duration: summary?.duration, // in seconds
            ascent: ascent, // in meters
            descent: descent, // in meters
            surface: extras?.surface?.summary, // Array: [{ value: 'paved', distance: 123, amount: '20.5%'}, ...]
            waytype: extras?.waytypes?.summary,
            traildifficulty: extras?.traildifficulty?.summary,
            // You could also extract bounding box, segments etc. if needed
            // For elevation profile, you'd use feature.geometry.coordinates which now include elevation if elevation=true
            // Example: coordinate [lng, lat, elevation]
            coordinates: feature.geometry?.coordinates || [],
          };
          console.log("Extracted Summary:", extractedSummary);
          setRouteSummary(extractedSummary);
        } else {
          setError("Route found, but properties data is missing.");
          setRouteSummary(null);
        }
      } else {
        setError("No route features found in the response.");
        setRouteGeojson(null);
        setRouteSummary(null);
      }
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
      setRouteSummary(null); // Clear summary on error
    } finally {
      setIsLoading(false);
    }
  };

  // --- Helper Function to Clear Route ---
  const clearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRouteGeojson(null);
    setRouteSummary(null); // <<< Clear summary state
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
            style={{
              width: "36px",
              height: "36px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              borderRadius: "50%",
              backgroundColor: "transparent",
              border: "2px solid rgb(51, 51, 51)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              cursor: "pointer",
              padding: "0",
              outline: "none",
            }}
            title="Get Directions"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 512 512"
            >
              <path d="M491.31,324.69,432,265.37A31.8,31.8,0,0,0,409.37,256H272V224H416a32,32,0,0,0,32-32V96a32,32,0,0,0-32-32H272V48a16,16,0,0,0-32,0V64H102.63A31.8,31.8,0,0,0,80,73.37L20.69,132.69a16,16,0,0,0,0,22.62L80,214.63A31.8,31.8,0,0,0,102.63,224H240v32H96a32,32,0,0,0-32,32v96a32,32,0,0,0,32,32H240v48a16,16,0,0,0,32,0V416H409.37A31.8,31.8,0,0,0,432,406.63l59.31-59.32A16,16,0,0,0,491.31,324.69Z" />
            </svg>
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
            <div className="action-buttons">
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
      {/* --- Route Summary Card (Bottom Center) --- */}
      {/* Render only if we have summary data */}
      {routeSummary && (
        <RouteSummaryCard
          summary={routeSummary}
          profile={profile} // Pass profile for context if needed
        />
      )}
    </div>
  );
}

export default App;
