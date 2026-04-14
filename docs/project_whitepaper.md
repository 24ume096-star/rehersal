# Smart Green Space: Full Project Technical Whitepaper
> **Date**: April 2026

## 1. Project Purpose & Impact
**What is it?**
Smart Green Space is a predictive "Digital Twin" of the Delhi NCR region built to address the increasing volatility of monsoonal flooding and urban climate risks. Rather than looking at static meteorological charts, civic authorities are presented with a real-time, 3D interactive simulation of their city.

**Why is it beneficial for Civic Authorities?**
Currently, municipal disaster response is reactive. By aggregating satellite telemetry, live traffic configurations, and predictive rainfall models, this system pivots civic management from *reactive* damage control to *proactive* risk mitigation. It dynamically isolates vulnerable infrastructure, auto-generating evacuation and Standard Operating Procedures (SOPs) before the river breaches critical thresholds.

**How does this directly benefit Everyday Citizens?**
For the general public, this platform acts as an ultimate early-warning shield. 
1. **Evacuation Safety:** Instead of citizens being trapped in sudden urban flash-flooding, predictive AI dictates safe passage routes *hours* in advance, saving lives.
2. **Infrastructure Protection:** By utilizing the platform to simulate where water collects, urban planners can plant specific high-absorption trees (monitored via the GSHI) in vulnerable neighborhoods, drastically reducing the chances of personal property and vehicles being destroyed during monsoons.
3. **Public Awareness:** Democratizing this data means citizens can check the live "Digital Twin" to see exactly if their specific neighborhood is in a high-risk zone today.

---

## 2. Platform Panels (The UI Landscape)
The frontend acts as a "Command Center Head-Up Display (HUD)" utilizing glassmorphic components seamlessly overlaid across the 3D topology.

1. **The Flood Monitoring Map (Core View):** A high-fidelity Mapbox GL layer mapping the Yamuna river. Utilizing dynamic GeoJSON recreation, the visual width of the river and the reach of the inner floodplains expand geometrically in exact accordance with user-controlled parameters.
2. **Scenario Control Panel:** The simulation sandbox. It allows operators to drag sliders simulating varying thresholds of rainfall (e.g., 200mm) and river discharge levels, visually stress-testing the capital's resilience before disaster strikes.
3. **Live Weather & Risk Header:** Pulses live data, constantly displaying 24h rainfall volumes and regional soil moisture arrays to act as the true "baseline" reality.
4. **Satellite NDVI Panel:** Translates complex satellite vegetation data into human-readable indices like the GSHI (detailed below).
5. **AI Help Desk Copilot:** A direct pipeline to frontier conversational AI. It digests alert outputs and translates them into actionable protocols for field-deployed disaster response teams.

---

## 3. Underlying APIS & Integrations
The platform leverages a highly disconnected matrix of live APIs to fuel its inference models.

* **Mapbox GL API**: Serves the 3D building extrusions, vector tiles, and core digital twin topological rendering.
* **Open-Meteo API**: Polls highly localized historical and current weather patterns, determining true architectural stress levels (soil saturation, wind speed, river volume).
* **OpenRouter AI Hub**: Acts as the LLM (Large Language Model) routing mechanism for the Help Desk.
* **Google Earth Engine SDK (Python Backend)**: Bypasses standard APIs entirely. The backend natively mounts Google Cloud credentials to fetch massive raster matrices from the **Sentinel-1 SAR** and **Sentinel-2** European satellites, executing heavy numpy math to assess deep Earth terrain.

### The TomTom Integration: Real-Time Logistics
**How TomTom Works:** The platform integrates the TomTom Traffic Flow API to monitor the real-time kinematic flow of vehicles across Delhi's primary arteries. During a simulated or real "Mega-Flood" scenario, calculating flood extent is only half the battle—the other half is logistics. TomTom analyzes the live speed and congestion density of the roads adjacent to the flood zones. 
* **The Benefit:** If the ML model flags a district (e.g., Civil Lines) for immediate evacuation, the platform queries TomTom to mathematically verify if the surrounding roads can handle the displacement of thousands of citizens, or if a secondary path must be highlighted via the AI Assistant.

