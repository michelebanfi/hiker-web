import React, { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// Define props the component accepts for clarity
function MapComponent({ routeGeojson, startPoint, endPoint, onMapClick }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const startMarkerRef = useRef(null); // Ref for start marker
  const endMarkerRef = useRef(null); // Ref for end marker
  const [mapLoaded, setMapLoaded] = useState(false);

  const [lng] = useState(9.19); // Initial center state - could be removed if not needed
  const [lat] = useState(45.46);
  const [zoom] = useState(9);

  // Store onMapClick in a ref to avoid recreating the click handler
  const onMapClickRef = useRef(onMapClick);

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
          "line-color": "#007cbf", // Blue color for the route
          "line-width": 6,
          "line-opacity": 0.8,
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
      startMarkerRef.current = new mapboxgl.Marker({ color: "#00FF00" }) // Green
        .setLngLat([startPoint.lng, startPoint.lat])
        .addTo(mapRef.current);
    }

    // Add new end marker
    if (endPoint) {
      endMarkerRef.current = new mapboxgl.Marker({ color: "#FF0000" }) // Red
        .setLngLat([endPoint.lng, endPoint.lat])
        .addTo(mapRef.current);
    }
  }, [startPoint, endPoint, mapLoaded]); // Include mapLoaded in dependencies

  // Use a callback ref to update mapContainerRef without causing re-renders
  const setMapContainer = useCallback((node) => {
    mapContainerRef.current = node;
  }, []);

  return (
    // Container div - Make sure its parent (.App) allows it to take space
    <div ref={setMapContainer} style={{ width: "100%", height: "100%" }} />
  );
}

// Use React.memo to prevent unnecessary re-renders
export default React.memo(MapComponent);
