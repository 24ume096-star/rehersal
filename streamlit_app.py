"""
Smart Green Space - Streamlit Cloud Dashboard
Showcases GSHI scores, business model, and analytics
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta

# Configure page
st.set_page_config(
    page_title="Smart Green Space",
    page_icon="🌿",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main { background-color: #f0f8f0; }
    .metric-card { 
        background: linear-gradient(135deg, #228B22, #32CD32);
        color: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
    }
    .header { color: #228B22; font-weight: bold; }
    .stMetric {
        background-color: white;
        padding: 10px;
        border-radius: 5px;
    }
</style>
""", unsafe_allow_html=True)

# Sidebar navigation
st.sidebar.title("🌿 Smart Green Space")
page = st.sidebar.radio(
    "Navigation",
    ["Dashboard", "GSHI Explained", "Business Model", "About", "API Docs"]
)

# ============================================================================
# PAGE 1: DASHBOARD
# ============================================================================
if page == "Dashboard":
    st.title("🌳 Smart Green Space Dashboard")
    st.markdown("Real-time Green Space Health & Climate Resilience Metrics")
    
    # Demo data for parks
    parks_data = {
        "Park": ["Deer Park", "Lodhi Garden", "Nehru Park", "Sunder Nursery", "Garden of Five Senses"],
        "Overall Score": [72, 68, 75, 81, 58],
        "Vegetation": [65, 62, 70, 78, 50],
        "Thermal": [58, 55, 68, 72, 45],
        "Water": [52, 48, 60, 65, 35],
        "Biodiversity": [68, 65, 72, 75, 55],
        "Air Quality": [45, 42, 55, 62, 38],
        "Infrastructure": [85, 80, 82, 88, 70],
        "Tree Health": [70, 66, 73, 80, 60],
        "Alerts": [2, 1, 0, 0, 4]
    }
    df_parks = pd.DataFrame(parks_data)
    
    # Top metrics
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("🌍 Cities Monitored", "3", "+1 this month")
    with col2:
        st.metric("🌳 Parks Active", "15", "+3 new sensors")
    with col3:
        st.metric("⚠️ Active Alerts", "12", "-5 resolved")
    with col4:
        st.metric("📡 Data Points/Day", "2.3M", "Real-time")
    
    st.markdown("---")
    
    # Park selector
    selected_park = st.selectbox("Select Park", df_parks["Park"])
    park_data = df_parks[df_parks["Park"] == selected_park].iloc[0]
    
    # GSHI visualization
    col1, col2 = st.columns([2, 1])
    
    with col1:
        # Overall score gauge
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number",
            value=park_data["Overall Score"],
            title=f"GSHI Score - {selected_park}",
            gauge=dict(
                axis=dict(range=[0, 100]),
                bar=dict(color="#228B22"),
                steps=[
                    {"range": [0, 25], "color": "#FFB6C6"},
                    {"range": [25, 50], "color": "#FFD700"},
                    {"range": [50, 75], "color": "#90EE90"},
                    {"range": [75, 100], "color": "#228B22"}
                ]
            ),
            domain=dict(x=[0, 1], y=[0, 1])
        ))
        fig_gauge.update_layout(height=300)
        st.plotly_chart(fig_gauge, use_container_width=True)
    
    with col2:
        st.metric("Status", "Healthy", "↑ Improving")
        st.metric("Last Updated", "2 min ago", "Real-time")
        status_text = "✅ All systems normal" if park_data["Alerts"] <= 2 else "⚠️ Some alerts active"
        st.info(status_text)
    
    st.markdown("---")
    
    # Component breakdown
    st.subheader("📊 GSHI Components")
    
    components = {
        "Vegetation": park_data["Vegetation"],
        "Thermal": park_data["Thermal"],
        "Water": park_data["Water"],
        "Biodiversity": park_data["Biodiversity"],
        "Air Quality": park_data["Air Quality"],
        "Infrastructure": park_data["Infrastructure"],
        "Tree Health": park_data["Tree Health"]
    }
    
    components_df = pd.DataFrame(list(components.items()), columns=["Component", "Score"])
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        # Bar chart
        fig_bar = px.bar(
            components_df,
            x="Component",
            y="Score",
            color="Score",
            color_continuous_scale=["#FFB6C6", "#FFD700", "#90EE90", "#228B22"],
            range_color=[0, 100],
            title="Component Scores"
        )
        fig_bar.update_layout(height=400, xaxis_tickangle=-45)
        st.plotly_chart(fig_bar, use_container_width=True)
    
    with col2:
        # Radar chart
        fig_radar = go.Figure(data=go.Scatterpolar(
            r=list(components.values()),
            theta=list(components.keys()),
            fill='toself',
            line_color='#228B22',
            fillcolor='rgba(34, 139, 34, 0.3)',
            marker_color='#228B22'
        ))
        fig_radar.update_layout(
            title="Health Profile",
            polar=dict(radialaxis=dict(visible=True, range=[0, 100])),
            height=400
        )
        st.plotly_chart(fig_radar, use_container_width=True)
    
    st.markdown("---")
    
    # City rankings
    st.subheader("🏆 City Rankings")
    df_ranked = df_parks.sort_values("Overall Score", ascending=False)
    
    col1, col2, col3 = st.columns(3)
    for idx, (col, rank) in enumerate([(col1, 1), (col2, 2), (col3, 3)]):
        if idx < len(df_ranked):
            row = df_ranked.iloc[idx]
            with col:
                st.markdown(f"""
                <div style='background: linear-gradient(135deg, #228B22, #32CD32); 
                            color: white; padding: 20px; border-radius: 10px; text-align: center;'>
                    <h2>🥇 #{rank}</h2>
                    <h3>{row['Park']}</h3>
                    <h1>{row['Overall Score']}</h1>
                </div>
                """, unsafe_allow_html=True)

