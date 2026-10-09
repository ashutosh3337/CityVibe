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
  updateReportNeighborhoodOptions();
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
    zoomControl: true,
    preferCanvas: true
  });

  // OpenStreetMap standard tiles (100% free, authorized, zero API key watermarks)
  const osmTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    keepBuffer: 8,
    crossOrigin: true
  });

  osmTile.addTo(map);

  // Invalidate map size multiple times after layout rendering to eliminate any black rectangular areas
  map.whenReady(() => {
    setTimeout(() => { if (map) map.invalidateSize(); }, 150);
    setTimeout(() => { if (map) map.invalidateSize(); }, 500);
    setTimeout(() => { if (map) map.invalidateSize(); }, 1200);
  });

  poiLayerGroup = L.layerGroup().addTo(map);
  hazardLayerGroup = L.layerGroup().addTo(map);
  reportsLayerGroup = L.layerGroup().addTo(map);
  routeLayerGroup = L.layerGroup().addTo(map);
}

// Global window resize listener to keep map tiles seamless without blank areas
window.addEventListener('resize', () => {
  if (map) map.invalidateSize();
  if (routeMap) routeMap.invalidateSize();
});

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

// Render POI Sidebar with rich place cards, clean typography and null-safety
function renderPoiList(items) {
  const container = document.getElementById('poiListContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!items || items.length === 0) {
    const cityName = selectedCity === 'all' ? 'All Cities' : selectedCity.toUpperCase();
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 3rem 1.5rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-glass); margin: 0.5rem 0;">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📍</div>
        <strong style="color: var(--text-primary); font-size: 0.95rem; display: block; margin-bottom: 0.35rem;">No locations found</strong>
        <span style="font-size: 0.82rem; line-height: 1.4;">No ${selectedCategory !== 'all' ? selectedCategory : ''} places found in ${cityName}. Try selecting a different category or city.</span>
      </div>
    `;
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
    const neighborhood = poi.neighborhood || 'City Center';
    const priceLevel = poi.priceLevel || 'Budget-Friendly';
    const defaultFallbackUrl = 'https://images.unsplash.com/photo-1590766940554-634a7ed41450?auto=format&fit=crop&w=800&q=80';
    const imageUrl = poi.imageUrl || defaultFallbackUrl;
    const vibeScore = Math.round(((safetyScore * 0.4) + (cleanlinessScore * 0.3) + (rating * 0.3)) * 20);

    // Safety Indicator Status
    const isVerySafe = safetyScore >= 4.4;
    const safetyIndicatorText = isVerySafe ? '🛡️ Safe Zone' : '⚠️ Verified Caution';
    const safetyIndicatorClass = isVerySafe ? 'indicator-safe' : 'indicator-caution';

    card.innerHTML = `
      <div class="poi-card-img-wrap">
        <img src="${imageUrl}" alt="${name}" class="poi-card-img" loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="if(this.dataset.fallbackApplied !== '1'){ this.dataset.fallbackApplied = '1'; this.src='${defaultFallbackUrl}'; }">
        <div class="poi-card-gradient-overlay"></div>
        <div class="poi-card-top-tags">
          <span class="badge ${badgeClass} poi-card-overlay-badge">${category}</span>
          <div class="poi-card-overlay-rating">⭐ ${rating}</div>
        </div>
        <div class="poi-card-img-bottom-bar">
          <span class="poi-vibe-pill">✨ Vibe ${vibeScore}%</span>
          <span class="poi-safety-indicator ${safetyIndicatorClass}">${safetyIndicatorText}</span>
        </div>
      </div>
      <div class="poi-card-body">
        <div class="poi-header-row">
          <h3 class="poi-title">${name}</h3>
        </div>
        <div class="poi-neighborhood-tag">
          <span class="loc-pin">📍</span> <span>${neighborhood}</span> • <span class="poi-price-tag">${priceLevel}</span>
        </div>
        <div class="poi-info-highlight" style="font-size: 0.82rem; color: var(--accent-cyan); display: flex; align-items: center; gap: 0.35rem; margin-top: 0.1rem; font-weight: 600;">
          <span>🕒 Best: ${poi.bestTimeToVisit || '10:00 AM - 8:00 PM'}</span>
          <span style="color: var(--text-muted);">•</span>
          <span style="color: var(--text-secondary);">${poi.type || 'Urban Hotspot'}</span>
        </div>
        <p class="poi-desc">${description}</p>
        <div class="poi-scores-row">
          <div class="mini-score-box">
            <span class="mini-label">Safety</span>
            <span class="mini-val text-emerald">${safetyScore}/5</span>
          </div>
          <div class="mini-score-box">
            <span class="mini-label">Cleanliness</span>
            <span class="mini-val text-cyan">${cleanlinessScore}/5</span>
          </div>
          <div class="mini-score-box">
            <span class="mini-label">Rating</span>
            <span class="mini-val text-amber">★ ${rating}</span>
          </div>
        </div>
        <div class="poi-card-actions">
          <button class="btn-card-details" onclick="event.stopPropagation(); openPoiModalById('${poi.id}')">Details</button>
          <button class="btn-card-route" onclick="event.stopPropagation(); routeToPoi('${poi.id}')">🛡️ Safe Route</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Quick Route from Card Action
function routeToPoi(poiId) {
  switchTab('tab-route');
  const destSelect = document.getElementById('routeDestination');
  if (destSelect) {
    destSelect.value = poiId;
    calculateRoutePlan();
  }
}

// Render Map Markers (POIs, Hazards, Citizen Alerts) - strictly filtered by selectedCity
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
      html: `<div style="background: ${iconColor}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5); font-size: 14px;">📍</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([poi.lat, poi.lng], { icon: customIcon }).addTo(poiLayerGroup);
    marker.bindPopup(`
      <div style="color: #111; font-family: sans-serif; font-size: 0.85rem; min-width: 200px;">
        <strong style="font-size: 0.95rem; color: #0f172a;">${poi.name}</strong><br>
        <span style="color: #64748b; font-size: 0.78rem;">${poi.type || 'Hotspot'} • ${poi.neighborhood}</span><br>
        <div style="margin-top: 0.4rem; display: flex; gap: 0.6rem; font-size: 0.8rem;">
          <span>🛡️ Safety: <b style="color: #059669;">${poi.safetyScore}/5</b></span>
          <span>★ <b style="color: #d97706;">${poi.rating}</b></span>
        </div>
        <div style="margin-top: 0.5rem; display: flex; gap: 0.35rem;">
          <button style="flex: 1; background: #0284c7; color: #fff; border: none; padding: 0.35rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer;" onclick="openPoiModalById('${poi.id}')">View Details</button>
          <button style="flex: 1; background: #059669; color: #fff; border: none; padding: 0.35rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer;" onclick="routeToPoi('${poi.id}')">Route</button>
        </div>
      </div>
    `);
    marker.on('click', () => selectPoi(poi));
  });

  // 2. Safety Hazard Zones (Red/Orange Circles) - Filtered to selected city
  safetyZones.forEach(zone => {
    if (selectedCity !== 'all' && (zone.city || 'pune').toLowerCase() !== selectedCity.toLowerCase()) return;

    const circleColor = zone.severity === 'high' ? '#f43f5e' : zone.severity === 'medium' ? '#f59e0b' : '#3b82f6';
    const circle = L.circle([zone.lat, zone.lng], {
      color: circleColor,
      fillColor: circleColor,
      fillOpacity: 0.25,
      radius: zone.radius || 400
    }).addTo(hazardLayerGroup);

    circle.bindPopup(`
      <div style="color: #111; font-family: sans-serif; font-size: 0.85rem; max-width: 240px;">
        <span style="background: ${circleColor}; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">${(zone.type || 'HAZARD').toUpperCase()}</span>
        <h4 style="margin: 6px 0 3px 0; color: #0f172a;">${zone.name}</h4>
        <p style="color: #475569; margin: 3px 0; font-size: 0.8rem;">${zone.reason}</p>
        <small style="color: #d97706; display: block; margin-top: 4px;"><b>Precaution:</b> ${zone.recommendedPrecaution}</small>
      </div>
    `);
  });

  // 3. Citizen Live Alerts Markers - Filtered to selected city
  citizenReports.forEach(rep => {
    if (!rep.lat || !rep.lng) return;
    if (selectedCity !== 'all' && (rep.city || 'pune').toLowerCase() !== selectedCity.toLowerCase()) return;

    const repIcon = L.divIcon({
      className: 'custom-rep-marker',
      html: `<div style="background: #e11d48; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 800; border: 2px solid #fff; box-shadow: 0 0 8px rgba(225,29,72,0.6);">!</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    const repMarker = L.marker([rep.lat, rep.lng], { icon: repIcon }).addTo(reportsLayerGroup);
    repMarker.bindPopup(`
      <div style="color: #111; font-family: sans-serif; font-size: 0.85rem; max-width: 220px;">
        <strong style="color: #e11d48;">📢 Verified Citizen Report</strong>
        <div style="font-weight: 700; color: #0f172a; margin-top: 3px;">${rep.title}</div>
        <p style="color: #475569; margin: 3px 0; font-size: 0.8rem;">${rep.description}</p>
        <small style="color: #64748b;">Reported by ${rep.author} (${rep.timeAgo})</small>
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

// Global Selected City State (Default: Pune)
let selectedCity = 'pune';

// Change City Filter & Smoothly Update All Views (Map, Places, Routing, Benchmarks, Reports)
function changeCityFilter(city) {
  selectedCity = city;
  
  // Ensure dropdown selection matches
  const citySelect = document.getElementById('citySelector');
  if (citySelect && citySelect.value !== city) {
    citySelect.value = city;
  }

  // Dynamic City Centers, Zooms, and Live Conditions
  const cityCenters = {
    'all': { coords: [20.5937, 78.9629], zoom: 5, temp: '27°C', aqi: '68 (Moderate)', traffic: '36% Normal', name: 'All India' },
    'pune': { coords: [18.5204, 73.8567], zoom: 13, temp: '26°C', aqi: '62 (Good)', traffic: '32% Smooth', name: 'Pune City' },
    'mumbai': { coords: [18.9600, 72.8300], zoom: 12, temp: '29°C', aqi: '82 (Moderate)', traffic: '48% Heavy', name: 'Mumbai Metro' },
    'delhi': { coords: [28.6139, 77.2090], zoom: 12, temp: '28°C', aqi: '135 (Caution)', traffic: '52% Heavy', name: 'Delhi NCR' },
    'bengaluru': { coords: [12.9716, 77.5946], zoom: 12, temp: '24°C', aqi: '55 (Good)', traffic: '42% Moderate', name: 'Bengaluru' },
    'jaipur': { coords: [26.9124, 75.7873], zoom: 12, temp: '30°C', aqi: '78 (Moderate)', traffic: '28% Smooth', name: 'Jaipur (Pink City)' }
  };

  const target = cityCenters[city] || cityCenters['pune'];
  if (map) {
    map.flyTo(target.coords, target.zoom, { duration: 1.2 });
  }

  // 1. Update Sensor Bar
  const tempEl = document.getElementById('sensorTemp');
  const aqiEl = document.getElementById('sensorAqi');
  const trafficEl = document.getElementById('sensorTraffic');
  if (tempEl) tempEl.innerText = target.temp;
  if (aqiEl) aqiEl.innerText = target.aqi;
  if (trafficEl) trafficEl.innerText = target.traffic;

  // 2. Filter POIs & Update Left Sidebar Places & Map Markers
  applyCombinedFilters();

  // 3. Update Safe Routing Landmarks Dropdowns for this City
  setupRouteDropdowns();

  // 4. Update Best vs Worst Comparison Dropdowns for this City
  setupBenchmarkDropdowns();

  // 5. Update Citizen Reports Feed & Report Form Neighborhoods
  renderReportsFeed();
  updateReportNeighborhoodOptions();
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
    zoomControl: true,
    preferCanvas: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    keepBuffer: 8,
    crossOrigin: true
  }).addTo(routeMap);

  routeMap.whenReady(() => {
    setTimeout(() => { if (routeMap) routeMap.invalidateSize(); }, 150);
    setTimeout(() => { if (routeMap) routeMap.invalidateSize(); }, 500);
  });

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

  const cityPois = selectedCity === 'all' 
    ? pois 
    : pois.filter(p => (p.city || 'pune').toLowerCase() === selectedCity.toLowerCase());

  const listToUse = cityPois.length > 0 ? cityPois : pois;

  listToUse.forEach((p) => {
    const optA = new Option(`${p.name} (${p.neighborhood})`, p.id);
    const optB = new Option(`${p.name} (${p.neighborhood})`, p.id);
    originSelect.add(optA);
    destSelect.add(optB);
  });

  if (listToUse.length > 1) {
    originSelect.selectedIndex = 0;
    destSelect.selectedIndex = 1;
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

      <div style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 0.9rem; display: flex; flex-direction: column; gap: 0.25rem;">
        ${safestRoute.alerts.slice(0, 2).map(a => `<div style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">✅ ${a}</div>`).join('')}
      </div>

      <button class="btn-primary" style="background: var(--gradient-safe); padding: 0.65rem 1rem; font-size: 0.85rem; width: 100%; border-radius: var(--radius-sm);" onclick="event.stopPropagation(); openInGoogleMaps([${oLat}, ${oLng}], [${dLat}, ${dLng}])">
        <span>🗺️ Open in Google Maps</span>
      </button>
    </div>

    <!-- Fastest Direct Route -->
    <div class="route-card fastest" style="cursor: pointer;" onclick="focusRouteOnMap('fast')">
      <div class="route-card-header">
        <div>
          <span class="badge badge-food">⚡ ${fastestRoute.badge}</span>
          <h3 style="margin-top: 0.35rem; font-size: 1.1rem; color: var(--accent-amber);">${fastestRoute.name}</h3>
          <span style="font-size: 0.78rem; color: var(--text-secondary);">${origin} ➔ ${destination}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 1.25rem; font-weight: 800; color: var(--accent-amber);">${fastestRoute.durationMins} mins</span>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${fastestRoute.distanceKm} km</div>
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

      <div style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 0.9rem; display: flex; flex-direction: column; gap: 0.25rem;">
        ${fastestRoute.alerts.slice(0, 2).map(a => `<div style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">⚠️ ${a}</div>`).join('')}
      </div>

      <button class="btn-primary" style="background: rgba(255,255,255,0.08); border: 1px solid var(--border-glass); padding: 0.65rem 1rem; font-size: 0.85rem; width: 100%; border-radius: var(--radius-sm);" onclick="event.stopPropagation(); openInGoogleMaps([${oLat}, ${oLng}], [${dLat}, ${dLng}])">
        <span>🗺️ Open in Google Maps</span>
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

  const allKeys = Object.keys(benchmarkData);
  const cityKeys = selectedCity === 'all'
    ? allKeys
    : allKeys.filter(k => (benchmarkData[k].city || 'pune').toLowerCase() === selectedCity.toLowerCase());

  const keysToUse = cityKeys.length > 0 ? cityKeys : allKeys;

  keysToUse.forEach(a => {
    selA.add(new Option(a, a));
    selB.add(new Option(a, a));
  });

  if (keysToUse.length > 1) {
    selA.selectedIndex = 0;
    selB.selectedIndex = 1;
  } else if (keysToUse.length === 1) {
    selA.selectedIndex = 0;
    selB.selectedIndex = 0;
  }
  runBenchmarkComparison();
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
            <div style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4; display: flex; flex-direction: column; gap: 0.25rem;">
              ${areaA.topPros.slice(0, 2).map(p => `<div style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">✨ ${p}</div>`).join('')}
            </div>
          </td>
          <td>
            <div style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4; display: flex; flex-direction: column; gap: 0.25rem;">
              ${areaB.topPros.slice(0, 2).map(p => `<div style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">✨ ${p}</div>`).join('')}
            </div>
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

function updateReportNeighborhoodOptions() {
  const select = document.getElementById('repNeighborhood');
  if (!select) return;
  select.innerHTML = '';

  const allKeys = Object.keys(benchmarkData);
  const cityKeys = selectedCity === 'all'
    ? allKeys
    : allKeys.filter(k => (benchmarkData[k].city || 'pune').toLowerCase() === selectedCity.toLowerCase());

  const keysToUse = cityKeys.length > 0 ? cityKeys : allKeys;
  keysToUse.forEach(k => {
    const opt = new Option(benchmarkData[k]?.name || k, benchmarkData[k]?.name || k);
    select.add(opt);
  });
}

function renderReportsFeed() {
  const feed = document.getElementById('reportsFeedContainer');
  if (!feed) return;
  feed.innerHTML = '';

  const filteredReports = selectedCity === 'all'
    ? citizenReports
    : citizenReports.filter(r => (r.city || 'pune').toLowerCase() === selectedCity.toLowerCase());

  const badgeEl = document.getElementById('liveFeedBadge');
  if (badgeEl) {
    badgeEl.innerText = `● ${filteredReports.length} Active Alerts`;
  }

  if (filteredReports.length === 0) {
    feed.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
        <div style="font-size: 1.8rem; margin-bottom: 0.4rem;">📢</div>
        <p style="font-size: 0.85rem;">No active reports logged for this city yet. Be the first to report!</p>
      </div>
    `;
    return;
  }

  filteredReports.forEach(rep => {
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
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
        <div style="flex: 1; min-width: 0;">
          ${hazardBadge}
          <h4 style="margin-top: 0.35rem; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${rep.title}</h4>
          <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${rep.neighborhood} • by ${rep.author} (${rep.timeAgo})</span>
        </div>
        <button class="upvote-btn" onclick="upvoteReport('${rep.id}', this)" style="border-radius: var(--radius-sm); flex-shrink: 0;">
          👍 <span>${rep.upvotes}</span>
        </button>
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.45rem; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${rep.description}</p>
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

  const selectedCity = document.getElementById('citySelector')?.value || 'pune';
  try {
    const res = await fetch('/api/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: query, city: selectedCity })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || `Server error (${res.status})`);
    }
    
    // Parse formatting (simple markdown replacement)
    const rawAnswer = data.answer || data.response || '';
    const formatted = rawAnswer
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');

    aiMsg.querySelector('.msg-bubble').innerHTML = `
      ${formatted}
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem; text-align: right;">Engine: ${data.model || 'CityVibe Offline Intelligence'}</div>
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

  const selectedCity = document.getElementById('citySelector')?.value || 'pune';
  try {
    const res = await fetch('/api/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, contextCategory: 'all', city: selectedCity })
    });

    const data = await res.json();
    const loading = document.getElementById('aiModalLoading');
    if (loading) loading.remove();

    if (!res.ok) {
      throw new Error(data.detail || `Server error (${res.status})`);
    }

    const rawText = data.answer || data.response || (typeof data === 'string' ? data : 'No response received.');
    const formatted = rawText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');

    chatBox.innerHTML += `
      <div style="margin-top: 0.75rem; padding: 0.85rem; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-glass); border-radius: var(--radius-md);">
        🤖 <strong>CityVibe Offline AI:</strong><br>
        <div style="margin-top: 0.35rem; line-height: 1.55;">${formatted}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem; text-align: right;">Engine: ${data.model || 'Offline NLP Intelligence'}</div>
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
