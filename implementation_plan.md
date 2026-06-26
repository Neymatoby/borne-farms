# Borne Farms — Major Enhancement Plan

This plan covers 8 key feature areas. Changes are scoped to the frontend (`dashboard.html`, CSS, JS files) with minimal backend additions, maximizing value within token budget.

---

## User Review Required

> [!IMPORTANT]
> **Dashboard Card Reordering**: We'll implement drag-and-drop using the native HTML5 Drag & Drop API (no library needed). Cards will save their order to `localStorage` so your custom layout persists across sessions.

> [!IMPORTANT]
> **Report Generation**: The auto-report at 7 PM will run client-side using `setInterval` timer checks. Reports will be generated as downloadable HTML/PDF documents. Since there's no persistent server scheduling, **the dashboard tab must be open** for the 7 PM auto-report to trigger. A manual "Generate Report Now" button will also be added.

> [!WARNING]
> **Weather Map Integration**: When you click a calendar date with rainfall/thunderstorm, we'll overlay animated weather effects on the Leaflet map (rain particles, storm clouds, darkened atmosphere). This is visual simulation — not live API weather data.

---

## Open Questions

> [!IMPORTANT]
> **Currency**: Financial data currently uses ₦ (Naira). Should reports and cost analysis continue using Naira?

> [!NOTE]
> **Breed Expansion**: Current breeds include 8 (White Fulani, Red Bororo, Sokoto Gudali, Holstein, Angus, Brahman, Hereford, Limousin). The meat vs dairy classification and feed-to-adult data will be built around these. Do you want additional breeds added?

---

## Proposed Changes

### 1. UAV & CCTV Video — Normal Frame Rate Playback

**Problem**: The `requestAnimationFrame` loop in `app.js` runs AI detection on every frame, creating backpressure that slows video playback.

**Solution**: Decouple video playback from AI detection processing.

#### [MODIFY] [app.js](file:///C:/Users/Ney/Desktop/borne-farms/js/app.js)
- Set `video.playbackRate = 1.0` explicitly on both UAV and CCTV video elements
- Throttle AI detection to run every **500ms** instead of every frame (2 detections/second is plenty for cow counting)
- Use a separate `setInterval` for detection calls instead of coupling to `requestAnimationFrame`
- Keep `requestAnimationFrame` for canvas overlay rendering only (bounding boxes update smoothly)
- Add a frame skip counter so the canvas overlay redraws at 30fps but detection API calls happen at 2fps
- Result: Videos play at full native frame rate; detection runs independently in background

---

### 2. Drag-and-Drop Dashboard Card Reordering

#### [MODIFY] [dashboard.js](file:///C:/Users/Ney/Desktop/borne-farms/js/dashboard.js)
- Add `draggable="true"` to all dashboard cards
- Implement `dragstart`, `dragover`, `dragenter`, `dragleave`, `drop` event handlers
- Save card order to `localStorage` key `"borne-dashboard-order"`
- On `initDashboard()`, restore saved order before rendering
- Add a "Reset Layout" button to restore default order
- Add visual feedback: dragged card gets opacity reduction, drop target gets a glowing border

#### [MODIFY] [index.css](file:///C:/Users/Ney/Desktop/borne-farms/index.css)
- Add `.card-dragging` styles (opacity: 0.5, scale: 0.95, rotate: 2deg)
- Add `.card-drag-over` styles (glowing border, slight scale up)
- Add `.drag-placeholder` styles (dashed border ghost element)
- Add cursor: grab / grabbing styles on card headers

---

### 3. Automatic Daily Report Generation (7 PM)

#### [NEW] [report.js](file:///C:/Users/Ney/Desktop/borne-farms/js/report.js)
- `initReportScheduler()`: Sets up a `setInterval` (checks every 60 seconds) to trigger report at 19:00
- `generateDailyReport()`: Collects data from all modules:
  - **Total Cows Counted**: From `appState.cowCount` (UAV + CCTV totals)
  - **Total Feed Consumed**: From `FEED_DATA` current month
  - **Total Cost**: From `FINANCIAL_DATA` current period expenses
  - **Cow Movement Trail**: Summary of `MOVEMENT_DATA.trails` (distance, active cows, zones visited)
  - **Weather Summary**: Current conditions and alerts
  - **Health Summary**: Healthy vs under-treatment counts
  - **Breed Analytics**: Meat vs dairy breakdown