# ============================================================================
# PAGE 2: GSHI EXPLAINED
# ============================================================================
elif page == "GSHI Explained":
    st.title("📚 Understanding GSHI")
    st.markdown("The Green Space Health Index - A 7-Component AI Model")
    
    st.info("""
    GSHI measures urban park resilience to climate hazards using satellite data, 
    IoT sensors, and AI algorithms to turn complex environmental data into 
    a single, actionable health score (0-100).
    """)
    
    # Components explanation
    components_info = {
        "🌿 Vegetation (22%)": {
            "description": "Satellite NDVI (Normalized Difference Vegetation Index) normalized for urban canopy health",
            "data_source": "NASA Earth Engine, MODIS satellite imagery",
            "impact": "Measures green cover density and forest canopy quality"
        },
        "🌡️ Thermal (18%)": {
            "description": "Heat Index calculated from temperature + humidity using Steadman's formula",
            "data_source": "IoT sensors, Open-Meteo weather API",
            "impact": "Indicates urban heat island effect and thermal stress"
        },
        "💧 Water (17%)": {
            "description": "Soil moisture levels and drainage system health",
            "data_source": "Soil moisture sensors, precipitation data",
            "impact": "Assessess flood resilience and water availability for vegetation"
        },
        "🦅 Biodiversity (15%)": {
            "description": "Shannon diversity index weighted by species conservation status",
            "data_source": "Citizen reports, ecological surveys, AI image recognition",
            "impact": "Measures ecosystem health and species diversity"
        },
        "💨 Air Quality (10%)": {
            "description": "PM2.5, PM10, CO₂ concentrations in air",
            "data_source": "Air quality sensors, government environmental data",
            "impact": "Reflects environmental pollution levels and air purification"
        },
        "⚡ Infrastructure (9%)": {
            "description": "Sensor uptime, alert response times, maintenance efficiency",
            "data_source": "IoT network monitoring, management systems",
            "impact": "Measures park maintenance and operational readiness"
        },
        "🌲 Tree Health (9%)": {
            "description": "AI-scanned tree decay analysis with exponential decay weighting",
            "data_source": "Drone imagery, manual tree health surveys",
            "impact": "Identifies diseased or at-risk trees for intervention"
        }
    }
    
    for component, info in components_info.items():
        with st.expander(component):
            col1, col2 = st.columns(2)
            with col1:
                st.markdown(f"**Description:** {info['description']}")
                st.markdown(f"**Data Source:** {info['data_source']}")
            with col2:
                st.markdown(f"**Impact:** {info['impact']}")
    
    st.markdown("---")
    
    # Formula visualization
    st.subheader("📐 Calculation Formula")
    st.latex(r"""
    \text{GSHI} = 0.22 \times V + 0.18 \times T + 0.17 \times W + 0.15 \times B 
    + 0.10 \times A + 0.09 \times I + 0.09 \times H
    """)
    
    st.markdown("""
    Where:
    - V = Vegetation Score
    - T = Thermal Score  
    - W = Water Score
    - B = Biodiversity Score
    - A = Air Quality Score
    - I = Infrastructure Score
    - H = Tree Health Score
    """)
    
    # Timeline data
    st.subheader("📈 Historical Trend")
    dates = pd.date_range(start="2026-01-01", end="2026-04-15", freq="D")
    trend_data = pd.DataFrame({
        "Date": dates,
        "GSHI": 65 + np.cumsum(np.random.normal(0.5, 2, len(dates))) + np.sin(np.arange(len(dates)) * 2 * np.pi / 30) * 5
    })
    trend_data["GSHI"] = trend_data["GSHI"].clip(30, 95)
    
    fig_trend = px.line(trend_data, x="Date", y="GSHI", 
                       title="GSHI 4-Month Trend",
                       markers=True,
                       color_discrete_sequence=["#228B22"])
    st.plotly_chart(fig_trend, use_container_width=True)

