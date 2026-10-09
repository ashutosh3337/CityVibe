/**
 * CityVibe - Main Frontend Application Logic
 * Integrates Leaflet Maps, Real-time Sensor Polling, Benchmark Comparisons,
 * Safe Route Simulation, Citizen Reporting, and AI Concierge.
 */

// Global State
let pois = [];
let safetyZones = [];
let citizenReports = [];
let benchmarkData = {};
let map = null;
let poiLayerGroup = null;
let hazardLayerGroup = null;
let reportsLayerGroup = null;
let routeLayerGroup = null;
let selectedCategory = 'all';
let currentMediaType = 'text';
let currentSelectedPoi = null;

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initMap();
  await loadInitialData();
  setupRouteDropdowns();
  setupBenchmarkDropdowns();
  runBenchmarkComparison();
  renderReportsFeed();
  startSensorTicker();
});

// Theme Management (Dark & Light Mode Toggle + Persistence)
function initTheme() {
  const savedTheme = localStorage.getItem('cityvibe_theme') || 'dark';
  applyTheme(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cityvibe_theme', theme);
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon) icon.innerText = theme === 'dark' ? '🌙' : '☀️';
  if (label) label.innerText = theme === 'dark' ? 'Dark' : 'Light';
}

// Mobile Sidebar Toggle
function toggleMobileSidebar() {
  const panel = document.getElementById('sidebarPanel');
  if (panel) {
    panel.classList.toggle('mobile-open');
    const btnText = document.getElementById('mobileSidebarText');
    if (btnText) {
      btnText.innerText = panel.classList.contains('mobile-open') ? 'Close Hotspots' : 'View Hotspots';
    }
  }
}

// Switch Tab Navigation
function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  const activePane = document.getElementById(tabId);
  if (activePane) activePane.classList.add('active');

  const navBtn = document.getElementById(`nav-${tabId.replace('tab-', '')}`);
  if (navBtn) navBtn.classList.add('active');

  if (tabId === 'tab-explore' && map) {
    setTimeout(() => map.invalidateSize(), 200);
  } else if (tabId === 'tab-route') {
    if (!routeMap) initRouteMap();
    if (routeMap) setTimeout(() => routeMap.invalidateSize(), 200);
  }
}

// 1. Map Initialization with Leaflet + OpenStreetMap (100% Free & Zero Key Required)
function initMap() {
  const mapElement = document.getElementById('leafletMap');
  if (!mapElement) return;

  // Center on Pune City, Maharashtra
  map = L.map('leafletMap', {
    center: [18.5204, 73.8567],
    zoom: 13,
    zoomControl: true
  });

  // OpenStreetMap standard tiles (100% free, authorized, zero API key watermarks)
  const osmTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19
  });

  osmTile.addTo(map);

  poiLayerGroup = L.layerGroup().addTo(map);
  hazardLayerGroup = L.layerGroup().addTo(map);
  reportsLayerGroup = L.layerGroup().addTo(map);
  routeLayerGroup = L.layerGroup().addTo(map);
}

// 2. Fetch Data from FastAPI Backend with Resilient Fallback
async function loadInitialData() {
  try {
    const [poisRes, safetyRes, reportsRes, benchmarksRes, statusRes] = await Promise.all([
      fetch('/api/pois'),
      fetch('/api/safety-zones'),
      fetch('/api/reports'),
      fetch('/api/benchmarks'),
      fetch('/api/live-status')
    ]);

    pois = await poisRes.json();
    safetyZones = await safetyRes.json();
    citizenReports = await reportsRes.json();
    benchmarkData = await benchmarksRes.json();
    const liveStatus = await statusRes.json();

    updateSensorBar(liveStatus.conditions, liveStatus.geminiConfigured);
    applyCombinedFilters();
  } catch (err) {
    console.warn('API fetch failed, loading local dataset fallback:', err);
    try {
      const fallbackRes = await fetch('/dataset.json');
      const fallback = await fallbackRes.json();
      pois = fallback.pois || [];
      safetyZones = fallback.safetyZones || [];
      citizenReports = fallback.citizenReports || [];
      benchmarkData = fallback.benchmarks || {};
      updateSensorBar(fallback.liveConditions, false);
      applyCombinedFilters();
    } catch(fallbackErr) {
      console.error('Failed to load dataset fallback:', fallbackErr);
    }
  }
}

