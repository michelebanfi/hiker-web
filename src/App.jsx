// src/MapComponent.jsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios"; // Import axios for RainViewer API call
import "mapbox-gl/dist/mapbox-gl.css";
import "./MapComponent.css"; // Import CSS for component-specific styles

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
if (MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
} else {
  console.error(
    "Mapbox Access Token is not set. Map functionality will be limited."
  );
}

// --- Constants for Map IDs ---
const ROUTE_SOURCE_ID = "route-source";
const ROUTE_LAYER_ID = "route-layer";
const RADAR_SOURCE_ID = "rainviewer-source";
const RADAR_LAYER_ID = "rainviewer-layer";
const RAINVIEWER_API_URL =
  "https://api.rainviewer.com/public/weather-maps.json";

// --- Helper to create styled marker elements ---
const createMarkerElement = (type) => {
  const el = document.createElement("div");
  el.className = `custom-marker marker-${type}`; // Use CSS classes

  // Set SVG based on type
  if (type === "start") {
    el.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512"><path fill="currentColor" d="M256 32C167.78 32 96 100.65 96 185c0 40.17 18.31 93.59 54.42 158.78 29 52.34 62.55 99.67 80 123.22a31.75 31.75 0 0 0 51.22 0c17.42-23.55 51-70.88 80-123.22C397.69 278.61 416 225.19 416 185 416 100.65 344.22 32 256 32Zm0 224a64 64 0 1 1 64-64 64.07 64.07 0 0 1-64 64Z"/></svg>
    `;
  } else if (type === "end") {
    el.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512"><path fill="currentColor" d="M80 480a16 16 0 0 1-16-16V68.13a24 24 0 0 1 11.9-20.72C88 40.38 112.38 32 160 32c37.21 0 78.83 14.71 115.55 27.68C305.12 70.13 333.05 80 352 80a183.84 183.84 0 0 0 71-14.5a18 18 0 0 1 25 16.58V301.44a20 20 0 0 1-12 18.31c-8.71 3.81-40.51 16.25-84 16.25-24.14 0-54.38-7.14-86.39-14.71C229.63 312.79 192.43 304 160 304c-36.87 0-55.74 5.58-64 9.11V464a16 16 0 0 1-16 16Z"/></svg>
    `;
  }
  return el;
};