# ============================================================================
# PAGE 3: BUSINESS MODEL
# ============================================================================
elif page == "Business Model":
    st.title("💼 Business Model Canvas")
    
    tabs = st.tabs(["Overview", "Value Proposition", "Revenue", "Customers", "Technology"])
    
    with tabs[0]:
        st.markdown("""
        ## Business Overview
        
        **Smart Green Space** is a climate-tech SaaS platform that enables cities 
        to transform from reactive disaster response to proactive urban resilience.
        
        ### Core Mission
        Transform civic action from reactive damage control to proactive disaster navigation 
        using AI-powered Green Space Health Intelligence.
        """)
        
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("""
            ### The Problem
            🌍 80% of global cities face urban flooding & heat stress
            
            💰 $3 Trillion annual infrastructure loss from climate hazards
            
            ⚠️ City planners lack real-time insights on green space health
            
            🖥️ Fragmented data = no single source of truth
            """)
        
        with col2:
            st.markdown("""
            ### Our Solution
            ✅ Proactive resilience through GSHI scoring
            
            ✅ Satellite + IoT data fusion in real-time
            
            ✅ Intuitive 3D visualization of complex risk
            
            ✅ API-first for seamless integration
            
            ✅ Predictive analytics for early warning
            """)
    
    with tabs[1]:
        st.markdown("""
        ## Value Propositions
        
        ### For Government (B2G)
        - **Proactive Resilience**: Transform from reactive to proactive disaster navigation
        - **Evidence-Based Planning**: Data-driven decisions for urban development
        - **Real-Time Preparedness**: Early warning systems for climate events
        - **Cost Optimization**: Prevent losses rather than manage aftermath
        
        ### For Enterprise (B2B)
        - **Risk Assessment**: Evaluate zone vulnerabilities for development
        - **Liability Quantification**: Quantify flood/heat risks for insurance
        - **Investment Protection**: Long-term risk assessment for property
        - **Compliance Support**: Meet ESG and regulatory requirements
        """)
    
    with tabs[2]:
        st.markdown("""
        ## Revenue Streams
        """)
        
        revenue_data = pd.DataFrame({
            "Stream": [
                "SaaS Subscriptions",
                "Civic Contracts",
                "API Tokens",
                "Premium Support"
            ],
            "Monthly (₹)": [250000, 500000, 100000, 50000],
            "Description": [
                "Tiered monthly ($500-5k/mo)",
                "Multi-year city licensing",
                "Metered billing for developers",
                "Custom deployment & training"
            ]
        })
        
        fig_revenue = px.pie(revenue_data, values="Monthly (₹)", names="Stream",
                            title="Projected Revenue Mix")
        st.plotly_chart(fig_revenue, use_container_width=True)
        
        st.dataframe(revenue_data, use_container_width=True)
    
    with tabs[3]:
        st.markdown("""
        ## Customer Segments
        
        ### B2G: Government
        - City Planning Departments
        - Emergency Response (NDRF)
        - Municipal Corporations
        - Climate Adaptation Committees
        
        ### B2B: Enterprise
        - Real Estate Developers
        - Insurance Companies  
        - Climate Tech Investors
        - ESG Consultancies
        """)
        
        st.subheader("Addressable Market")
        market_data = pd.DataFrame({
            "Segment": ["Indian Cities", "Regional", "International"],
            "TAM (₹ Cr)": [500, 1200, 5000],
            "Realistic Year 2027": [50, 120, 300]
        })
        
        fig_market = px.bar(market_data, x="Segment", y=["TAM (₹ Cr)", "Realistic Year 2027"],
                           title="Market Opportunity",
                           barmode='group')
        st.plotly_chart(fig_market, use_container_width=True)
    
    with tabs[4]:
        st.markdown("""
        ## Technology Stack
        
        ### Frontend
        - **Framework**: React + TypeScript
        - **Visualization**: Three.js, Mapbox GL, D3.js
        - **Deployment**: Vercel Edge
        
        ### Backend
        - **Runtime**: Node.js + Express
        - **ORM**: Prisma
        - **Language**: JavaScript/TypeScript
        
        ### Data & ML
        - **ML**: Python (scikit-learn, TensorFlow, XGBoost)
        - **Infrastructure**: GPU clusters (NVIDIA)
        - **Processing**: Apache Spark for big data
        
        ### Infrastructure
        - **Cloud**: AWS (EC2, RDS, S3)
        - **Database**: PostgreSQL + TimescaleDB
        - **Cache**: Redis
        - **Message Queue**: RabbitMQ
        - **Containerization**: Docker + Kubernetes
        
        ### Data Sources
        - **Satellite**: Google Earth Engine, USGS, ESA
        - **Weather**: Open-Metoe, NOAA
        - **Maps**: Mapbox, TomTom
        - **IoT**: Custom sensor networks
        """)
        
        st.info("🚀 Full API Documentation: https://docs.smartgreenspace.io")

