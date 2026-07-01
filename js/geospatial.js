// ========================================
// BORNE FARMS — Geospatial Module (Leaflet.js)
// Farm Map: Joined Dual 100m × 100m plots
// Location: Abuja Farm, FCT Abuja, Nigeria
// ========================================

const GeospatialModule = {
    mainMap: null,
    miniMap: null,
    currentWeatherCode: null,
    currentWeatherLabel: '',

    // Center of the combined farm (FCT Abuja Centroid)
    center: [8.79470, 7.65492],

    // Real surveyed farm boundary (from georeferenced aerial corners)
    farmBoundary: {
        coords: [
            [8.795127, 7.654825], // topLeft
            [8.795059, 7.655086], // topRight
            [8.794536, 7.654983], // bottomRight
            [8.794593, 7.654708]  // bottomLeft
        ]
    },

    // Zone markers within the farm — paddocks, water points, feed stations, pasture zones
    farmZones: {
        paddocks: [
            { name: 'Paddock A — Main Pen', coords: [8.79500, 7.65490], animals: 96 },
            { name: 'Paddock B — Quarantine', coords: [8.79490, 7.65500], animals: 11 },
            { name: 'Paddock C — Weaning', coords: [8.79475, 7.65485], animals: 24 },
            { name: 'Paddock D — Bull Enclosure', coords: [8.79465, 7.65495], animals: 14 },
            { name: 'Paddock E — Maternity', coords: [8.79505, 7.65475], animals: 18 },
            { name: 'Paddock F — Holding', coords: [8.79485, 7.65475], animals: 8 }
        ],
        waterPoints: [
            { name: 'Water Point 1 — North Trough', coords: [8.79508, 7.65490] },
            { name: 'Water Point 2 — Central Pump', coords: [8.79480, 7.65490] },
            { name: 'Water Point 3 — South Well', coords: [8.79460, 7.65490] }
        ],
        feedStations: [
            { name: 'Feed Station 1 — Hay Drop', coords: [8.79500, 7.65505] },
            { name: 'Feed Station 2 — Silage Bay', coords: [8.79490, 7.65480] },
            { name: 'Feed Station 3 — Grain Mix', coords: [8.79470, 7.65505] },
            { name: 'Feed Station 4 — Protein Bin', coords: [8.79465, 7.65475] },
            { name: 'Feed Station 5 — Mineral Lick', coords: [8.79495, 7.65470] }
        ],
        pastureZones: [
            { name: 'Pasture Zone A — North Field', coords: [8.79510, 7.65480], area: '2.1 ha' },
            { name: 'Pasture Zone B — East Field', coords: [8.79495, 7.65506], area: '1.8 ha' },
            { name: 'Pasture Zone C — South Field', coords: [8.79460, 7.65475], area: '2.5 ha' },
            { name: 'Pasture Zone D — West Field', coords: [8.79455, 7.65500], area: '1.6 ha' }
        ]
    },

    // Tile layer providers (reliable, free, no API key needed)
    tileLayers: {
        osm: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            options: {
                maxZoom: 19,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }
        },
        // Google Satellite — high-res aerial, zoom to 21, no API key
        satellite: {
            url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            options: {
                maxZoom: 21,
                subdomains: ['0', '1', '2', '3'],
                attribution: '© Google Maps'
            }
        },
        // Google Hybrid — satellite + roads/labels
        hybrid: {
            url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            options: {
                maxZoom: 21,
                subdomains: ['0', '1', '2', '3'],
                attribution: '© Google Maps'
            }
        },
        topoMap: {
            url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            options: {
                maxZoom: 17,
                attribution: '© OpenTopoMap'
            }
        }
    },

    init() {
        this.initMiniMap();
        this.bindGeoFileLoader();
        this.renderZoneStats();
    },

    renderZoneStats() {
        const z = this.farmZones;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('geoPastureCount', z.pastureZones.length);
        set('geoPaddockCount', z.paddocks.length);
        set('geoWaterCount', z.waterPoints.length);
        set('geoFeedCount', z.feedStations.length);
    },

    // ====================================================
    // GEOSPATIAL FILE LOADER
    // Accepts GeoTIFF (.tif/.tiff), GeoJSON, KML, GPX, Shapefile (.shp/.zip)
    // Renders each as a Leaflet layer on the main map.
    // ====================================================
    geoLayers: [],   // [{ id, name, layer, color }]
    geoColorPalette: ['#07503f', '#7e9a3c', '#c7913c', '#b2cee7', '#c3cda7', '#e8fe85', '#fceace'],

    bindGeoFileLoader() {
        const input = document.getElementById('geoFileInput');
        const clearBtn = document.getElementById('geoClearBtn');
        if (input) {
            input.addEventListener('change', (e) => {
                const files = Array.from(e.target.files || []);
                files.forEach(f => this.loadGeoFile(f));
                input.value = ''; // allow re-loading same file
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearGeoLayers());
        }
    },

    async loadGeoFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        const baseName = file.name.replace(/\.[^.]+$/, '');
        try {
            if (['tif', 'tiff', 'geotiff'].includes(ext)) {
                await this.loadGeoTIFF(file, baseName);
            } else if (['geojson', 'json'].includes(ext)) {
                await this.loadGeoJSON(file, baseName);
            } else if (ext === 'kml') {
                await this.loadKML(file, baseName);
            } else if (ext === 'gpx') {
                await this.loadGPX(file, baseName);
            } else if (['shp', 'zip'].includes(ext)) {
                await this.loadShapefile(file, baseName);
            } else {
                console.warn('Unsupported geo file type:', ext);
            }
        } catch (e) {
            console.error('Failed to load geo file:', file.name, e);
        }
    },

    // --- GeoTIFF ---
    async loadGeoTIFF(file, name) {
        if (typeof GeoTIFF === 'undefined') {
            console.error('geotiff.js not loaded');
            return;
        }
        const buf = await file.arrayBuffer();
        const tiff = await GeoTIFF.fromArrayBuffer(buf);
        const image = await tiff.getImage();

        // Render raster to a canvas → dataURL
        const width = image.getWidth();
        const height = image.getHeight();
        const rgba = await image.readRGB(); // RGB uint8
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        for (let i = 0; i < rgba.length; i += 3) {
            const o = (i / 3) * 4;
            imageData.data[o] = rgba[i];
            imageData.data[o + 1] = rgba[i + 1];
            imageData.data[o + 2] = rgba[i + 2];
            imageData.data[o + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');

        // Compute geographic bounds from GeoTIFF metadata
        const bounds = this.geoTiffBounds(image);
        if (!bounds) {
            console.error('GeoTIFF has no georeferencing info');
            return;
        }

        const layer = L.imageOverlay(dataUrl, bounds, {
            opacity: 0.85,
            interactive: true
        }).addTo(this.mainMap);

        this.mainMap.fitBounds(bounds, { padding: [40, 40] });
        this.registerGeoLayer(name, layer, 'raster');
    },

    // Extract [south, west, north, east] lat/lng bounds from a GeoTIFF image
    geoTiffBounds(image) {
        try {
            const tiepoint = image.getTiePoints()[0];
            const pixelScale = image.getFileDirectory().ModelPixelScale;
            if (!tiepoint || !pixelScale) return null;

            const width = image.getWidth();
            const height = image.getHeight();
            const x0 = tiepoint.x;
            const y0 = tiepoint.y;
            const sx = pixelScale[0];
            const sy = pixelScale[1];

            // pixel → world (origin top-left, y grows down)
            const west = x0;
            const east = x0 + width * sx;
            const north = y0;
            const south = y0 - height * sy;

            // Assume WGS84 (EPSG:4326). If projected, this is approximate.
            return [[south, west], [north, east]];
        } catch (e) {
            console.warn('Could not parse GeoTIFF bounds:', e);
            return null;
        }
    },

    // --- GeoJSON ---
    async loadGeoJSON(file, name) {
        const text = await file.text();
        const data = JSON.parse(text);
        const color = this.nextGeoColor();
        const layer = L.geoJSON(data, {
            style: { color, weight: 2, opacity: 0.9, fillOpacity: 0.15 },
            pointToLayer: (feat, latlng) => L.circleMarker(latlng, {
                radius: 5, color, fillColor: color, fillOpacity: 0.7, weight: 2
            }),
            onEachFeature: (feat, lyr) => {
                if (feat.properties) {
                    const props = Object.entries(feat.properties)
                        .map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br>');
                    lyr.bindPopup(props);
                }
            }
        }).addTo(this.mainMap);
        this.mainMap.fitBounds(layer.getBounds(), { padding: [40, 40] });
        this.registerGeoLayer(name, layer, 'geojson', color);
    },

    // --- KML ---
    async loadKML(file, name) {
        if (typeof toGeoJSON === 'undefined') {
            console.error('togeojson not loaded'); return;
        }
        const text = await file.text();
        const dom = new DOMParser().parseFromString(text, 'text/xml');
        const gj = toGeoJSON.kml(dom);
        this.addGeoJSONLayer(gj, name);
    },

    // --- GPX ---
    async loadGPX(file, name) {
        if (typeof toGeoJSON === 'undefined') {
            console.error('togeojson not loaded'); return;
        }
        const text = await file.text();
        const dom = new DOMParser().parseFromString(text, 'text/xml');
        const gj = toGeoJSON.gpx(dom);
        this.addGeoJSONLayer(gj, name);
    },

    // --- Shapefile ---
    async loadShapefile(file, name) {
        if (typeof shp === 'undefined') {
            console.error('shpjs not loaded'); return;
        }
        const buf = await file.arrayBuffer();
        const gj = await shp(buf);
        this.addGeoJSONLayer(gj, name);
    },

    // Shared GeoJSON → Leaflet layer (used by KML/GPX/Shapefile)
    addGeoJSONLayer(gj, name) {
        const color = this.nextGeoColor();
        const layer = L.geoJSON(gj, {
            style: { color, weight: 2, opacity: 0.9, fillOpacity: 0.15 },
            pointToLayer: (feat, latlng) => L.circleMarker(latlng, {
                radius: 5, color, fillColor: color, fillOpacity: 0.7, weight: 2
            }),
            onEachFeature: (feat, lyr) => {
                if (feat.properties) {
                    const props = Object.entries(feat.properties)
                        .map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br>');
                    lyr.bindPopup(props);
                }
            }
        }).addTo(this.mainMap);
        try { this.mainMap.fitBounds(layer.getBounds(), { padding: [40, 40] }); } catch (_) {}
        this.registerGeoLayer(name, layer, 'vector', color);
    },

    // --- Layer registry + UI chips ---
    nextGeoColor() {
        return this.geoColorPalette[this.geoLayers.length % this.geoColorPalette.length];
    },

    registerGeoLayer(name, layer, type, color) {
        const id = 'geo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const c = color || this.geoColorPalette[this.geoLayers.length % this.geoColorPalette.length];
        this.geoLayers.push({ id, name, layer, color: c, type });
        this.renderGeoLayerChips();
    },

    removeGeoLayer(id) {
        const idx = this.geoLayers.findIndex(l => l.id === id);
        if (idx === -1) return;
        this.mainMap.removeLayer(this.geoLayers[idx].layer);
        this.geoLayers.splice(idx, 1);
        this.renderGeoLayerChips();
    },

    clearGeoLayers() {
        this.geoLayers.forEach(l => this.mainMap.removeLayer(l.layer));
        this.geoLayers = [];
        this.renderGeoLayerChips();
    },

    renderGeoLayerChips() {
        const list = document.getElementById('geoLayerList');
        if (!list) return;
        list.innerHTML = '';
        this.geoLayers.forEach(l => {
            const chip = document.createElement('span');
            chip.className = 'geo-layer-chip';
            chip.innerHTML =
                `<span class="geo-chip-dot" style="background:${l.color};"></span>` +
                `<span>${l.name}</span>` +
                `<span class="geo-chip-remove" title="Remove">✕</span>`;
            chip.querySelector('.geo-chip-remove').addEventListener('click', () => this.removeGeoLayer(l.id));
            list.appendChild(chip);
        });
    },

    // ====================================================
    // WEATHER-ON-MAP — animated rain / storm / thunderstorm
    // overlay that reflects live or a selected day's weather
    // ====================================================
    weatherCategory(code) {
        if (code == null) return 'clear';
        if ([95, 96, 99].includes(code)) return 'thunder';
        if ([65, 67, 82, 86, 75].includes(code)) return 'heavy';
        if ([51, 53, 55, 56, 57, 61, 63, 66, 80, 81, 71, 73, 77, 85].includes(code)) return 'rain';
        if ([45, 48].includes(code)) return 'fog';
        if ([2, 3].includes(code)) return 'cloudy';
        return 'clear';
    },

    ensureWeatherOverlay(containerId) {
        const c = document.getElementById(containerId);
        if (!c) return null;
        let fx = c.querySelector(':scope > .map-weather-fx');
        if (!fx) {
            fx = document.createElement('div');
            fx.className = 'map-weather-fx wx-clear';
            fx.innerHTML =
                '<div class="mwx-clouds"></div>' +
                '<div class="mwx-dark"></div>' +
                '<div class="mwx-rain"></div>' +
                '<div class="mwx-fog"></div>' +
                '<div class="mwx-flash"></div>' +
                '<div class="map-weather-badge"></div>';
            c.appendChild(fx);
        }
        return fx;
    },

    setWeatherFX(code, label) {
        this.currentWeatherCode = code;
        if (label != null) this.currentWeatherLabel = label;
        const cat = this.weatherCategory(code);
        const icons = { clear: '☀️', cloudy: '☁️', fog: '🌫️', rain: '🌧️', heavy: '🌧️', thunder: '⛈️' };
        const names = { clear: 'Clear', cloudy: 'Cloudy', fog: 'Foggy', rain: 'Rain', heavy: 'Heavy Rain', thunder: 'Thunderstorm' };
        ['farmMap', 'dashboardMiniMap'].forEach((id) => {
            const fx = this.ensureWeatherOverlay(id);
            if (!fx) return;
            fx.className = 'map-weather-fx wx-' + cat;
            const badge = fx.querySelector('.map-weather-badge');
            if (badge) {
                const txt = (this.currentWeatherLabel ? this.currentWeatherLabel + ' · ' : '') + names[cat];
                badge.innerHTML = '<span>' + icons[cat] + '</span> ' + txt;
            }
        });
    },

    initMiniMap() {
        const container = document.getElementById('dashboardMiniMap');
        if (!container || this.miniMap) return;

        // Ensure the container has explicit dimensions
        container.style.width = '100%';
        container.style.minHeight = '280px';

        try {
            this.miniMap = L.map('dashboardMiniMap', {
                center: this.center,
                zoom: 19,
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                scrollWheelZoom: false,
                maxZoom: 21
            });

            // Satellite basemap for the farm zone overview (with OSM fallback)
            const miniSat = L.tileLayer(this.tileLayers.satellite.url, this.tileLayers.satellite.options).addTo(this.miniMap);
            miniSat.on('tileerror', () => {
                this.miniMap.removeLayer(miniSat);
                L.tileLayer(this.tileLayers.osm.url, this.tileLayers.osm.options).addTo(this.miniMap);
            });

            this.drawFarmLayout(this.miniMap, true);
            if (this.currentWeatherCode != null) this.setWeatherFX(this.currentWeatherCode);

            // Force size recalculation after render
            setTimeout(() => {
                if (this.miniMap) this.miniMap.invalidateSize();
            }, 300);
            setTimeout(() => {
                if (this.miniMap) this.miniMap.invalidateSize();
            }, 1000);
        } catch (e) {
            console.error('Mini map initialization failed:', e);
            this.renderFallbackMap(container, true);
        }
    },

    initFullMap() {
        const container = document.getElementById('farmMap');
        if (!container) return;

        // If map already exists, just refresh it
        if (this.mainMap) {
            setTimeout(() => {
                this.mainMap.invalidateSize();
                this.mainMap.setView(this.center, 18);
            }, 100);
            return;
        }

        // Ensure explicit dimensions on container
        container.style.width = '100%';
        container.style.height = '550px';
        container.style.minHeight = '400px';

        try {
            this.mainMap = L.map('farmMap', {
                center: this.center,
                zoom: 19,
                zoomControl: true,
                maxZoom: 21,
                minZoom: 15
            });

            // Google Satellite (high-res aerial, default)
            const satellite = L.tileLayer(
                this.tileLayers.satellite.url,
                this.tileLayers.satellite.options
            );

            // Google Hybrid (satellite + roads/labels)
            const hybrid = L.tileLayer(
                this.tileLayers.hybrid.url,
                this.tileLayers.hybrid.options
            );

            // OpenStreetMap layer (very reliable)
            const osm = L.tileLayer(
                this.tileLayers.osm.url,
                this.tileLayers.osm.options
            );

            // Default to satellite view
            satellite.addTo(this.mainMap);

            // Layer control
            L.control.layers({
                'Satellite (Google)': satellite,
                'Hybrid (Google)': hybrid,
                'Street Map (OSM)': osm
            }, {}, { position: 'topright', collapsed: false }).addTo(this.mainMap);

            // Draw the real surveyed farm boundary
            this.drawFarmLayout(this.mainMap, false);
            this.trackWorkerLocation(this.mainMap);

            // Scale control
            L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.mainMap);

            // Re-apply any active weather overlay now the full map exists
            if (this.currentWeatherCode != null) this.setWeatherFX(this.currentWeatherCode);

            // Multiple invalidateSize calls to handle various rendering timing issues
            const refreshMap = () => {
                if (this.mainMap) {
                    this.mainMap.invalidateSize();
                }
            };

            setTimeout(refreshMap, 100);
            setTimeout(refreshMap, 300);
            setTimeout(refreshMap, 600);
            setTimeout(refreshMap, 1200);

            // Also refresh on window resize
            window.addEventListener('resize', () => {
                setTimeout(refreshMap, 100);
            });

            // Handle tile load errors with fallback
            satellite.on('tileerror', () => {
                console.warn('Satellite tiles failed, switching to OSM...');
                this.mainMap.removeLayer(satellite);
                osm.addTo(this.mainMap);
            });

        } catch (e) {
            console.error('Full map initialization failed:', e);
            this.renderFallbackMap(container, false);
        }
    },

    drawFarmLayout(map, isMini) {
        // Real surveyed farm boundary
        L.polygon(this.farmBoundary.coords, {
            color: '#07503f',
            weight: isMini ? 2.5 : 4,
            opacity: 0.9,
            fillOpacity: 0,
            lineJoin: 'round'
        }).bindPopup('<b>Borne Farms</b><br>Surveyed boundary').addTo(map);

        // Skip zone markers on the mini map
        if (isMini) return;

        const zones = this.farmZones;
        const makeIcon = (bg, border, glyph) => L.divIcon({
            className: 'zone-marker',
            html: `<div style="width:22px;height:22px;background:${bg};border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${border};">${glyph}</div>`,
            iconSize: [22, 22], iconAnchor: [11, 11]
        });

        // Pasture zones — olive circles
        zones.pastureZones.forEach(z => {
            L.circle(z.coords, {
                radius: 25, color: '#7e9a3c', weight: 2, fillColor: '#7e9a3c', fillOpacity: 0.15
            }).bindPopup(`<b>${z.name}</b><br>${z.area}`).addTo(map);
        });

        // Paddocks — forest markers with "P"
        zones.paddocks.forEach(p => {
            L.marker(p.coords, { icon: makeIcon('#e6ecd5', '#07503f', 'P') })
                .bindPopup(`<b>${p.name}</b><br>${p.animals} cattle`).addTo(map);
        });

        // Water points — sky markers with "W"
        zones.waterPoints.forEach(w => {
            L.marker(w.coords, { icon: makeIcon('#b2cee7', '#07503f', 'W') })
                .bindPopup(`<b>${w.name}</b>`).addTo(map);
        });

        // Feed stations — peach markers with "F"
        zones.feedStations.forEach(f => {
            L.marker(f.coords, { icon: makeIcon('#fceace', '#07503f', 'F') })
                .bindPopup(`<b>${f.name}</b>`).addTo(map);
        });
    },

    trackWorkerLocation(map) {
        if (!navigator.geolocation) return;

        const workerIcon = L.divIcon({
            className: 'worker-marker',
            html: `<div class="worker-dot" style="width:14px;height:14px;background:#e8fe85;border-radius:50%;border:2px solid #07503f;box-shadow:0 0 8px rgba(232,254,133,.7);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        let marker = null;

        navigator.geolocation.watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                if (!marker) {
                    marker = L.marker([lat, lng], { icon: workerIcon, zIndexOffset: 1000 })
                        .bindPopup('<b>You (Live Tracking)</b><br>Field Worker')
                        .addTo(map);
                } else {
                    marker.setLatLng([lat, lng]);
                }
            },
            (err) => {
                // Mock worker position inside Plot B if tracking is disabled
                if (!marker) {
                    marker = L.marker([8.79463, 7.65542], { icon: workerIcon, zIndexOffset: 1000 })
                        .bindPopup('<b>You (Mock Field Worker)</b><br>Plot B Cattle Zone')
                        .addTo(map);
                }
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    },

    /**
     * Canvas-based fallback farm layout visualization
     * Renders when Leaflet tiles fail to load or map init fails
     */
    renderFallbackMap(container, isMini) {
        container.innerHTML = '';
        container.style.position = 'relative';
        container.style.background = '#e8e4d4';
        container.style.overflow = 'hidden';

        const canvas = document.createElement('canvas');
        const height = isMini ? 280 : 550;
        canvas.width = container.clientWidth || 600;
        canvas.height = height;
        canvas.style.width = '100%';
        canvas.style.height = height + 'px';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Scale coordinates to canvas
        const pad = 40;
        const w = canvas.width - pad * 2;
        const h = canvas.height - pad * 2;

        // Farm bounds
        const latMin = 8.79425, latMax = 8.79515;
        const lngMin = 7.654008, lngMax = 7.655832;
        const latRange = latMax - latMin;
        const lngRange = lngMax - lngMin;

        const toX = (lng) => pad + ((lng - lngMin) / lngRange) * w;
        const toY = (lat) => pad + ((latMax - lat) / latRange) * h;

        // Background grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = pad + (w / 10) * i;
            ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + h); ctx.stroke();
            const y = pad + (h / 10) * i;
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + w, y); ctx.stroke();
        }

        // Helper: draw polygon
        const drawPoly = (coords, strokeColor, fillColor, fillOpacity, lineWidth, dash) => {
            ctx.beginPath();
            coords.forEach(([lat, lng], i) => {
                const x = toX(lng), y = toY(lat);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();

            if (fillColor) {
                ctx.fillStyle = fillColor;
                ctx.globalAlpha = fillOpacity || 0.15;
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lineWidth || 2;
            if (dash) ctx.setLineDash(dash);
            else ctx.setLineDash([]);
            ctx.stroke();
            ctx.setLineDash([]);
        };

        // Draw the real surveyed farm boundary
        drawPoly(this.farmBoundary.coords, '#07503f', null, 0, isMini ? 2.5 : 4);

        if (!isMini) {
            // Coordinate labels on axes
            ctx.font = '9px Inter, sans-serif';
            ctx.fillStyle = 'rgba(33,37,41,0.5)';
            ctx.textAlign = 'left';
            ctx.fillText(`${latMax.toFixed(5)}°N`, 4, pad + 10);
            ctx.fillText(`${latMin.toFixed(5)}°N`, 4, pad + h);
            ctx.textAlign = 'center';
            ctx.fillText(`${lngMin.toFixed(5)}°E`, pad, pad + h + 16);
            ctx.fillText(`${lngMax.toFixed(5)}°E`, pad + w, pad + h + 16);

            // Title
            ctx.font = 'bold 13px Inter, sans-serif';
            ctx.fillStyle = 'rgba(33,37,41,0.7)';
            ctx.textAlign = 'center';
            ctx.fillText('BORNE FARMS — Abuja, FCT Nigeria', canvas.width / 2, 20);
        }

        // Legend bar
        const legendDiv = document.createElement('div');
        legendDiv.style.cssText = `
            position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
            display: flex; gap: 12px; align-items: center;
            background: rgba(255,255,255,0.85); backdrop-filter: blur(8px);
            padding: 6px 14px; border-radius: 8px; font-size: 10px;
            color: rgba(33,37,41,0.7); font-family: Inter, sans-serif;
        `;
        legendDiv.innerHTML = `
            <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#07503f;"></span>Farm Boundary</span>
        `;
        container.appendChild(legendDiv);
    }
};