---

## 4. How It Works: The ML Pipeline & GSHI
1. **Data Ingestion**: A cron job running in the Node.js API pings Open-Meteo, TomTom, and local geographic datasets, storing historical snapshots in the Time-Series PostgreSQL database.
2. **Analysis / Inference**: The continuous live data is sent to the isolated Python `ml-service`. Here, a trained **Random Forest Machine Learning model** evaluates the data alongside the current Sentinel satellite imagery. 

### Core Metric: The Green Space Health Index (GSHI)
**What is GSHI?** 
The Green Space Health Index is a high-fidelity proprietary composite score (0-100) calculated by our backend that determines the multifaceted health and flood mitigation potential of urban parks. Unlike static indicators, GSHI is a dynamic 7-component model.

**The 7 Factors of GSHI Calculation:**
Our system assigns heavy weights to biological and climatic factors while incorporating physical infrastructure health:

1.  **Vegetation (Weight: 22%)**: Uses seasonal-adjusted NDVI normalization. The system compares absolute NDVI from Sentinel-2 against monthly climatology baselines for Delhi (e.g., peak baseline of 0.58 in August vs 0.24 in May), ensuring seasonal variations don't mask underlying canopy decline.
2.  **Thermal Comfort (Weight: 18%)**: Calculated using the metric Steadman’s Heat Index (apparent temperature) derived from live temperature and humidity sensors. The final score is mapped against a **Gaussian Comfort Curve** centered at 22°C, where deviations into extreme heat significantly degrade the index.
3.  **Water & Soil Health (Weight: 17%)**: Analyzes soil moisture saturation. It identifies the "Goldilocks zone" (40-70%) for optimal root health and groundwater absorption. Scores hit 0 if soil reaches 100% saturation, signaling a total inability to mitigate further flash-flooding.
4.  **Ecological Biodiversity (Weight: 15%)**: Implements the **Shannon Diversity Index (H)** across recorded species logs. It incorporates weighted multipliers for endangered species (e.g., a 4.0x multiplier for Critically Endangered sightings), rewarding parks that support sensitive ecosystems.
5.  **Air Quality (Weight: 10%)**: A weighted composite of PM2.5 (50%), PM10 (30%), and CO2 levels (20%). It penalizes the score when levels breach WHO safe guidelines (PM2.5 > 15 μg/m³).
6.  **Infrastructure Integrity (Weight: 9%)**: Derived from IoT sensor node uptime combined with citizen-reported vandalism or damage. Open emergency alerts regarding irrigation or drainage failures apply direct penalties to this sub-score.
7.  **Tree Health (Weight: 9%)**: A **Recency-Decay Weighted Average** of AI-conducted tree scans. More recent health assessments (scanned via spectral analysis) carry higher mathematical weight than older logs to ensure the index reflects current biological status.

**Resilience Modeling:**
Beyond the flat 7 factors, the platform calculates a **Resilience Score** which blends Flood Mitigation potential (inverted risk), Thermal Buffering (canopy density), and Ecological Stability. This tells authorities not just "how healthy the park is" but "how well this park will protect the surrounding neighborhood during a disaster."

---

## 5. The Future Roadmap
* **Civic IoT Integration**: Bridging the system to read natively from physical smart sensors located inside city drainage systems and municipal water pumps for sub-millisecond flood prediction.
* **Monetization via API Interfaces**: Selling heavily processed, granular flood risk assessments to private real-estate and actuarial insurance bureaus for hyper-localized policy quoting.
* **Computer Vision Object Detection**: Integrating Convolutional Neural Networks (CNN) over localized satellite snapshots to automatically flag blocked city drainage pathways dynamically prior to monsoon seasons.
