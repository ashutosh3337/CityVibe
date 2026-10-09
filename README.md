# 🏙️ CityVibe — AI Urban Navigator & Safety Intelligence

> **Smart Exploration & Safety-Weighted Geospatial Navigation for Indian Metros**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet_1.9-199900?style=flat&logo=leaflet)](https://leafletjs.com/)
[![AI Engine](https://img.shields.io/badge/AI-Offline_NLP_%2B_Gemini-8B5CF6?style=flat&logo=google)](https://deepmind.google/technologies/gemini/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**CityVibe** is an intelligent urban exploration and safety navigation platform for Indian metros (**Pune, Mumbai, Delhi, Bengaluru, Jaipur**). It pairs curated cultural discovery with real-time hazard intelligence, women's safety routing, neighborhood benchmarking, and an offline-first AI Concierge.

---

## ⚡ Core Features

- 🗺️ **Smart Exploration Hub**: Responsive 45/55 split dashboard featuring 130+ curated places across Heritage, Food, Fashion, Culture, and Stays with HD photos, ratings, cleanliness & safety scores.
- 🛡️ **Safety-First Route Simulator**: Compares well-lit, high-footfall **Safe Boulevards** with direct shortcuts; includes 1-click **Open in Google Maps**.
- ⚠️ **Geospatial Hazard Zones**: Dynamic GIS overlays for accident hotspots, waterlogging risks, and dim-lit zones with actionable safety tips.
- ⚖️ **5-Pillar Neighborhood Comparator**: Side-by-side benchmark matrix evaluating Safety, Cleanliness, Affordability, Ratings, and Transit Accessibility.
- 📢 **Multimodal Citizen Hub**: Live crowdsourced incident reporting with text, voice notes, photo tagging, automated NLP triage, and community upvoting.
- 🤖 **Dual-Mode AI Concierge**: Instant local heuristic intelligence (zero key required) + optional Google Gemini 2.5 Flash integration.
- 🌓 **Dual Themes & Live Sensors**: Dark/Light glassmorphism design with live Temperature, AQI, and Traffic telemetry.

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pydantic |
| **Frontend** | Vanilla HTML5, Modern CSS3 (Glassmorphism, Flex/Grid), Vanilla JS (ES6+) |
| **Mapping & GIS** | Leaflet.js 1.9.4, OpenStreetMap (OSM) Tiles |
| **AI & NLP** | Local Heuristic NLP Engine + Google Gemini API (`google-genai`) |
| **Testing** | Automated Python Test Suite (`test_runner.py`) |

---

## 🚀 Quick Start

```bash
# 1. Clone repository
git clone https://github.com/ashutosh3337/CityVibe.git
cd CityVibe

# 2. Set up virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start server
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

- 🌐 **Web App**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- 📚 **Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🧪 Validation & Testing

Run the automated 8-part test suite validating all API endpoints, safe routing, and NLP triage:

```bash
python test_runner.py
# Output: 8/8 PASSED, 0 FAILED
```

---

## 📡 API Overview

| Method | Endpoint | Description |
|:---:|---|---|
| `GET` | `/api/pois?city=&category=` | Curated spots filtered by city or category |
| `GET` | `/api/safety-zones?city=` | Geo-hazard zones & safety precautions |
| `GET` | `/api/live-status?city=` | Live Weather, AQI & Traffic telemetry |
| `GET` | `/api/benchmarks/compare?areaA=&areaB=` | 5-pillar neighborhood benchmark comparison |
| `POST` | `/api/route-plan` | Safe Boulevard vs. Direct Arterial route planner |
| `GET/POST`| `/api/reports` | Get live citizen alerts / Submit new multimodal report |
| `POST` | `/api/reports/{id}/upvote` | Upvote a citizen-reported alert |
| `POST` | `/api/concierge` | Ask CityVibe AI Concierge (Offline or Gemini) |

---

## 📂 Project Structure

```text
CityVibe/
├── app.py             # FastAPI REST server & routing engine
├── dataset.py         # 130+ POIs, hazard zones, benchmarks & telemetry
├── test_runner.py     # 8-suite automated technical validation test
├── requirements.txt   # Core Python dependencies
├── static/
│   ├── index.html     # Single-page application structure
│   ├── style.css      # Ultra-premium glassmorphism styles
│   └── app.js         # Leaflet GIS, routing & UI logic
└── README.md          # Project documentation
```

---

## 📄 License

MIT License • Built with ❤️ for urban safety & exploration.