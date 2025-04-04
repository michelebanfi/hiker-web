import React, { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Location, Flag } from "react-ionicons"; // Import the Ionicons

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// Define props the component accepts for clarity
function MapComponent({ routeGeojson, startPoint, endPoint, onMapClick }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const startMarkerRef = useRef(null); // Ref for start marker
  const endMarkerRef = useRef(null); // Ref for end marker
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isCloudActive, setIsCloudActive] = useState(false); // New state for cloud button

  const [lng] = useState(9.19); // Initial center state - could be removed if not needed
  const [lat] = useState(45.46);
  const [zoom] = useState(9);

  // Store onMapClick in a ref to avoid recreating the click handler
  const onMapClickRef = useRef(onMapClick);

  // Handle cloud button click
  const handleCloudClick = () => {
    setIsCloudActive((prev) => !prev);
  };

  // Update the ref whenever the prop changes
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // --- Map Initialization Effect (Runs ONCE) ---
  useEffect(() => {
    if (mapRef.current) return; // Initialize map only once

    if (!MAPBOX_ACCESS_TOKEN) {
      console.error("Mapbox Access Token is not set.");
      return;
    }

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12", // Outdoors style might be better for hiking/biking
      center: [lng, lat],
      zoom: zoom,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // --- Add Click Listener ---
    const handleMapClick = (e) => {
      console.log(`Map clicked at: ${e.lngLat.lng}, ${e.lngLat.lat}`);
      // Always use the current callback from ref
      if (onMapClickRef.current) {
        onMapClickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      }
    };

    mapRef.current.on("click", handleMapClick);

    // --- Map Loaded Listener (Important!) ---
    // Wait until map style is loaded before trying to add sources/layers
    mapRef.current.on("load", () => {
      console.log("Map loaded successfully");
      setMapLoaded(true);

      // Add an empty source and layer for the route initially
      // This makes updating easier later
      mapRef.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      });

      mapRef.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "rgb(0,122,255)", // Blue color for the route
          "line-width": 6,
          "line-opacity": 1,
        },
      });
    });

    // --- Cleanup ---
    return () => {
      if (mapRef.current) {
        mapRef.current.off("click", handleMapClick);
        mapRef.current.remove();
        mapRef.current = null;
        setMapLoaded(false);
      }
    };
  }, []); // Remove dependencies that could cause re-initialization

  // --- Effect to Update Route on Map ---
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) {
      return; // Make sure map is initialized and style loaded
    }

    const map = mapRef.current;
    const source = map.getSource("route"); // Get the existing source

    if (source) {
      if (
        routeGeojson &&
        routeGeojson.features &&
        routeGeojson.features.length > 0
      ) {
        // Update the data of the existing source
        source.setData(routeGeojson);
        console.log("Route source updated on map.");

        // Optional: Fit map to route bounds
        try {
          const coordinates = routeGeojson.features[0].geometry.coordinates;
          if (coordinates.length > 0) {
            const bounds = coordinates.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

            map.fitBounds(bounds, {
              padding: 60, // Add padding around the bounds
            });
          }
        } catch (e) {
          console.error("Error fitting map to bounds:", e);
        }
      } else {
        // Clear the route if routeGeojson is null or empty
        source.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        });
        console.log("Route cleared from map.");
      }
    } else {
      console.warn(
        "Route source not found on map. Was initialization skipped?"
      );
    }
  }, [routeGeojson, mapLoaded]); // Only depend on routeGeojson and mapLoaded

  // --- Create Custom Marker Elements ---
  const createStartMarkerElement = () => {
    const markerElement = document.createElement("div");

    // Style the marker container
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
    markerElement.style.transform = "translate(-50%, -50%)";

    // Use direct SVG for location icon (from Ionicons)
    markerElement.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512"><circle cx="256" cy="192" r="32"/><path d="M256,32C167.78,32,96,100.65,96,185c0,40.17,18.31,93.59,54.42,158.78,29,52.34,62.55,99.67,80,123.22a31.75,31.75,0,0,0,51.22,0c17.42-23.55,51-70.88,80-123.22C397.69,278.61,416,225.19,416,185,416,100.65,344.22,32,256,32Zm0,224a64,64,0,1,1,64-64A64.07,64.07,0,0,1,256,256Z"/></svg>
    `;

    return markerElement;
  };

  const createEndMarkerElement = () => {
    const markerElement = document.createElement("div");

    // Style the marker container
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
    markerElement.style.transform = "translate(-50%, -50%)";

    // Use direct SVG for flag icon (from Ionicons)
    markerElement.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512"><path d="M80,480a16,16,0,0,1-16-16V68.13A24,24,0,0,1,75.9,47.41C88,40.38,112.38,32,160,32c37.21,0,78.83,14.71,115.55,27.68C305.12,70.13,333.05,80,352,80a183.84,183.84,0,0,0,71-14.5,18,18,0,0,1,25,16.58V301.44a20,20,0,0,1-12,18.31c-8.71,3.81-40.51,16.25-84,16.25-24.14,0-54.38-7.14-86.39-14.71C229.63,312.79,192.43,304,160,304c-36.87,0-55.74,5.58-64,9.11V464A16,16,0,0,1,80,480Z"/></svg>
    `;

    return markerElement;
  };

  // --- Effect to Update Start/End Markers ---
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return; // Make sure map exists and is loaded

    // Remove previous markers first
    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.remove();
      endMarkerRef.current = null;
    }

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
      const endElement = createEndMarkerElement();

      endMarkerRef.current = new mapboxgl.Marker({
        element: endElement,
        anchor: "center",
      })
        .setLngLat([endPoint.lng, endPoint.lat])
        .addTo(mapRef.current);
    }
  }, [startPoint, endPoint, mapLoaded]); // Include mapLoaded in dependencies

  // Use a callback ref to update mapContainerRef without causing re-renders
  const setMapContainer = useCallback((node) => {
    mapContainerRef.current = node;
  }, []);

  return (
    // Container div with relative positioning to allow overlay buttons
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Map container */}
      <div ref={setMapContainer} style={{ width: "100%", height: "100%" }} />

      {/* Buttons overlay */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "200px",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {/* Cloud button */}
        <button
          onClick={handleCloudClick}
          style={{
            backgroundColor: "white",
            border: "2px solid rgb(51, 51, 51)",
            borderRadius: "4px",
            padding: "8px",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "40px",
            height: "40px",
          }}
          aria-label="Toggle cloud view"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 512 512"
            fill={isCloudActive ? "rgb(0,122,255)" : "none"}
            stroke={isCloudActive ? "none" : "currentColor"}
            strokeWidth="2"
          >
            <path d="M396,432H136c-36.44,0-70.36-12.57-95.51-35.41C14.38,372.88,0,340,0,304c0-36.58,13.39-68.12,38.72-91.22,18.11-16.53,42.22-28.25,69.18-33.87a16,16,0,0,0,11.37-9.15,156.24,156.24,0,0,1,42.05-56C187.76,91.69,220.5,80,256,80a153.57,153.57,0,0,1,107.14,42.9c24.73,23.81,41.5,55.28,49.18,92a16,16,0,0,0,12.12,12.39C470,237.42,512,270.43,512,328c0,33.39-12.24,60.78-35.41,79.23C456.23,423.43,428.37,432,396,432Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Use React.memo to prevent unnecessary re-renders
export default React.memo(MapComponent);
