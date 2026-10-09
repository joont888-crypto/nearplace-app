/**
 * NearPlace Luxe - Soft Neumorphic Luxury Controller (design.md)
 * Features: Real OSRM Routing, Voice Notifications, Wikipedia/Maps Images, Advanced Budget Breakdown & Map Pinning
 */
class NearPlaceApp {
    constructor() {
        this.lang = localStorage.getItem('nearplace_lang') || 'th';
        this.theme = localStorage.getItem('nearplace_theme') || 'dark';

        // User Position (Bangkok reference)
        this.userPos = { lat: 13.7420, lng: 100.5350 };

        // Travel Mode: 'walk' or 'car' per Section 12
        this.travelMode = localStorage.getItem('nearplace_travel_mode') || 'car';
        // Speeds are defined as constants in RoutingService (WALK_SPEED_KMH=4.2, CAR_SPEED_KMH=26)

        this.isNavigating = false;
        this.navInterval = null;
        this.currentRouteWaypoints = [];
        this.currentRouteIndex = 0;
        this.hasSpokenArriving = false;
        this.isMapPanelCollapsed = false;

        // Load places from localStorage or default presets
        const savedPlaces = localStorage.getItem('nearplace_saved_places');
        try {
            this.places = savedPlaces ? JSON.parse(savedPlaces) : Object.values(PRESET_PLACES).map(p => ({ ...p }));
        } catch(e) {
            this.places = Object.values(PRESET_PLACES).map(p => ({ ...p }));
        }

        // Active Destination (defaults to first place)
        this.activeDestination = this.places[0] || PRESET_PLACES.iconsiam;

        // Last Pinned Location (for auto-recording expenses)
        const savedLastPinned = localStorage.getItem('nearplace_last_pinned');
        try {
            this.lastPinnedLocation = savedLastPinned ? JSON.parse(savedLastPinned) : this.activeDestination;
        } catch(e) {
            this.lastPinnedLocation = this.activeDestination;
        }

        // Daily Budget Limit per Requirement 1 & 2
        this.dailyBudgetLimit = parseFloat(localStorage.getItem('nearplace_daily_budget')) || 2000;

        // Budget View Mode: 'byDay' or 'byLocation'
        this.budgetViewMode = 'byDay';

        // Load Expenses with Date Tracking
        const savedExpenses = localStorage.getItem('nearplace_expenses');
        try {
            this.expenses = savedExpenses ? JSON.parse(savedExpenses) : [
                { 
                    id: 1, 
                    destination: "ICONSIAM", 
                    title: "Dining & Coffee", 
                    amount: 850, 
                    date: this.getTodayDateString(), 
                    displayDate: "Today", 
                    time: "14:30" 
                }
            ];
        } catch(e) {
            this.expenses = [];
        }

        // Proximity Alerts Log
        try {
            this.alertsLog = JSON.parse(localStorage.getItem('nearplace_alerts_log') || '[]');
        } catch(e) {
            this.alertsLog = [];
        }

        // Settings
        this.settings = {
            pushAlerts: true,
            soundChime: true,
            voiceEnabled: localStorage.getItem('nearplace_voice_enabled') !== 'false',
            units: 'km'
        };

        // Authentication & User Profile
        this.isLoggedIn = localStorage.getItem('nearplace_is_logged_in') === 'true';
        const savedProfile = localStorage.getItem('nearplace_user_profile');
        try {
            this.userProfile = savedProfile ? JSON.parse(savedProfile) : {
                name: "Luxe Traveler",
                bio: "Bangkok, Thailand",
                email: "traveler@nearplace.luxe",
                avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
                authProvider: 'guest'
            };
        } catch(e) {
            this.userProfile = {
                name: "Luxe Traveler",
                bio: "Bangkok, Thailand",
                email: "traveler@nearplace.luxe",
                avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
                authProvider: 'guest'
            };
        }

        this.currentTab = 'tab-home';
        this.isCrosshairMode = false;
        this.mapLayerType = 'google_roadmap';
        this.searchDebounceTimer = null;

        // Leaflet references
        this.map = null;
        this.userMarker = null;
        this.destinationMarker = null;
        this.radiusCircle = null;
        this.routePolyline = null;
        this.tileLayer = null;
    }

