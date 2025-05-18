import React from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

interface GeographicData {
  location: string;
  country: string;
  province: string;
  sales: number;
  order_count: number;
}

interface GeographicMapProps {
  data: GeographicData[];
}

// Map data URL for world map
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country code to coordinates mapping (simplified)
const countryCoordinates: { [key: string]: [number, number] } = {
  'US': [-95.7129, 37.0902],
  'CA': [-106.3468, 56.1304],
  'GB': [-3.4360, 55.3781],
  'FR': [2.2137, 46.2276],
  'DE': [10.4515, 51.1657],
  'JP': [138.2529, 36.2048],
  'AU': [133.7751, -25.2744],
  'CN': [104.1954, 35.8617],
  // Add more countries as needed
};

const GeographicMap: React.FC<GeographicMapProps> = ({ data }) => {
  // Group data by country
  const countryData = data.reduce((acc, item) => {
    const country = item.country;
    if (!acc[country]) {
      acc[country] = { sales: 0, order_count: 0 };
    }
    acc[country].sales += item.sales;
    acc[country].order_count += item.order_count;
    return acc;
  }, {} as { [key: string]: { sales: number; order_count: number } });

  // Get max sales for scaling
  const maxSales = Math.max(...Object.values(countryData).map(d => d.sales));

  // Create markers for countries with sales
  const markers = Object.entries(countryData).map(([country, data]) => ({
    country,
    sales: data.sales,
    order_count: data.order_count,
    coordinates: countryCoordinates[country] || [0, 0],
    markerSize: Math.max(10, (data.sales / maxSales) * 50),
  }));

  return (
    <div className="w-full h-full">
      <div className="h-[300px]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 100,
          }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#E5E7EB"
                  stroke="#D1D5DB"
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: '#D1D5DB', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>
          {markers.map((marker) => (
            <Marker
              key={marker.country}
              coordinates={marker.coordinates}
            >
              <circle
                r={marker.markerSize}
                fill="#3B82F6"
                fillOpacity={0.6}
                stroke="#1E40AF"
                strokeWidth={1}
              />
              <text
                textAnchor="middle"
                y={-marker.markerSize - 5}
                style={{
                  fontFamily: 'system-ui',
                  fill: '#1F2937',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                {marker.country}
              </text>
            </Marker>
          ))}
        </ComposableMap>
      </div>
      
      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        {markers.slice(0, 4).map((marker) => (
          <div key={marker.country} className="flex items-center space-x-2">
            <div
              className="w-4 h-4 rounded-full bg-blue-500"
              style={{ opacity: 0.6 }}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {marker.country}: ${marker.sales.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeographicMap;