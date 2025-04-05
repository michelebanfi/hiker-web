import React, { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios"; // Import Axios
import "mapbox-gl/dist/mapbox-gl.css";
// Location and Flag icons are handled via SVG now, so these imports might be removable
// import { Location, Flag } from "react-ionicons";

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// --- Constants for RainViewer ---
const RAINVIEWER_API_URL =
  "https://api.rainviewer.com/public/weather-maps.json";
const RADAR_SOURCE_ID = "rainviewer-source";
const RADAR_LAYER_ID = "rainviewer-layer";
const RADAR_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

function MapComponent({ routeGeojson, startPoint, endPoint, onMapClick }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isCloudActive, setIsCloudActive] = useState(false);

  // --- State for RainViewer ---
  const [radarFrames, setRadarFrames] = useState([]); // Array of available { path, time }
  const [currentRadarTimestamp, setCurrentRadarTimestamp] = useState(null);
  const [radarError, setRadarError] = useState(null);
  const radarIntervalRef = useRef(null); // Ref to store interval ID

  // Initial map center/zoom (can be kept or removed if map fits bounds later)
  const [initialLng] = useState(9.19);
  const [initialLat] = useState(45.46);
  const [initialZoom] = useState(9);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // --- Fetch RainViewer Data ---
  const fetchRainViewerData = useCallback(async () => {
    console.log("Fetching RainViewer data...");
    setRadarError(null);
    try {
      const response = await axios.get(RAINVIEWER_API_URL);
      if (response.data?.radar?.past?.length > 0) {
        const frames = response.data.radar.past;
        setRadarFrames(frames);
        // Set the latest timestamp (last in the 'past' array)
        const latestFrame = frames[frames.length - 1];
        setCurrentRadarTimestamp(latestFrame.time);
        console.log(
          "RainViewer data fetched. Latest timestamp:",
          latestFrame.time
        );
      } else {
        console.warn("No past radar frames found in RainViewer response.");
        setRadarFrames([]);
        setCurrentRadarTimestamp(null);
      }
    } catch (err) {
      console.error("Error fetching RainViewer data:", err);
      setRadarError("Could not load radar data.");
      setRadarFrames([]);
      setCurrentRadarTimestamp(null);
    }
  }, []); // No dependencies, it's a stable function

  // --- Map Initialization Effect (Runs ONCE) ---
  useEffect(() => {
    if (mapRef.current) return;

    if (!MAPBOX_ACCESS_TOKEN) {
      console.error("Mapbox Access Token is not set.");
      return;
    }

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [initialLng, initialLat],
      zoom: initialZoom,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    const handleMapClickInternal = (e) => {
      console.log(`Map clicked at: ${e.lngLat.lng}, ${e.lngLat.lat}`);
      if (onMapClickRef.current) {
        onMapClickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      }
    };

    mapRef.current.on("click", handleMapClickInternal);

    mapRef.current.on("load", () => {
      console.log("Map loaded successfully");
      setMapLoaded(true); // <<< Trigger loading of route and potentially radar

      // Add empty route source and layer (as before)
      mapRef.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        },
      });
      mapRef.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "rgb(0,122,255)",
          "line-width": 6,
          "line-opacity": 1,
        },
      });
    });

    // Cleanup
    return () => {
      if (radarIntervalRef.current) {
        clearInterval(radarIntervalRef.current); // Clear interval on unmount
      }
      if (mapRef.current) {
        mapRef.current.off("click", handleMapClickInternal);
        mapRef.current.remove();
        mapRef.current = null;
        setMapLoaded(false);
      }
    };
  }, [initialLng, initialLat, initialZoom]); // Include stable initial values

  // --- Effect to Handle Radar Layer Visibility and Updates ---
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return; // Need map to be loaded

    const map = mapRef.current;

    // Function to add or update the radar layer
    const manageRadarLayer = () => {
      if (isCloudActive && currentRadarTimestamp) {
        const tileUrl = `https://tilecache.rainviewer.com/v2/radar/${currentRadarTimestamp}/512/{z}/{x}/{y}/2/1_1.png`; // Size 512, scheme 2, options smooth+snow

        // Remove existing source/layer first to ensure clean update
        if (map.getLayer(RADAR_LAYER_ID)) {
          map.removeLayer(RADAR_LAYER_ID);
        }
        if (map.getSource(RADAR_SOURCE_ID)) {
          map.removeSource(RADAR_SOURCE_ID);
        }

        // Add new source and layer
        map.addSource(RADAR_SOURCE_ID, {
          type: "raster",
          tiles: [tileUrl],
          tileSize: 512, // Use 512 for RainViewer's higher resolution tiles
          // attribution: '<a href="https://www.rainviewer.com/" target="_blank">RainViewer</a>', // Optional attribution
        });

        map.addLayer(
          {
            id: RADAR_LAYER_ID,
            type: "raster",
            source: RADAR_SOURCE_ID,
            paint: {
              "raster-opacity": 0.7, // Adjust opacity as needed
            },
          },
          "route"
        ); // <<< Add radar layer *below* the 'route' layer

        console.log(
          `Radar layer added/updated for timestamp: ${currentRadarTimestamp}`
        );
      } else {
        // Remove layer and source if cloud is inactive or no timestamp
        if (map.getLayer(RADAR_LAYER_ID)) {
          map.removeLayer(RADAR_LAYER_ID);
          console.log("Radar layer removed.");
        }
        if (map.getSource(RADAR_SOURCE_ID)) {
          map.removeSource(RADAR_SOURCE_ID);
          console.log("Radar source removed.");
        }
      }
    };

    // Manage layer based on current state
    manageRadarLayer();

    // Set up or clear the refresh interval
    if (isCloudActive) {
      // Fetch immediately if activating and no data/timestamp yet
      if (!currentRadarTimestamp) {
        fetchRainViewerData();
      }
      // Clear any existing interval before setting a new one
      if (radarIntervalRef.current) {
        clearInterval(radarIntervalRef.current);
      }
      // Start interval to fetch new data periodically
      radarIntervalRef.current = setInterval(
        fetchRainViewerData,
        RADAR_REFRESH_INTERVAL
      );
      console.log("Radar refresh interval started.");
    } else {
      // Clear interval if cloud becomes inactive
      if (radarIntervalRef.current) {
        clearInterval(radarIntervalRef.current);
        radarIntervalRef.current = null;
        console.log("Radar refresh interval stopped.");
      }
    }

    // Cleanup specific to this effect: Remove layer/source if effect re-runs or unmounts while active
    return () => {
      if (mapRef.current && mapRef.current.isStyleLoaded()) {
        // Check if map style still exists
        if (mapRef.current.getLayer(RADAR_LAYER_ID)) {
          mapRef.current.removeLayer(RADAR_LAYER_ID);
        }
        if (mapRef.current.getSource(RADAR_SOURCE_ID)) {
          mapRef.current.removeSource(RADAR_SOURCE_ID);
        }
      }
      // Interval cleanup is handled in the main unmount effect and when isCloudActive changes
    };
  }, [mapLoaded, isCloudActive, currentRadarTimestamp, fetchRainViewerData]); // Dependencies trigger layer updates

  // --- Effect to Update Route --- (Keep this as it is)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) {
      return;
    }
    const map = mapRef.current;
    const source = map.getSource("route");
    if (source) {
      if (routeGeojson?.features?.length > 0) {
        source.setData(routeGeojson);
        console.log("Route source updated on map.");
        try {
          const coordinates = routeGeojson.features[0].geometry.coordinates;
          if (coordinates.length > 0) {
            const bounds = coordinates.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
            map.fitBounds(bounds, { padding: 80 }); // Increased padding slightly
          }
        } catch (e) {
          console.error("Error fitting map to route bounds:", e);
        }
      } else {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        });
        console.log("Route cleared from map.");
      }
    } else {
      console.warn("Route source not found on map.");
    }
  }, [routeGeojson, mapLoaded]);

  // --- Marker Creation Functions --- (Keep these as they are)
  const createStartMarkerElement = () => {
    const markerElement = document.createElement("div");
    markerElement.style.width = "40px";
    markerElement.style.height = "40px";
    markerElement.style.display = "flex";
    markerElement.style.justifyContent = "center";
    markerElement.style.alignItems = "center";
    markerElement.style.borderRadius = "50%";
    markerElement.style.backgroundColor = "white";
    markerElement.style.border = "2px solid rgb(51, 51, 51)";
    markerElement.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    markerElement.style.cursor = "pointer";
    // Center the element over the coordinate
    markerElement.style.transform = "translate(-50%, -50%)";
    // Location SVG (start point)
    markerElement.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512" fill="currentColor"><path d="M256 32C167.6 32 96 100.6 96 185c0 40.2 18.3 93.6 54.4 158.8 29 52.3 62.6 99.7 80 123.2C238.7 480.7 247.4 480 256 480s17.3.7 25.6 1.2c17.4-23.5 51-70.9 80-123.2C397.7 278.6 416 225.2 416 185c0-84.4-71.6-153-160-153zm0 224a64 64 0 1164-64 64.1 64.1 0 01-64 64z"/></svg>
    `;
    return markerElement;
  };

  const createEndMarkerElement = () => {
    const markerElement = document.createElement("div");
    markerElement.style.width = "40px";
    markerElement.style.height = "40px";
    markerElement.style.display = "flex";
    markerElement.style.justifyContent = "center";
    markerElement.style.alignItems = "center";
    markerElement.style.borderRadius = "50%";
    markerElement.style.backgroundColor = "white";
    markerElement.style.border = "2px solid rgb(51, 51, 51)";
    markerElement.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    markerElement.style.cursor = "pointer";
    // Center the element over the coordinate
    markerElement.style.transform = "translate(-50%, -50%)";
    // Flag SVG (end point)
    markerElement.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512" fill="currentColor"><path d="M80 480a16 16 0 01-16-16V68.13a24 24 0 0111.9-20.72C88 40.38 112.38 32 160 32c37.21 0 78.83 14.71 115.55 27.68C305.12 70.13 333.05 80 352 80a183.84 183.84 0 0071-14.5 18 18 0 0125 16.58V301.44a20 20 0 01-12 18.31c-8.71 3.81-40.51 16.25-84 16.25-24.14 0-54.38-7.14-86.39-14.71C229.63 312.79 192.43 304 160 304c-36.87 0-55.74 5.58-64 9.11V464a16 16 0 01-16 16z"/></svg>
    `;
    return markerElement;
  };

  // --- Effect to Update Start/End Markers --- (Keep this as it is)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    // Remove previous markers
    startMarkerRef.current?.remove();
    endMarkerRef.current?.remove();
    startMarkerRef.current = null;
    endMarkerRef.current = null;

    // Add new start marker
    if (startPoint) {
      console.log("Adding start marker at:", startPoint);
      const startElement = createStartMarkerElement();
      startMarkerRef.current = new mapboxgl.Marker({
        element: startElement,
        anchor: "center",
      })
        .setLngLat([startPoint.lng, startPoint.lat])
        .addTo(mapRef.current);
    }
    // Add new end marker
    if (endPoint) {
      console.log("Adding end marker at:", endPoint);
      const endElement = createEndMarkerElement();
      endMarkerRef.current = new mapboxgl.Marker({
        element: endElement,
        anchor: "center",
      })
        .setLngLat([endPoint.lng, endPoint.lat])
        .addTo(mapRef.current);
    }
  }, [startPoint, endPoint, mapLoaded]);

  // --- Cloud Button Click Handler ---
  const handleCloudClick = () => {
    setIsCloudActive((prev) => !prev);
    // Note: The useEffect hook listening to `isCloudActive` will handle
    // fetching data, setting intervals, and adding/removing the layer.
  };

  // Use callback ref for map container
  const setMapContainer = useCallback((node) => {
    mapContainerRef.current = node;
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={setMapContainer} style={{ width: "100%", height: "100%" }} />

      {/* Cloud Button Overlay */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          // Adjust left position to not overlap your existing route card
          // Example: Place it relative to the top-right nav controls
          right: "50px", // Position near the Mapbox Nav control
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <button
          onClick={handleCloudClick}
          style={{
            backgroundColor: isCloudActive ? "lightblue" : "white", // visual feedback
            border: "1px solid #aaa", // slightly softer border
            borderRadius: "4px",
            padding: "8px",
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)", // softer shadow
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "40px",
            height: "40px",
          }}
          title={isCloudActive ? "Hide Radar" : "Show Radar"}
          aria-label={
            isCloudActive ? "Hide weather radar" : "Show weather radar"
          }
          aria-pressed={isCloudActive}
        >
          {/* SVG Cloud Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 512 512"
            // Style changes based on isCloudActive state
            fill={isCloudActive ? "rgb(0,122,255)" : "none"} // Fill blue when active
            stroke={isCloudActive ? "none" : "currentColor"} // Outline when inactive
            strokeWidth="32" // Adjusted stroke width for visibility
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M400 240c-8.89-89.54-71-144-144-144-69 0-113.44 48.2-128 96-60 6-112 43.59-112 112 0 66 54 112 120 112h260c58 0 100-50 100-104 0-57-41-100-100-112a16 16 0 00-4-16z" />
          </svg>
        </button>
        {/* Display error if radar fetching fails */}
        {radarError && isCloudActive && (
          <div
            style={{
              backgroundColor: "rgba(255, 0, 0, 0.7)",
              color: "white",
              padding: "5px 8px",
              borderRadius: "4px",
              fontSize: "0.8em",
              maxWidth: "150px",
              textAlign: "center",
            }}
          >
            {radarError}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(MapComponent);