// Render POI Sidebar with real images, null-safety and defensive defaults
function renderPoiList(items) {
  const container = document.getElementById('poiListContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!items || items.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No locations found for this filter.</div>`;
    return;
  }

  items.forEach(poi => {
    const card = document.createElement('div');
    card.className = 'poi-card';
    card.id = `poi-card-${poi.id || 'unknown'}`;
    card.onclick = () => selectPoi(poi);

    const category = poi.category || 'culture';
    const badgeClass = `badge-${category}`;
    const name = poi.name || 'Unnamed Landmark';
    const rating = poi.rating !== undefined && poi.rating !== null ? poi.rating : '4.5';
    const safetyScore = poi.safetyScore !== undefined && poi.safetyScore !== null ? poi.safetyScore : '4.5';
    const cleanlinessScore = poi.cleanlinessScore !== undefined && poi.cleanlinessScore !== null ? poi.cleanlinessScore : '4.2';
    const description = poi.description || 'Verified urban exploration destination with safety assessment.';
    const neighborhood = poi.neighborhood || 'City Center';
    const imageUrl = poi.imageUrl || 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=600&q=80';

    card.innerHTML = `
      <div class="poi-card-img-wrap">
        <img src="${imageUrl}" alt="${name}" class="poi-card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=600&q=80'">
        <span class="badge ${badgeClass} poi-card-overlay-badge">${category}</span>
        <div class="poi-card-overlay-rating">★ ${rating}</div>
      </div>
      <div class="poi-card-body">
        <div class="poi-title">${name}</div>
        <div class="poi-neighborhood-tag">📍 ${neighborhood}</div>
        <div class="poi-scores">
          <span class="score-badge">🛡️ Safety: <strong style="color: var(--accent-emerald)">${safetyScore}/5</strong></span>
          <span class="score-badge">🧹 Clean: <strong>${cleanlinessScore}/5</strong></span>
        </div>
        <p class="poi-desc">${description}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

// Render Map Markers (POIs, Hazards, Citizen Alerts)
function renderMapMarkers() {
  poiLayerGroup.clearLayers();
  hazardLayerGroup.clearLayers();
  reportsLayerGroup.clearLayers();

  // 1. POI Markers
  pois.forEach(poi => {
    if (selectedCity !== 'all' && (poi.city || 'pune').toLowerCase() !== selectedCity.toLowerCase()) return;
    if (selectedCategory !== 'all' && poi.category !== selectedCategory) return;

    let iconColor = '#06b6d4';
    if (poi.category === 'heritage') iconColor = '#8b5cf6';
    else if (poi.category === 'food') iconColor = '#f59e0b';
    else if (poi.category === 'fashion') iconColor = '#ec4899';
    else if (poi.category === 'hotel') iconColor = '#10b981';

    const customIcon = L.divIcon({
      className: 'custom-poi-marker',
      html: `<div style="background: ${iconColor}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5);">📍</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([poi.lat, poi.lng], { icon: customIcon }).addTo(poiLayerGroup);
    marker.bindPopup(`
      <div style="color: #111; font-family: sans-serif; font-size: 0.85rem;">
        <strong style="font-size: 0.95rem;">${poi.name}</strong><br>
        <span style="color: #666;">${poi.type} • ${poi.neighborhood}</span><br>
        <div style="margin-top: 0.4rem; display: flex; gap: 0.5rem;">
          <span>🛡️ Safety: <b>${poi.safetyScore}/5</b></span>
          <span>★ <b>${poi.rating}</b></span>
        </div>
        <button style="margin-top: 0.5rem; background: #06b6d4; color: #fff; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer;" onclick="openPoiModalById('${poi.id}')">View Details & History</button>
      </div>
    `);
    marker.on('click', () => selectPoi(poi));
  });

  // 2. Safety Hazard Zones (Red/Orange Polygons & Circles)
  safetyZones.forEach(zone => {
    const circleColor = zone.severity === 'high' ? '#f43f5e' : '#f59e0b';
    const circle = L.circle([zone.lat, zone.lng], {
      color: circleColor,
      fillColor: circleColor,
      fillOpacity: 0.25,
      radius: zone.radius || 400
    }).addTo(hazardLayerGroup);

    circle.bindPopup(`
      <div style="color: #111; font-family: sans-serif; font-size: 0.85rem;">
        <span style="background: #f43f5e; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">${zone.type.toUpperCase()}</span>
        <h4 style="margin: 4px 0;">${zone.name}</h4>
        <p style="color: #444; margin: 4px 0;">${zone.reason}</p>
        <small style="color: #d97706;"><b>Precaution:</b> ${zone.recommendedPrecaution}</small>
      </div>
    `);
  });

  // 3. Citizen Live Alerts Markers
  citizenReports.forEach(rep => {
    if (!rep.lat || !rep.lng) return;
    const repIcon = L.divIcon({
      className: 'custom-rep-marker',
      html: `<div style="background: #e11d48; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; border: 2px solid #fff;">!</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    const repMarker = L.marker([rep.lat, rep.lng], { icon: repIcon }).addTo(reportsLayerGroup);
    repMarker.bindPopup(`
      <div style="color: #111; font-family: sans-serif; font-size: 0.85rem;">
        <strong style="color: #e11d48;">📢 Verified Citizen Report</strong>
        <div style="font-weight: 600; margin-top: 2px;">${rep.title}</div>
        <p style="color: #555; margin: 3px 0;">${rep.description}</p>
        <small style="color: #888;">Reported by ${rep.author} (${rep.timeAgo})</small>
      </div>
    `);
  });
}

// Select and focus POI
function selectPoi(poi) {
  currentSelectedPoi = poi;
  document.querySelectorAll('.poi-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`poi-card-${poi.id}`);
  if (card) {
    card.classList.add('selected');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (map) {
    map.flyTo([poi.lat, poi.lng], 15, { duration: 1.2 });
  }
}

// Global State
let selectedCity = 'pune';

// Change City Filter & Pan Map
function changeCityFilter(city) {
  selectedCity = city;
  
  // Dynamic Map Views for Major Indian Metros or All India
  const cityCenters = {
    'all': { coords: [21.5937, 78.9629], zoom: 5, temp: '27°C', aqi: '68 (Moderate)', traffic: '36% Normal' },
    'pune': { coords: [18.5204, 73.8567], zoom: 13, temp: '26°C', aqi: '62 (Good)', traffic: '32% Smooth' },
    'mumbai': { coords: [19.0760, 72.8777], zoom: 12, temp: '29°C', aqi: '82 (Moderate)', traffic: '48% Heavy' },
    'delhi': { coords: [28.6139, 77.2090], zoom: 12, temp: '28°C', aqi: '135 (Caution)', traffic: '52% Heavy' },
    'bengaluru': { coords: [12.9716, 77.5946], zoom: 12, temp: '24°C', aqi: '55 (Good)', traffic: '42% Moderate' },
    'jaipur': { coords: [26.9124, 75.7873], zoom: 12, temp: '30°C', aqi: '78 (Moderate)', traffic: '28% Smooth' }
  };

  const target = cityCenters[city] || cityCenters['pune'];
  if (map) {
    map.flyTo(target.coords, target.zoom, { duration: 1.5 });
  }

  const tempEl = document.getElementById('sensorTemp');
  const aqiEl = document.getElementById('sensorAqi');
  const trafficEl = document.getElementById('sensorTraffic');
  if (tempEl) tempEl.innerText = target.temp;
  if (aqiEl) aqiEl.innerText = target.aqi;
  if (trafficEl) trafficEl.innerText = target.traffic;

  // Filter POIs according to city & category
  applyCombinedFilters();
}

function applyCombinedFilters() {
  let filtered = pois;
  if (selectedCity !== 'all') {
    filtered = filtered.filter(p => (p.city || 'pune').toLowerCase() === selectedCity.toLowerCase());
  }
  if (selectedCategory !== 'all') {
    filtered = filtered.filter(p => p.category === selectedCategory);
  }
  renderPoiList(filtered);
  renderMapMarkers();
}

// Filter POI Categories
function filterCategory(cat, el) {
  selectedCategory = cat;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  applyCombinedFilters();
}

// Toggle Map Layers
function toggleMapLayer(type) {
  if (type === 'pois') {
    const checked = document.getElementById('layerTogglePoi').checked;
    if (checked) map.addLayer(poiLayerGroup); else map.removeLayer(poiLayerGroup);
  } else if (type === 'hazards') {
    const checked = document.getElementById('layerToggleHazards').checked;
    if (checked) map.addLayer(hazardLayerGroup); else map.removeLayer(hazardLayerGroup);
  } else if (type === 'reports') {
    const checked = document.getElementById('layerToggleReports').checked;
    if (checked) map.addLayer(reportsLayerGroup); else map.removeLayer(reportsLayerGroup);
  }
}

// POI Details Modal with safe fallbacks
function openPoiModalById(poiId) {
  const poi = pois.find(p => p.id === poiId);
  if (!poi) return;
  currentSelectedPoi = poi;

  const titleEl = document.getElementById('modalPoiTitle');
  const neighEl = document.getElementById('modalPoiNeighborhood');
  const badgeEl = document.getElementById('modalPoiBadge');
  const ratingEl = document.getElementById('modalPoiRating');
  const priceEl = document.getElementById('modalPoiPrice');
  const safetyEl = document.getElementById('modalPoiSafety');
  const cleanEl = document.getElementById('modalPoiClean');
  const hoursEl = document.getElementById('modalPoiHours');
  const descEl = document.getElementById('modalPoiDesc');
  const histEl = document.getElementById('modalPoiHistory');
  const imgEl = document.getElementById('modalPoiImage');

  if (titleEl) titleEl.innerText = poi.name || 'Verified Destination';
  if (neighEl) neighEl.innerText = `${poi.type || 'Urban Hotspot'} • ${poi.neighborhood || 'City Center'}`;
  if (badgeEl) {
    badgeEl.innerText = poi.category || 'culture';
    badgeEl.className = `badge badge-${poi.category || 'culture'}`;
  }
  if (ratingEl) ratingEl.innerText = `★ ${poi.rating !== undefined ? poi.rating : '4.5'}`;
  if (priceEl) priceEl.innerText = poi.priceLevel || 'Budget-Friendly';
  if (safetyEl) safetyEl.innerText = `${poi.safetyScore !== undefined ? poi.safetyScore : '4.5'} / 5`;
  if (cleanEl) cleanEl.innerText = `${poi.cleanlinessScore !== undefined ? poi.cleanlinessScore : '4.2'} / 5`;
  if (hoursEl) hoursEl.innerText = poi.bestTimeToVisit || '10:00 AM - 8:00 PM';
  if (descEl) descEl.innerText = poi.description || 'Rich urban hotspot with safety monitoring.';
  if (histEl) histEl.innerText = poi.history || 'An integral landmark shaping the local cultural and historical heritage of the city.';
  if (imgEl) imgEl.src = poi.imageUrl || 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=800&q=80';

  const backdrop = document.getElementById('poiModalBackdrop');
  if (backdrop) backdrop.classList.add('open');
}

function closePoiModal(e) {
  document.getElementById('poiModalBackdrop').classList.remove('open');
}

function navigateFromModal() {
  closePoiModal();
  switchTab('tab-route');
  if (currentSelectedPoi) {
    const destSelect = document.getElementById('routeDestination');
    if (destSelect) {
      destSelect.value = currentSelectedPoi.id;
      calculateRoutePlan();
    }
  }
}

// 3. Safe Route Navigator Logic
let routeMap = null;
let routeMapSafeLayer = null;
let routeMapFastLayer = null;
let routeMapMarkersLayer = null;

function initRouteMap() {
  const el = document.getElementById('routeMap');
  if (!el || routeMap) return;

  routeMap = L.map('routeMap', {
    center: [18.5204, 73.8567],
    zoom: 12,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  }).addTo(routeMap);

  routeMapSafeLayer = L.layerGroup().addTo(routeMap);
  routeMapFastLayer = L.layerGroup().addTo(routeMap);
  routeMapMarkersLayer = L.layerGroup().addTo(routeMap);
}

function setupRouteDropdowns() {
  initRouteMap();
  const originSelect = document.getElementById('routeOrigin');
  const destSelect = document.getElementById('routeDestination');
  if (!originSelect || !destSelect) return;

  originSelect.innerHTML = '';
  destSelect.innerHTML = '';

  pois.forEach((p, idx) => {
    const optA = new Option(`${p.name} (${p.neighborhood})`, p.id);
    const optB = new Option(`${p.name} (${p.neighborhood})`, p.id);
    originSelect.add(optA);
    destSelect.add(optB);
  });

  if (pois.length > 3) {
    originSelect.selectedIndex = 0; // Shaniwar Wada
    destSelect.selectedIndex = 1; // Aga Khan Palace
  }
}

async function calculateRoutePlan() {
  const originId = document.getElementById('routeOrigin').value;
  const destId = document.getElementById('routeDestination').value;
  const container = document.getElementById('routeResultsContainer');

  if (originId === destId) {
    container.innerHTML = `<div style="color: var(--accent-rose); padding: 1.5rem;">Origin and destination must be different landmarks.</div>`;
    return;
  }

  container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">⚡ Calculating safety-weighted and direct corridors...</div>`;

  try {
    const res = await fetch('/api/route-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originPoiId: originId, destPoiId: destId })
    });

    const data = await res.json();
    renderRouteResults(data);
  } catch (err) {
    container.innerHTML = `<div style="color: var(--accent-rose);">Failed to calculate route: ${err.message}</div>`;
  }
}

function openInGoogleMaps(originCoords, destCoords) {
  if (!originCoords || !destCoords) return;
  const url = `https://www.google.com/maps/dir/?api=1&origin=${originCoords[0]},${originCoords[1]}&destination=${destCoords[0]},${destCoords[1]}&travelmode=driving`;
  window.open(url, '_blank');
}

function renderRouteResults(data) {
  const container = document.getElementById('routeResultsContainer');
  const { fastestRoute, safestRoute, origin, destination, originCoords, destCoords } = data;

  const oLat = originCoords ? originCoords[0] : 18.5204;
  const oLng = originCoords ? originCoords[1] : 73.8567;
  const dLat = destCoords ? destCoords[0] : 18.5524;
  const dLng = destCoords ? destCoords[1] : 73.9015;

  container.innerHTML = `
    <!-- Safest Recommended Route -->
    <div class="route-card safest" style="cursor: pointer;" onclick="focusRouteOnMap('safe')">
      <div class="route-card-header">
        <div>
          <span class="badge badge-hotel">🌟 ${safestRoute.badge}</span>
          <h3 style="margin-top: 0.35rem; font-size: 1.15rem; color: var(--accent-emerald);">${safestRoute.name}</h3>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">${origin} ➔ ${destination}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 1.3rem; font-weight: 800; color: var(--accent-emerald);">${safestRoute.durationMins} mins</span>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${safestRoute.distanceKm} km</div>
        </div>
      </div>

      <div class="route-stats-grid">
        <div class="stat-box">
          <span>Safety Index</span>
          <strong style="color: var(--accent-emerald);">${safestRoute.safetyScore}/100</strong>
        </div>
        <div class="stat-box">
          <span>Lighting & CCTV</span>
          <strong style="font-size: 0.8rem; color: var(--accent-cyan);">${safestRoute.lighting}</strong>
        </div>
        <div class="stat-box">
          <span>Incident Risk</span>
          <strong style="color: var(--accent-emerald);">Minimal / Zero</strong>
        </div>
      </div>

      <ul style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 1.25rem; line-height: 1.5; margin-bottom: 1rem;">
        ${safestRoute.alerts.map(a => `<li>✅ ${a}</li>`).join('')}
      </ul>

      <button class="btn-primary" style="background: var(--gradient-safe); padding: 0.65rem 1rem; font-size: 0.85rem; width: 100%;" onclick="event.stopPropagation(); openInGoogleMaps([${oLat}, ${oLng}], [${dLat}, ${dLng}])">
        <span>🗺️ Open Directions in Google Maps</span>
      </button>
    </div>

    <!-- Fastest Direct Route -->
    <div class="route-card fastest" style="cursor: pointer;" onclick="focusRouteOnMap('fast')">
      <div class="route-card-header">
        <div>
          <span class="badge badge-food">⚡ ${fastestRoute.badge}</span>
          <h3 style="margin-top: 0.35rem; font-size: 1.15rem; color: var(--accent-amber);">${fastestRoute.name}</h3>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">${origin} ➔ ${destination}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 1.3rem; font-weight: 800; color: var(--accent-amber);">${fastestRoute.durationMins} mins</span>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${fastestRoute.distanceKm} km</div>
        </div>
      </div>

      <div class="route-stats-grid">
        <div class="stat-box">
          <span>Safety Index</span>
          <strong style="color: var(--accent-amber);">${fastestRoute.safetyScore}/100</strong>
        </div>
        <div class="stat-box">
          <span>Lighting Condition</span>
          <strong style="font-size: 0.8rem;">${fastestRoute.lighting}</strong>
        </div>
        <div class="stat-box">
          <span>Traffic Level</span>
          <strong style="color: var(--accent-amber);">Moderate / Peak</strong>
        </div>
      </div>

      <ul style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 1.25rem; line-height: 1.5; margin-bottom: 1rem;">
        ${fastestRoute.alerts.map(a => `<li>⚠️ ${a}</li>`).join('')}
      </ul>

      <button class="btn-primary" style="background: rgba(255,255,255,0.1); border: 1px solid var(--border-glass); padding: 0.65rem 1rem; font-size: 0.85rem; width: 100%;" onclick="event.stopPropagation(); openInGoogleMaps([${oLat}, ${oLng}], [${dLat}, ${dLng}])">
        <span>🗺️ Open Directions in Google Maps</span>
      </button>
    </div>
  `;

  // Draw on both main map and dedicated routeMap
  routeLayerGroup.clearLayers();
  if (safestRoute.coordinates) {
    L.polyline(safestRoute.coordinates, { color: '#10b981', weight: 6, opacity: 0.9 }).addTo(routeLayerGroup);
  }
  if (fastestRoute.coordinates) {
    L.polyline(fastestRoute.coordinates, { color: '#f59e0b', weight: 4, opacity: 0.7, dashArray: '6, 6' }).addTo(routeLayerGroup);
  }

  // Draw on dedicated route tab map
  if (!routeMap) initRouteMap();
  if (routeMap) {
    setTimeout(() => routeMap.invalidateSize(), 150);
    routeMapSafeLayer.clearLayers();
    routeMapFastLayer.clearLayers();
    routeMapMarkersLayer.clearLayers();

    if (safestRoute.coordinates) {
      L.polyline(safestRoute.coordinates, { color: '#10b981', weight: 6, opacity: 0.9 }).addTo(routeMapSafeLayer);
    }
    if (fastestRoute.coordinates) {
      L.polyline(fastestRoute.coordinates, { color: '#f59e0b', weight: 4, opacity: 0.7, dashArray: '6, 6' }).addTo(routeMapFastLayer);
    }

    // Origin & Destination markers
    const originIcon = L.divIcon({
      className: 'route-marker-origin',
      html: `<div style="background: #06b6d4; color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; border: 2px solid #fff; box-shadow: 0 0 8px rgba(0,0,0,0.5);">A</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    const destIcon = L.divIcon({
      className: 'route-marker-dest',
      html: `<div style="background: #10b981; color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; border: 2px solid #fff; box-shadow: 0 0 8px rgba(0,0,0,0.5);">B</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    if (originCoords) L.marker(originCoords, { icon: originIcon }).addTo(routeMapMarkersLayer).bindPopup(`<b>Start:</b> ${origin}`);
    if (destCoords) L.marker(destCoords, { icon: destIcon }).addTo(routeMapMarkersLayer).bindPopup(`<b>Destination:</b> ${destination}`);

    if (safestRoute.coordinates && safestRoute.coordinates.length > 0) {
      const bounds = L.latLngBounds(safestRoute.coordinates);
      routeMap.fitBounds(bounds, { padding: [40, 40] });
    }
  }
}

function focusRouteOnMap(type) {
  if (!routeMap) return;
  if (type === 'safe' && routeMapSafeLayer) {
    routeMap.flyTo(routeMap.getCenter(), routeMap.getZoom(), { duration: 0.5 });
  }
}

// 4. Best vs. Worst Benchmark Comparison
function setupBenchmarkDropdowns() {
  const selA = document.getElementById('compareAreaA');
  const selB = document.getElementById('compareAreaB');
  if (!selA || !selB) return;

  selA.innerHTML = '';
  selB.innerHTML = '';

  const areas = Object.keys(benchmarkData);
  areas.forEach(a => {
    selA.add(new Option(a, a));
    selB.add(new Option(a, a));
  });

  if (areas.length > 1) {
    selA.selectedIndex = 0; // Colaba & Fort
    selB.selectedIndex = 1; // Bandra West
  }
}

function runBenchmarkComparison() {
  const selA = document.getElementById('compareAreaA').value;
  const selB = document.getElementById('compareAreaB').value;
  const wrap = document.getElementById('benchmarkResultsWrap');

  const areaA = benchmarkData[selA];
  const areaB = benchmarkData[selB];

  if (!areaA || !areaB) return;

  wrap.innerHTML = `
    <table class="vibe-table">
      <thead>
        <tr>
          <th style="width: 28%;">Evaluation Metric</th>
          <th style="width: 36%; color: var(--accent-cyan); font-size: 0.95rem;">${areaA.name}</th>
          <th style="width: 36%; color: var(--accent-purple); font-size: 0.95rem;">${areaB.name}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Overall Vibe Score</strong></td>
          <td>
            <span style="font-size: 1.2rem; font-weight: 800; color: var(--accent-cyan);">${areaA.overallScore}/100</span>
            <div class="meter-bar"><div class="meter-fill fill-emerald" style="width: ${areaA.overallScore}%;"></div></div>
          </td>
          <td>
            <span style="font-size: 1.2rem; font-weight: 800; color: var(--accent-purple);">${areaB.overallScore}/100</span>
            <div class="meter-bar"><div class="meter-fill fill-emerald" style="width: ${areaB.overallScore}%;"></div></div>
          </td>
        </tr>
        <tr>
          <td>🛡️ <strong>Safety & Night Security</strong></td>
          <td>
            <strong>${areaA.safety} / 100</strong>
            <div class="meter-bar"><div class="meter-fill fill-emerald" style="width: ${areaA.safety}%;"></div></div>
            <small style="color: var(--text-muted); font-size: 0.75rem;">Crime rate: ${areaA.crimeRate}</small>
          </td>
          <td>
            <strong>${areaB.safety} / 100</strong>
            <div class="meter-bar"><div class="meter-fill fill-emerald" style="width: ${areaB.safety}%;"></div></div>
            <small style="color: var(--text-muted); font-size: 0.75rem;">Crime rate: ${areaB.crimeRate}</small>
          </td>
        </tr>
        <tr>
          <td>🧹 <strong>Cleanliness & Sanitation</strong></td>
          <td>
            <strong>${areaA.cleanliness} / 100</strong>
            <div class="meter-bar"><div class="meter-fill fill-blue" style="width: ${areaA.cleanliness}%;"></div></div>
          </td>
          <td>
            <strong>${areaB.cleanliness} / 100</strong>
            <div class="meter-bar"><div class="meter-fill fill-blue" style="width: ${areaB.cleanliness}%;"></div></div>
          </td>
        </tr>
        <tr>
          <td>💰 <strong>Budget & Affordability</strong></td>
          <td>
            <strong>${areaA.affordability} / 100</strong>
            <div class="meter-bar"><div class="meter-fill fill-amber" style="width: ${areaA.affordability}%;"></div></div>
          </td>
          <td>
            <strong>${areaB.affordability} / 100</strong>
            <div class="meter-bar"><div class="meter-fill fill-amber" style="width: ${areaB.affordability}%;"></div></div>
          </td>
        </tr>
        <tr>
          <td>⭐ <strong>User Ratings & Experience</strong></td>
          <td>
            <strong>${areaA.ratings} / 100</strong>
            <div class="meter-bar"><div class="meter-fill fill-purple" style="width: ${areaA.ratings}%;"></div></div>
          </td>
          <td>
            <strong>${areaB.ratings} / 100</strong>
            <div class="meter-bar"><div class="meter-fill fill-purple" style="width: ${areaB.ratings}%;"></div></div>
          </td>
        </tr>
        <tr>
          <td>🚆 <strong>Transit & Accessibility</strong></td>
          <td>
            <strong>${areaA.accessibility} / 100</strong>
            <small style="display:block; color: var(--text-muted); font-size: 0.75rem;">${areaA.transitScore}</small>
          </td>
          <td>
            <strong>${areaB.accessibility} / 100</strong>
            <small style="display:block; color: var(--text-muted); font-size: 0.75rem;">${areaB.transitScore}</small>
          </td>
        </tr>
        <tr>
          <td><strong>Highlights & Pros</strong></td>
          <td>
            <ul style="padding-left: 1rem; font-size: 0.8rem; color: var(--text-secondary);">
              ${areaA.topPros.map(p => `<li>${p}</li>`).join('')}
            </ul>
          </td>
          <td>
            <ul style="padding-left: 1rem; font-size: 0.8rem; color: var(--text-secondary);">
              ${areaB.topPros.map(p => `<li>${p}</li>`).join('')}
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

// 5. Citizen Multimodal Reporting
function setMediaType(type) {
  currentMediaType = type;
  document.querySelectorAll('#btnMediaText, #btnMediaVoice, #btnMediaPhoto').forEach(b => b.classList.remove('active'));
  
  if (type === 'text') document.getElementById('btnMediaText').classList.add('active');
  if (type === 'voice_note') document.getElementById('btnMediaVoice').classList.add('active');
  if (type === 'photo') document.getElementById('btnMediaPhoto').classList.add('active');

  document.getElementById('voiceRecorderPreview').style.display = type === 'voice_note' ? 'flex' : 'none';
  document.getElementById('photoInputWrap').style.display = type === 'photo' ? 'block' : 'none';
}

async function submitCitizenReport() {
  const category = document.getElementById('repCategory').value;
  const neighborhood = document.getElementById('repNeighborhood').value;
  const title = document.getElementById('repTitle').value.trim();
  const description = document.getElementById('repDescription').value.trim();
  const photoUrl = document.getElementById('repPhotoUrl')?.value.trim();

  if (!title || !description) {
    alert('Please provide both an incident summary title and description.');
    return;
  }

  const payload = {
    category,
    neighborhood,
    title,
    description,
    mediaType: currentMediaType,
    imageUrl: photoUrl || (currentMediaType === 'photo' ? 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f6?auto=format&fit=crop&w=600&q=80' : null)
  };

  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'success') {
      citizenReports.unshift(data.report);
      renderReportsFeed();
      renderMapMarkers();
      
      // Reset form
      document.getElementById('repTitle').value = '';
      document.getElementById('repDescription').value = '';
      setMediaType('text');
      alert('Report verified and added to live city intelligence map!');
    }
  } catch (err) {
    alert('Failed to submit report: ' + err.message);
  }
}

function renderReportsFeed() {
  const feed = document.getElementById('reportsFeedContainer');
  if (!feed) return;
  feed.innerHTML = '';

  document.getElementById('liveFeedBadge').innerText = `● ${citizenReports.length} Active Alerts`;

  citizenReports.forEach(rep => {
    const card = document.createElement('div');
    card.className = 'report-item-card';

    const hazardBadge = rep.hazardLevel === 'High' 
      ? '<span class="badge badge-safety">High Hazard</span>' 
      : rep.hazardLevel === 'Medium' 
      ? '<span class="badge badge-food">Medium Caution</span>' 
      : '<span class="badge badge-hotel">Verified Info</span>';

    const mediaSnippet = rep.mediaType === 'voice_note' 
      ? `<div class="voice-wave-player"><span>🎙️ Voice Note (${rep.audioDuration || '0:15'})</span><button style="background: var(--accent-cyan); color:#fff; border:none; padding: 2px 8px; border-radius: 4px; cursor:pointer;" onclick="playVoiceSimulation(this)">▶ Play</button></div>`
      : rep.mediaType === 'photo' && rep.imageUrl
      ? `<img src="${rep.imageUrl}" style="width: 100%; height: 140px; object-fit: cover; border-radius: var(--radius-sm); margin-top: 0.5rem;">`
      : '';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          ${hazardBadge}
          <h4 style="margin-top: 0.35rem; font-size: 0.95rem;">${rep.title}</h4>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${rep.neighborhood} • by ${rep.author} (${rep.timeAgo})</span>
        </div>
        <button class="upvote-btn" onclick="upvoteReport('${rep.id}', this)">
          👍 <span>${rep.upvotes}</span>
        </button>
      </div>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">${rep.description}</p>
      ${mediaSnippet}
    `;
    feed.appendChild(card);
  });
}

async function upvoteReport(reportId, btn) {
  try {
    const res = await fetch(`/api/reports/${reportId}/upvote`, { method: 'POST' });
    const data = await res.json();
    if (data.status === 'success') {
      const rep = citizenReports.find(r => r.id === reportId);
      if (rep) rep.upvotes = data.upvotes;
      btn.querySelector('span').innerText = data.upvotes;
    }
  } catch (err) {
    console.error('Failed to upvote:', err);
  }
}

function playVoiceSimulation(btn) {
  btn.innerText = '🔊 Playing...';
  setTimeout(() => { btn.innerText = '▶ Play'; }, 2000);
}

// 6. AI City Concierge Chat
function askPresetPrompt(txt) {
  document.getElementById('chatInput').value = txt;
  sendChatMessage();
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const query = input.value.trim();
  if (!query) return;

  const history = document.getElementById('chatHistoryContainer');
  
  // Append user message
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.innerHTML = `
    <div class="chat-avatar avatar-user">👤</div>
    <div class="msg-bubble">${query}</div>
  `;
  history.appendChild(userMsg);
  input.value = '';

  // Append AI loading placeholder
  const aiMsg = document.createElement('div');
  aiMsg.className = 'chat-msg';
  aiMsg.innerHTML = `
    <div class="chat-avatar avatar-ai">🤖</div>
    <div class="msg-bubble"><em>CityVibe AI analyzing safety zones, historical context, and local recommendations...</em></div>
  `;
  history.appendChild(aiMsg);
  history.scrollTop = history.scrollHeight;

  try {
    const res = await fetch('/api/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: query })
    });

    const data = await res.json();
    
    // Parse formatting (simple markdown replacement)
    const formatted = data.answer
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');

    aiMsg.querySelector('.msg-bubble').innerHTML = `
      ${formatted}
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem; text-align: right;">Engine: ${data.model}</div>
    `;
  } catch (err) {
    aiMsg.querySelector('.msg-bubble').innerHTML = `<span style="color: var(--accent-rose);">Error getting recommendations: ${err.message}</span>`;
  }
  history.scrollTop = history.scrollHeight;
}

// 7. Sensor & AI Engine Updates
function updateSensorBar(cond, geminiConfigured) {
  const cityEl = document.getElementById('sensorCity');
  const tempEl = document.getElementById('sensorTemp');
  const aqiEl = document.getElementById('sensorAqi');
  const trafficEl = document.getElementById('sensorTraffic');
  const pill = document.getElementById('aiStatusPill');

  if (cond) {
    // Extract weather whether nested inside cond.weather or provided directly
    const weatherData = cond.weather || cond;
    const city = weatherData.city || 'Mumbai Metro';
    const temp = weatherData.tempC !== undefined ? `${weatherData.tempC}°C` : '29°C';
    const aqi = weatherData.airQualityIndex !== undefined 
      ? `${weatherData.airQualityIndex} (${weatherData.airQualityStatus || 'Good'})` 
      : '74 (Good)';
    
    // Extract traffic condition
    const trafficData = cond.trafficIndex || cond;
    const traffic = trafficData.overallCityCongestion || '38% Moderate';

    if (cityEl) cityEl.innerText = city;
    if (tempEl) tempEl.innerText = temp;
    if (aqiEl) aqiEl.innerText = aqi;
    if (trafficEl) trafficEl.innerText = traffic;
  } else {
    if (cityEl) cityEl.innerText = 'Mumbai Metro';
    if (tempEl) tempEl.innerText = '29°C';
    if (aqiEl) aqiEl.innerText = '74 (Good)';
    if (trafficEl) trafficEl.innerText = '38% Moderate';
  }

  if (pill) {
    pill.innerText = '⚡ AI Engine: Ready (Offline)';
    pill.className = 'badge badge-culture';
  }
}

function startSensorTicker() {
  setInterval(async () => {
    try {
      const res = await fetch('/api/live-status');
      const data = await res.json();
      updateSensorBar(data.conditions, false);
    } catch (e) {}
  }, 30000);
}

// 8. AI Engine Controls (Smart Offline Engine is 100% Default & Active)
function openApiKeyModal(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const modal = document.getElementById('apiKeyModalBackdrop');
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('open');
      const input = document.getElementById('aiModalInput');
      if (input) input.focus();
    }, 10);
  }
}

