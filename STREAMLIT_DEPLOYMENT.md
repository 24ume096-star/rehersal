# 🚀 Streamlit Cloud Deployment Guide

## Smart Green Space Dashboard

### Prerequisites
1. GitHub account
2. Streamlit Cloud account (free tier available)
3. Repository with the Streamlit app

### Step 1: Prepare Your Repository

```bash
# Directory structure
smart-green-space/
├── streamlit_app.py        # Main Streamlit app
├── requirements.txt        # Python dependencies
├── .streamlit/
│   └── config.toml        # Streamlit configuration
└── README.md              # Project documentation
```

### Step 2: Create requirements.txt
```
streamlit==1.42.0
pandas==2.2.0
numpy==1.26.4
plotly==5.18.0
streamlit-folium==0.17.0
python-pptx==0.6.21
```

### Step 3: Push to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Add Streamlit app for cloud deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-green-space.git
git push -u origin main
```

### Step 4: Deploy on Streamlit Cloud

1. **Go to Streamlit Cloud**: https://streamlit.io/cloud
2. **Sign in** with your GitHub account
3. **Create new app**:
   - Click "New app"
   - Select repository: `your-username/smart-green-space`
   - Select branch: `main`
   - Set main file path: `streamlit_app.py`
4. **Configure app** (optional):
   - Add Python version (3.9+)
   - Add environment variables if needed
5. **Deploy**: Click "Deploy" button

### Step 5: Configure Custom Domain (Optional)

1. Go to app settings
2. Add custom domain: `dashboard.smartgreenspace.io`
3. Update DNS records with CNAME

### Environment Variables (if needed)

Add to Streamlit Cloud secrets:
```
API_KEY = "your-api-key"
DATABASE_URL = "postgresql://..."
GOOGLE_MAPS_API = "your-google-maps-key"
```

Access in code:
```python
import streamlit as st

api_key = st.secrets["API_KEY"]
```

### Monitoring & Logs

1. **View logs**: Streamlit Cloud dashboard → App → Logs
2. **Check performance**: Monitor → Metrics
3. **Set alerts**: Configure email notifications

### Cost Estimation

| Plan | Price | Features |
|------|-------|----------|
| Community | Free | 1 GB memory, basic support |
| Pro | $7/month | 3 GB memory, priority support |
| Advanced | Contact sales | Custom resources |

### Performance Tips

1. **Cache expensive operations**:
```python
@st.cache_data
def load_data():
    return fetch_gshi_data()
```

2. **Use session state for responsiveness**:
```python
if 'selected_park' not in st.session_state:
    st.session_state.selected_park = "Deer Park"
```

3. **Optimize data loading**:
```python
@st.cache_data(ttl=3600)  # Cache for 1 hour
def get_gshi_scores():
    return fetch_from_api()
```

### Troubleshooting

**App not deploying?**
- Check `requirements.txt` for incompatible packages
- Verify `streamlit_app.py` exists in root
- Review build logs for errors

**App too slow?**
- Use caching for data
- Reduce data fetching frequency
- Optimize visualizations (use Plotly Light)

**Out of memory?**
- Upgrade to Pro tier
- Reduce data volume
- Use pagination for large datasets

### Advanced Features

#### 1. Real-time Updates
```python
import streamlit as st
import time

# Auto-refresh every 60 seconds
st.set_page_config(initial_sidebar_state="expanded")
if 'refresh_counter' not in st.session_state:
    st.session_state.refresh_counter = 0
st.session_state.refresh_counter += 1
time.sleep(60)
st.rerun()
```

#### 2. Authentication
```python
import streamlit_authenticator as stauth

authenticator = stauth.Authenticate(
    usernames,
    secrets['usernames'],
    secrets['passwords'],
    'some_cookie_name',
    'some_signature_key',
    cookie_expiry_days=30
)
```

#### 3. Database Connection
```python
import sqlite3

@st.cache_resource
def get_connection():
    return sqlite3.connect("data.db")

conn = get_connection()
```

### Deployment Checklist

- [ ] Code committed to GitHub
- [ ] `requirements.txt` updated with all dependencies
- [ ] `streamlit_app.py` in repository root
- [ ] `.streamlit/config.toml` configured
- [ ] Secrets added to Streamlit Cloud (if needed)
- [ ] App deployed successfully
- [ ] Custom domain configured (optional)
- [ ] Monitoring/logging enabled

### Support & Resources

- **Streamlit Docs**: https://docs.streamlit.io
- **Community Forum**: https://discuss.streamlit.io
- **GitHub Issues**: https://github.com/streamlit/streamlit/issues
- **Twitter**: @streamlit

### Next Steps

1. Add authentication for secure access
2. Connect to live API endpoint
3. Implement user database for personalization
4. Set up webhooks for real-time updates
5. Add export functionality (PDF, CSV)
6. Integrate payment processing for SaaS

---

**Need help?** Email: dev@smartgreenspace.io