function MapComponent({ routeGeojson, startPoint, endPoint, onMapClick }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isRadarActive, setIsRadarActive] = useState(false); // Renamed for clarity
  const [radarTimestamps, setRadarTimestamps] = useState([]); // Store available timestamps
  const [selectedTimestamp, setSelectedTimestamp] = useState(null); // Currently displayed timestamp
  const [radarError, setRadarError] = useState(null);

  // Initial map center/zoom (can be props or constants)
  const initialLng = 9.19;
  const initialLat = 45.46;
  const initialZoom = 9;

  // Use Ref for the callback to prevent map re-renders if the callback changes identity
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // --- Fetch RainViewer Timestamps ---
  useEffect(() => {
    const fetchTimestamps = async () => {
      try {
        setRadarError(null);
        const response = await axios.get(RAINVIEWER_API_URL);
        if (response.data && response.data.radar && response.data.radar.past) {
          // Combine past and nowcast, sort descending (newest first)
          const timestamps = [
            ...(response.data.radar.nowcast || []),
            ...(response.data.radar.past || []),
          ]
            .map((frame) => frame.time)
            .sort((a, b) => b - a);

          setRadarTimestamps(timestamps);
          // Set the latest timestamp as the default selected one
          if (timestamps.length > 0) {
            setSelectedTimestamp(timestamps[0]);
            console.log("RainViewer timestamps loaded. Latest:", timestamps[0]);
          } else {
            console.warn("No RainViewer timestamps found in API response.");
            setRadarError("No radar data available.");
          }
        } else {
          console.error(
            "Invalid RainViewer API response structure:",
            response.data
          );
          setRadarError("Failed to parse radar data.");
        }
      } catch (error) {
        console.error("Error fetching RainViewer timestamps:", error);
        setRadarError("Could not load weather data.");
        setRadarTimestamps([]);
        setSelectedTimestamp(null);
      }
    };

    fetchTimestamps();
  }, []); // Fetch only once on component mount

  // --- Initialize Map ---
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current || !MAPBOX_ACCESS_TOKEN)
      return; // Initialize map only once

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [initialLng, initialLat],
      zoom: initialZoom,
    });

    const map = mapRef.current;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const handleMapClickInternal = (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      }
    };
    map.on("click", handleMapClickInternal);

    map.on("load", () => {
      console.log("Map loaded");
      setMapLoaded(true);

      // Add empty route source and layer
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }, // Start empty
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "rgb(0,122,255)",
          "line-width": 5,
          "line-opacity": 0.9,
        },
      });

      // --- Prepare Radar Source (added on load, tiles updated later) ---
      map.addSource(RADAR_SOURCE_ID, {
        type: "raster",
        tiles: [], // Initialize with empty tiles
        tileSize: 512, // RainViewer uses 512px tiles
      });

      // --- Prepare Radar Layer (added on load, visibility toggled later) ---
      map.addLayer(
        {
          id: RADAR_LAYER_ID,
          type: "raster",
          source: RADAR_SOURCE_ID,
          paint: {
            "raster-opacity": 0.5, // Adjust opacity as needed
          },
          layout: {
            visibility: "none", // Initially hidden
          },
        },
        // Try to insert radar below labels, if possible. Adjust based on style.
        // Common layers: 'building', 'road-label', 'waterway-label'
        // Find a label layer in your style using map.getStyle().layers
        // Example: Find the first symbol layer to draw below it
        map.getStyle().layers.find((layer) => layer.type === "symbol")?.id ||
          ROUTE_LAYER_ID
      );

      console.log("Route and Radar sources/layers initialized.");
    });

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.off("click", handleMapClickInternal);
        mapRef.current.remove();
        mapRef.current = null;
        setMapLoaded(false);
        console.log("Map removed");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependencies intentionally empty to run only once

  // --- Update Route Layer ---
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource(ROUTE_SOURCE_ID);

    if (source) {
      const data = routeGeojson || { type: "FeatureCollection", features: [] };
      source.setData(data);
      // console.log("Route source updated:", data);

      // Fit bounds only if there's a valid route
      if (
        routeGeojson?.features?.[0]?.geometry?.coordinates?.length > 1 // Check for at least 2 points
      ) {
        try {
          const coordinates = routeGeojson.features[0].geometry.coordinates;
          const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
          }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

          map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
        } catch (e) {
          console.error("Error fitting map to route bounds:", e);
        }
      }
    } else {
      console.warn(`${ROUTE_SOURCE_ID} not found.`);
    }
  }, [routeGeojson, mapLoaded]);

  // --- Update Markers ---
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // Clear existing markers
    if (startMarkerRef.current) startMarkerRef.current.remove();
    if (endMarkerRef.current) endMarkerRef.current.remove();
    startMarkerRef.current = null;
    endMarkerRef.current = null;

    // Add Start Marker
    if (startPoint) {
      startMarkerRef.current = new mapboxgl.Marker({
        element: createMarkerElement("start"),
        anchor: "center", // Anchor to the center of the custom element
      })
        .setLngLat([startPoint.lng, startPoint.lat])
        .addTo(map);
    }

    // Add End Marker
    if (endPoint) {
      endMarkerRef.current = new mapboxgl.Marker({
        element: createMarkerElement("end"),
        anchor: "center",
      })
        .setLngLat([endPoint.lng, endPoint.lat])
        .addTo(map);
    }
  }, [startPoint, endPoint, mapLoaded]);

  // --- Manage Radar Layer Visibility and Tiles ---
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !selectedTimestamp) return;
    const map = mapRef.current;
    const source = map.getSource(RADAR_SOURCE_ID);

    if (!source) {
      console.warn(`${RADAR_SOURCE_ID} not ready yet.`);
      return;
    }

    if (isRadarActive && radarTimestamps.length > 0) {
      // Construct tile URL for the selected timestamp
      const tileUrl = `https://tilecache.rainviewer.com/v2/radar/${selectedTimestamp}/512/{z}/{x}/{y}/2/1_1.png`;

      // Update the source's tiles (Mapbox handles reloading)
      // Check if setTiles exists (added in later Mapbox versions)
      if (typeof source.setTiles === "function") {
        source.setTiles([tileUrl]);
      } else {
        // Fallback for older versions (might cause flicker)
        map.removeLayer(RADAR_LAYER_ID);
        map.removeSource(RADAR_SOURCE_ID);
        map.addSource(RADAR_SOURCE_ID, {
          type: "raster",
          tiles: [tileUrl],
          tileSize: 512,
        });
        map.addLayer(
          {
            id: RADAR_LAYER_ID,
            type: "raster",
            source: RADAR_SOURCE_ID,
            paint: { "raster-opacity": 0.5 },
            layout: { visibility: "visible" },
          },
          map.getStyle().layers.find((layer) => layer.type === "symbol")?.id ||
            ROUTE_LAYER_ID
        );
      }

      // Ensure layer is visible
      map.setLayoutProperty(RADAR_LAYER_ID, "visibility", "visible");
      console.log(`Radar active. Showing timestamp: ${selectedTimestamp}`);
    } else {
      // Hide the layer if radar is inactive or no timestamps
      map.setLayoutProperty(RADAR_LAYER_ID, "visibility", "none");
      console.log("Radar inactive or no data.");
    }
  }, [isRadarActive, selectedTimestamp, radarTimestamps, mapLoaded]); // Re-run when state changes

  // Toggle radar visibility
  const handleRadarToggle = () => {
    if (radarError) {
      alert(`Cannot show radar: ${radarError}`); // Simple feedback
      return;
    }
    if (radarTimestamps.length === 0 && !radarError) {
      alert(
        "Radar data is still loading or unavailable. Please try again shortly."
      );
      return;
    }
    setIsRadarActive((prev) => !prev);
  };

  // Callback ref for map container
  const setMapContainer = useCallback((node) => {
    mapContainerRef.current = node;
  }, []);

  // --- TODO: Add UI for selecting timestamp (e.g., slider) ---
  // This would update the `selectedTimestamp` state.

  return (
    <div className="map-container-wrapper">
      {" "}
      {/* Use CSS class */}
      <div ref={setMapContainer} className="map-container-inner" />{" "}
      {/* Use CSS class */}
      {/* Buttons Overlay - Use CSS classes */}
      <div className="map-overlay-buttons">
        <button
          onClick={handleRadarToggle}
          className={`map-control-button ${isRadarActive ? "active" : ""}`} // Add 'active' class
          aria-label="Toggle weather radar"
          title="Toggle weather radar"
          disabled={!selectedTimestamp && !radarError} // Disable if no data loaded yet (and no error)
        >
          {/* Cloud Icon SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 512 512"
          >
            <path
              d="M114.61 318.78a111.79 111.79 0 0 1-46-89.4C68.61 162.46 124.73 112 192 112c30.8 0 60.45 9.82 86.31 28.93a16 16 0 0 0 19.62.07C323.22 122.57 362.1 103.12 400 103.12c61.73 0 112 47.3 112 105.88 0 41.66-25.33 80.34-63.87 99.43a16 16 0 0 0-8.2 13.67c.27 67.83-54.1 117.35-119.28 117.35-41.37 0-78.86-19.77-100.91-51.73a16 16 0 0 0-24.23-4.88c-26.5 22.16-58.57 34.74-90.9 34.74-56.83 0-105.66-39.17-114.39-92.61a16 16 0 0 0-15-16.19Z"
              fill={isRadarActive ? "rgb(0,122,255)" : "currentColor"} // Dynamic fill based on state
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="32"
              style={{ fillOpacity: isRadarActive ? 1 : 0 }} // Use fill opacity for better effect
            />
          </svg>
        </button>
        {/* Add other overlay buttons here if needed */}
        {radarError && (
          <span className="radar-error-indicator" title={radarError}>
            ⚠️
          </span>
        )}
      </div>
      {/* Optional: Add a simple timestamp display or slider later */}
      {/* isRadarActive && selectedTimestamp && (
            <div className="timestamp-display">
                Radar Time: {new Date(selectedTimestamp * 1000).toLocaleString()}
            </div>
       )*/}
    </div>
  );
}

export default React.memo(MapComponent);
