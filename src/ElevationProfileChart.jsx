// src/ElevationProfileChart.jsx
import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler, // Import Filler plugin
} from "chart.js";

// Register necessary Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler // Register Filler
);

// Helper function to calculate distance between two lat/lon points (Haversine formula)
// Returns distance in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Helper to format distance for labels/tooltips
const formatChartDistance = (meters) => {
  if (meters === null || meters === undefined) return "0 km";
  const kilometers = meters / 1000;
  return `${kilometers.toFixed(1)} km`;
};

function ElevationProfileChart({ coordinates }) {
  // useMemo prevents recalculating data on every render unless coordinates change
  const chartData = useMemo(() => {
    if (!coordinates || coordinates.length < 2) {
      return { labels: [], datasets: [] };
    }

    const elevations = [];
    const distances = [0]; // Start at 0 distance
    let cumulativeDistance = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const [lon1, lat1, ele1] = coordinates[i - 1];
      const [lon2, lat2, ele2] = coordinates[i];

      // Add elevation for the *start* point of the segment on the first iteration
      if (i === 1) {
        elevations.push(
          ele1 !== undefined && ele1 !== null ? Math.round(ele1) : 0
        );
      }
      // Add elevation for the end point of the segment
      elevations.push(
        ele2 !== undefined && ele2 !== null ? Math.round(ele2) : 0
      );

      // Calculate distance of this segment
      const segmentDistance = calculateDistance(lat1, lon1, lat2, lon2);
      cumulativeDistance += segmentDistance;
      distances.push(cumulativeDistance);
    }

    // Create labels at reasonable intervals (e.g., every ~10% of points or every km)
    // This simplifies the X-axis display
    const labels = distances.map((d) => formatChartDistance(d));
    const simplifiedLabels = [];
    const elevationData = [];
    const numPoints = distances.length;
    const step = Math.max(1, Math.floor(numPoints / 10)); // Show ~10 labels

    for (let i = 0; i < numPoints; i++) {
      if (i % step === 0 || i === numPoints - 1) {
        simplifiedLabels.push(labels[i]);
        elevationData.push(elevations[i]);
      } else {
        // For Chart.js to draw a continuous line, provide null for labels you skip
        simplifiedLabels.push(null);
        elevationData.push(elevations[i]); // Still need the elevation data point
      }
    }

    return {
      labels: simplifiedLabels, // Use the distance labels for the X-axis
      datasets: [
        {
          label: "Elevation",
          data: elevationData, // The elevation values for the Y-axis
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.2)", // Fill color
          tension: 0.3, // Slightly smooth the line
          pointRadius: 0, // Hide points for a cleaner look
          pointHitRadius: 10, // Easier to hover for tooltip
          fill: true, // Enable fill beneath the line
          borderWidth: 1.5,
          spanGaps: true, // Allow gaps in the line for null values
        },
      ],
    };
  }, [coordinates]);

  const options = {
    responsive: true,
    maintainAspectRatio: false, // Important to control height via CSS
    plugins: {
      legend: {
        display: false, // Hide legend as there's only one dataset
      },
      title: {
        display: true,
        text: "Elevation Profile",
        font: { size: 14 },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          title: function (tooltipItems) {
            // Show distance in tooltip title
            const index = tooltipItems[0]?.dataIndex;
            if (index !== undefined && index < chartData.labels.length) {
              // Find the nearest non-null label if the current one is null
              let labelIndex = index;
              while (chartData.labels[labelIndex] === null && labelIndex > 0) {
                labelIndex--;
              }
              return `Dist: ${
                chartData.labels[labelIndex] || formatChartDistance(0)
              }`; // Fallback
            }
            return "";
          },
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += `${Math.round(context.parsed.y)} m`; // Elevation in meters
            }
            return label;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false, // Elevation doesn't always start at 0
        title: {
          display: true,
          text: "Elevation (m)",
          font: { size: 12 },
        },
        grid: {
          color: "rgba(0, 0, 0, 0.05)", // Lighter grid lines
        },
        ticks: {
          font: { size: 10 },
        },
      },
      x: {
        title: {
          display: true,
          text: "Distance",
          font: { size: 12 },
        },
        ticks: {
          font: { size: 10 },
          autoSkip: false, // Use our custom simplified labels logic
          maxRotation: 0,
          minRotation: 0,
          // Only show labels where we provided one (not null)
          // callback: function(value, index, values) {
          //    return chartData.labels[index] !== null ? this.getLabelForValue(value) : '';
          // }
        },
        grid: {
          display: false, // Hide vertical grid lines for cleaner look
        },
      },
    },
    interaction: {
      mode: "index", // Tooltip appears for the nearest index on hover
      intersect: false,
    },
    animation: false,
  };
  console.log("Chart data:", chartData);
  return <Line options={options} data={chartData} />;
}

export default ElevationProfileChart;
