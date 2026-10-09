// ==========================================================================
// External API Services: Weather, Geocoding, Real Routing, Images & Voice
// ==========================================================================

const WeatherService = {
    /**
     * Fetches real-time weather from Open-Meteo API
     */
    async fetchWeather(lat, lng) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Weather request failed");
            const data = await res.json();

            if (data && data.current) {
                const temp = Math.round(data.current.temperature_2m);
                const code = data.current.weather_code;
                const humidity = data.current.relative_humidity_2m;
                const wind = Math.round(data.current.wind_speed_10m);

                const { icon, desc } = Utils.parseWeatherCode(code);
                return { temp, icon, desc, humidity, wind };
            }
        } catch (e) {
            console.warn("Weather fetch error:", e);
        }
        return { temp: 29, icon: '🌤️', desc: 'Partly Cloudy', humidity: 62, wind: 10 };
    }
};

const GeocodingService = {
    /**
     * Searches places using OpenStreetMap Nominatim API restricted strictly to Thailand
     */
    async search(query) {
        try {
            // countrycodes=th restricts all search queries within Thailand boundary
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=th&viewbox=97.0,20.6,106.0,5.5&limit=5&addressdetails=1`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'th,en' } });
            if (!res.ok) throw new Error("Search request failed");
            return await res.json();
        } catch (e) {
            console.warn("Geocoding search error:", e);
            return [];
        }
    },

    /**
     * Reverse geocodes coordinates to address and location name (Thailand only)
     */
    async reverse(lat, lng) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&countrycodes=th&zoom=18&addressdetails=1`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'th,en' } });
            if (!res.ok) throw new Error("Reverse geocode failed");
            return await res.json();
        } catch (e) {
            console.warn("Reverse geocode error:", e);
            return null;
        }
    }
};

const RoutingService = {
    // Average human walking speed: 4.2 km/h (~70 m/min, ~14.3 min/km)
    WALK_SPEED_KMH: 4.2,
    // Average city car driving speed with traffic and lights: 26.0 km/h (~433 m/min, ~2.3 min/km)
    CAR_SPEED_KMH: 26.0,

    /**
     * Calculates duration in seconds based on mode and distance
     */
    calculateDuration(distanceMeters, mode = 'car') {
        const speedKmh = mode === 'walk' ? this.WALK_SPEED_KMH : this.CAR_SPEED_KMH;
        return Math.max(60, Math.round((distanceMeters / 1000 / speedKmh) * 3600));
    },

    /**
     * Fetches real road/path route from OSRM API (driving vs walking)
     * Calculates accurate duration from human walking pace (4.2 km/h) vs car traffic pace (26 km/h)
     * Returns: { waypoints: [[lat, lng], ...], distanceMeters, durationSeconds, steps, calories }
     */
    async fetchRoute(startLat, startLng, endLat, endLng, mode = 'car') {
        const isCar = mode === 'car';
        const profile = 'driving'; // OSRM demo server reliably serves road geometry
        try {
            const url = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Routing request failed");
            const data = await res.json();

            if (data && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const rawCoords = route.geometry.coordinates; // [[lng, lat], ...]
                const waypoints = rawCoords.map(coord => [coord[1], coord[0]]);
                const distanceMeters = Math.round(route.distance);

                // Scientifically calculate duration based on travel mode
                const durationSeconds = this.calculateDuration(distanceMeters, mode);
                const steps = isCar ? 0 : Math.round(distanceMeters * 1.35);
                const calories = isCar ? 0 : Math.round(distanceMeters * 0.055);

                return {
                    waypoints,
                    distanceMeters,
                    durationSeconds,
                    steps,
                    calories,
                    isRealRoute: true
                };
            }
        } catch (e) {
            console.warn("OSRM routing failed, falling back to interpolated geometry:", e);
        }

        // Fallback realistic calculation: Walk (4.2 km/h) vs Car (26 km/h)
        const distMeters = Utils.calculateDistance(startLat, startLng, endLat, endLng);
        const durationSeconds = this.calculateDuration(distMeters, mode);
        const steps = isCar ? 0 : Math.round(distMeters * 1.35);
        const calories = isCar ? 0 : Math.round(distMeters * 0.055);

        const mid1 = [
            startLat + (endLat - startLat) * 0.35 + 0.0010,
            startLng + (endLng - startLng) * 0.35 - 0.0006
        ];
        const mid2 = [
            startLat + (endLat - startLat) * 0.65 - 0.0006,
            startLng + (endLng - startLng) * 0.65 + 0.0012
        ];

        return {
            waypoints: [[startLat, startLng], mid1, mid2, [endLat, endLng]],
            distanceMeters: Math.round(distMeters),
            durationSeconds,
            steps,
            calories,
            isRealRoute: false
        };
    }
};

