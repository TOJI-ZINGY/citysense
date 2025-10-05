// Switch to Leaflet (OpenStreetMap tiles) + Nominatim geocoding to avoid
// Google Maps billing requirements. This file initializes a Leaflet map, performs
// simple geocoding via Nominatim, and keeps the chatbot/search UI behavior.

// Keep a reference to the Leaflet map and marker so we can update them on searches.
let leafletMap = null;
let leafletMarker = null;
let boundaryLayer = null;

async function initMap(cityName = "The New Valley Governorate") {
  const mapEl = document.getElementById('map');
  if (!mapEl) {
    console.error('initMap: #map element not found');
    return;
  }

  try {
    // Initialize map if not already
    if (!leafletMap) {
      // Set a default center (world view) until geocode succeeds
      leafletMap = L.map('map', { zoomControl: true }).setView([26.8206, 30.8025], 5);

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(leafletMap);
    }

    // Use Nominatim (OpenStreetMap) for simple geocoding. Try a few sensible
    // variants when the first lookup returns no results (e.g. 'The New Valley' -> 'New Valley Governorate, Egypt').
    async function geocodeOnce(query) {
      // Request polygon_geojson where available and boundingbox
      const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&addressdetails=1&q=${encodeURIComponent(query)}&limit=1`;
      const resp = await fetch(url, {
        headers: { 'Accept-Language': 'en-US' }
      });
      if (!resp.ok) {
        console.error('Nominatim request failed for', query, resp.status, resp.statusText);
        return null;
      }
  const json = await resp.json();
      // Log full response for debugging (can be noisy)
      console.debug('Nominatim response for', query, json);
      if (!json || json.length === 0) return null;
      return json[0];
    }

    // Build candidate queries to improve match rate.
    const candidates = [
      cityName,
      // remove leading 'The ' if present
      cityName.replace(/^The\s+/i, ''),
      // append country (Egypt) as many of your places are in Egypt
      `${cityName}, Egypt`,
      `${cityName.replace(/^The\s+/i, '')}, Egypt`,
      'el wadi, Egypt',
      'New Valley Governorate, Egypt'
    ];

    let loc = null;
    for (const q of candidates) {
      try {
        loc = await geocodeOnce(q);
        if (loc) {
          console.info('Geocoding success with query:', q);
          break;
        }
        // small delay between attempts to be polite to the service
        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        console.warn('Geocode attempt failed for', q, e);
      }
    }

    if (!loc) {
      console.warn('No geocoding results for any candidate of', cityName, candidates);
      // Keep the map at its default view and show a transient popup so the user knows.
      if (leafletMap) {
        const popup = L.popup({ closeOnClick: true })
          .setLatLng(leafletMap.getCenter())
          .setContent('Location not found on the map.')
          .openOn(leafletMap);
      } else {
        mapEl.innerText = 'City not found on the map.';
      }
      return;
    }

    const lat = parseFloat(loc.lat);
    const lon = parseFloat(loc.lon);

    // Remove previous boundary layer if present
    if (boundaryLayer) {
      try { leafletMap.removeLayer(boundaryLayer); } catch (e) { /* ignore */ }
      boundaryLayer = null;
    }

    // Place or update the marker at the geocoded point
    if (leafletMarker) {
      leafletMarker.setLatLng([lat, lon]);
      // Update existing popup content if present
      const pop = leafletMarker.getPopup && leafletMarker.getPopup();
      if (pop) pop.setContent(cityName);
      else leafletMarker.bindPopup(cityName);

      // Update or bind a permanent tooltip (label) above the marker so the name
      // stays visible without opening the popup.
      if (leafletMarker.getTooltip && leafletMarker.getTooltip()) {
        leafletMarker.getTooltip().setContent(cityName);
      } else {
        leafletMarker.bindTooltip(cityName, { permanent: true, direction: 'top', offset: [0, -10], className: 'map-label' }).openTooltip();
      }
    } else {
      leafletMarker = L.marker([lat, lon]).addTo(leafletMap).bindPopup(cityName);
      // Add a permanent tooltip (label) above the marker
      leafletMarker.bindTooltip(cityName, { permanent: true, direction: 'top', offset: [0, -10], className: 'map-label' }).openTooltip();
    }

    // If Nominatim returned polygon geojson, draw it. Otherwise use boundingbox if available.
    let bounds = null;
    if (loc.geojson) {
      try {
        boundaryLayer = L.geoJSON(loc.geojson, {
          style: { color: '#ff6d00', weight: 3, opacity: 0.9, fill: true, fillColor: '#ff6d00', fillOpacity: 0.1 }
        }).addTo(leafletMap);
        bounds = boundaryLayer.getBounds();
      } catch (e) {
        console.warn('Failed to add geojson boundary:', e);
      }
    }

    if (!bounds && loc.boundingbox) {
      // Nominatim boundingbox format: [south, north, west, east] or [south, north, west, east] as strings
      const bb = loc.boundingbox.map(parseFloat);
      // Some responses give [south, north, west, east]
      const south = bb[0], north = bb[1], west = bb[2], east = bb[3];
      bounds = L.latLngBounds([south, west], [north, east]);
      boundaryLayer = L.rectangle(bounds, { color: '#ff6d00', weight: 2, fillOpacity: 0.05 }).addTo(leafletMap);
    }

    // If we have valid bounds, fit the map to them with a dynamic maxZoom
    if (bounds && bounds.isValid && bounds.isValid()) {
      // Compute an approximate area (degrees) to choose a maxZoom cap
      const latDiff = Math.abs(bounds.getNorth() - bounds.getSouth());
      const lonDiff = Math.abs(bounds.getEast() - bounds.getWest());
      const areaApprox = latDiff * lonDiff;

      let maxZoomCap = 14;
      if (areaApprox < 0.0005) maxZoomCap = 16; // very small area -> allow deeper zoom
      else if (areaApprox < 0.01) maxZoomCap = 15;
      else if (areaApprox < 0.5) maxZoomCap = 13;
      else if (areaApprox < 5) maxZoomCap = 11;
      else maxZoomCap = 8;

      leafletMap.fitBounds(bounds, { padding: [20,20], maxZoom: maxZoomCap });
      // Open popup on the marker after fit
      if (leafletMarker) leafletMarker.openPopup();
    } else {
      // No bounds: fallback to centering and a reasonable zoom based on default
      leafletMap.setView([lat, lon], 10);
      if (leafletMarker) leafletMarker.openPopup();
    }

  } catch (err) {
    console.error('Error in initMap (Leaflet):', err);
    const el = document.getElementById('map');
    if (el) el.innerText = 'Error loading map data.';
  }
}

// Expose initMap to window so other UI code can call it
window.initMap = initMap;

// This is the function that the Google Maps script will call.
// It runs after the Google Maps API is ready.
function initGoogleMap() {
  // Back-compat: if any code calls initGoogleMap, call initMap with default city.
  // This ensures nothing breaks if some code still expects the Google callback.
  initMap('The New Valley Governorate');

  // --- Chatbot functionality ---
  const chatbotToggle = document.getElementById('chatbotToggle');
  const chatbotWindow = document.getElementById('chatbotWindow');
  const chatClose = document.getElementById('chatClose');
  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');
  const chatMessages = document.getElementById('chatMessages');
  const searchInput = document.querySelector('.search-input');

  if (chatbotToggle) { // Add checks for elements to prevent errors if not found
    chatbotToggle.addEventListener('click', () => {
        chatbotWindow.classList.toggle('active');
    });
  }

  if (chatClose) {
    chatClose.addEventListener('click', () => {
        chatbotWindow.classList.remove('active');
    });
  }

  function addMessage(text, isUser = false) {
      const messageDiv = document.createElement('div');
      messageDiv.classList.add('message');
      messageDiv.classList.add(isUser ? 'user' : 'bot');
      messageDiv.textContent = text;
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function sendMessage() {
      const message = chatInput.value.trim();
      if (message) {
          addMessage(message, true);
          chatInput.value = '';

          setTimeout(() => {
              const responses = [
                  "Based on current data, New York's temperature is expected to rise by 1.5°F over the next decade.",
                  "Urban expansion in this area has increased by 2.1% year-over-year, primarily in residential zones.",
                  "The vegetation index shows improvement in 3 of the 5 boroughs compared to last year.",
                  "Traffic density is highest in Manhattan during weekdays between 8-9 AM and 5-6 PM.",
                  "Air quality has improved by 8% since last year due to new environmental policies.",
                  "To predict future scenarios, I need more specific parameters. Could you elaborate on what you're interested in?",
                  "I can provide data on population growth, environmental risks, and urban expansion. Which one would you like to know more about?",
                  "For detailed insights, please specify the time frame or specific area within the city."
              ];
              const randomResponse = responses[Math.floor(Math.random() * responses.length)];
              addMessage(randomResponse);
          }, 1000);
      }
  }

  if (chatSend) {
    chatSend.addEventListener('click', sendMessage);
  }
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
  }

  // --- Search functionality ---
  const cityData = {
      "el wadi": { // Corrected key to match default load
          name: "The New Valley Governorate",
          country: "Egypt",
          population: "161130",
          temperature: "23°c",
          rainfall: "0",
          humidity: "12%",
          vegetation: "0.17",
          airQuality: "Moderate",
          soilType: "Sandy",
          populationGrowth: "2.23%",
          trafficDensity: "Sparse",
          urbanExpansion: "+1.6% YoY"
      },
      "london": {
          name: "London",
          country: "United Kingdom",
          population: "8.9 million",
          temperature: "60°F",
          rainfall: "2.5 in",
          humidity: "75%",
          vegetation: "0.55",
          airQuality: "Good",
          soilType: "Clay",
          populationGrowth: "0.8%",
          trafficDensity: "Very High",
          urbanExpansion: "+1.5% YoY"
      },
      "tokyo": {
          name: "Tokyo",
          country: "Japan",
          population: "14 million",
          temperature: "78°F",
          rainfall: "4.1 in",
          humidity: "70%",
          vegetation: "0.38",
          airQuality: "Moderate",
          soilType: "Volcanic",
          populationGrowth: "0.5%",
          trafficDensity: "High",
          urbanExpansion: "+0.9% YoY"
      }
  };

  function updateCityData(cityKey) {
      const data = cityData[cityKey.toLowerCase()];
      if (data) {
          document.getElementById('sidebar-city-name').textContent = data.name;
          document.getElementById('sidebar-city-country').textContent = data.country;
          document.getElementById('sidebar-population').textContent = data.population;
          document.getElementById('sidebar-temperature').textContent = data.temperature;
          document.getElementById('sidebar-rainfall').textContent = data.rainfall.replace('0', 'Zero');
          document.getElementById('sidebar-humidity').textContent = data.humidity;
          document.getElementById('sidebar-vegetation').textContent = data.vegetation;
          document.getElementById('sidebar-air-quality').textContent = data.airQuality;
          document.getElementById('sidebar-soil-type').textContent = data.soilType;
          document.getElementById('sidebar-population-growth').textContent = data.populationGrowth;
          document.getElementById('sidebar-traffic-density').textContent = data.trafficDensity;
          document.getElementById('sidebar-urban-expansion').textContent = data.urbanExpansion;

          document.getElementById('metric-temperature').textContent = data.temperature;
          document.getElementById('metric-rainfall').textContent = data.rainfall;
          document.getElementById('metric-population').textContent = data.population.replace(' million', 'M');
          document.getElementById('metric-air-quality').textContent = data.airQuality === "Good" ? "25" : "36";

          addMessage(`Data for ${data.name} has been loaded. How can I assist you further?`);

          initMap(data.name);

      } else {
          alert("City data not found. Try 'el wadi'.");
          addMessage("I couldn't find data for that city. Please try 'el wadi'.");
      }
  }

  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const city = searchInput.value.trim();
            if (city) {
                updateCityData(city);
            }
        }
    });
  }

  // Load default city data and map on page load
  updateCityData("el wadi"); // Corrected to match the key in cityData object
}

// Automatically initialize when the document is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGoogleMap);
} else {
  // DOM already ready
  initGoogleMap();
}

/* ----------------- 2D City Renderer (uses ChatGPT JSON output) ----------------- */
// Expected JSON schema (example):
// {
//   "width": 1000, "height": 800,
//   "layers": [
//     { "type": "road", "id": "r1", "path": [[x,y],[x,y],...], "width": 6 },
//     { "type": "building", "id": "b1", "x": 100, "y": 200, "w": 60, "h": 80, "label": "School" },
//     { "type": "park", "id": "p1", "x": 300, "y": 120, "w": 120, "h": 80 }
//   ]
// }

function renderCity2DFromJSON(json) {
  const container = document.getElementById('city-2d');
  if (!container) return;
  container.innerHTML = '';

  let cfg = json;
  // Basic validation
  if (!cfg || !Array.isArray(cfg.layers)) {
    container.innerText = 'Invalid JSON: missing layers array.';
    return;
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  const w = cfg.width || 1000;
  const h = cfg.height || 600;
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.display = 'block';

  // background
  const bg = document.createElementNS(svgNS, 'rect');
  bg.setAttribute('x', 0);
  bg.setAttribute('y', 0);
  bg.setAttribute('width', w);
  bg.setAttribute('height', h);
  bg.setAttribute('fill', '#eaf2ff');
  svg.appendChild(bg);

  // Add a subtle drop-shadow filter and text styles for labels
  const defs = document.createElementNS(svgNS, 'defs');
  defs.innerHTML = `
    <filter id="ds" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.15" />
    </filter>
    `;
  svg.appendChild(defs);

  // Draw layers in order
  const legendItems = new Map();
  for (const layer of cfg.layers) {
    const color = layer.color || (layer.type === 'park' ? '#b7e4c7' : (layer.type === 'building' ? '#d9d9d9' : '#888'));
    const stroke = layer.stroke || (layer.type === 'park' ? '#6bbf76' : '#999');


    if (layer.type === 'road' && Array.isArray(layer.path)) {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'city-layer road-layer');
      // outline stroke (wider, lighter)
      const outline = document.createElementNS(svgNS, 'path');
      const d = layer.path.map((p,i) => `${i===0? 'M':'L'} ${p[0]} ${p[1]}`).join(' ');
      outline.setAttribute('d', d);
      outline.setAttribute('stroke', layer.outline || '#e0e0e0');
      outline.setAttribute('stroke-width', (layer.width || 8) + 6);
      outline.setAttribute('fill', 'none');
      outline.setAttribute('stroke-linecap', 'round');
      outline.setAttribute('filter', 'url(#ds)');
      g.appendChild(outline);

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', layer.stroke || '#888');
      path.setAttribute('stroke-width', layer.width || 8);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      g.appendChild(path);

      // label (hidden until hover)
      if (layer.label) {
        const pts = layer.path;
        const mid = pts[Math.floor(pts.length/2)];
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('x', mid[0]);
        label.setAttribute('y', mid[1] - 12);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', layer.labelColor || '#222');
        label.setAttribute('font-size', '12');
        label.setAttribute('font-weight', '700');
        label.setAttribute('class', 'city-layer-label');
        label.textContent = layer.label;
        g.appendChild(label);
      }

      svg.appendChild(g);
      legendItems.set(layer.label || 'Road', layer.stroke || '#888');


    } else if (layer.type === 'building') {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'city-layer building-layer');
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', layer.x);
      rect.setAttribute('y', layer.y);
      rect.setAttribute('width', layer.w);
      rect.setAttribute('height', layer.h);
      rect.setAttribute('rx', layer.rx || 6);
      rect.setAttribute('ry', layer.ry || 6);
      rect.setAttribute('fill', layer.fill || color);
      rect.setAttribute('stroke', layer.stroke || stroke);
      rect.setAttribute('filter', 'url(#ds)');
      g.appendChild(rect);
      if (layer.label) {
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', layer.x + layer.w/2);
        text.setAttribute('y', layer.y + layer.h/2 + 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', layer.labelColor || '#333');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '700');
        text.setAttribute('class', 'city-layer-label');
        text.textContent = layer.label;
        g.appendChild(text);
      }
      svg.appendChild(g);
      legendItems.set(layer.label || 'Building', layer.fill || color);

    } else if (layer.type === 'park') {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'city-layer park-layer');
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', layer.x);
      rect.setAttribute('y', layer.y);
      rect.setAttribute('width', layer.w);
      rect.setAttribute('height', layer.h);
      rect.setAttribute('rx', layer.rx || 4);
      rect.setAttribute('ry', layer.ry || 4);
      rect.setAttribute('fill', layer.fill || color);
      rect.setAttribute('stroke', layer.stroke || stroke);
      rect.setAttribute('filter', 'url(#ds)');
      g.appendChild(rect);
      if (layer.label) {
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', layer.x + layer.w/2);
        text.setAttribute('y', layer.y + layer.h/2 + 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', layer.labelColor || '#1b5e20');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '700');
        text.setAttribute('class', 'city-layer-label');
        text.textContent = layer.label;
        g.appendChild(text);
      }
      svg.appendChild(g);
      legendItems.set(layer.label || 'Park', layer.fill || color);
    }
  }

  // Add legend below the svg
  const legend = document.createElement('div');
  legend.className = 'city-legend';
  for (const [label, color] of legendItems) {
    const item = document.createElement('div');
    item.className = 'city-legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'city-legend-swatch';
    swatch.style.background = color;
    const text = document.createElement('span');
    text.className = 'city-legend-text';
    text.textContent = label;
    item.appendChild(swatch);
    item.appendChild(text);
    legend.appendChild(item);
  }
  container.appendChild(svg);
  container.appendChild(legend);
}

// Sample JSON to test the renderer
const sampleCityJSON = {
  width: 1000,
  height: 600,
  layers: [
    { type: 'road', id: 'r1', path: [[50,300],[950,300]], width: 14, stroke: '#6c757d', label: 'Main St', labelColor: '#333' },
    { type: 'road', id: 'r2', path: [[500,50],[500,550]], width: 12, stroke: '#6c757d', label: 'Central Ave', labelColor: '#333' },
    { type: 'building', id: 'b1', x: 80, y: 220, w: 120, h: 160, label: 'Library', fill: '#f1c40f', stroke: '#b08900', labelColor: '#222' },
    { type: 'building', id: 'b2', x: 220, y: 240, w: 160, h: 120, label: 'Market', fill: '#d9d9d9', stroke: '#888', labelColor: '#222' },
    { type: 'park', id: 'p1', x: 420, y: 60, w: 260, h: 120, label: 'Central Park', fill: '#b7e4c7', stroke: '#6bbf76', labelColor: '#145A32' },
    { type: 'building', id: 'b3', x: 720, y: 240, w: 160, h: 120, label: 'School', fill: '#ffe0b2', stroke: '#c97b00', labelColor: '#222' }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  const renderBtn = document.getElementById('city2d-render');
  const sampleBtn = document.getElementById('city2d-sample');
  const textarea = document.getElementById('city2d-json');
  const promptEl = document.getElementById('city2d-prompt');

  // Populate prompt template (simple example) — user can copy this into ChatGPT
  if (promptEl) {
    // Strong, explicit instruction set to reduce malformed JSON output from models.
    promptEl.textContent = `IMPORTANT — RETURN STRICT, VALID JSON ONLY (NO EXTRA TEXT)

Follow these rules exactly when producing output for the renderer below:

1) Return a SINGLE JSON object and NOTHING ELSE. Do NOT include any explanation, commentary, code fences (\`\`\`), backticks (\`), or markdown. The response must be pure JSON only.
2) Use DOUBLE QUOTES for all JSON strings. Do NOT use single quotes.
3) Do NOT include trailing commas anywhere. Do NOT include comments. Do NOT include functions or JS expressions.
4) Do NOT wrap the JSON in parentheses or other characters. The top-level value must be a single JSON object (i.e. starting with { and ending with }).
5) Schema (required keys):
   {
     "width": <integer>,
     "height": <integer>,
     "layers": [ ... ]
   }
   - The "layers" array contains objects of type "road", "building", or "park" (see examples below).

6) If you need to return multiple objects, place them inside the "layers" array. Do NOT emit multiple top-level objects or comma-separated object lists.

7) Coordinates and sizes must be integers and within the canvas (0 <= x <= width, 0 <= y <= height).

8) Minimal validation: ensure JSON.parse(yourOutput) succeeds and that the root object has numeric "width" and "height" and an array named "layers".

The page will attempt very small repairs (remove code fences, unwrap surrounding parentheses, strip trailing commas). However, DO NOT rely on these repairs — they are best-effort. Produce valid JSON to begin with.

Example (THIS EXACT FORMAT is required -- a SINGLE JSON object):
{
  "width": ${sampleCityJSON.width},
  "height": ${sampleCityJSON.height},
  "layers": [
    { "type": "road", "id": "r1", "path": [[50,300],[950,300]], "width": 14, "stroke": "#6c757d", "label": "Main St", "labelColor": "#333" },
    { "type": "building", "id": "b1", "x": 80, "y": 220, "w": 120, "h": 160, "label": "Library", "fill": "#f1c40f", "stroke": "#b08900", "labelColor": "#222" },
    { "type": "park", "id": "p1", "x": 420, "y": 60, "w": 260, "h": 120, "label": "Central Park", "fill": "#b7e4c7", "stroke": "#6bbf76" }
  ]
}

If the model cannot comply exactly, return the word "ERROR" (without quotes) as the entire output so a human can intervene.`;
  }

  if (sampleBtn) sampleBtn.addEventListener('click', () => {
    textarea.value = JSON.stringify(sampleCityJSON, null, 2);
  });

  // Try to be tolerant of common AI/clipboard formatting issues (triple-backticks,
  // surrounding parentheses, pasted sequence of objects without an array/root).
  function tryParseLooseJSON(text) {
    if (!text) return null;
    let s = text.trim();

    // Remove Markdown code fences ```json ... ``` or ``` ... ```
    s = s.replace(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n```$/m, '$1');
    // Remove single backticks
    if (/^`[\s\S]*`$/.test(s)) s = s.replace(/^`([\s\S]*)`$/, '$1');

    // Unwrap a single pair of surrounding parentheses if present
    while (s.startsWith('(') && s.endsWith(')')) {
      // only unwrap when parentheses wrap the whole text (common when models return `( ... )`)
      s = s.slice(1, -1).trim();
    }

    // If the user pasted multiple objects (e.g. '{...},{...},...') or AI returned a
    // sequence of object literals, detect repeated "\"type\"" entries and wrap
    // them into the expected root object as a layers array. This is a best-effort
    // repair to help non-expert users; it only runs when we see multiple '"type":'.
    const typeCount = (s.match(/"type"\s*:/g) || []).length;
    const hasRootLayers = /"layers"\s*:\s*\[/.test(s);
    const isArray = s.startsWith('[');
    const hasWidth = /"width"\s*:\s*\d+/.test(s);

    if (!hasRootLayers && !isArray && typeCount > 1 && !hasWidth) {
      // Wrap as { width:1000, height:600, layers: [ <paste> ] }
      s = `{"width":1000,"height":600,"layers":[${s}]}`;
    }

    // If it looks like just an array of objects, wrap into root too
    if (!hasRootLayers && isArray && typeCount >= 1 && !hasWidth) {
      s = `{"width":1000,"height":600,"layers":${s}}`;
    }

    // Remove trailing commas before closing brackets/braces (common in hand-copied JS/AI output)
    // e.g. '{...}, ]' -> '{...} ]' and '{...}, }' -> '{...} }'
    s = s.replace(/,(\s*[\]\}])/g, '$1');
    // Remove a final trailing comma at the end of the string
    s = s.replace(/,\s*$/g, '');

    // If there are unmatched opening brackets/braces, try to auto-close them
    const openSq = (s.match(/\[/g) || []).length;
    const closeSq = (s.match(/\]/g) || []).length;
    const openBr = (s.match(/\{/g) || []).length;
    const closeBr = (s.match(/\}/g) || []).length;
    if (openSq > closeSq) {
      s += ']'.repeat(openSq - closeSq);
    }
    if (openBr > closeBr) {
      s += '}'.repeat(openBr - closeBr);
    }

    // Finally try to parse
    try {
      return JSON.parse(s);
    } catch (err) {
      // Re-throw with a friendlier message including the original parse error
      const msg = `Could not parse JSON. ${err.message}. If you pasted ChatGPT output, make sure it's a single JSON object (no explanations, no backticks) and that there are no trailing commas.`;
      const e = new Error(msg);
      e.original = err;
      throw e;
    }
  }

  if (renderBtn) renderBtn.addEventListener('click', () => {
    try {
      const val = textarea.value.trim();
      const parsed = val ? tryParseLooseJSON(val) : sampleCityJSON;
      if (!parsed) throw new Error('No JSON provided');
      renderCity2DFromJSON(parsed);
    } catch (e) {
      // Show a clearer alert and log the detailed error to console for debugging
      console.error('JSON parse error:', e);
      alert('Invalid JSON: ' + e.message);
    }
  });
});
