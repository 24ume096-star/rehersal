# Smart Green Space: Platform Panel UI/UX Review
**Date**: April 2026 | **Focus**: UX Architecture & Functional Review

This document provides a detailed architectural and functional breakdown of each module within the Smart Green Space platform's frontend ecosystem.

## 🗺️ 1. FloodMonitoringPanel (The Core Digital Twin)
**Purpose:** The central neurological hub of the platform. It houses the interactive 3D Mapbox instance overlaying the Delhi NCR region.

* **UX Dynamics:** Utilizes a full-bleed dark-mode map layout. The 3D buildings layer uses dynamic lighting, providing a "Command Center" aesthetic.
* **Functional Highlights:**
  * **Dynamic Geography:** When rainfall scenarios increase, the `yamuna-river` line width dramatically swells, and the `yamuna-buffer` polygon actively recomputes its GeoJSON points to simulate rising floodwaters.
  * **Interactive KPIs:** 3D extruded zones mapped directly to ML model (`riskScore`) outputs.

## 🎛️ 2. ScenarioControlPanel (The Simulator)
**Purpose:** Empowers urban planners to transition from passive monitoring to active stress-testing.

* **UX Dynamics:** Features high-contrast glassmorphic sliders housed within a stable flex-grid side panel to prevent scrolling conflicts.
* **Functional Highlights:**
  * **Real-time Lerp Animation:** Sliding parameters trigger an 800ms "easeOutCubic" interpolation, allowing the map geometry and models to visibly "grow" or "shrink".
  * **Presets:** Contains quick-load settings (e.g., "Mega-Flood," "Monsoon Baseline") to test specific disaster playbooks instantly.

## 🛰️ 3. SatellitePanel (Earth Observation Hub)
**Purpose:** Translates raw multi-spectral imagery into human-readable insights.

* **UX Dynamics:** A transparent, sleek overlay rendering normalized difference vegetation indexes (NDVI) alongside textual summaries.
* **Functional Highlights:**
  * **AI Insight Generator:** If live AI services are offline, it falls back to a deterministic `generateSatelliteInsight()` logic stream, ensuring users are never left with "Loading..." states.
  * **Thermal & SAR Fallbacks:** Reads from Sentinel-1/2 telemetry pipelines to visualize data even if there is heavy cloud cover.

## 🤖 4. AIHelpDeskPanel (Expert System)
**Purpose:** Acts as a real-time copilot for disaster management teams.

* **UX Dynamics:** A chat-based interface integrating markdown responses smoothly. It maintains the core `shadow-glass` and `backdrop-blur` CSS tokens to appear floating.
* **Functional Highlights:**
  * **OpenRouter Agnostic:** Connects seamlessly to cutting edge language models (Llama, GPT-4o, Claude) via OpenRouter.
  * **Context-Aware Offline Fallback:** If internet or API fails, the platform executes `generateLocalResponse`, reading live risk factors to generate critical SOPs autonomously.

## 🌤️ 5. LiveWeatherPanel & CityRiskBadge
**Purpose:** The global context modules anchoring the interface in present reality.

* **UX Dynamics:** Situated in primary header space, drawing immediate attention.
* **Functional Highlights:**
  * Constantly pulses live 10-minute meteorological polls to sync the platform's baseline data before scenario overrides are applied.