function closeApiKeyModal(e) {
  if (e && e.target && e.target !== e.currentTarget && !e.target.classList.contains('close-btn')) return;
  const modal = document.getElementById('apiKeyModalBackdrop');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 200);
  }
}

function useOfflineEngine(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  try {
    localStorage.setItem('cityvibe_ai_engine', 'offline');
  } catch(err) {}
  
  const modal = document.getElementById('apiKeyModalBackdrop');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 200);
  }
  updateSensorBar(null, false);
}

function askAiModalPrompt(text) {
  const input = document.getElementById('aiModalInput');
  if (input) {
    input.value = text;
    sendAiModalQuery();
  }
}

async function sendAiModalQuery() {
  const input = document.getElementById('aiModalInput');
  const chatBox = document.getElementById('aiModalChatBox');
  if (!input || !chatBox) return;

  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  // Append user query
  chatBox.innerHTML += `
    <div style="margin-top: 0.85rem; padding: 0.6rem 0.85rem; background: var(--gradient-brand); color: #fff; border-radius: var(--radius-md); font-weight: 600;">
      👤 ${text}
    </div>
    <div id="aiModalLoading" style="margin-top: 0.6rem; color: var(--accent-cyan); font-style: italic;">
      🤖 Synthesizing smart local intelligence...
    </div>
  `;
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const res = await fetch('/api/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, contextCategory: 'all' })
    });

    const data = await res.json();
    const loading = document.getElementById('aiModalLoading');
    if (loading) loading.remove();

    chatBox.innerHTML += `
      <div style="margin-top: 0.75rem; padding: 0.85rem; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-glass); border-radius: var(--radius-md);">
        🤖 <strong>CityVibe Offline AI:</strong><br>
        ${data.response.replace(/\n/g, '<br>')}
      </div>
    `;
  } catch (err) {
    const loading = document.getElementById('aiModalLoading');
    if (loading) loading.remove();
    chatBox.innerHTML += `
      <div style="margin-top: 0.75rem; color: var(--accent-rose);">
        ⚠️ Error: ${err.message}
      </div>
    `;
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}