# ============================================================================
# PAGE 4: ABOUT
# ============================================================================
elif page == "About":
    st.title("🌍 About Smart Green Space")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.markdown("""
        ## Our Mission
        Transform urban resilience through real-time green and thermal intelligence, 
        enabling cities to evolve from reactive disaster management to proactive 
        climate adaptation.
        
        ## The Team
        - **Founders**: Climate tech entrepreneurs with 15+ years in geospatial & ML
        - **Advisors**: IIT Delhi professors, NDRF officials, insurance executives
        - **Engineering**: 20+ engineers across fullstack, ML, DevOps
        
        ## Locations
        - 🏢 **HQ**: Delhi, India
        - 🌏 **R&D**: Bangalore, India  
        - 🌍 **Operations**: Mumbai, India
        
        ## Funding
        - Pre-Seed: $200K (2024)
        - Seed Round: Raising $2M (2026)
        - Use of funds: 40% Product, 30% Sales, 20% Operations, 10% Admin
        """)
    
    with col2:
        st.metric("Founded", "2022", "3+ years")
        st.metric("Countries", "1", "5 target")
        st.metric("Cities", "3", "50 by 2027")
        st.metric("Users", "500+", "10k target")
    
    st.markdown("---")
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.subheader("📊 Key Metrics")
        st.metric("Data Points/Day", "2.3M", "Real-time")
        st.metric("API Calls/Month", "10M+", "Enterprise")
        st.metric("99.9%", "Uptime SLA", "Maintained")
    
    with col2:
        st.subheader("🎯 Milestones")
        st.markdown("""
        ✅ 2024: Platform MVP  
        ✅ 2025: Delhi deployment  
        ✅ Q2 2026: 3-city expansion  
        🎯 Q4 2026: Enterprise contracts
        """)
    
    with col3:
        st.subheader("🏆 Recognition")
        st.markdown("""
        🥇 AI for Good Award  
        🥇 Climate Tech 100  
        🥇 Innovation Challenge Winner
        """)
    
    st.markdown("---")
    
    st.markdown("""
    ## Contact & Links
    - 🌐 Website: https://smartgreenspace.io
    - 📧 Email: team@smartgreenspace.io
    - 🐦 Twitter: @SmartGreenSpace
    - 💼 LinkedIn: company/smart-green-space
    - 📱 Mobile: Coming Q3 2026
    """)

