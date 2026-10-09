// Utility Functions & Helpers
const Utils = {
    /**
     * Calculates distance between two coordinates in meters using the Haversine formula
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    },

    /**
     * Formats meters into human-readable strings (m / km)
     */
    formatDistance(meters) {
        if (meters >= 1000) {
            return (meters / 1000).toFixed(1) + ' km';
        }
        return Math.round(meters) + ' m';
    },

    /**
     * Formats travel duration in minutes into a localized, human-friendly string
     */
    formatDuration(minutes, lang = 'th') {
        const m = Math.max(1, Math.round(minutes));
        if (m < 60) {
            return lang === 'th' ? `${m} นาที` : `${m} min`;
        }
        const hours = Math.floor(m / 60);
        const remMins = m % 60;
        if (remMins === 0) {
            return lang === 'th' ? `${hours} ชม.` : `${hours} hr`;
        }
        return lang === 'th' ? `${hours} ชม. ${remMins} นาที` : `${hours} hr ${remMins} min`;
    },

    /**
     * Returns FontAwesome icon class according to category string
     */
    getCategoryIcon(category) {
        const cat = (category || '').toLowerCase();
        if (cat.includes('shop') || cat.includes('mall')) return 'fa-bag-shopping';
        if (cat.includes('food') || cat.includes('restaurant') || cat.includes('dining')) return 'fa-utensils';
        if (cat.includes('park') || cat.includes('nature')) return 'fa-tree';
        if (cat.includes('hotel')) return 'fa-hotel';
        return 'fa-location-dot';
    },

    /**
     * Converts WMO weather code to icon and description
     */
    parseWeatherCode(code) {
        if (code === 0) return { icon: '☀️', desc: 'Clear Sunny' };
        if (code >= 1 && code <= 3) return { icon: '🌤️', desc: 'Partly Cloudy' };
        if (code >= 51 && code <= 67) return { icon: '🌧️', desc: 'Rain Showers' };
        return { icon: '🌤️', desc: 'Mild Weather' };
    },

    /**
     * Plays luxurious crystal chime sound via Web Audio API
     */
    playGlassChimeSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.6);
        } catch (e) {
            console.warn("Audio chime failed:", e);
        }
    }
};