const ImageService = {
    // Curated Landmark Image Catalog for Thailand (Requirement 5)
    landmarkLibrary: [
        {
            keys: ['iconsiam', 'ไอคอนสยาม', 'charoen nakhon', 'เจริญนคร'],
            img: "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['centralworld', 'เซ็นทรัลเวิลด์', 'central world', 'ratchaprasong', 'ราชประสงค์'],
            img: "https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['siam paragon', 'สยามพารากอน', 'siam center', 'siam square', 'สยามสแควร์'],
            img: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['wat arun', 'วัดอรุณ', 'temple of dawn', 'bangkok yai'],
            img: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['wat phra kaew', 'วัดพระแก้ว', 'grand palace', 'พระบรมมหาราชวัง', 'emerald buddha'],
            img: "https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['wat pho', 'วัดโพธิ์', 'reclining buddha', 'ท่าเตียน', 'tha tien'],
            img: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['yaowarat', 'เยาวราช', 'chinatown', 'samphanthawong', 'สัมพันธวงศ์', 'เยาวราช'],
            img: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['chatuchak', 'จตุจักร', 'jj market', 'หมอชิต', 'mo chit'],
            img: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['lumphini', 'lumpini', 'สวนลุม', 'สวนลุมพินี', 'sarasin', 'สารสิน'],
            img: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['benjakitti', 'เบญจกิติ', 'สวนเบญ', 'คลองเตย', 'khlong toei'],
            img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['mahanakhon', 'มหานคร', 'skywalk', 'silom', 'สีลม', 'chong nonsi', 'ช่องนนทรี'],
            img: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['asiatique', 'เอเชียทีค', 'charoen krung', 'เจริญกรุง'],
            img: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['emsphere', 'emquartier', 'emporium', 'เอ็มควอเทียร์', 'เอ็มสเฟียร์', 'phrom phong', 'พร้อมพงษ์'],
            img: "https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['terminal 21', 'เทอร์มินอล 21', 'asok', 'อโศก'],
            img: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['khao san', 'khaosan', 'ข้าวสาร', 'banglamphu', 'บางลำพู'],
            img: "https://images.unsplash.com/photo-1506665531195-3566af2b4dfa?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['thonglor', 'ทองหล่อ', 'ekkamai', 'เอกมัย', 'sukhumvit 55'],
            img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['ari', 'อารีย์', 'phahon yothin', 'พหลโยธิน'],
            img: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['chao phraya', 'เจ้าพระยา', 'ท่าพระจันทร์', 'ท่าช้าง', 'tha chang'],
            img: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['bacc', 'หอศิลป์', 'bangkok art and culture'],
            img: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=800&q=80"
        },
        {
            keys: ['suvarnabhumi', 'สุวรรณภูมิ', 'airport', 'สนามบิน'],
            img: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80"
        }
    ],

    /**
     * Resolves actual location photos in priority order:
     * 1. Curated Thai Landmark Library (exact & regex matching)
     * 2. Wikimedia Commons GeoSearch (by GPS coordinates within 500m)
     * 3. Wikipedia article image (by place name)
     * 4. Google Street View Static (outdoor road level photo)
     * 5. Rich Multi-Category Image Gallery (Unsplash high-res)
     */
    async fetchLocationImage(queryName, category = '', lat = null, lng = null) {
        const cleanName = (queryName || '').split(',')[0].trim();
        const searchTarget = `${cleanName} ${category}`.toLowerCase();

        // ── Strategy 1: Curated Thailand Landmark Library ─────────────────────
        if (cleanName && cleanName !== 'Pinned Spot' && cleanName !== 'Custom Spot') {
            for (const lm of this.landmarkLibrary) {
                if (lm.keys.some(k => searchTarget.includes(k))) {
                    return lm.img;
                }
            }
        }

        // ── Strategy 2: Wikimedia Commons GeoSearch by coordinates ──────────────
        if (lat !== null && lng !== null) {
            try {
                const geoUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=600&gslimit=5&gsprop=dimensions|name&gsnamespace=6&format=json&origin=*`;
                const geoRes = await fetch(geoUrl);
                const geoData = await geoRes.json();

                if (geoData && geoData.query && geoData.query.geosearch && geoData.query.geosearch.length > 0) {
                    const nearbyImages = geoData.query.geosearch.filter(img => {
                        const t = (img.title || '').toLowerCase();
                        return !t.includes('map') && !t.includes('flag') && !t.includes('logo') &&
                               !t.includes('coat') && !t.includes('diagram') && !t.includes('plan') &&
                               !t.includes('.svg') && !t.includes('icon');
                    });

                    if (nearbyImages.length > 0) {
                        const fileTitle = encodeURIComponent(nearbyImages[0].title.replace('File:', ''));
                        const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${fileTitle}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;
                        const infoRes = await fetch(infoUrl);
                        const infoData = await infoRes.json();

                        if (infoData && infoData.query && infoData.query.pages) {
                            const pages = Object.values(infoData.query.pages);
                            if (pages[0] && pages[0].imageinfo && pages[0].imageinfo[0]) {
                                const thumbUrl = pages[0].imageinfo[0].thumburl || pages[0].imageinfo[0].url;
                                if (thumbUrl) return thumbUrl;
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Wikimedia GeoSearch error:', e);
            }
        }

        // ── Strategy 3: Wikipedia article image by place name ───────────────────
        if (cleanName && cleanName !== 'Pinned Spot' && cleanName !== 'Custom Spot') {
            try {
                const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanName + ' Thailand')}&gsrlimit=3&prop=pageimages&pithumbsize=800&format=json&origin=*`;
                const res = await fetch(wikiUrl);
                const data = await res.json();

                if (data && data.query && data.query.pages) {
                    const pages = Object.values(data.query.pages).filter(p => p.thumbnail && p.thumbnail.source);
                    if (pages.length > 0) {
                        return pages[0].thumbnail.source;
                    }
                }
            } catch (e) {
                console.warn('Wikipedia image lookup error:', e);
            }
        }

        // ── Strategy 4: Google Street View Static (outdoor road level photo) ────
        if (lat !== null && lng !== null) {
            return `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${lat},${lng}&fov=85&pitch=0&source=outdoor`;
        }

        return this.getFallbackImage(category, cleanName);
    },

    /**
     * Expanded category gallery with authentic curated imagery (Requirement 5)
     */
    getFallbackImage(category = '', name = '') {
        const lower = (category + ' ' + name).toLowerCase();

        // 1. Cafes & Coffee Shops
        if (lower.includes('cafe') || lower.includes('coffee') || lower.includes('bakery') || lower.includes('คาเฟ่') || lower.includes('กาแฟ')) {
            const cafeImgs = [
                "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=800&q=80"
            ];
            return cafeImgs[Math.floor(Math.random() * cafeImgs.length)];
        }

        // 2. Restaurants, Dining & Street Food
        if (lower.includes('food') || lower.includes('restaurant') || lower.includes('dining') || lower.includes('noodle') || lower.includes('อาหาร') || lower.includes('กิน')) {
            const foodImgs = [
                "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80"
            ];
            return foodImgs[Math.floor(Math.random() * foodImgs.length)];
        }

        // 3. Shopping Malls & Markets
        if (lower.includes('shop') || lower.includes('mall') || lower.includes('store') || lower.includes('market') || lower.includes('ห้าง') || lower.includes('ตลาด')) {
            const shopImgs = [
                "https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80"
            ];
            return shopImgs[Math.floor(Math.random() * shopImgs.length)];
        }

        // 4. Temples, Shrines & Cultural Sites
        if (lower.includes('temple') || lower.includes('wat') || lower.includes('shrine') || lower.includes('วัด') || lower.includes('ศาล')) {
            const templeImgs = [
                "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=800&q=80"
            ];
            return templeImgs[Math.floor(Math.random() * templeImgs.length)];
        }

        // 5. Parks, Lakes & Nature
        if (lower.includes('park') || lower.includes('garden') || lower.includes('nature') || lower.includes('lake') || lower.includes('สวน')) {
            const parkImgs = [
                "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80"
            ];
            return parkImgs[Math.floor(Math.random() * parkImgs.length)];
        }

        // 6. Hotels & Resorts
        if (lower.includes('hotel') || lower.includes('resort') || lower.includes('inn') || lower.includes('โรงแรม')) {
            const hotelImgs = [
                "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
            ];
            return hotelImgs[Math.floor(Math.random() * hotelImgs.length)];
        }

        // 7. Transit, BTS & MRT Stations
        if (lower.includes('station') || lower.includes('bts') || lower.includes('mrt') || lower.includes('train') || lower.includes('สถานี')) {
            return "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80";
        }

        // 8. Hospitals & Medical
        if (lower.includes('hospital') || lower.includes('clinic') || lower.includes('medical') || lower.includes('โรงพยาบาล')) {
            return "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=800&q=80";
        }

        // 9. Bars, Rooftops & Nightlife
        if (lower.includes('bar') || lower.includes('pub') || lower.includes('rooftop') || lower.includes('nightlife') || lower.includes('เบียร์')) {
            return "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80";
        }

        // Default Authentic Bangkok Urban Vibe
        return "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=800&q=80";
    }
};


