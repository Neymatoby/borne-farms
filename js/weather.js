// ========================================
// BORNE FARMS — Weather Module
// ========================================

const WeatherModule = {
    // Abuja Farm Coordinates (FCT Abuja)
    lat: 8.79470,
    lon: 7.65492,
    data: null, // Stores raw API payload

    // Weather Code Mapping from origintech-forecast
    WC: {
        0: { d: "Clear Sky", i: "☀️", n: "🌙" },
        1: { d: "Mainly Clear", i: "🌤️", n: "🌙" },
        2: { d: "Partly Cloudy", i: "⛅", n: "☁️" },
        3: { d: "Overcast", i: "☁️", n: "☁️" },
        45: { d: "Foggy", i: "🌫️", n: "🌫️" },
        48: { d: "Rime Fog", i: "🌫️", n: "🌫️" },
        51: { d: "Light Drizzle", i: "🌦️", n: "🌧️" },
        53: { d: "Moderate Drizzle", i: "🌦️", n: "🌧️" },
        55: { d: "Dense Drizzle", i: "🌧️", n: "🌧️" },
        56: { d: "Freezing Drizzle", i: "🌧️", n: "🌧️" },
        57: { d: "Heavy Freezing Drizzle", i: "🌧️", n: "🌧️" },
        61: { d: "Slight Rain", i: "🌦️", n: "🌧️" },
        63: { d: "Moderate Rain", i: "🌧️", n: "🌧️" },
        65: { d: "Heavy Rain", i: "🌧️", n: "🌧️" },
        66: { d: "Freezing Rain", i: "🌧️", n: "🌧️" },
        67: { d: "Heavy Freezing Rain", i: "🌧️", n: "🌧️" },
        71: { d: "Slight Snow", i: "🌨️", n: "🌨️" },
        73: { d: "Moderate Snow", i: "🌨️", n: "🌨️" },
        75: { d: "Heavy Snow", i: "❄️", n: "❄️" },
        77: { d: "Snow Grains", i: "🌨️", n: "🌨️" },
        80: { d: "Light Showers", i: "🌦️", n: "🌧️" },
        81: { d: "Moderate Showers", i: "🌧️", n: "🌧️" },
        82: { d: "Violent Showers", i: "⛈️", n: "⛈️" },
        85: { d: "Light Snow Showers", i: "🌨️", n: "🌨️" },
        86: { d: "Heavy Snow Showers", i: "❄️", n: "❄️" },
        95: { d: "Thunderstorm", i: "⛈️", n: "⛈️" },
        96: { d: "Thunderstorm + Hail", i: "⛈️", n: "⛈️" },
        99: { d: "Severe Thunderstorm", i: "⛈️", n: "⛈️" }
    },

    // Month offset for calendar view
    monthOffset: 0,
    selectedHourIdx: null,

    async init() {
        console.log("WeatherModule: initializing for Abuja Farm...");
        try {
            await this.fetchWeather();
            this.bindEvents();
        } catch (e) {
            console.error('Weather fetch failed, using simulated data. Error:', e);
            this.setSimulatedWeather();
        }
    },

    wInfo(code, night = false) {
        const weather = this.WC[code] || { d: "Unknown", i: "❓", n: "❓" };
        return { desc: weather.d, icon: night ? weather.n : weather.i };
    },

    async fetchWeather() {
        const params = new URLSearchParams({
            latitude: this.lat,
            longitude: this.lon,
            current: [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation",
                "rain",
                "weather_code",
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m"
            ].join(","),
            hourly: [
                "temperature_2m",
                "precipitation_probability",
                "precipitation",
                "weather_code",
                "wind_speed_10m",
                "wind_gusts_10m",
                "visibility"
            ].join(","),
            daily: [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "rain_sum",
                "wind_speed_10m_max",
                "wind_gusts_10m_max",
                "precipitation_probability_max"
            ].join(","),
            timezone: "Africa/Lagos",
            forecast_days: 16,
            past_days: 31
        });

        const url = `https://api.open-meteo.com/v1/forecast?${params}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Open-Meteo API returned status ${response.status}`);
        }
        this.data = await response.json();
        
        // Update entire Dashboard Weather panels
        this.updateUI();
    },

    setSimulatedWeather() {
        // Fallback simulated data if offline
        const mockTime = [];
        const mockTemp = [];
        const mockPrecipProb = [];
        const mockPrecip = [];
        const mockCodes = [];
        const mockWind = [];
        
        const now = new Date();
        for (let i = -744; i < 384; i++) { // Past 31 days to 16 days forward
            const date = new Date(now.getTime() + i * 3600000);
            mockTime.push(date.toISOString());
            mockTemp.push(Math.round(26 + Math.sin(i/6) * 5));
            mockPrecipProb.push(Math.max(0, Math.round(Math.sin(i/24) * 80)));
            mockPrecip.push(Math.random() > 0.85 ? Math.random() * 8 : 0);
            mockCodes.push(Math.random() > 0.8 ? 61 : 3);
            mockWind.push(Math.round(10 + Math.random() * 15));
        }

        const mockDailyTime = [];
        const mockDailyMax = [];
        const mockDailyMin = [];
        const mockDailyCode = [];
        const mockDailyPrecip = [];
        const mockDailyWind = [];

        for (let i = -31; i < 16; i++) {
            const date = new Date(now.getTime() + i * 86400000);
            mockDailyTime.push(date.toISOString().split('T')[0]);
            mockDailyMax.push(Math.round(30 + Math.random() * 5));
            mockDailyMin.push(Math.round(22 + Math.random() * 3));
            mockDailyCode.push(Math.random() > 0.7 ? 63 : 2);
            mockDailyPrecip.push(Math.random() > 0.6 ? Math.random() * 15 : 0);
            mockDailyWind.push(Math.round(15 + Math.random() * 20));
        }

        this.data = {
            current: {
                temperature_2m: 31,
                relative_humidity_2m: 68,
                apparent_temperature: 34,
                precipitation: 0,
                weather_code: 2,
                wind_speed_10m: 12,
                wind_gusts_10m: 18
            },
            hourly: {
                time: mockTime,
                temperature_2m: mockTemp,
                precipitation_probability: mockPrecipProb,
                precipitation: mockPrecip,
                weather_code: mockCodes,
                wind_speed_10m: mockWind
            },
            daily: {
                time: mockDailyTime,
                weather_code: mockDailyCode,
                temperature_2m_max: mockDailyMax,
                temperature_2m_min: mockDailyMin,
                precipitation_sum: mockDailyPrecip,
                wind_speed_10m_max: mockDailyWind
            }
        };
        this.updateUI();
    },

    updateUI() {
        if (!this.data) return;

        const current = this.data.current;
        const weatherInfo = this.wInfo(current.weather_code);
        const temp = Math.round(current.temperature_2m);
        const feelsLike = Math.round(current.apparent_temperature);
        const humidity = current.relative_humidity_2m;
        const windSpeed = Math.round(current.wind_speed_10m);

        // Weather Theme setting on body
        const condition = temp > 34 ? 'hot' : humidity > 75 ? 'rainy' : temp < 20 ? 'cool' : 'fair';
        document.body.dataset.weatherTheme = condition;

        // Header widget
        const widgetTemp = document.querySelector('.weather-temp');
        if (widgetTemp) widgetTemp.textContent = `${temp}°C`;

        // Weather panel (Current conditions)
        const tempLarge = document.querySelector('.weather-temp-large');
        if (tempLarge) tempLarge.textContent = `${temp}°C`;

        const desc = document.querySelector('.weather-desc');
        if (desc) desc.textContent = `${weatherInfo.icon} ${weatherInfo.desc}`;

        const humEl = document.getElementById('humidity');
        if (humEl) humEl.textContent = `${humidity}%`;

        const windEl = document.getElementById('windSpeed');
        if (windEl) windEl.textContent = `${windSpeed} km/h`;

        const feelsEl = document.getElementById('feelsLike');
        if (feelsEl) feelsEl.textContent = `${feelsLike}°C`;

        const locEl = document.querySelector('.weather-location-large');
        if (locEl) locEl.innerHTML = `<i data-lucide="map-pin"></i> Abuja Farm`;

        const financeChip = document.getElementById('financeWeatherChip');
        if (financeChip) {
            const labelMap = {
                hot: 'Hot weather theme',
                rainy: 'Rain-ready theme',
                cool: 'Cool weather theme',
                fair: 'Fair weather theme'
            };
            const chipText = financeChip.querySelector('span');
            if (chipText) chipText.textContent = labelMap[condition];
        }

        // Build additional sub-sections
        this.buildHourlyStrip();
        this.buildHistoryTable();
        this.buildCalendarGrid();

        // Reflect the current live weather on the farm map
        if (typeof GeospatialModule !== 'undefined') {
            GeospatialModule.setWeatherFX(current.weather_code, 'Now');
        }

        // Run AI Crop advisor calculations and update UI
        if (typeof CropAdvisorModule !== 'undefined') {
            const analysis = CropAdvisorModule.analyze(this.data);
            CropAdvisorModule.updateUI(analysis);
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    buildHourlyStrip() {
        const hourly = this.data.hourly;
        const track = document.getElementById("hourlyForecastTrack");
        if (!track || !hourly) return;

        const now = new Date();
        const currentIndex = hourly.time.findIndex((time) => new Date(time) >= now);
        if (currentIndex < 0) return;

        let html = "";
        const limit = Math.min(currentIndex + 48, hourly.time.length);
        for (let index = currentIndex; index < limit; index++) {
            const hourTime = new Date(hourly.time[index]);
            const isNow = index === currentIndex;
            const label = isNow ? "Now" : hourTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            const dayLabel = hourTime.getHours() === 0
                ? `<span style="font-size:0.6rem;color:var(--accent-blue);display:block;">${hourTime.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>`
                : "";
            
            const wInfo = this.wInfo(hourly.weather_code[index], hourTime.getHours() >= 18 || hourTime.getHours() < 6);
            const temp = Math.round(hourly.temperature_2m[index]);
            const wind = Math.round(hourly.wind_speed_10m[index]);
            const rain = hourly.precipitation_probability[index] || 0;

            html += `
                <div class="hour-cell ${isNow ? 'now' : ''}" title="${wInfo.desc}">
                    ${dayLabel}
                    <span class="hc-time">${label}</span>
                    <span class="hc-icon">${wInfo.icon}</span>
                    <span class="hc-temp">${temp}°</span>
                    <span class="hc-wind">💨 ${wind} km/h</span>
                    ${rain > 0 ? `<span class="hc-rain">💧${rain}%</span>` : ''}
                </div>
            `;
        }

        track.innerHTML = html;
    },

    buildHistoryTable() {
        const daily = this.data.daily;
        const body = document.getElementById("weatherHistoryBody");
        if (!body || !daily) return;

        const today = new Date().toISOString().split("T")[0];
        const todayIndex = daily.time.indexOf(today);
        if (todayIndex < 0) return;

        // Show past 30 days trend
        const startIndex = Math.max(0, todayIndex - 30);
        let html = "";

        for (let index = startIndex; index < todayIndex; index++) {
            const date = new Date(daily.time[index]);
            const dayLabel = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
            const weather = this.wInfo(daily.weather_code[index]);
            const high = Math.round(daily.temperature_2m_max[index]);
            const low = Math.round(daily.temperature_2m_min[index]);
            const rain = (daily.precipitation_sum[index] || 0).toFixed(1);
            const wind = Math.round(daily.wind_speed_10m_max[index]);

            let level = 'safe';
            if (daily.weather_code[index] >= 95 || rain > 10) level = 'danger';
            else if (daily.weather_code[index] >= 61 || rain > 2 || wind > 30) level = 'caution';

            html += `
                <tr>
                    <td>${dayLabel}</td>
                    <td style="font-size:1.2rem; text-align:center;">${weather.icon}</td>
                    <td>${weather.desc}</td>
                    <td><strong>${high}°C</strong></td>
                    <td style="color:var(--text-secondary);">${low}°C</td>
                    <td style="color:var(--accent-blue);">${rain} mm</td>
                    <td>${wind} km/h</td>
                    <td><span class="status-pill status-${level}" style="font-size:0.65rem; padding: 2px 6px; border-radius:10px; font-weight:600; text-transform:uppercase;">${level}</span></td>
                </tr>
            `;
        }

        body.innerHTML = html;
    },

    buildCalendarGrid() {
        const daily = this.data.daily;
        const grid = document.getElementById("weatherCalendarGrid");
        if (!grid || !daily) return;

        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth() + this.monthOffset, 1);
        const year = target.getFullYear();
        const month = target.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        const labelEl = document.getElementById("calendarMonthLabel");
        if (labelEl) labelEl.textContent = `${monthNames[month]} ${year}`;

        // Reset grid structure but keep headers
        const headers = [...grid.querySelectorAll(".cal-hdr")];
        grid.innerHTML = "";
        headers.forEach((header) => grid.appendChild(header));

        const firstDay = new Date(year, month, 1).getDay();
        const offset = firstDay === 0 ? 6 : firstDay - 1; // Align to Mon
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = now.toISOString().split("T")[0];

        // Empty spacer cells
        for (let index = 0; index < offset; index++) {
            const blank = document.createElement("div");
            blank.className = "cal-day empty";
            grid.appendChild(blank);
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = dateString === todayStr;
            const dailyIndex = daily.time.indexOf(dateString);
            const cell = document.createElement("div");
            cell.className = `cal-day ${isToday ? "today" : ""}`;

            if (dailyIndex >= 0) {
                const weather = this.wInfo(daily.weather_code[dailyIndex]);
                const high = Math.round(daily.temperature_2m_max[dailyIndex]);
                const low = Math.round(daily.temperature_2m_min[dailyIndex]);
                const rain = daily.precipitation_sum[dailyIndex] || 0;
                
                cell.innerHTML = `
                    <span class="cd-num">${day}</span>
                    <span class="cd-icon">${weather.icon}</span>
                    <span class="cd-temp">${high}° / ${low}°</span>
                    ${rain > 0 ? `<span class="cd-rain">💧${rain.toFixed(1)}mm</span>` : ""}
                `;
                cell.classList.add("has-weather");
                cell.title = `${weather.desc} — tap to view on the farm map`;
                cell.dataset.code = daily.weather_code[dailyIndex];
                cell.dataset.date = dateString;
                cell.dataset.desc = weather.desc;
                cell.addEventListener("click", () => this.selectCalendarDay(cell));
            } else {
                cell.innerHTML = `
                    <span class="cd-num">${day}</span>
                    <span class="cd-icon" style="opacity:.3">-</span>
                `;
            }
            grid.appendChild(cell);
        }
    },

    selectCalendarDay(cell) {
        const grid = document.getElementById("weatherCalendarGrid");
        if (grid) grid.querySelectorAll(".cal-day.selected").forEach((c) => c.classList.remove("selected"));
        cell.classList.add("selected");

        const code = parseInt(cell.dataset.code, 10);
        const date = cell.dataset.date;
        const desc = cell.dataset.desc || "";
        const label = new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

        // Visualize the day's weather on the Farm Zone Overview (mini map)
        if (typeof GeospatialModule !== "undefined") {
            GeospatialModule.setWeatherFX(code, label);
        }
        const msg = `Showing ${desc} for ${label} on the farm zone overview`;
        if (typeof showToast === "function") showToast(msg, "info");
        else if (typeof showNotification === "function") showNotification(msg, "info");
    },

    bindEvents() {
        const prevBtn = document.getElementById("calendarPrevMonth");
        const nextBtn = document.getElementById("calendarNextMonth");

        if (prevBtn) {
            prevBtn.addEventListener("click", () => {
                this.monthOffset--;
                this.buildCalendarGrid();
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener("click", () => {
                this.monthOffset++;
                this.buildCalendarGrid();
            });
        }

        // Weather panel tab switching
        const tabBtns = document.querySelectorAll(".weather-tab-btn");
        tabBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const targetTabId = e.currentTarget.dataset.tab;
                
                // Set active tab button
                tabBtns.forEach(b => {
                    b.classList.remove("active");
                    b.style.background = "none";
                    b.style.color = "var(--text-secondary)";
                });
                e.currentTarget.classList.add("active");
                e.currentTarget.style.background = "var(--bg-secondary)";
                e.currentTarget.style.color = "var(--text-primary)";
                
                // Show tab content
                const tabContents = document.querySelectorAll(".weather-tab-content");
                tabContents.forEach(content => {
                    if (content.id === targetTabId) {
                        content.style.display = "block";
                    } else {
                        content.style.display = "none";
                    }
                });
            });
        });

        // Set initial style for active tab button
        const activeTab = document.querySelector(".weather-tab-btn.active");
        if (activeTab) {
            activeTab.style.background = "var(--bg-secondary)";
            activeTab.style.color = "var(--text-primary)";
        }
    }
};
