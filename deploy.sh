#!/usr/bin/env bash
# Quick Start Script for Smart Green Space Deployment

#!/bin/bash

echo "🌿 Smart Green Space - Quick Deployment Script"
echo "=============================================="
echo ""

# Check if in correct directory
if [ ! -f "streamlit_app.py" ]; then
    echo "❌ Error: streamlit_app.py not found!"
    echo "Run this script from the smart-green-space directory"
    exit 1
fi

# Menu
echo "Select deployment option:"
echo "1) Run locally (development)"
echo "2) Deploy to Streamlit Cloud"
echo "3) Install dependencies only"
echo "4) Generate PowerPoint"
echo "5) View documentation"
echo ""
read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo "🚀 Starting Streamlit app..."
        python -m pip install -q -r requirements.txt
        streamlit run streamlit_app.py
        ;;
    2)
        echo "📤 Deploying to Streamlit Cloud..."
        echo ""
        echo "Steps:"
        echo "1. Push code to GitHub: git push origin main"
        echo "2. Visit: https://streamlit.io/cloud"
        echo "3. Click 'New app'"
        echo "4. Select repository & streamlit_app.py"
        echo "5. Click Deploy"
        echo ""
        ;;
    3)
        echo "📦 Installing dependencies..."
        python -m pip install -q -r requirements.txt
        echo "✅ Dependencies installed!"
        ;;
    4)
        echo "📊 Generating PowerPoint..."
        python create_business_ppt.py
        echo "✅ PowerPoint created: Business_Model_Presentation.pptx"
        ;;
    5)
        echo "📚 Documentation files:"
        echo "• DEPLOYMENT_GUIDE.md - Complete deployment guide"
        echo "• STREAMLIT_DEPLOYMENT.md - Streamlit Cloud specific"
        echo "• docs/business_model.md - Business model details"
        echo ""
        ;;
    *)
        echo "❌ Invalid choice"
        ;;
esac