# ============================================================================
# PAGE 5: API DOCS
# ============================================================================
elif page == "API Docs":
    st.title("🔗 API Documentation")
    
    st.markdown("""
    ## Base URL
    ```
    https://api.smartgreenspace.io/v1
    ```
    
    ## Authentication
    All requests require an API key in the header:
    ```
    Authorization: Bearer YOUR_API_KEY
    ```
    """)
    
    tabs = st.tabs(["Endpoints", "Examples", "Rate Limits", "Support"])
    
    with tabs[0]:
        st.subheader("Core Endpoints")
        
        endpoints = [
            {
                "Method": "GET",
                "Endpoint": "/gshi/parks/{parkId}/current",
                "Description": "Get current GSHI score for a park"
            },
            {
                "Method": "GET",
                "Endpoint": "/gshi/cities/{cityId}/rankings",
                "Description": "Get park rankings for a city"
            },
            {
                "Method": "GET",
                "Endpoint": "/gshi/parks/{parkId}/history",
                "Description": "Get historical GSHI trends (7d, 30d, 90d)"
            },
            {
                "Method": "POST",
                "Endpoint": "/gshi/parks/{parkId}/alert",
                "Description": "Create custom alert thresholds"
            },
            {
                "Method": "GET",
                "Endpoint": "/satellite/ndvi/{parkId}",
                "Description": "Get latest satellite NDVI data"
            },
            {
                "Method": "GET",
                "Endpoint": "/forecast/{parkId}",
                "Description": "Get 7-day GSHI forecast"
            }
        ]
        
        df_endpoints = pd.DataFrame(endpoints)
        st.dataframe(df_endpoints, use_container_width=True)
    
    with tabs[1]:
        st.subheader("Code Examples")
        
        st.markdown("**Python**")
        st.code("""
import requests

api_key = "your_api_key_here"
headers = {"Authorization": f"Bearer {api_key}"}

# Get GSHI score
response = requests.get(
    "https://api.smartgreenspace.io/v1/gshi/parks/delhi-deer-park/current",
    headers=headers
)
print(response.json())
        """, language="python")
        
        st.markdown("**JavaScript**")
        st.code("""
const apiKey = "your_api_key_here";

async function getGshiScore(parkId) {
  const response = await fetch(
    `https://api.smartgreenspace.io/v1/gshi/parks/${parkId}/current`,
    {
      headers: { "Authorization": `Bearer ${apiKey}` }
    }
  );
  return await response.json();
}
        """, language="javascript")
    
    with tabs[2]:
        st.markdown("""
        ## Rate Limits
        
        | Plan | Requests/Min | Requests/Day |
        |------|-------------|------------|
        | Free | 10 | 1,000 |
        | Pro | 100 | 100,000 |
        | Enterprise | Unlimited | Unlimited |
        
        ## Response Times
        - 95th percentile: < 200ms
        - 99th percentile: < 500ms
        - 99.9th percentile: < 2s
        """)
    
    with tabs[3]:
        st.markdown("""
        ## Support
        
        - 📧 Documentation: https://docs.smartgreenspace.io
        - 💬 Community: https://community.smartgreenspace.io
        - 🎟️ Issues: https://github.com/smartgreenspace/api/issues
        - 📞 Enterprise Support: support@smartgreenspace.io
        
        ## SLA
        - **Uptime**: 99.9% guaranteed
        - **Support Response**: < 2 hours
        - **Critical Issues**: < 30 minutes
        """)

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #666; padding: 20px;'>
    <p>🌿 Smart Green Space © 2026 | Building Climate-Resilient Cities</p>
    <p>
        <a href='https://smartgreenspace.io'>Website</a> • 
        <a href='https://docs.smartgreenspace.io'>Docs</a> • 
        <a href='https://github.com/smartgreenspace'>GitHub</a>
    </p>
</div>
""", unsafe_allow_html=True)