- `renderReport(data)`: Creates a styled HTML report document
- `downloadReport(html)`: Converts to downloadable PDF using browser print-to-PDF, or generates a downloadable HTML file
- `showReportNotification()`: Toast notification when report is auto-generated
- Add "Generate Report Now" button in dashboard header
- Store last report timestamp in `localStorage` to prevent duplicates

#### [MODIFY] [dashboard.html](file:///C:/Users/Ney/Desktop/borne-farms/dashboard.html)
- Add report generation button in top bar
- Add report preview modal
- Add `<script src="js/report.js">` tag

---

### 4. Weather Data Reflection on Map

#### [MODIFY] [weather.js](file:///C:/Users/Ney/Desktop/borne-farms/js/weather.js)
- Emit a custom event `weather-day-selected` when a calendar day is clicked, passing weather data (condition, rainChance, temperature, wind)
- Add visual indicator showing which day is currently reflected on map

#### [MODIFY] [geospatial.js](file:///C:/Users/Ney/Desktop/borne-farms/js/geospatial.js)
- Listen for `weather-day-selected` custom event
- **Weather overlay system**:
  - **Rain**: Add animated CSS rain overlay on the map container using pseudo-elements and keyframe animations
  - **Thunderstorm**: Add lightning flash effect + darker map tiles (using Leaflet's `L.tileLayer` with a dark filter overlay)
  - **Cloudy**: Add semi-transparent cloud SVG overlay
  - **Clear/Sunny**: Warm golden tint overlay
- Add a weather info badge on the map showing the selected date's weather data
- Add "Clear Weather Overlay" button
- Auto-switch to geospatial section when weather day is clicked (or show notification to navigate)

#### [MODIFY] [index.css](file:///C:/Users/Ney/Desktop/borne-farms/index.css)
- Add `@keyframes rain-animation` (falling droplets)
- Add `@keyframes lightning-flash` (white flash pulse)
- Add `.map-weather-overlay` styles for each condition type
- Add `.weather-badge` floating badge on map

---

### 5. Meat vs Dairy Cattle Classification & Analytics

#### [MODIFY] [data.js](file:///C:/Users/Ney/Desktop/borne-farms/js/data.js)
- Enhance `BREEDS_DATA` with detailed purpose-specific data:
  ```
  For each breed, add:
  - purpose: "Meat" | "Dairy" | "Dual-Purpose"
  - matureWeight: { male: kg, female: kg }
  - maturityAge: months
  - feedToAdult: { dailyFeedKg, totalFeedKg, totalCostNaira }
  - meatYield: { dressPercentage, avgCarcassKg, pricePerKg, totalRevenue } (for meat breeds)
  - milkYield: { dailyLiters, lactationDays, annualLiters, pricePerLiter, annualRevenue } (for dairy breeds)
  - growthRate: { birthWeightKg, weaningWeightKg, monthlyGainKg }
  - healthCare: { annualVetCost, vaccinations, commonDiseases }
  ```

- Add new data structure `CATTLE_ECONOMICS`:
  ```
  Per breed:
  - costToRaise: (feed + vet + labor from calf to adult)
  - expectedRevenue: (meat sale or annual milk revenue)
  - breakEvenMonths: when revenue exceeds cost
  - roi: percentage return
  - forecastData: 12-month projection of costs vs revenue
  ```

---

### 6. Livestock Section — Meat vs Dairy Analytics Dashboard

#### [MODIFY] [livestock.js](file:///C:/Users/Ney/Desktop/borne-farms/js/livestock.js)
- Add **filter tabs**: "All Breeds" | "Meat/Beef" | "Dairy" | "Dual-Purpose"
- Redesign breed cards to show:
  - Purpose badge (color-coded: red=meat, blue=dairy, purple=dual)
  - Feed-to-adult summary (total kg, total cost)
  - Expected revenue
  - Time to maturity
  - ROI indicator
- Add **Breed Comparison Table**: Side-by-side comparison of selected breeds
- Add **Economics Chart**: Chart.js grouped bar chart showing cost-to-raise vs revenue for each breed
- Add **Growth Timeline**: Visual timeline showing growth stages (calf → weaner → yearling → adult) with feed requirements at each stage

#### [MODIFY] [dashboard.html](file:///C:/Users/Ney/Desktop/borne-farms/dashboard.html)
- Update livestock section HTML to include filter tabs, comparison table container, economics chart canvas, growth timeline container

---

### 7. Feed Management Enhancement

#### [MODIFY] [feed.js](file:///C:/Users/Ney/Desktop/borne-farms/js/feed.js)
- Add **per-breed feed calculator**: Select breed → shows daily feed, cost per day, total to maturity
- Add **feed forecast chart**: Projects feed needs for next 6 months based on herd composition
- Add **meat vs dairy feed comparison**: Side-by-side showing feed efficiency for meat vs dairy breeds
- Add feed cost optimization suggestions

#### [MODIFY] [dashboard.html](file:///C:/Users/Ney/Desktop/borne-farms/dashboard.html)
- Expand feed section with breed selector, forecast chart canvas, comparison containers

---

### 8. Dashboard — Forecast & Cost Analytics Cards

#### [MODIFY] [dashboard.js](file:///C:/Users/Ney/Desktop/borne-farms/js/dashboard.js)
- Add new dashboard cards:
  - **Meat vs Dairy Overview**: Quick stats (count by purpose, avg ROI by type)
  - **Feed Forecast**: Mini chart showing 3-month feed projection
  - **Cost-to-Maturity Snapshot**: Cheapest vs most expensive breed to raise
- Ensure "Feed Tier vs Growth & Milk Production" card respects drag-and-drop ordering

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| [app.js](file:///C:/Users/Ney/Desktop/borne-farms/js/app.js) | MODIFY | Decouple video playback from detection, fix frame rate |
| [dashboard.js](file:///C:/Users/Ney/Desktop/borne-farms/js/dashboard.js) | MODIFY | Drag-and-drop cards, new analytics cards |
| [report.js](file:///C:/Users/Ney/Desktop/borne-farms/js/report.js) | NEW | Auto-report generation at 7 PM + manual trigger |
| [weather.js](file:///C:/Users/Ney/Desktop/borne-farms/js/weather.js) | MODIFY | Emit weather events for map integration |
| [geospatial.js](file:///C:/Users/Ney/Desktop/borne-farms/js/geospatial.js) | MODIFY | Weather overlay on map |
| [data.js](file:///C:/Users/Ney/Desktop/borne-farms/js/data.js) | MODIFY | Comprehensive breed economics data |
| [livestock.js](file:///C:/Users/Ney/Desktop/borne-farms/js/livestock.js) | MODIFY | Meat/dairy filters, economics, growth timeline |
| [feed.js](file:///C:/Users/Ney/Desktop/borne-farms/js/feed.js) | MODIFY | Per-breed calculator, feed forecast |
| [dashboard.html](file:///C:/Users/Ney/Desktop/borne-farms/dashboard.html) | MODIFY | New sections, report UI, updated containers |
| [index.css](file:///C:/Users/Ney/Desktop/borne-farms/index.css) | MODIFY | Drag-drop, weather overlays, new card styles |

---

## Verification Plan

### Manual Verification
1. **Video Playback**: Upload a video to UAV/CCTV → verify it plays at normal speed while detection overlays still appear
2. **Drag-and-Drop**: Drag dashboard cards → verify reorder persists after page refresh
3. **Report**: Wait for 7 PM or click "Generate Report" → verify report contains all required data
4. **Weather on Map**: Click a thunderstorm day on calendar → verify rain/lightning animation appears on map
5. **Breed Analytics**: Navigate to Livestock → verify meat/dairy filters work, economics data displays correctly
6. **Feed Calculator**: Select a breed in Feed section → verify feed-to-adult calculations display
7. **Cost Analysis**: Verify ROI and break-even data appears for each breed

### Automated Tests
- Browser console: No JavaScript errors across all sections
- `localStorage` persistence: Verify dashboard order saves/loads correctly