const VoiceService = {
    _voicesCache: null,
    _audioEl: null,   // reusable <audio> for Google TTS fallback

    /**
     * Returns available voices. Waits for voiceschanged if empty (Chrome async loading).
     */
    _getVoices() {
        return new Promise(resolve => {
            if (this._voicesCache && this._voicesCache.length > 0) {
                return resolve(this._voicesCache);
            }
            const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
            if (voices && voices.length > 0) {
                this._voicesCache = voices;
                return resolve(voices);
            }
            if (!window.speechSynthesis) return resolve([]);
            const handler = () => {
                window.speechSynthesis.removeEventListener('voiceschanged', handler);
                const v = window.speechSynthesis.getVoices() || [];
                this._voicesCache = v;
                resolve(v);
            };
            window.speechSynthesis.addEventListener('voiceschanged', handler);
            setTimeout(() => {
                window.speechSynthesis.removeEventListener('voiceschanged', handler);
                resolve(window.speechSynthesis.getVoices() || []);
            }, 2000);
        });
    },

    /**
     * Check if a native Thai voice is installed on this system.
     */
    async _hasThaiVoice() {
        const voices = await this._getVoices();
        return voices.some(v => v.lang.toLowerCase().startsWith('th'));
    },

    /**
     * Speak via Google Translate TTS — works for Thai on any browser/OS.
     * Uses unofficial gTTS endpoint; chunked to ≤200 chars per request.
     */
    _speakGoogleTTS(text, lang = 'th') {
        const tl = lang === 'th' ? 'th' : 'en';
        // Chunk text to avoid URL length limits
        const chunks = [];
        const words = text.split(' ');
        let current = '';
        for (const w of words) {
            if ((current + ' ' + w).length > 190) {
                if (current) chunks.push(current.trim());
                current = w;
            } else {
                current = current ? current + ' ' + w : w;
            }
        }
        if (current) chunks.push(current.trim());

        let chunkIndex = 0;
        const playNext = () => {
            if (chunkIndex >= chunks.length) return;
            const chunk = chunks[chunkIndex++];
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${tl}&client=tw-ob`;
            if (!this._audioEl) {
                this._audioEl = new Audio();
                this._audioEl.crossOrigin = 'anonymous';
            }
            this._audioEl.src = url;
            this._audioEl.onended = playNext;
            this._audioEl.onerror = () => console.warn('Google TTS chunk failed');
            this._audioEl.play().catch(e => console.warn('Google TTS play error:', e));
        };
        playNext();
    },

    /**
     * Main speak method — tries Web Speech API (with Thai voice check),
     * falls back to Google Translate TTS if no Thai voice found locally.
     */
    async speak(text, lang = 'th') {
        if (!text) return;

        // --- Tier 1: Web Speech API (only if Thai voice actually exists) ---
        if ('speechSynthesis' in window) {
            const voices = await this._getVoices();
            const langCode = lang === 'th' ? 'th-TH' : 'en-US';
            const targetLang = lang === 'th' ? 'th' : 'en';
            const matched = voices.find(v => v.lang.toLowerCase() === langCode.toLowerCase())
                         || voices.find(v => v.lang.toLowerCase().startsWith(targetLang));

            // Only use Web Speech if we found a matching voice
            if (matched || lang !== 'th') {
                try {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = langCode;
                    utterance.rate = 0.95;
                    utterance.pitch = 1.0;
                    utterance.volume = 1.0;
                    if (matched) utterance.voice = matched;
                    setTimeout(() => {
                        try { window.speechSynthesis.speak(utterance); } catch(e) {}
                    }, 100);
                    return;
                } catch(e) {
                    console.warn('Web Speech failed, falling back to Google TTS:', e);
                }
            }
        }

        // --- Tier 2: Google Translate TTS (always works for Thai) ---
        try {
            this._speakGoogleTTS(text, lang);
        } catch(e) {
            console.warn('Google TTS failed:', e);
        }
    },

    notifyNavStart(placeName, mode = 'car', lang = 'th') {
        const modeText = mode === 'walk'
            ? (lang === 'th' ? 'เดิน' : 'walking')
            : (lang === 'th' ? 'ขับรถ' : 'driving');
        const text = lang === 'th'
            ? `เริ่มนำทางไปยัง ${placeName} ด้วยการ${modeText}`
            : `Starting ${modeText} navigation to ${placeName}.`;
        this.speak(text, lang);
    },

    notifyArriving(placeName, lang = 'th') {
        const text = lang === 'th'
            ? `ใกล้ถึงจุดหมาย ${placeName} แล้ว`
            : `Arriving soon at ${placeName}.`;
        this.speak(text, lang);
    },

    notifyArrived(placeName, lang = 'th') {
        const text = lang === 'th'
            ? `คุณถึงจุดหมาย ${placeName} เรียบร้อยแล้ว`
            : `You have arrived at ${placeName}.`;
        this.speak(text, lang);
    },

    notifyProximity(placeName, lang = 'th') {
        const text = lang === 'th'
            ? `คุณอยู่ใกล้ ${placeName} ในระยะแจ้งเตือนแล้ว`
            : `You are near ${placeName}.`;
        this.speak(text, lang);
    }
};