    getTodayDateString() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // Returns YYYY-MM-DD for a date that is `daysAgo` before today
    getDateStringDaysAgo(daysAgo) {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // ==========================================================================
    // Real Device GPS Location (watchPosition)
    // ==========================================================================
    startRealLocation() {
        if (!navigator.geolocation) {
            this.showToast(
                this.lang === 'th' ? 'ไม่รองรับ GPS' : 'GPS Not Supported',
                this.lang === 'th' ? 'เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง' : 'This browser does not support geolocation'
            );
            return;
        }

        const options = { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 };

        // One-shot: get position immediately on startup
        navigator.geolocation.getCurrentPosition(
            (pos) => this._onLocationUpdate(pos, true),
            (err) => console.warn('GPS initial fix error:', err.message),
            options
        );

        // Continuous watch: update map as user moves
        this._gpsWatchId = navigator.geolocation.watchPosition(
            (pos) => this._onLocationUpdate(pos, false),
            (err) => {
                if (err.code === 1) { // PERMISSION_DENIED
                    this.showToast(
                        this.lang === 'th' ? 'GPS ถูกปฏิเสธ' : 'Location Denied',
                        this.lang === 'th' ? 'กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อใช้งาน' : 'Please allow location access to use navigation'
                    );
                }
            },
            options
        );
    }

    _onLocationUpdate(pos, isFirst = false) {
        const { latitude, longitude, accuracy } = pos.coords;

        // Validate within Thailand bounds
        if (!this.isWithinThailand(latitude, longitude)) return;

        const prevLat = this.userPos.lat;
        const prevLng = this.userPos.lng;
        this.userPos = { lat: latitude, lng: longitude };

        // Update user marker on map
        if (this.map && this.userMarker) {
            this.userMarker.setLatLng([latitude, longitude]);
        }

        // On first fix: center map on real position
        if (isFirst && this.map) {
            this.map.setView([latitude, longitude], 15, { animate: true });
        }

        // Update GPS indicator badge
        const gpsEl = document.getElementById('gps-accuracy-badge');
        if (gpsEl) {
            gpsEl.innerText = accuracy < 20 ? '📍 GPS' : `📍 ~${Math.round(accuracy)}m`;
            gpsEl.title = `Accuracy: ±${Math.round(accuracy)}m`;
        }

        // Refresh travel metrics if position moved significantly (>10m)
        const moved = Utils.calculateDistance(prevLat, prevLng, latitude, longitude);
        if (moved > 10 && this.activeDestination) {
            this.updateTravelMetrics(this.activeDestination);
            this.refreshCurrentWeather();
        }
    }

    init() {
        this.applyTheme(this.theme);
        this.applyLanguage(this.lang);
        this.initHeaderDate();
        this.renderHomeFeaturedCard();
        this.renderExploreList();
        this.renderBudgetScreen();
        this.refreshCurrentWeather();
        this.startGeofenceMonitoring();
        this.startRealLocation();
        this.updateRadiusUI(this.activeDestination.radius || 500);
        this.setTravelMode(this.travelMode);
        this.updateVoiceStatusUI();
        this.renderProfileUI();
        this.checkLoginScreen();

        setTimeout(() => {
            this.initMap();
        }, 150);

        window.addEventListener('resize', () => {
            if (this.map) this.map.invalidateSize();
        });
    }

    initHeaderDate() {
        const dateEl = document.getElementById('header-greeting-date');
        if (dateEl) {
            const now = new Date();
            const options = { weekday: 'short', month: 'short', day: 'numeric' };
            dateEl.innerText = now.toLocaleDateString(this.lang === 'th' ? 'th-TH' : 'en-US', options);
        }
    }

    initMap() {
        if (typeof L === 'undefined') {
            setTimeout(() => this.initMap(), 150);
            return;
        }

        const mapContainer = document.getElementById('leaflet-map');
        if (!mapContainer || this.map) return;

        try {
            // Thailand boundary restriction (Requirement 4)
            const thailandBounds = L.latLngBounds(
                L.latLng(5.5, 97.0),
                L.latLng(20.6, 106.0)
            );

            this.map = L.map('leaflet-map', {
                zoomControl: false,
                attributionControl: false,
                fadeAnimation: true,
                zoomAnimation: true,
                maxBounds: thailandBounds,
                maxBoundsViscosity: 0.85,
                minZoom: 5,
                maxZoom: 19
            }).setView([this.userPos.lat, this.userPos.lng], 14);

            this.updateMapTiles();

            // User location pulsing pin
            const userIcon = L.divIcon({
                className: 'custom-user-pin',
                html: `<div class="user-location-marker"><div class="user-location-pulse"></div><div class="user-location-dot"></div></div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });
            this.userMarker = L.marker([this.userPos.lat, this.userPos.lng], { icon: userIcon }).addTo(this.map);

            // Click listener for Map Pinning (Requirement 6)
            this.map.on('click', (e) => {
                this.handleMapTap(e.latlng);
            });

            this.updateMapForDestination(this.activeDestination);

            this.map.invalidateSize();
            requestAnimationFrame(() => { if (this.map) this.map.invalidateSize(); });
            setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 300);
        } catch(e) {
            console.error("Map init error:", e);
        }
    }

    isWithinThailand(lat, lng) {
        return lat >= 5.5 && lat <= 20.6 && lng >= 97.0 && lng <= 106.0;
    }

    updateMapTiles() {
        if (!this.map) return;
        if (this.tileLayer) {
            this.map.removeLayer(this.tileLayer);
            this.tileLayer = null;
        }

        let tileUrl = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
        let subdomains = ['mt0', 'mt1', 'mt2', 'mt3'];

        if (this.mapLayerType === 'dark_carto') {
            tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            subdomains = ['a', 'b', 'c', 'd'];
        } else if (this.mapLayerType === 'osm') {
            tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            subdomains = ['a', 'b', 'c'];
        }

        this.tileLayer = L.tileLayer(tileUrl, {
            maxZoom: 20,
            subdomains: subdomains,
            attribution: 'Map Data',
            className: 'neu-map-tiles'
        }).addTo(this.map);
    }

    // ==========================================================================
    // Requirement 6 & 3: Map Pinning with Actual Location Images
    // ==========================================================================
    async handleMapTap(latlng) {
        if (!latlng) return;

        // Requirement 4: Enforce Thailand boundary
        if (!this.isWithinThailand(latlng.lat, latlng.lng)) {
            const title = i18n[this.lang] && i18n[this.lang].outOfBounds ? i18n[this.lang].outOfBounds : "Outside Thailand";
            const msg = i18n[this.lang] && i18n[this.lang].onlyThailand ? i18n[this.lang].onlyThailand : "Restricted to Thailand only";
            this.showToast(title, msg);
            return;
        }

        this.showToast("Pinning Location...", `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);

        // Move/Drop Destination Pin immediately
        if (this.destinationMarker) this.map.removeLayer(this.destinationMarker);

        const destIcon = L.divIcon({
            className: 'custom-dest-pin animate-bounce',
            html: `<div class="neu-raised w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-cherry border border-cherry/60 shadow-lg"><i class="fa-solid fa-map-pin"></i></div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        this.destinationMarker = L.marker([latlng.lat, latlng.lng], { icon: destIcon, draggable: true }).addTo(this.map);
        this.destinationMarker.on('dragend', (ev) => {
            this.handleMapTap(ev.target.getLatLng());
        });

        // 1. Reverse Geocode via Nominatim API to get actual place name & address
        const geoResult = await GeocodingService.reverse(latlng.lat, latlng.lng);
        let placeName = "Pinned Spot";
        let fullAddress = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        let category = "Location";

        if (geoResult) {
            fullAddress = geoResult.display_name || fullAddress;
            const addr = geoResult.address || {};
            placeName = geoResult.name || addr.amenity || addr.shop || addr.building || addr.tourism || addr.road || addr.suburb || "Pinned Spot";
            category = geoResult.type || addr.shop || addr.amenity || "Location";
        }

        // 2. Fetch Actual Real Location Image — uses GPS coords first (Wikimedia GeoSearch), then name (Wikipedia), then Street View
        const realImage = await ImageService.fetchLocationImage(placeName, category, latlng.lat, latlng.lng);

        const newPinnedPlace = {
            id: 'pin-' + Date.now(),
            name: placeName,
            address: fullAddress,
            category: category.toUpperCase(),
            lat: latlng.lat,
            lng: latlng.lng,
            radius: 500,
            budget: 1500,
            spent: 0,
            image: realImage,
            isFavorite: false,
            datePinned: this.getTodayDateString(),
            note: ""
        };

        // Save as Last Pinned Location (Requirement 1)
        this.lastPinnedLocation = newPinnedPlace;
        localStorage.setItem('nearplace_last_pinned', JSON.stringify(newPinnedPlace));

        // Add to places list if not present
        const existingIdx = this.places.findIndex(x => x.name.toLowerCase() === placeName.toLowerCase());
        if (existingIdx === -1) {
            this.places.unshift(newPinnedPlace);
            localStorage.setItem('nearplace_saved_places', JSON.stringify(this.places));
        }

        // Set as active destination and calculate real route
        this.selectDestination(newPinnedPlace);

        // Open Place Details Bottom Sheet to show actual photo and options
        this.openPlaceDetails(newPinnedPlace.id);
    }

    updateMapForDestination(place) {
        if (!this.map || !place) return;

        if (this.destinationMarker) this.map.removeLayer(this.destinationMarker);
        if (this.radiusCircle) this.map.removeLayer(this.radiusCircle);

        const destIcon = L.divIcon({
            className: 'custom-dest-pin',
            html: `<div class="neu-raised w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-cherry border border-cherry/40"><i class="fa-solid fa-location-dot"></i></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        this.destinationMarker = L.marker([place.lat, place.lng], { icon: destIcon, draggable: true }).addTo(this.map);
        this.destinationMarker.on('dragend', (ev) => {
            this.handleMapTap(ev.target.getLatLng());
        });

        if (place.radius) {
            this.radiusCircle = L.circle([place.lat, place.lng], {
                color: '#B89A67',
                fillColor: '#B89A67',
                fillOpacity: 0.10,
                weight: 1.5,
                radius: place.radius
            }).addTo(this.map);
        }

        this.drawRoutePolyline(place);
    }

    // ==========================================================================
    // Requirement 5: Real OSRM Routes Categorized by Mode of Travel (Walk vs Car)
    // ==========================================================================
    async drawRoutePolyline(place) {
        if (!this.map || !place) return;
        if (this.routePolyline) this.map.removeLayer(this.routePolyline);

        // Fetch Real Turn-by-Turn Route from OSRM
        const routeData = await RoutingService.fetchRoute(
            this.userPos.lat,
            this.userPos.lng,
            place.lat,
            place.lng,
            this.travelMode
        );

        this.currentRouteWaypoints = routeData.waypoints;

        const isWalking = this.travelMode === 'walk';
        this.routePolyline = L.polyline(this.currentRouteWaypoints, {
            color: '#B89A67',
            weight: isWalking ? 3.5 : 4.5,
            dashArray: isWalking ? '4, 8' : null,
            lineCap: 'round',
            opacity: 0.88
        }).addTo(this.map);

        // Fit map bounds to view route
        if (this.currentRouteWaypoints.length > 0) {
            const bounds = L.latLngBounds(this.currentRouteWaypoints);
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }

        // Update travel metrics with real route values
        this.updateTravelMetrics(place, routeData);
    }

    updateTravelMetrics(place, routeData = null) {
        if (!place) return;
        let distMeters = 0;
        let timeMins = 0;
        let steps = 0;
        let calories = 0;

        const isCar = this.travelMode === 'car';

        if (routeData) {
            distMeters = routeData.distanceMeters;
            timeMins = Math.max(1, Math.round(routeData.durationSeconds / 60));
            // Requirement 1: In Car mode, steps and cal are cut out
            steps = isCar ? 0 : (routeData.steps || Math.round(distMeters * 1.35));
            calories = isCar ? 0 : (routeData.calories || Math.round(distMeters * 0.055));
        } else {
            distMeters = Utils.calculateDistance(this.userPos.lat, this.userPos.lng, place.lat, place.lng);
            // Use RoutingService canonical speeds: walk=4.2 km/h, car=26 km/h
            const durationSec = RoutingService.calculateDuration(distMeters, this.travelMode);
            timeMins = Math.max(1, Math.round(durationSec / 60));
            steps = isCar ? 0 : Math.round(distMeters * 1.35);
            calories = isCar ? 0 : Math.round(distMeters * 0.055);
        }

        const distStr = Utils.formatDistance(distMeters);
        const timeStr = Utils.formatDuration(timeMins, this.lang);

        // Update map screen metrics
        const mapDistEl = document.getElementById('map-metric-distance');
        const mapTimeEl = document.getElementById('map-metric-time');
        const mapStepsEl = document.getElementById('map-metric-steps');
        const mapCalEl = document.getElementById('map-metric-calories');
        const mapTitleEl = document.getElementById('map-active-dest-title');

        if (mapDistEl) mapDistEl.innerText = distStr;
        if (mapTimeEl) mapTimeEl.innerText = timeStr;
        if (mapStepsEl) mapStepsEl.innerText = steps > 0 ? steps.toLocaleString() : '-';
        if (mapCalEl) mapCalEl.innerText = calories > 0 ? `${calories} kcal` : '-';
        if (mapTitleEl) mapTitleEl.innerText = place.name;

        // Mini Collapsed Info
        const miniDistEl = document.getElementById('map-mini-dist');
        const miniTimeEl = document.getElementById('map-mini-time');
        if (miniDistEl) miniDistEl.innerText = distStr;
        if (miniTimeEl) miniTimeEl.innerText = timeStr;

        // Requirement 1: Adjust grid layout depending on mode
        const metricGrid = document.getElementById('map-metrics-grid');
        const stepsBox = document.getElementById('metric-box-steps');
        const calBox = document.getElementById('metric-box-calories');

        if (isCar) {
            if (stepsBox) stepsBox.classList.add('hidden');
            if (calBox) calBox.classList.add('hidden');
            if (metricGrid) metricGrid.className = "grid grid-cols-2 gap-2 text-center transition-all duration-300";
        } else {
            if (stepsBox) stepsBox.classList.remove('hidden');
            if (calBox) calBox.classList.remove('hidden');
            if (metricGrid) metricGrid.className = "grid grid-cols-4 gap-2 text-center transition-all duration-300";
        }

        // Update home screen destination card metrics
        const homeDistEl = document.getElementById('home-dest-distance');
        const homeTimeEl = document.getElementById('home-dest-time');
        if (homeDistEl) homeDistEl.innerText = distStr;
        if (homeTimeEl) homeTimeEl.innerText = timeStr;
    }

    selectDestination(place) {
        if (!place) return;
        this.activeDestination = place;
        this.lastPinnedLocation = place;
        localStorage.setItem('nearplace_last_pinned', JSON.stringify(place));

        this.renderHomeFeaturedCard();
        this.updateRadiusUI(place.radius || 500);
        this.updateMapForDestination(place);
        this.renderBudgetScreen();
        this.showToast("Destination Selected", place.name);
    }

    renderHomeFeaturedCard() {
        const place = this.activeDestination;
        if (!place) return;

        const nameEl = document.getElementById('home-dest-name');
        const catEl = document.getElementById('home-dest-category');
        const imgEl = document.getElementById('home-dest-image');
        const heartBtn = document.getElementById('home-dest-favorite-btn');
        const notifyTargetEl = document.getElementById('notify-target-name');

        if (nameEl) nameEl.innerText = place.name;
        if (catEl) catEl.innerText = place.category || 'Location';
        if (imgEl && place.image) imgEl.src = place.image;
        if (notifyTargetEl) notifyTargetEl.innerText = place.name;

        if (heartBtn) {
            heartBtn.innerHTML = place.isFavorite 
                ? `<i class="fa-solid fa-heart text-red-400 text-sm"></i>` 
                : `<i class="fa-regular fa-heart text-xs opacity-60"></i>`;
        }

        this.updateTravelMetrics(place);
    }

    toggleFavorite(placeId) {
        const targetId = placeId || (this.activeDestination ? this.activeDestination.id : null);
        const p = this.places.find(x => x.id === targetId);
        if (!p) return;

        p.isFavorite = !p.isFavorite;
        localStorage.setItem('nearplace_saved_places', JSON.stringify(this.places));
        this.renderHomeFeaturedCard();
        this.renderExploreList();
        this.showToast(p.isFavorite ? "Added to Favorites" : "Removed from Favorites", p.name);
    }

    setTravelMode(mode) {
        this.travelMode = mode;
        localStorage.setItem('nearplace_travel_mode', mode);

        const walkBtn = document.getElementById('mode-btn-walk');
        const carBtn = document.getElementById('mode-btn-car');

        if (walkBtn && carBtn) {
            if (mode === 'walk') {
                walkBtn.className = "neu-btn-recessed py-2 px-3.5 rounded-btn text-xs font-semibold flex items-center gap-1.5 text-cherry";
                carBtn.className = "neu-btn py-2 px-3.5 rounded-btn text-xs font-semibold flex items-center gap-1.5 text-neutral-500";
            } else {
                carBtn.className = "neu-btn-recessed py-2 px-3.5 rounded-btn text-xs font-semibold flex items-center gap-1.5 text-cherry";
                walkBtn.className = "neu-btn py-2 px-3.5 rounded-btn text-xs font-semibold flex items-center gap-1.5 text-neutral-500";
            }
        }

        // Toggle visibility of steps/cal boxes in UI
        const metricGrid = document.getElementById('map-metrics-grid');
        const stepsBox = document.getElementById('metric-box-steps');
        const calBox = document.getElementById('metric-box-calories');

        if (mode === 'car') {
            if (stepsBox) stepsBox.classList.add('hidden');
            if (calBox) calBox.classList.add('hidden');
            if (metricGrid) metricGrid.className = "grid grid-cols-2 gap-2 text-center transition-all duration-300";
        } else {
            if (stepsBox) stepsBox.classList.remove('hidden');
            if (calBox) calBox.classList.remove('hidden');
            if (metricGrid) metricGrid.className = "grid grid-cols-4 gap-2 text-center transition-all duration-300";
        }

        if (this.activeDestination) {
            this.drawRoutePolyline(this.activeDestination);
            this.renderHomeFeaturedCard();
        }
    }

    setRadius(val) {
        const radiusNum = parseInt(val);
        if (isNaN(radiusNum)) return;
        if (this.activeDestination) {
            this.activeDestination.radius = radiusNum;
            localStorage.setItem('nearplace_saved_places', JSON.stringify(this.places));
            if (this.radiusCircle) this.radiusCircle.setRadius(radiusNum);
        }
        this.updateRadiusUI(radiusNum);
    }

    updateRadiusUI(val) {
        const text = val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)} km` : `${val} m`;

        const homeDisplay = document.getElementById('home-radius-display');
        const homeSlider = document.getElementById('home-radius-slider');
        const homeSliderVal = document.getElementById('home-radius-slider-val');

        const mapDisplay = document.getElementById('map-radius-display');
        const mapSlider = document.getElementById('map-radius-slider');

        if (homeDisplay) homeDisplay.innerText = text;
        if (homeSlider) homeSlider.value = val;
        if (homeSliderVal) homeSliderVal.innerText = text;

        if (mapDisplay) mapDisplay.innerText = text;
        if (mapSlider) mapSlider.value = val;

        [50, 250, 500, 1000, 2000].forEach(r => {
            const btn = document.getElementById(`radius-pill-${r}`);
            if (btn) {
                if (r === val) {
                    btn.className = "neu-btn-recessed py-1.5 px-1 rounded-btn text-xs font-bold text-cherry";
                } else {
                    btn.className = "neu-btn py-1.5 px-1 rounded-btn text-xs font-medium text-neutral-500 dark:text-neutral-400";
                }
            }
        });
    }

    updateRadiusPills(val) {
        this.updateRadiusUI(val);
    }

    async refreshCurrentWeather() {
        const w = await WeatherService.fetchWeather(this.userPos.lat, this.userPos.lng);
        const tempEl = document.getElementById('weather-temp-main');
        const descEl = document.getElementById('weather-desc-main');
        const rainEl = document.getElementById('weather-rain-val');
        const windEl = document.getElementById('weather-wind-val');
        const humEl = document.getElementById('weather-hum-val');

        if (tempEl) tempEl.innerText = `${w.temp}°`;
        if (descEl) descEl.innerText = w.desc;
        if (rainEl) rainEl.innerText = "20%";
        if (windEl) windEl.innerText = `${w.wind} km/h`;
        if (humEl) humEl.innerText = `${w.humidity}%`;
    }

    renderExploreList() {
        const container = document.getElementById('explore-places-list');
        if (!container) return;

        if (this.places.length === 0) {
            container.innerHTML = `<div class="text-center py-12 text-xs text-neutral-400">No saved places yet.</div>`;
            return;
        }

        container.innerHTML = this.places.map(p => {
            const dist = Utils.calculateDistance(this.userPos.lat, this.userPos.lng, p.lat, p.lng);
            return `
                <div onclick="app.selectDestination(app.places.find(x => x.id === '${p.id}')); app.openPlaceDetails('${p.id}')" class="neu-raised p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all">
                    <div class="flex items-center space-x-3.5 min-w-0 flex-1 pr-2">
                        <img src="${p.image || 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?auto=format&fit=crop&w=400&q=80'}" class="w-14 h-14 rounded-2xl object-cover shadow-sm shrink-0" alt="${p.name}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=400&q=80'">
                        <div class="min-w-0">
                            <span class="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">${p.category}</span>
                            <h3 class="font-bold text-sm truncate">${p.name}</h3>
                            <div class="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                <span class="font-semibold text-cherry">${Utils.formatDistance(dist)}</span>
                                <span>•</span>
                                <span>Budget: ฿${(p.budget || 1500).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 shrink-0">
                        <button onclick="event.stopPropagation(); app.toggleFavorite('${p.id}')" class="neu-circle w-9 h-9 text-xs" title="Favorite">
                            <i class="fa-${p.isFavorite ? 'solid text-red-400' : 'regular text-neutral-400'} fa-heart"></i>
                        </button>
                        <button onclick="event.stopPropagation(); app.deletePlace('${p.id}')" class="neu-circle w-9 h-9 text-xs text-neutral-400 hover:text-red-500 active:scale-90 transition-all" title="Delete">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    deletePlace(id) {
        const placeIdx = this.places.findIndex(x => x.id === id);
        if (placeIdx === -1) return;
        const placeName = this.places[placeIdx].name;

        // Prevent deleting if it's the only place in list
        if (this.places.length <= 1) {
            this.showToast(
                this.lang === 'th' ? "ไม่สามารถลบได้" : "Cannot Delete",
                this.lang === 'th' ? "ต้องมีสถานที่อย่างน้อย 1 แห่งในระบบ" : "At least one location is required"
            );
            return;
        }

        // Remove place
        this.places.splice(placeIdx, 1);
        localStorage.setItem('nearplace_saved_places', JSON.stringify(this.places));

        // If currently active destination was deleted, fallback to first available
        if (this.activeDestination && this.activeDestination.id === id) {
            this.activeDestination = this.places[0];
            this.renderHomeFeaturedCard();
            if (this.map) this.updateMapForDestination(this.activeDestination);
        }

        if (this.lastPinnedLocation && this.lastPinnedLocation.id === id) {
            this.lastPinnedLocation = this.places[0];
            localStorage.setItem('nearplace_last_pinned', JSON.stringify(this.lastPinnedLocation));
        }

        this.renderExploreList();
        this.renderBudgetScreen();

        this.showToast(
            this.lang === 'th' ? "ลบสถานที่สำเร็จ" : "Place Deleted",
            this.lang === 'th' ? `ลบ ${placeName} เรียบร้อยแล้ว` : `Removed ${placeName}`
        );
    }

    // ==========================================================================
    // Requirements 1 & 2: Budget Breakdown by Day/Location, Adjust Budget, Auto-record
    // ==========================================================================
    renderBudgetScreen() {
        const place = this.activeDestination;
        const todayStr = this.getTodayDateString();

        // 1. Daily Budget Calculations
        const todayExpenses = this.expenses.filter(e => (e.date === todayStr || e.displayDate === 'Today'));
        const todaySpent = todayExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
        const todayRemaining = Math.max(0, this.dailyBudgetLimit - todaySpent);
        const dailyPercent = Math.min(100, Math.round((todaySpent / this.dailyBudgetLimit) * 100));

        // Update Daily Summary Elements
        const dailyLimitEl = document.getElementById('daily-budget-limit-val');
        const todaySpentEl = document.getElementById('today-spent-val');
        const todayRemainingEl = document.getElementById('today-remaining-val');
        const dailyProgressEl = document.getElementById('daily-budget-progress-bar');
        const dailyPercentEl = document.getElementById('daily-budget-percent-text');

        if (dailyLimitEl) dailyLimitEl.innerText = `฿${this.dailyBudgetLimit.toLocaleString()}`;
        if (todaySpentEl) todaySpentEl.innerText = `฿${todaySpent.toLocaleString()}`;
        if (todayRemainingEl) todayRemainingEl.innerText = `฿${todayRemaining.toLocaleString()}`;
        if (dailyProgressEl) dailyProgressEl.style.width = `${dailyPercent}%`;
        if (dailyPercentEl) dailyPercentEl.innerText = `${dailyPercent}% used`;

        // 2. Destination Budget Summary
        const placeBudget = place ? (place.budget || 1500) : 1500;
        const placeExpenses = this.expenses.filter(e => !place || e.destination.toLowerCase() === place.name.toLowerCase());
        const placeSpent = placeExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
        const placeRemaining = Math.max(0, placeBudget - placeSpent);

        const destTitle = document.getElementById('budget-destination-title');
        const bVal = document.getElementById('budget-total-val');
        const sVal = document.getElementById('budget-spent-val');
        const rVal = document.getElementById('budget-remaining-val');

        if (destTitle && place) destTitle.innerText = place.name;
        if (bVal) bVal.innerText = `฿${placeBudget.toLocaleString()}`;
        if (sVal) sVal.innerText = `฿${placeSpent.toLocaleString()}`;
        if (rVal) rVal.innerText = `฿${placeRemaining.toLocaleString()}`;

        // 3. Quick Record Label for Last Pinned Location (Requirement 1)
        const lastPinned = this.lastPinnedLocation || place;
        const quickRecordNameEl = document.getElementById('quick-record-place-name');
        if (quickRecordNameEl && lastPinned) {
            quickRecordNameEl.innerText = lastPinned.name;
        }

        // 4. Render Grouped Breakdown (By Day vs By Location)
        this.renderBudgetBreakdown();

        // 5. Render Weekly Summary Panel
        this.renderWeeklySummary();
    }

    setBudgetViewMode(mode) {
        this.budgetViewMode = mode;
        const btnDay = document.getElementById('btn-budget-mode-day');
        const btnLoc = document.getElementById('btn-budget-mode-loc');

        if (btnDay && btnLoc) {
            if (mode === 'byDay') {
                btnDay.className = "neu-btn-recessed py-1.5 px-3 rounded-btn text-xs font-bold text-cherry";
                btnLoc.className = "neu-btn py-1.5 px-3 rounded-btn text-xs font-medium text-neutral-400";
            } else {
                btnLoc.className = "neu-btn-recessed py-1.5 px-3 rounded-btn text-xs font-bold text-cherry";
                btnDay.className = "neu-btn py-1.5 px-3 rounded-btn text-xs font-medium text-neutral-400";
            }
        }
        this.renderBudgetBreakdown();
    }

    renderBudgetBreakdown() {
        const container = document.getElementById('budget-expenses-list');
        if (!container) return;

        if (this.expenses.length === 0) {
            container.innerHTML = `<div class="text-center py-8 text-xs text-neutral-400">No expenses logged yet.</div>`;
            return;
        }

        if (this.budgetViewMode === 'byDay') {
            // Group expenses by Day (Requirement 1)
            const grouped = {};
            this.expenses.forEach(e => {
                const dayKey = e.date || e.displayDate || "Recent";
                if (!grouped[dayKey]) grouped[dayKey] = [];
                grouped[dayKey].push(e);
            });

            container.innerHTML = Object.entries(grouped).map(([day, items]) => {
                const dayTotal = items.reduce((sum, x) => sum + (x.amount || 0), 0);
                return `
                    <div class="neu-raised p-4 space-y-2.5">
                        <div class="flex justify-between items-center border-b border-neutral-300 dark:border-neutral-700/60 pb-2">
                            <div class="flex items-center gap-2">
                                <i class="fa-regular fa-calendar text-xs text-cherry"></i>
                                <span class="font-bold text-xs">${day === this.getTodayDateString() ? 'Today' : day}</span>
                            </div>
                            <span class="text-xs font-bold text-cherry">฿${dayTotal.toLocaleString()}</span>
                        </div>
                        <div class="space-y-2 pt-1">
                            ${items.map(it => `
                                <div class="neu-recessed p-2.5 rounded-xl flex items-center justify-between text-xs">
                                    <div class="flex items-center space-x-2.5 min-w-0">
                                        <div class="w-7 h-7 rounded-lg neu-raised flex items-center justify-center text-cherry text-[10px] shrink-0">
                                            <i class="fa-solid fa-location-dot"></i>
                                        </div>
                                        <div class="min-w-0">
                                            <div class="font-bold truncate">${it.destination}</div>
                                            <div class="text-[10px] text-neutral-400 truncate">${it.title} ${it.time ? '• ' + it.time : ''}</div>
                                        </div>
                                    </div>
                                    <div class="font-bold text-sm shrink-0 ml-2">฿${it.amount.toLocaleString()}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            // Group expenses by Visited Location (Requirement 1)
            const locMap = {};
            this.expenses.forEach(e => {
                const locName = e.destination || "Other";
                if (!locMap[locName]) locMap[locName] = { total: 0, items: [], place: this.places.find(p => p.name.toLowerCase() === locName.toLowerCase()) };
                locMap[locName].total += (e.amount || 0);
                locMap[locName].items.push(e);
            });

            container.innerHTML = Object.entries(locMap).map(([locName, data]) => {
                const placeBudget = data.place ? (data.place.budget || 1500) : 1500;
                return `
                    <div class="neu-raised p-4 space-y-2.5">
                        <div class="flex justify-between items-center border-b border-neutral-300 dark:border-neutral-700/60 pb-2">
                            <div>
                                <h4 class="font-bold text-sm">${locName}</h4>
                                <span class="text-[10px] text-neutral-400">Budget Limit: ฿${placeBudget.toLocaleString()}</span>
                            </div>
                            <div class="text-right">
                                <div class="text-xs font-bold text-cherry">Spent: ฿${data.total.toLocaleString()}</div>
                                <button onclick="app.openAdjustPlaceBudgetModal('${data.place ? data.place.id : ''}', '${locName}', ${placeBudget})" class="text-[10px] text-neutral-400 hover:text-cherry underline">Adjust Budget</button>
                            </div>
                        </div>
                        <div class="space-y-1.5 pt-1">
                            ${data.items.map(it => `
                                <div class="flex justify-between items-center text-xs py-1 text-neutral-600 dark:text-neutral-300">
                                    <span class="truncate pr-2">${it.title} (${it.date || it.displayDate || 'Recent'})</span>
                                    <span class="font-semibold shrink-0">฿${it.amount.toLocaleString()}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Auto-Record Expense (Requirement 1)
    addExpense(amount, title = "Expense", destination = null) {
        if (!amount || isNaN(amount)) return;
        const targetDest = destination || (this.lastPinnedLocation ? this.lastPinnedLocation.name : (this.activeDestination ? this.activeDestination.name : "Bangkok"));

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newExpense = {
            id: Date.now(),
            destination: targetDest,
            title: title || "Shopping & Food",
            amount: parseFloat(amount),
            date: this.getTodayDateString(),
            displayDate: "Today",
            time: timeStr
        };

        this.expenses.unshift(newExpense);
        localStorage.setItem('nearplace_expenses', JSON.stringify(this.expenses));
        this.renderBudgetScreen();
        this.closeExpenseModal();
        this.showToast("Expense Recorded", `฿${parseFloat(amount).toLocaleString()} for ${targetDest}`);
    }

    quickAddExpenseForLastPinned(amount) {
        const target = this.lastPinnedLocation || this.activeDestination;
        const placeName = target ? target.name : "Bangkok";
        this.addExpense(amount, "Quick Expense", placeName);
    }

    // Adjust Daily Budget Limit (Requirement 2)
    adjustDailyBudgetLimit(newAmount) {
        if (!newAmount || isNaN(newAmount) || newAmount <= 0) return;
        this.dailyBudgetLimit = parseFloat(newAmount);
        localStorage.setItem('nearplace_daily_budget', this.dailyBudgetLimit);
        this.renderBudgetScreen();
        this.closeAdjustDailyModal();
        this.showToast("Daily Budget Updated", `฿${this.dailyBudgetLimit.toLocaleString()}`);
    }

    // Adjust Place Budget Limit (Requirement 2)
    adjustPlaceBudget(placeId, locName, newAmount) {
        if (!newAmount || isNaN(newAmount) || newAmount <= 0) return;
        const place = this.places.find(p => p.id === placeId || p.name.toLowerCase() === locName.toLowerCase());
        if (place) {
            place.budget = parseFloat(newAmount);
            localStorage.setItem('nearplace_saved_places', JSON.stringify(this.places));
        }
        this.renderBudgetScreen();
        this.closeAdjustPlaceModal();
        this.showToast("Location Budget Updated", `${locName}: ฿${parseFloat(newAmount).toLocaleString()}`);
    }

    // ==========================================================================
    // Weekly Summary (past 7 days: total spend + places visited)
    // ==========================================================================
    getWeekSummary() {
        const today = new Date();
        const todayStr = this.getTodayDateString();
        const weekDates = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            weekDates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
        }

        // Normalize: expenses with displayDate='Today' but missing real date → assign today's date
        const normalizedExpenses = this.expenses.map(e => ({
            ...e,
            date: (e.date && e.date.match(/^\d{4}-\d{2}-\d{2}$/)) ? e.date : todayStr
        }));

        const weekExpenses = normalizedExpenses.filter(e => weekDates.includes(e.date));
        const totalSpent = weekExpenses.reduce((s, e) => s + (e.amount || 0), 0);
        const placesSet = new Set(weekExpenses.map(e => e.destination).filter(Boolean));
        const placesVisited = [...placesSet];

        // Build per-day breakdown
        const byDay = {};
        weekDates.forEach(d => { byDay[d] = { spent: 0, places: new Set() }; });
        weekExpenses.forEach(e => {
            if (byDay[e.date]) {
                byDay[e.date].spent += (e.amount || 0);
                if (e.destination) byDay[e.date].places.add(e.destination);
            }
        });

        return { totalSpent, placesVisited, byDay, weekDates };
    }

    renderWeeklySummary() {
        const container = document.getElementById('weekly-summary-body');
        if (!container) return;

        const { totalSpent, placesVisited, byDay, weekDates } = this.getWeekSummary();
        const isth = this.lang === 'th';
        const dayLabels = isth
            ? ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
            : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Bar chart: use fixed pixel heights (max bar = 56px)
        const MAX_BAR_PX = 56;
        const MIN_BAR_PX = 4;
        const maxSpend = Math.max(...weekDates.map(d => byDay[d].spent), 1);

        const chartBars = weekDates.map(d => {
            const dayObj = new Date(d + 'T00:00:00');
            const label = dayLabels[dayObj.getDay()];
            const spent = byDay[d].spent;
            const barPx = spent > 0
                ? Math.max(MIN_BAR_PX, Math.round((spent / maxSpend) * MAX_BAR_PX))
                : MIN_BAR_PX;
            const isToday = d === this.getTodayDateString();
            const amtLabel = spent > 0
                ? (spent >= 1000 ? '฿' + (Math.round(spent / 100) / 10) + 'k' : '฿' + Math.round(spent))
                : '';
            return `
                <div class="flex flex-col items-center gap-0.5 flex-1" style="min-width:0">
                    <span class="text-[9px] font-bold leading-tight ${spent > 0 ? 'text-cherry' : 'text-neutral-400'} truncate w-full text-center">${amtLabel}</span>
                    <div class="w-full flex flex-col justify-end rounded-sm overflow-hidden" style="height:${MAX_BAR_PX}px; background: rgba(184,154,103,0.1);">
                        <div class="w-full rounded-t transition-all duration-700 ${isToday ? 'bg-cherry' : 'bg-cherry/50'}" style="height:${barPx}px"></div>
                    </div>
                    <span class="text-[9px] leading-tight ${isToday ? 'font-bold text-cherry' : 'text-neutral-400'}">${label}</span>
                </div>
            `;
        }).join('');

        // Places visited chips
        const placeChips = placesVisited.length > 0
            ? placesVisited.map(p => `<span class="neu-recessed px-2.5 py-1 rounded-full text-[10px] font-semibold">${p}</span>`).join('')
            : `<span class="text-xs text-neutral-400">${isth ? 'ยังไม่มีข้อมูลสัปดาห์นี้' : 'No visits this week'}</span>`;

        container.innerHTML = `
            <!-- Mini Bar Chart -->
            <div class="flex gap-1.5 items-end w-full mt-1">
                ${chartBars}
            </div>

            <!-- Places Chips -->
            <div class="mt-3">
                <div class="text-[10px] text-neutral-400 mb-2 font-semibold uppercase tracking-wider">${isth ? 'สถานที่ที่ไปในสัปดาห์นี้' : 'Visited This Week'}</div>
                <div class="flex flex-wrap gap-1.5">
                    ${placeChips}
                </div>
            </div>
        `;

        // Update quick-stat numbers always visible in the header
        const totalEl = document.getElementById('weekly-total-spent');
        const placesEl = document.getElementById('weekly-places-count');
        if (totalEl) totalEl.innerText = `฿${totalSpent.toLocaleString()}`;
        if (placesEl) placesEl.innerText = placesVisited.length;
    }

    // ==========================================================================
    // Modals
    // ==========================================================================
    openExpenseModal() {
        const modal = document.getElementById('add-expense-modal');
        const inputDest = document.getElementById('modal-expense-dest');
        const lastPinned = this.lastPinnedLocation || this.activeDestination;

        // Auto-fill most recently pinned location (Requirement 1)
        if (inputDest && lastPinned) {
            inputDest.value = lastPinned.name;
        }

        if (modal) modal.classList.remove('hidden');
    }

    closeExpenseModal() {
        const modal = document.getElementById('add-expense-modal');
        if (modal) modal.classList.add('hidden');
    }

    openAdjustDailyModal() {
        const modal = document.getElementById('adjust-daily-budget-modal');
        const input = document.getElementById('modal-daily-budget-input');
        if (input) input.value = this.dailyBudgetLimit;
        if (modal) modal.classList.remove('hidden');
    }

    closeAdjustDailyModal() {
        const modal = document.getElementById('adjust-daily-budget-modal');
        if (modal) modal.classList.add('hidden');
    }

    openAdjustPlaceBudgetModal(placeId, locName, currentBudget) {
        const modal = document.getElementById('adjust-place-budget-modal');
        const title = document.getElementById('modal-adjust-place-title');
        const input = document.getElementById('modal-place-budget-input');
        const idHolder = document.getElementById('modal-adjust-place-id');

        if (title) title.innerText = locName;
        if (input) input.value = currentBudget || 1500;
        if (idHolder) idHolder.value = placeId || locName;
        if (modal) modal.classList.remove('hidden');
    }

    closeAdjustPlaceModal() {
        const modal = document.getElementById('adjust-place-budget-modal');
        if (modal) modal.classList.add('hidden');
    }

    // ==========================================================================
    // Requirement 3: Reset All Data
    // ==========================================================================
    confirmResetData() {
        const modal = document.getElementById('reset-confirm-modal');
        if (modal) modal.classList.remove('hidden');
    }

    closeResetModal() {
        const modal = document.getElementById('reset-confirm-modal');
        if (modal) modal.classList.add('hidden');
    }

    executeResetData() {
        // Clear all NearPlace localStorage keys
        const keysToRemove = [
            'nearplace_saved_places',
            'nearplace_expenses',
            'nearplace_daily_budget',
            'nearplace_last_pinned',
            'nearplace_alerts_log',
            'nearplace_travel_mode'
        ];
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // Restore factory presets
        this.places = Object.values(PRESET_PLACES).map(p => ({ ...p }));
        this.activeDestination = this.places[0];
        this.lastPinnedLocation = this.places[0];
        this.dailyBudgetLimit = 2000;
        this.budgetViewMode = 'byDay';
        this.expenses = [
            {
                id: 1,
                destination: "ICONSIAM",
                title: "Dining & Coffee",
                amount: 850,
                date: this.getTodayDateString(),
                displayDate: "Today",
                time: "14:30"
            }
        ];
        this.alertsLog = [];
        this.travelMode = 'car';

        this.closeResetModal();

        // Refresh all screens and controls
        this.setTravelMode('car');
        this.setRadius(500);
        this.renderHomeFeaturedCard();
        this.renderExploreList();
        this.renderBudgetScreen();
        if (this.map) {
            this.updateMapForDestination(this.activeDestination);
            this.recenterMap();
        }

        const msg = i18n[this.lang] && i18n[this.lang].dataResetSuccess
            ? i18n[this.lang].dataResetSuccess
            : "All data has been reset to defaults";
        this.showToast(i18n[this.lang] && i18n[this.lang].resetData ? i18n[this.lang].resetData : "Reset Data", msg);
    }

    // ==========================================================================
    // Profile & Authentication Management (Separate Login Screen)
    // ==========================================================================
    checkLoginScreen() {
        const langEl = document.getElementById('login-lang-code');
        if (langEl) langEl.innerText = this.lang.toUpperCase();

        const hasSession = sessionStorage.getItem('nearplace_session_active');
        if (!this.isLoggedIn && !hasSession) {
            this.switchTab('tab-login');
        } else {
            this.switchTab('tab-home');
        }
    }

    loginWithGoogle() {
        const btn = document.getElementById('btn-google-login');
        if (btn) {
            btn.classList.add('opacity-70', 'pointer-events-none');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `
                <div class="w-4 h-4 border-2 border-cherry border-t-transparent rounded-full animate-spin"></div>
                <span class="text-xs font-bold text-cherry">Signing in with Google...</span>
            `;

            setTimeout(() => {
                this._executeGoogleLogin();
                btn.innerHTML = originalHtml;
                btn.classList.remove('opacity-70', 'pointer-events-none');
            }, 800);
        } else {
            this._executeGoogleLogin();
        }
    }

    _executeGoogleLogin() {
        // Authenticate with Google profile data
        const googleUser = {
            name: "Alexander Vance",
            email: "alexander.vance@gmail.com",
            bio: "Google Verified • Bangkok & Worldwide",
            avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80",
            authProvider: 'google'
        };

        this.userProfile = googleUser;
        this.isLoggedIn = true;
        localStorage.setItem('nearplace_user_profile', JSON.stringify(googleUser));
        localStorage.setItem('nearplace_is_logged_in', 'true');
        sessionStorage.setItem('nearplace_session_active', 'true');

        // Go to Home screen
        this.switchTab('tab-home');

        // Update all UI elements
        this.renderProfileUI();

        const successTitle = i18n[this.lang] && i18n[this.lang].loginSuccess ? i18n[this.lang].loginSuccess : "Signed in with Google";
        this.showToast(successTitle, `${googleUser.name} (${googleUser.email})`);
    }

    continueAsGuest() {
        sessionStorage.setItem('nearplace_session_active', 'true');
        this.switchTab('tab-home');

        this.renderProfileUI();
        this.showToast(
            this.lang === 'th' ? "เข้าสู่ระบบแบบผู้มาเยือน" : "Guest Mode",
            this.lang === 'th' ? "คุณสามารถเข้าสู่ระบบด้วย Google ภายหลังได้ที่ Settings" : "You can sign in with Google anytime in Settings"
        );
    }

    signOutUser() {
        this.isLoggedIn = false;
        localStorage.removeItem('nearplace_is_logged_in');
        sessionStorage.removeItem('nearplace_session_active');

        // Revert profile to default guest
        this.userProfile = {
            name: "Luxe Traveler",
            bio: "Bangkok, Thailand",
            email: "traveler@nearplace.luxe",
            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
            authProvider: 'guest'
        };
        localStorage.setItem('nearplace_user_profile', JSON.stringify(this.userProfile));

        this.renderProfileUI();

        // Switch cleanly to dedicated Login Screen
        this.switchTab('tab-login');

        const toastTitle = i18n[this.lang] && i18n[this.lang].logoutSuccess ? i18n[this.lang].logoutSuccess : "Signed Out";
        this.showToast(toastTitle, this.lang === 'th' ? "ออกจากระบบเรียบร้อยแล้ว" : "Signed out successfully");
    }

    renderProfileUI() {
        if (!this.userProfile) return;
        const imgEl = document.getElementById('profile-display-img');
        const nameEl = document.getElementById('profile-display-name');
        const bioEl = document.getElementById('profile-display-bio');
        const emailEl = document.getElementById('profile-display-email');

        if (imgEl && this.userProfile.avatar) imgEl.src = this.userProfile.avatar;
        if (nameEl && this.userProfile.name) nameEl.innerText = this.userProfile.name;
        if (bioEl) bioEl.innerText = this.userProfile.bio || '';
        if (emailEl) emailEl.innerText = this.userProfile.email || '';

        // Sync Account Card in Settings
        const authBadge = document.getElementById('settings-auth-status-badge');
        const authAvatar = document.getElementById('settings-auth-avatar');
        const authName = document.getElementById('settings-auth-name');
        const authEmail = document.getElementById('settings-auth-email');
        const googleBtnText = document.getElementById('settings-google-btn-text');

        if (authAvatar && this.userProfile.avatar) authAvatar.src = this.userProfile.avatar;
        if (authName && this.userProfile.name) authName.innerText = this.userProfile.name;
        if (authEmail) authEmail.innerText = this.userProfile.email || '';

        if (authBadge) {
            if (this.isLoggedIn || this.userProfile.authProvider === 'google') {
                authBadge.innerText = "Google Verified";
                authBadge.className = "neu-recessed px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-500";
                if (googleBtnText) googleBtnText.innerText = i18n[this.lang] && i18n[this.lang].switchAccount ? i18n[this.lang].switchAccount : "Switch";
            } else {
                authBadge.innerText = i18n[this.lang] && i18n[this.lang].guestMode ? "Guest Mode" : "Guest Mode";
                authBadge.className = "neu-recessed px-2 py-0.5 rounded-full text-[10px] font-bold text-cherry";
                if (googleBtnText) googleBtnText.innerText = "Google Sign in";
            }
        }
    }

    openEditProfileModal() {
        const modal = document.getElementById('edit-profile-modal');
        const previewImg = document.getElementById('modal-profile-preview');
        const nameInput = document.getElementById('modal-profile-name-input');
        const bioInput = document.getElementById('modal-profile-bio-input');
        const emailInput = document.getElementById('modal-profile-email-input');
        const urlInput = document.getElementById('modal-profile-url-input');

        if (this.userProfile) {
            if (previewImg) previewImg.src = this.userProfile.avatar || '';
            if (nameInput) nameInput.value = this.userProfile.name || '';
            if (bioInput) bioInput.value = this.userProfile.bio || '';
            if (emailInput) emailInput.value = this.userProfile.email || '';
            if (urlInput) urlInput.value = this.userProfile.avatar || '';
        }

        if (modal) modal.classList.remove('hidden');
    }

    closeEditProfileModal() {
        const modal = document.getElementById('edit-profile-modal');
        if (modal) modal.classList.add('hidden');
    }

    handleProfilePhotoUpload(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            this.showToast(
                this.lang === 'th' ? "ไฟล์ไม่ถูกต้อง" : "Invalid File",
                this.lang === 'th' ? "กรุณาเลือกไฟล์รูปภาพ" : "Please select an image file"
            );
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const previewImg = document.getElementById('modal-profile-preview');
            const urlInput = document.getElementById('modal-profile-url-input');
            if (previewImg) previewImg.src = dataUrl;
            if (urlInput) urlInput.value = '';
            this._pendingAvatarData = dataUrl;
        };
        reader.readAsDataURL(file);
    }

    previewProfileUrl(url) {
        if (!url || !url.trim()) return;
        const previewImg = document.getElementById('modal-profile-preview');
        if (previewImg) {
            previewImg.src = url.trim();
            this._pendingAvatarData = url.trim();
        }
    }

    saveProfile() {
        const nameInput = document.getElementById('modal-profile-name-input');
        const bioInput = document.getElementById('modal-profile-bio-input');
        const emailInput = document.getElementById('modal-profile-email-input');
        const previewImg = document.getElementById('modal-profile-preview');

        const name = nameInput ? nameInput.value.trim() : '';
        const bio = bioInput ? bioInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const avatar = this._pendingAvatarData || (previewImg ? previewImg.src : (this.userProfile ? this.userProfile.avatar : ''));

        if (!name) {
            this.showToast(
                this.lang === 'th' ? "กรุณากรอกชื่อ" : "Name Required",
                this.lang === 'th' ? "โปรดระบุชื่อผู้ใช้ของคุณ" : "Please enter your name"
            );
            return;
        }

        this.userProfile = {
            name: name,
            bio: bio,
            email: email,
            avatar: avatar
        };

        localStorage.setItem('nearplace_user_profile', JSON.stringify(this.userProfile));
        this._pendingAvatarData = null;

        this.renderProfileUI();
        this.closeEditProfileModal();

        this.showToast(
            this.lang === 'th' ? "อัปเดตโปรไฟล์สำเร็จ" : "Profile Updated",
            name
        );
    }

    // ==========================================================================
    // Collapsible Map Panel to prevent blocking the map during navigation
    // ==========================================================================
    toggleMapPanel(forceState = null) {
        if (forceState !== null) {
            this.isMapPanelCollapsed = forceState;
        } else {
            this.isMapPanelCollapsed = !this.isMapPanelCollapsed;
        }

        const panelBody = document.getElementById('map-panel-body');
        const chevron = document.getElementById('map-panel-chevron');
        const collapsedInfo = document.getElementById('map-panel-collapsed-info');
        const miniNavBtn = document.getElementById('btn-mini-nav-toggle');

        if (this.isMapPanelCollapsed) {
            if (panelBody) panelBody.classList.add('hidden');
            if (chevron) chevron.className = "fa-solid fa-chevron-up transition-transform duration-300";
            if (collapsedInfo) collapsedInfo.classList.remove('hidden');
            if (miniNavBtn) miniNavBtn.classList.remove('hidden');
        } else {
            if (panelBody) panelBody.classList.remove('hidden');
            if (chevron) chevron.className = "fa-solid fa-chevron-down transition-transform duration-300";
            if (collapsedInfo) collapsedInfo.classList.add('hidden');
            if (miniNavBtn) miniNavBtn.classList.add('hidden');
        }
    }

    // ==========================================================================
    // Requirement 4: Voice Notifications in Selected Language & Nav Simulation
    // ==========================================================================
    toggleNavigationSimulation() {
        this.isNavigating = !this.isNavigating;
        const btnText = document.getElementById('map-nav-btn-text');
        const btnIcon = document.getElementById('map-nav-btn-icon');
        const miniNavIcon = document.getElementById('mini-nav-icon');
        const dest = this.activeDestination;

        if (this.isNavigating) {
            this.hasSpokenArriving = false;
            if (btnText) btnText.innerText = i18n[this.lang].stopNav || "Stop Nav";
            if (btnIcon) btnIcon.className = "fa-solid fa-square-stop animate-pulse";
            if (miniNavIcon) miniNavIcon.className = "fa-solid fa-square-stop animate-pulse text-red-500";

            // Automatically collapse the panel during navigation so user can see full map!
            setTimeout(() => {
                if (this.isNavigating) this.toggleMapPanel(true);
            }, 600);

            // Voice: Navigation Started
            if (this.settings.voiceEnabled && dest) {
                VoiceService.notifyNavStart(dest.name, this.travelMode, this.lang);
            }

            this.currentRouteIndex = 0;
            this.navInterval = setInterval(() => {
                if (this.currentRouteIndex < this.currentRouteWaypoints.length - 1) {
                    this.currentRouteIndex++;
                    const nextPt = this.currentRouteWaypoints[this.currentRouteIndex];
                    this.userPos.lat = nextPt[0];
                    this.userPos.lng = nextPt[1];

                    if (this.userMarker) this.userMarker.setLatLng([this.userPos.lat, this.userPos.lng]);
                    if (this.map) this.map.panTo([this.userPos.lat, this.userPos.lng]);

                    // Voice Notification: "Arriving Soon" at 70% progress (Requirement 4)
                    const progress = this.currentRouteIndex / this.currentRouteWaypoints.length;
                    if (progress >= 0.70 && !this.hasSpokenArriving) {
                        this.hasSpokenArriving = true;
                        if (this.settings.voiceEnabled && dest) {
                            VoiceService.notifyArriving(dest.name, this.lang);
                        }
                        this.showToast("Approaching Destination", `Arriving soon at ${dest.name}`);
                    }
                } else {
                    // Voice Notification: Arrived at Destination (Requirement 4)
                    this.toggleNavigationSimulation();
                    if (this.settings.voiceEnabled && dest) {
                        VoiceService.notifyArrived(dest.name, this.lang);
                    }
                    this.showToast('Arrived!', `You have reached ${dest ? dest.name : 'destination'}.`);

                    // Re-open panel upon arrival
                    this.toggleMapPanel(false);

                    // Prompt to record expense for this visited location
                    setTimeout(() => {
                        this.openExpenseModal();
                    }, 1200);
                }
            }, 1200);
        } else {
            if (btnText) btnText.innerText = i18n[this.lang].startNav || "Start Navigation";
            if (btnIcon) btnIcon.className = "fa-solid fa-location-arrow";
            if (miniNavIcon) miniNavIcon.className = "fa-solid fa-location-arrow";
            if (this.navInterval) clearInterval(this.navInterval);
        }
    }

    testVoice() {
        const destName = this.activeDestination ? this.activeDestination.name : "ICONSIAM";
        VoiceService.notifyArriving(destName, this.lang);
        this.showToast("Voice Test", `Testing in ${this.lang.toUpperCase()}...`);
    }

    toggleVoice() {
        this.settings.voiceEnabled = !this.settings.voiceEnabled;
        localStorage.setItem('nearplace_voice_enabled', this.settings.voiceEnabled);
        this.updateVoiceStatusUI();
        this.showToast("Voice Guidance", this.settings.voiceEnabled ? "Enabled" : "Disabled");
    }

    updateVoiceStatusUI() {
        const dot = document.getElementById('voice-status-dot');
        const text = document.getElementById('voice-status-text');
        if (dot) {
            dot.className = this.settings.voiceEnabled ? "w-2.5 h-2.5 rounded-full bg-cherry" : "w-2.5 h-2.5 rounded-full bg-neutral-400";
        }
        if (text) {
            text.innerText = this.settings.voiceEnabled ? (this.lang === 'th' ? 'เปิดใช้งาน' : 'Enabled') : (this.lang === 'th' ? 'ปิด' : 'Disabled');
        }
    }

    startGeofenceMonitoring() {
        setInterval(() => {
            this.places.forEach(place => {
                const dist = Utils.calculateDistance(this.userPos.lat, this.userPos.lng, place.lat, place.lng);
                if (dist <= (place.radius || 500)) {
                    if (!place.triggered) {
                        place.triggered = true;
                        this.triggerProximityAlert(place, dist);
                    }
                } else {
                    place.triggered = false;
                }
            });
        }, 2000);
    }

    triggerProximityAlert(place, distance) {
        if (this.settings.soundChime) Utils.playGlassChimeSound();
        if (navigator.vibrate) navigator.vibrate([150, 100, 150]);

        // Voice Proximity Notification (Requirement 4)
        if (this.settings.voiceEnabled) {
            VoiceService.notifyProximity(place.name, this.lang);
        }

        const logItem = {
            id: Date.now(),
            placeName: place.name,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            radius: place.radius
        };
        this.alertsLog.unshift(logItem);
        localStorage.setItem('nearplace_alerts_log', JSON.stringify(this.alertsLog));

        this.showToast(`Near ${place.name}!`, `Inside ${Utils.formatDistance(place.radius || 500)} radius.`);
    }

    showToast(title, msg) {
        const toast = document.getElementById('notification-toast');
        if (!toast) return;
        document.getElementById('toast-title').innerText = title;
        document.getElementById('toast-message').innerText = msg;
        toast.classList.remove('-translate-y-36', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
        setTimeout(() => this.dismissToast(), 4000);
    }

    dismissToast() {
        const toast = document.getElementById('notification-toast');
        if (!toast) return;
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('-translate-y-36', 'opacity-0');
    }

    openPlaceDetails(id) {
        const p = this.places.find(x => x.id === id) || this.activeDestination;
        if (!p) return;

        this.currentDetailPlaceId = p.id;

        const sheet = document.getElementById('place-detail-sheet');
        const img = document.getElementById('detail-sheet-image');
        const name = document.getElementById('detail-sheet-name');
        const cat = document.getElementById('detail-sheet-category');
        const addr = document.getElementById('detail-sheet-address');
        const hours = document.getElementById('detail-sheet-hours');

        if (img) img.src = p.image || '';
        if (name) name.innerText = p.name;
        if (cat) cat.innerText = p.category;
        if (addr) addr.innerText = p.address;
        if (hours) hours.innerText = p.openingHours || "10:00 - 22:00";

        if (sheet) sheet.classList.remove('translate-y-full');
    }

    deleteCurrentDetailPlace() {
        if (!this.currentDetailPlaceId) return;
        const id = this.currentDetailPlaceId;
        this.closeDetailSheet();
        this.deletePlace(id);
    }

    closeDetailSheet() {
        const sheet = document.getElementById('place-detail-sheet');
        if (sheet) sheet.classList.add('translate-y-full');
    }

    recenterMap() {
        if (this.map) this.map.flyTo([this.userPos.lat, this.userPos.lng], 15);
    }

    toggleTheme() {
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.theme = newTheme;
        localStorage.setItem('nearplace_theme', newTheme);
        this.applyTheme(newTheme);
    }

    applyTheme(mode) {
        if (mode === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        const icon = document.getElementById('theme-icon');
        const themeText = document.getElementById('theme-setting-text');
        if (icon) {
            icon.className = mode === 'dark' ? "fa-solid fa-sun text-cherry text-xs" : "fa-solid fa-moon text-xs";
        }
        if (themeText) {
            themeText.innerText = mode === 'dark' ? "Graphite" : "Ivory";
        }
    }

    toggleLanguage() {
        const newLang = this.lang === 'th' ? 'en' : 'th';
        this.lang = newLang;
        localStorage.setItem('nearplace_lang', newLang);
        this.applyLanguage(newLang);
    }

    applyLanguage(code) {
        const langEl = document.getElementById('lang-code');
        const loginLangEl = document.getElementById('login-lang-code');
        const langSettingText = document.getElementById('lang-setting-text');
        if (langEl) langEl.innerText = code.toUpperCase();
        if (loginLangEl) loginLangEl.innerText = code.toUpperCase();
        if (langSettingText) langSettingText.innerText = code === 'th' ? 'ไทย (TH)' : 'English (EN)';

        const dict = i18n[code] || i18n.th;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.innerText = dict[key];
        });
        this.initHeaderDate();
        this.updateVoiceStatusUI();
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        document.querySelectorAll('.tab-screen').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(tabId);
        if (target) target.classList.remove('hidden');

        // Hide floating bottom nav completely when on dedicated Login screen
        const bottomNav = document.getElementById('bottom-nav-bar');
        if (bottomNav) {
            if (tabId === 'tab-login') {
                bottomNav.classList.add('hidden', 'translate-y-20', 'opacity-0');
            } else {
                bottomNav.classList.remove('hidden', 'translate-y-20', 'opacity-0');
            }
        }

        ['home', 'explore', 'map', 'budget', 'settings'].forEach(t => {
            const btn = document.getElementById(`nav-btn-${t}`);
            if (btn) {
                if (`tab-${t}` === tabId) {
                    btn.className = "neu-btn-recessed flex-1 py-2 px-3 rounded-full flex flex-col items-center justify-center text-cherry transition-all";
                } else {
                    btn.className = "flex-1 py-2 px-3 rounded-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-cherry transition-all";
                }
            }
        });

        if (tabId === 'tab-map') {
            if (!this.map) this.initMap();
            setTimeout(() => {
                if (this.map) this.map.invalidateSize();
            }, 100);
        }

        if (tabId === 'tab-budget') {
            this.renderBudgetScreen();
        }
    }

    handleSearchInput(query, containerId = 'home-search-results') {
        if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
        const resultsContainer = document.getElementById(containerId);

        if (!query || query.trim().length < 2) {
            if (resultsContainer) resultsContainer.classList.add('hidden');
            return;
        }

        this.searchDebounceTimer = setTimeout(async () => {
            const data = await GeocodingService.search(query.trim());
            if (data && data.length > 0) {
                resultsContainer.innerHTML = data.map(item => `
                    <div onclick="app.selectSearchResult(${item.lat}, ${item.lon}, '${item.display_name.replace(/'/g, "\\'")}', '${item.type || 'Location'}', '${containerId}')" class="p-3 rounded-2xl hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer text-xs flex items-center space-x-2.5 transition-all">
                        <div class="w-8 h-8 rounded-xl neu-recessed flex items-center justify-center text-cherry shrink-0">
                            <i class="fa-solid fa-location-dot"></i>
                        </div>
                        <div class="truncate">
                            <div class="font-bold truncate">${item.display_name.split(',')[0]}</div>
                            <div class="text-[10px] text-neutral-400 truncate">${item.display_name}</div>
                        </div>
                    </div>
                `).join('');
                resultsContainer.classList.remove('hidden');
            } else {
                resultsContainer.innerHTML = `<div class="p-4 text-xs text-center text-neutral-400">No locations found.</div>`;
                resultsContainer.classList.remove('hidden');
            }
        }, 400);
    }

    async selectSearchResult(lat, lng, fullAddress, category, containerId) {
        const pLat = parseFloat(lat);
        const pLng = parseFloat(lng);

        if (!this.isWithinThailand(pLat, pLng)) {
            const title = i18n[this.lang] && i18n[this.lang].outOfBounds ? i18n[this.lang].outOfBounds : "Outside Thailand";
            const msg = i18n[this.lang] && i18n[this.lang].onlyThailand ? i18n[this.lang].onlyThailand : "Restricted to Thailand only";
            this.showToast(title, msg);
            return;
        }

        const nameParts = fullAddress.split(',');
        const mainName = nameParts[0];

        // Fetch Real Image (Requirement 3 & 5)
        const realImage = await ImageService.fetchLocationImage(mainName, category, pLat, pLng);

        const newTarget = {
            id: 'place-' + Date.now(),
            name: mainName,
            address: fullAddress,
            category: category.toUpperCase() || 'LOCATION',
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            radius: 500,
            budget: 1500,
            spent: 0,
            isFavorite: false,
            image: realImage,
            steps: 4500,
            calories: 200,
            note: ""
        };

        this.places.unshift(newTarget);
        localStorage.setItem('nearplace_saved_places', JSON.stringify(this.places));
        this.selectDestination(newTarget);

        const container = document.getElementById(containerId);
        if (container) container.classList.add('hidden');

        const input = document.getElementById('home-search-input');
        if (input) input.value = '';
    }
}

// Global App Instance & Initialization
let app;
window.onload = function() {
    app = new NearPlaceApp();
    app.init();
};
