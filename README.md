# 🏙️ CityVibe — AI Urban Navigator

> **Next-Generation Smart Exploration & Safety Intelligence Engine for Indian Metros**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet%201.9-199900?style=flat&logo=leaflet)](https://leafletjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Hackathon](https://img.shields.io/badge/Built%20For-PromptWars%20Hackathon-f59e0b?style=flat)]()

---

## 📌 1. Overview & Description

**CityVibe** is an intelligent urban navigation and exploration platform designed to help citizens, tourists, students, and commuters discover the best places in their city while prioritizing personal safety, transit efficiency, and neighborhood transparency.

By blending **curated urban datasets**, **interactive geospatial mapping**, **smart safety hazard zones**, and an **offline AI Concierge engine**, CityVibe delivers rich insights into food streets, cultural landmarks, heritage monuments, fashion corridors, and safe night routes across **Pune, Mumbai, Delhi, Bengaluru, and Jaipur**.

---

## 🎯 2. The Problem It Solves

- **Lack of Safety Awareness**: Traditional navigation apps suggest the shortest path without accounting for poor street lighting, high accident zones, construction bottlenecks, or isolated stretches.
- **Generic Tourist Information**: Existing map aggregators often provide superficial ratings without deep cultural history, best visiting hours, cleanliness metrics, or safety scores.
- **Neighborhood Comparison Blindspots**: Commuters and newcomers struggle to compare areas by affordability, crime rate, transit accessibility, and street vibe when choosing where to live, dine, or stay.
- **Online Dependency**: Travelers often lose network connectivity in crowded streets or heritage alleys, rendering cloud-only AI assistants unusable.

---

## ✨ 3. Key Features

1. **🗺️ Interactive 2-Column Exploration Hub**
   - Clean 35%/65% split layout featuring responsive place cards with cover photos, star ratings, safety scores, and category tags alongside a high-performance Leaflet map.
2. **📍 Multi-City & Pan-India Coverage (130+ Curated Places)**
   - 25–30 real landmarks per city covering **Pune, Mumbai, Delhi, Bengaluru, and Jaipur** across 5 categories: *Heritage, Food & Street Food, Fashion & Shopping, Culture & Popular Places, and Hotels & Stays*.
3. **🛡️ Smart Safety Hazard Zones & Alerts**
   - Real-time visualization of accident hotspots, waterlogging stretches, construction bottlenecks, and dim-lit areas with actionable safety precautions.
4. **🛣️ Safety-First Routing Simulator**
   - Compare traditional *Direct / Fast Routes* with *Safe Lit Corridors* (monitored avenues with 24/7 CCTV and high footfall). Includes 1-click **Open in Google Maps** integration for turn-by-turn navigation.
5. **⚖️ 5-Pillar Neighborhood Comparator (Best vs. Worst)**
   - Side-by-side analytical radar benchmark scoring neighborhoods on **Safety, Cleanliness, Affordability, Ratings, and Transit Accessibility**.
6. **📢 Multimodal Citizen Reporting Hub**
   - Community-powered reporting with photo uploads, voice note logs, hazard level tags (Low, Medium, High), and upvoting for verified municipal and citizen safety alerts.
7. **⚡ Zero-Config Offline AI Engine & Assistant**
   - Instant answers on safety guidelines, cultural history, food recommendations, and local transit tips with **zero API key requirement** and instant response times.
8. **🌓 Seamless Dark / Light Mode with Smart Sensors**
   - Tailored glassmorphism UI with live weather readings, Air Quality Index (AQI), and real-time traffic congestion indicators.

---

## 🛠️ 4. Tech Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic
- **Frontend**: Vanilla HTML5, Modern CSS3 (Custom Design System, Glassmorphism, CSS Variables, Responsive Grid/Flexbox), Vanilla JavaScript (ES6+)
- **Mapping & GIS**: Leaflet.js, OpenStreetMap standard tiles
- **AI & NLP Engine**: Built-in Offline Expert Rule & Heuristic Synthesis + Google Gemini 2.5 Flash API connector
- **Testing**: Automated Python End-to-End Test Suite (`test_runner.py`)

---

## 🚀 5. How to Run Locally

### Prerequisites
- Python 3.10 or higher installed
- Git installed

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ashutosh3337/CityVibe.git
   cd CityVibe
   ```

2. **Create and activate a virtual environment (optional but recommended):**
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the development server:**
   ```bash
   python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
   ```

5. **Open in your browser:**
   - Web App: [http://127.0.0.1:8000](http://127.0.0.1:8000)
   - Interactive API Docs (Swagger): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

6. **Run automated test suite:**
   ```bash
   python test_runner.py
   ```

---

## 📸 6. Screenshots & Previews

| Map Exploration & Curated Cards | Safety Routing & Map Highlights |
|:---:|:---:|
| *(Screenshot Placeholder: Map & Exploration View with Pune Cards)* | *(Screenshot Placeholder: Safe Route vs Direct Route on Map)* |

| 5-Pillar Neighborhood Matrix | Citizen Hub & Hazard Reports |
|:---:|:---:|
| *(Screenshot Placeholder: Best vs Worst Comparison Radar)* | *(Screenshot Placeholder: Live Citizen Reporting Feed)* |

---

## 📂 7. Project Structure

```text
CityVibe/
├── app.py                 # FastAPI server & REST endpoints
├── dataset.py             # Curated dataset (130+ POIs, Safety Zones, Benchmarks)
├── test_runner.py         # 8-suite automated technical validation test
├── requirements.txt       # Python package dependencies
├── README.md              # Project documentation
└── static/
    ├── index.html         # Single-page application HTML5 structure
    ├── style.css          # Ultra-premium responsive glassmorphism CSS design
    └── app.js             # Leaflet mapping, filtering, routing & offline AI logic
```

---

## 🔮 8. Future Improvements

- [ ] **Real-time SOS & Emergency Escort**: Add emergency broadcast with nearest police station & hospital routing.
- [ ] **Crowdsourced Live Lighting Map**: Allow evening commuters to rate road illumination levels in real time.
- [ ] **Public Transit Metro Integration**: Live transit schedules and metro station integration for Pune Metro & Mumbai Metro.
- [ ] **Multi-Language Audio Guides**: Integrated voice tours in Marathi, Hindi, and English for major heritage landmarks.

---

## 🏆 9. Hackathon Submission

Built with ❤️ for the **PromptWars Hackathon**.