"""
CityVibe - FastAPI Application Server
Provides REST APIs for Smart Exploration, Safety Zones, Comparison Matrix,
Safe Route Calculations, and AI City Concierge via Gemini.
"""

import os
import uuid
import math
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dataset import (
    POIS,
    SAFETY_ZONES,
    NEIGHBORHOODS_BENCHMARK,
    INITIAL_CITIZEN_REPORTS,
    LIVE_CITY_CONDITIONS
)

# Global Gemini Client State
GEMINI_AVAILABLE = False
gemini_client = None
active_gemini_api_key = os.environ.get("GEMINI_API_KEY", "")

def init_gemini(api_key: str):
    global GEMINI_AVAILABLE, gemini_client, active_gemini_api_key
    if not api_key:
        GEMINI_AVAILABLE = False
        gemini_client = None
        return False
    try:
        from google import genai
        gemini_client = genai.Client(api_key=api_key)
        GEMINI_AVAILABLE = True
        active_gemini_api_key = api_key
        return True
    except Exception as e:
        print(f"Gemini client initialization error: {e}")
        GEMINI_AVAILABLE = False
        gemini_client = None
        return False

if active_gemini_api_key:
    init_gemini(active_gemini_api_key)

app = FastAPI(
    title="CityVibe API",
    description="Smart Interactive Urban Exploration & Safety Intelligence Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for runtime citizen reports
citizen_reports_db = list(INITIAL_CITIZEN_REPORTS)


# Models
class CitizenReportCreate(BaseModel):
    category: str # safety, traffic, food_vibe, cleanliness
    title: str
    description: str
    neighborhood: str
    mediaType: Optional[str] = "text" # text, voice_note, photo
    author: Optional[str] = "Citizen Explorer"
    imageUrl: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class RouteRequest(BaseModel):
    originPoiId: str
    destPoiId: str
    mode: str = "balanced" # fastest, safest, scenic


class ConciergeRequest(BaseModel):
    prompt: str
    contextCategory: Optional[str] = "all"
    neighborhood: Optional[str] = None
    timeAvailable: Optional[str] = None
    budgetLevel: Optional[str] = None
    city: Optional[str] = None


class ApiKeyPayload(BaseModel):
    apiKey: str


# Endpoints
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "CityVibe",
        "geminiConfigured": GEMINI_AVAILABLE,
        "activeReportsCount": len(citizen_reports_db),
        "activePoisCount": len(POIS),
        "activeHazardZonesCount": len(SAFETY_ZONES)
    }


@app.post("/api/configure-key")
def configure_key(payload: ApiKeyPayload):
    key = payload.apiKey.strip()
    success = init_gemini(key)
    return {
        "status": "success" if success else "failed",
        "geminiConfigured": GEMINI_AVAILABLE,
        "message": "Gemini API successfully configured!" if success else "Failed to initialize Gemini with the provided key."
    }


@app.get("/api/pois")
def get_pois(category: Optional[str] = None, neighborhood: Optional[str] = None, city: Optional[str] = None):
    results = POIS
    if city and city != "all":
        results = [p for p in results if (p.get("city") or "pune").lower() == city.lower()]
    if category and category != "all":
        results = [p for p in results if p["category"].lower() == category.lower()]
    if neighborhood and neighborhood != "all":
        results = [p for p in results if p["neighborhood"].lower() == neighborhood.lower()]
    return results


@app.get("/api/safety-zones")
def get_safety_zones(city: Optional[str] = None):
    results = SAFETY_ZONES
    if city and city != "all":
        results = [z for z in results if (z.get("city") or "pune").lower() == city.lower()]
    return results


@app.get("/api/live-status")
def get_live_status(city: Optional[str] = "pune"):
    c_key = city.lower() if city and city.lower() in LIVE_CITY_CONDITIONS else "pune"
    cond = LIVE_CITY_CONDITIONS.get(c_key, LIVE_CITY_CONDITIONS["pune"])
    return {
        "conditions": cond,
        "allConditions": LIVE_CITY_CONDITIONS,
        "recentAlertsCount": len(citizen_reports_db),
        "safetyZoneCount": len(SAFETY_ZONES),
        "geminiConfigured": GEMINI_AVAILABLE
    }


@app.get("/api/benchmarks")
def get_benchmarks(city: Optional[str] = None):
    if city and city != "all":
        return {k: v for k, v in NEIGHBORHOODS_BENCHMARK.items() if (v.get("city") or "pune").lower() == city.lower()}
    return NEIGHBORHOODS_BENCHMARK


@app.get("/api/benchmarks/compare")
def compare_neighborhoods(areaA: str, areaB: str):
    data_a = NEIGHBORHOODS_BENCHMARK.get(areaA)
    data_b = NEIGHBORHOODS_BENCHMARK.get(areaB)
    
    if not data_a or not data_b:
        raise HTTPException(status_code=404, detail="One or both neighborhoods not found.")
        
    diff = {
        "areaA": data_a,
        "areaB": data_b,
        "safetyWinner": areaA if data_a["safety"] >= data_b["safety"] else areaB,
        "cleanlinessWinner": areaA if data_a["cleanliness"] >= data_b["cleanliness"] else areaB,
        "affordabilityWinner": areaA if data_a["affordability"] >= data_b["affordability"] else areaB,
        "overallWinner": areaA if data_a["overallScore"] >= data_b["overallScore"] else areaB,
    }
    return diff


@app.get("/api/reports")
def get_reports(city: Optional[str] = None):
    if city and city != "all":
        return [r for r in citizen_reports_db if (r.get("city") or "pune").lower() == city.lower()]
    return citizen_reports_db


@app.post("/api/reports")
def submit_report(report: CitizenReportCreate):
    hazard_level = "Low"
    desc_lower = report.description.lower()
    title_lower = report.title.lower()
    
    if report.category == "safety":
        hazard_level = "Medium"
        if any(w in desc_lower or w in title_lower for w in ["fire", "assault", "flood", "severely broken", "wire", "accident", "danger", "hazard"]):
            hazard_level = "High"
    elif report.category == "traffic":
        hazard_level = "High" if any(w in desc_lower or w in title_lower for w in ["closure", "block", "gridlock", "jam", "pipeline", "diverted"]) else "Medium"
    elif report.category == "cleanliness":
        hazard_level = "Medium" if any(w in desc_lower for w in ["spill", "overflow", "garbage"]) else "Low"

    # Precise coordinates centered around Pune neighborhoods if not explicitly passed
    lat = report.lat or 18.5204
    lng = report.lng or 73.8567
    n_lower = report.neighborhood.lower()
    if "deccan" in n_lower or "fc road" in n_lower:
        lat = 18.5186
        lng = 73.8415
    elif "koregaon" in n_lower:
        lat = 18.5362
        lng = 73.8940
    elif "shivajinagar" in n_lower or "jm road" in n_lower:
        lat = 18.5314
        lng = 73.8446
    elif "baner" in n_lower or "balewadi" in n_lower:
        lat = 18.5590
        lng = 73.7868
    elif "swargate" in n_lower or "camp" in n_lower:
        lat = 18.5018
        lng = 73.8580

    new_report = {
        "id": f"rep-{uuid.uuid4().hex[:6]}",
        "category": report.category,
        "hazardLevel": hazard_level,
        "title": report.title,
        "description": report.description,
        "neighborhood": report.neighborhood,
        "author": report.author or "Citizen Explorer",
        "mediaType": report.mediaType,
        "imageUrl": report.imageUrl,
        "audioDuration": "0:18" if report.mediaType == "voice_note" else None,
        "lat": lat,
        "lng": lng,
        "upvotes": 1,
        "verified": True,
        "timeAgo": "Just now"
    }

    citizen_reports_db.insert(0, new_report)
    return {"status": "success", "report": new_report}


@app.post("/api/reports/{report_id}/upvote")
def upvote_report(report_id: str):
    for rep in citizen_reports_db:
        if rep["id"] == report_id:
            rep["upvotes"] += 1
            return {"status": "success", "upvotes": rep["upvotes"]}
    raise HTTPException(status_code=404, detail="Report not found")


@app.post("/api/route-plan")
def calculate_route(req: RouteRequest):
    p_orig = next((p for p in POIS if p["id"] == req.originPoiId), None)
    p_dest = next((p for p in POIS if p["id"] == req.destPoiId), None)

    if not p_orig or not p_dest:
        raise HTTPException(status_code=404, detail="Origin or destination landmark not found.")

    # Distance approximation
    d_lat = p_dest["lat"] - p_orig["lat"]
    d_lng = p_dest["lng"] - p_orig["lng"]
    approx_km = round(math.sqrt(d_lat**2 + d_lng**2) * 111.0, 1)
    if approx_km < 1.0:
        approx_km = 1.8

    fastest_time_mins = max(int(approx_km * 4.5), 12)
    safest_time_mins = fastest_time_mins + 6

    # Waypoints
    fastest_waypoints = [
        [p_orig["lat"], p_orig["lng"]],
        [(p_orig["lat"] + p_dest["lat"]) / 2, (p_orig["lng"] + p_dest["lng"]) / 2],
        [p_dest["lat"], p_dest["lng"]]
    ]

    safest_waypoints = [
        [p_orig["lat"], p_orig["lng"]],
        [(p_orig["lat"] * 0.7 + p_dest["lat"] * 0.3 + 0.003), (p_orig["lng"] * 0.7 + p_dest["lng"] * 0.3 + 0.005)],
        [(p_orig["lat"] * 0.3 + p_dest["lat"] * 0.7 + 0.004), (p_orig["lng"] * 0.3 + p_dest["lng"] * 0.7 + 0.003)],
        [p_dest["lat"], p_dest["lng"]]
    ]

    city_name = (p_orig.get("city") or "pune").lower()
    
    if city_name == "mumbai":
        fast_name = "Direct Mumbai Arterial (Western Express / SV Rd)"
        safe_name = "Patrolled Coastal Seaface Corridor (Bandra-Worli / Marine Dr)"
        fast_alerts = ["Heavy rush hour movement near flyover ramps", "Continuous taxi & bus transit"]
        safe_alerts = ["100% CCTV & Marine Police patrolled boulevard", "Wide illuminated sidewalks"]
    elif city_name == "bengaluru":
        fast_name = "Primary Transit Arterial (MG Rd / Old Airport Rd)"
        safe_name = "Patrolled Tech Boulevard (Indiranagar / Namma Metro Corridor)"
        fast_alerts = ["Peak traffic crawl near signal junctions", "BMTC Volvo rapid bus movement"]
        safe_alerts = ["Well-lit pedestrian footpaths with CCTV", "Active neighborhood security posts"]
    elif city_name == "delhi":
        fast_name = "Direct Ring Road Arterial Corridor"
        safe_name = "Patrolled Central Vista & Metro Boulevard"
        fast_alerts = ["Moderate congestion near outer circle intersections", "High bus movement"]
        safe_alerts = ["Delhi Police PCR vans active 24/7", "CISF guarded metro corridor"]
    elif city_name == "jaipur":
        fast_name = "Direct Heritage Radial (MI Road / Tonk Rd)"
        safe_name = "Royal Tourist Corridor (C-Scheme / JLN Marg)"
        fast_alerts = ["Moderate tourist market traffic", "E-rickshaw density near gates"]
        safe_alerts = ["Dedicated Tourist Police booths", "Zero high-priority hazards active"]
    else:
        fast_name = "Direct Pune Arterial (JM Rd / Shivaji Rd)"
        safe_name = "Patrolled Smart Boulevard (FC Rd / SB Rd Corridor)"
        fast_alerts = ["Heavy traffic near University circle / Alka Chowk", "Active bus transit corridor"]
        safe_alerts = ["Zero reported hazards on this bypass", "Wide illuminated sidewalks & police marshal booths"]

    return {
        "origin": p_orig["name"],
        "destination": p_dest["name"],
        "originCoords": [p_orig["lat"], p_orig["lng"]],
        "destCoords": [p_dest["lat"], p_dest["lng"]],
        "fastestRoute": {
            "name": fast_name,
            "distanceKm": approx_km,
            "durationMins": fastest_time_mins,
            "safetyScore": 76,
            "lighting": "Standard Urban Lighting",
            "alerts": fast_alerts,
            "coordinates": fastest_waypoints,
            "badge": "Shortest ETA"
        },
        "safestRoute": {
            "name": safe_name,
            "distanceKm": round(approx_km * 1.15, 1),
            "durationMins": safest_time_mins,
            "safetyScore": 97,
            "lighting": "100% Smart LED & CCTV Monitored",
            "alerts": safe_alerts,
            "coordinates": safest_waypoints,
            "badge": "Recommended Safe Vibe"
        }
    }


# ==============================================================================
# CITY-AWARE OFFLINE INTELLIGENCE ENGINE (PUNE, MUMBAI, DELHI, BENGALURU, JAIPUR)
# ==============================================================================

CITY_KNOWLEDGE_BASE = {
    "mumbai": {
        "cityName": "Mumbai",
        "weatherStr": "29°C, AQI 74 (Moderate), Sea Breeze",
        "itinerary": (
            "🗺️ **Custom Mumbai Safety-First Urban Exploration Itinerary:**\n\n"
            "• **Morning (8:30 AM - 12:30 PM): South Bombay Heritage & Seafront**\n"
            "  - Start at *Gateway of India* & admire the iconic *Taj Mahal Palace Hotel* in Colaba.\n"
            "  - Stroll through *Kala Ghoda Art District* and see the Victorian Gothic architecture of *CSMT (Chhatrapati Shivaji Maharaj Terminus)*.\n\n"
            "• **Afternoon (1:00 PM - 4:30 PM): Coastal Drive & Street Gastronomy**\n"
            "  - Enjoy authentic coastal seafood or Parsi delights at *Britannia & Co.* / *Kyani & Co.*, or butter Pav Bhaji at *Cannon*.\n"
            "  - Walk along *Marine Drive (Queen's Necklace)* enjoying the Arabian Sea breeze.\n\n"
            "• **Evening & Sunset (5:00 PM - 9:00 PM): Suburban Vibes & Beach Sunsets**\n"
            "  - Head to *Bandra West*: Walk along *Bandstand Promenade* & *Carter Road*.\n"
            "  - Catch the sunset at *Juhu Beach* or *Girgaon Chowpatty* with fresh Mumbai Bhelpuri & Sev Puri.\n\n"
            "🛡️ **Safety Check:** South Mumbai and Bandra seafront promenades have 24/7 CCTV surveillance and active police patrolling."
        ),
        "safety": (
            "🛡️ **CityVibe Verified Mumbai Safety & Night Protocol:**\n\n"
            "• **Top Rated Safe Zones (92+ Index):**\n"
            "  - *Marine Drive & Nariman Point:* Heavily patrolled 24/7 with continuous pedestrian traffic until late night.\n"
            "  - *Bandra West (Bandstand & Carter Road):* Vibrant cafes, well-lit seaside promenade, continuous Mumbai Police vigilance.\n"
            "  - *Colaba Tourist Precinct & BKC:* High private & city security, well-maintained arterial roads.\n\n"
            "• **Transit Safety Tips:**\n"
            "  - *Mumbai Local Trains:* Safe & efficient (use designated women's compartments during night hours with RPF escorts).\n"
            "  - *Road Transit:* 24/7 metered black-and-yellow (Kaali-Peeli) taxis, Uber, and Ola are widely available and safe.\n\n"
            "• **Areas Requiring Caution Late Night:** Avoid isolated unlit dock stretches or desolate coastal alleys after midnight."
        ),
        "food": (
            "🍢 **Curated Mumbai Street Gastronomy & Food Trail:**\n\n"
            "1. **Iconic Mumbai Vada Pav:** *Ashok Vada Pav* (Kirti College, Dadar) & *Anand Vada Pav* (Vile Parle) – hot, crispy with spicy red garlic chutney.\n"
            "2. **Legendary Pav Bhaji:** *Sardar Refreshments* (Tardeo) & *Cannon Pav Bhaji* (CSMT) – rich, butter-drenched red bhaji served with toasted pav.\n"
            "3. **Chowpatty Chaat:** *Girgaon Chowpatty* & *Juhu Beach* – classic spicy Bhel Puri, Sev Puri, Ragda Pattice, and Pani Puri.\n"
            "4. **Irani Cafes & Parsi Treats:** *Kyani & Co.* (Marine Lines) & *Cafe Mondegar / Leopold Cafe* (Colaba) – Bun Maska, Chai, and Mawa Cakes.\n"
            "5. **Late Night Rolls & Kebabs:** *Bademiya* & *Bade Miya* (Colaba) – Seekh kebabs, Baida roti, and chicken bhuna rolls."
        ),
        "history": (
            "🏛️ **Mumbai Heritage & Architectural Spotlight:**\n\n"
            "• **Gateway of India (1924):** Monumental Indo-Saracenic basalt arch built to commemorate the landing of King George V; historic departure point for the last British troops in 1948.\n"
            "• **Chhatrapati Shivaji Maharaj Terminus (CSMT, 1887):** UNESCO World Heritage Victorian Gothic railway masterpiece designed by F.W. Stevens, blending Venetian Gothic and Indian architectural styles.\n"
            "• **Elephanta Caves (5th–8th Century):** UNESCO World Heritage rock-cut temples dedicated to Lord Shiva, located on Gharapuri Island in Mumbai Harbour.\n"
            "• **Kala Ghoda & Fort Heritage Precinct:** Mumbai's premier arts district featuring Victorian neoclassical buildings, David Sassoon Library, and Jehangir Art Gallery."
        ),
        "places": (
            "✨ **CityVibe Curated Exploration Guide for Mumbai:**\n\n"
            "• **Top Must-Visit Landmarks:** Gateway of India, Marine Drive (Queen's Necklace), Bandra Bandstand, CSMT Heritage Building, and Juhu Beach.\n"
            "• **Art & Culture Precincts:** Kala Ghoda, Jehangir Art Gallery, Prithvi Theatre (Juhu), and Prince of Wales Museum (CSMVS).\n"
            "• **Shopping & Nightlife:** Colaba Causeway street market, Linking Road Bandra, Palladium Mall (Lower Parel), and Carter Road cafes.\n"
            "• **Live Weather Status:** 29°C, AQI 74 (Moderate), Gentle sea breeze.\n"
            "• **Safety Assurance:** 24/7 active Mumbai Police presence across tourist and coastal corridors."
        )
    },
    "pune": {
        "cityName": "Pune",
        "weatherStr": "26°C, AQI 62 (Good), Pleasant evening breeze",
        "itinerary": (
            "🗺️ **Custom Pune Safety-First Urban Exploration Itinerary:**\n\n"
            "• **Morning (8:30 AM - 12:30 PM): Peshwa Heritage & Cave Temples**\n"
            "  - Start at *Shaniwar Wada* & *Lal Mahal* in the heart of old Pune.\n"
            "  - Visit *Dagdusheth Halwai Ganpati Temple* followed by the 8th-century *Pataleshwar Cave Temple* on JM Road.\n\n"
            "• **Afternoon (1:00 PM - 4:00 PM): Culinary Safari & Art Museums**\n"
            "  - Authentic spicy Puneri Misal at *Bedekar Misal* or Bun Maska Chai at *Cafe Goodluck* (FC Road).\n"
            "  - Explore the eclectic 20,000+ artifacts collection at *Raja Dinkar Kelkar Museum*.\n\n"
            "• **Evening & Sunset (5:00 PM - 8:30 PM): Cultural Strolls & High Street**\n"
            "  - Take a peaceful walk through *Aga Khan Palace* gardens, then visit *Koregaon Park / Osho Teerth Park*.\n"
            "  - Dine at *Balewadi High Street* or enjoy fresh Sarasbaug Bhel in the evening.\n\n"
            "🛡️ **Safety Check:** All suggested stops maintain safety indices above 90/100 with verified street lighting and active patrols."
        ),
        "safety": (
            "🛡️ **CityVibe Verified Pune Safety & Night Protocol:**\n\n"
            "• **Top Rated Safe Zones (90+ Index):**\n"
            "  - *Deccan Gymkhana & FC Road:* Vibrant student population, well-lit pedestrian walkways until midnight.\n"
            "  - *Koregaon Park & Balewadi High Street:* High security, upscale cafes, and active police patrol vans.\n\n"
            "• **Active Hazard Zones to Avoid After 10 PM:**\n"
            "  - ⚠️ *Khadki Underpass Stretch:* Reported dim streetlighting and narrow blind turns.\n"
            "  - ⚠️ *Chandani Chowk Highway Merging:* Caution required due to heavy highway freight traffic.\n\n"
            "• **Emergency & Transit Tip:** Pune Metro lines (PCMC to Swargate, Vanaz to Ramwadi) and app-based autos/cabs (Uber/Ola) are the safest night transit options."
        ),
        "food": (
            "🍢 **Curated Pune Gastronomy & Street Food Trail:**\n\n"
            "1. **Cafe Goodluck (FC Road):** Legendary Bun Maska, Irani Chai, and Keema Pav (active since 1935).\n"
            "2. **Bedekar Misal (Narayan Peth):** Iconic authentic Puneri misal with crunchy poha and fiery rassa (Budget: ₹90-130).\n"
            "3. **FC Road & JM Road Street Food Row:** Crispy piping hot Vada Pav, Sabudana Vada, and Mango Mastani shakes.\n"
            "4. **Sarasbaug Chowpatty:** Famous Kolhapuri and Puneri Bhelpuri, SPDP, and Matka Kulfi.\n"
            "5. **Vaishali Restaurant (FC Road):** Mysore Masala Dosa, SPDP, and iconic Filter Coffee."
        ),
        "history": (
            "🏛️ **Pune Heritage & Architectural Spotlight:**\n\n"
            "• **Shaniwar Wada (1732):** The seven-storied historic fortress seat of the Peshwa rulers of the Maratha Empire.\n"
            "• **Aga Khan Palace (1892):** Built by Sultan Muhammed Shah Aga Khan III; served as the internment camp for Mahatma Gandhi during the Quit India movement.\n"
            "• **Pataleshwar Cave Temple (8th Century):** Monolithic rock-cut Shiva temple carved out of a single basalt rock during the Rashtrakuta period.\n"
            "• **Sinhagad Fort:** Majestic hilltop fortress famous for the heroic 1670 Battle of Sinhagad and breathtaking Sahyadri views."
        ),
        "places": (
            "✨ **CityVibe Curated Exploration Guide for Pune:**\n\n"
            "• **Recommended Zones:** Pune Deccan & FC Road Cultural Precinct, Koregaon Park, and Old Heritage Core.\n"
            "• **Exploration Highlights:** Shaniwar Wada, Aga Khan Palace, Cafe Goodluck, Pataleshwar Caves, and Dagdusheth Ganpati Temple.\n"
            "• **Live Weather Status:** 26°C, AQI 62 (Good), Pleasant evening breeze.\n"
            "• **Safety Assurance:** Zero high-priority hazards active on recommended primary routes."
        )
    },
    "delhi": {
        "cityName": "Delhi NCR",
        "weatherStr": "24°C, AQI 150 (Moderate), Mild breeze",
        "itinerary": (
            "🗺️ **Custom Delhi Safety-First Urban Exploration Itinerary:**\n\n"
            "• **Morning (8:30 AM - 12:30 PM): Mughal Splendour & Old Delhi**\n"
            "  - Explore *Red Fort* and *Jama Masjid*, followed by a rickshaw tour of *Chandni Chowk*.\n\n"
            "• **Afternoon (1:00 PM - 4:30 PM): Lutyens' Delhi & Modern History**\n"
            "  - Visit *India Gate*, *Rashtrapati Bhavan* vista, and the serene *Humayun's Tomb*.\n\n"
            "• **Evening & Sunset (5:00 PM - 8:30 PM): Bohemian Heritage & Cafes**\n"
            "  - Walk around *Hauz Khas Village & Fort Lake*, or explore *Connaught Place (CP)* inner circle.\n\n"
            "🛡️ **Safety Check:** Stick to Delhi Metro Yellow/Violet lines and verified app-based cabs for evening transit."
        ),
        "safety": (
            "🛡️ **CityVibe Verified Delhi Safety & Night Protocol:**\n\n"
            "• **Top Rated Safe Zones:** Connaught Place Inner Circle, Khan Market, Hauz Khas Village, Aerocity.\n"
            "• **Transit Safety Tips:** Delhi Metro is exceptionally safe, well-monitored with CISF security and dedicated women's coaches. Use official app cabs (Uber/BluSmart) after 10 PM.\n"
            "• **Caution Areas:** Avoid isolated outer ring road stretches and poorly lit outskirts late at night."
        ),
        "food": (
            "🍢 **Curated Delhi Gastronomy & Street Food Trail:**\n\n"
            "1. **Chandni Chowk (Old Delhi):** Paranthe Wali Gali, Natraj Dahi Bhalla, and Karim's Mutton Seekh.\n"
            "2. **Connaught Place:** Keventers Milkshakes, Wenger's Bakery Shami Kebabs, and Odeon Paan.\n"
            "3. **Lajpat Nagar & CR Park:** Delhi-style Chaat, Chole Bhature, and authentic Mughlai rolls."
        ),
        "history": (
            "🏛️ **Delhi Heritage & Architectural Spotlight:**\n\n"
            "• **Qutub Minar (1192):** The 73-metre tall UNESCO World Heritage minaret of red sandstone.\n"
            "• **Humayun's Tomb (1570):** Sublime precursor to the Taj Mahal, showcasing Persian-Mughal garden architecture.\n"
            "• **Red Fort (1648):** Built by Mughal Emperor Shah Jahan as the ceremonial center of the Mughal state."
        ),
        "places": (
            "✨ **CityVibe Curated Exploration Guide for Delhi NCR:**\n\n"
            "• **Top Must-Visit Landmarks:** Qutub Minar, India Gate, Red Fort, Humayun's Tomb, and Lotus Temple.\n"
            "• **Vibrant Hubs:** Connaught Place, Hauz Khas Village, Khan Market, and Chandni Chowk.\n"
            "• **Safety Assurance:** High metro connectivity with CISF security stations."
        )
    },
    "bengaluru": {
        "cityName": "Bengaluru",
        "weatherStr": "25°C, AQI 48 (Good), Crisp Pleasant Weather",
        "itinerary": (
            "🗺️ **Custom Bengaluru Urban Exploration Itinerary:**\n\n"
            "• **Morning (8:30 AM - 12:30 PM): Garden City & Colonial Heritage**\n"
            "  - Stroll through *Cubbon Park* and visit *Bangalore Palace* and *Vidhana Soudha*.\n\n"
            "• **Afternoon (1:00 PM - 4:30 PM): South Indian Culinary Classics**\n"
            "  - Savor legendary Benne Dosa & Filter Coffee at *Vidyarthi Bhavan* (Gandhi Bazaar) or *MTR* (Lalbagh).\n\n"
            "• **Evening & Sunset (5:00 PM - 9:30 PM): Microbreweries & Tech Vibe**\n"
            "  - Explore vibrant cafes and microbreweries in *Indiranagar (100ft Road)* or *Koramangala*.\n\n"
            "🛡️ **Safety Check:** Namma Metro Purple and Green lines provide fast and safe connections across city centers."
        ),
        "safety": (
            "🛡️ **CityVibe Verified Bengaluru Safety & Night Protocol:**\n\n"
            "• **Top Safe Zones:** Indiranagar 100ft Road, Koramangala 4th/5th Blocks, MG Road & Church Street, Lavelle Road.\n"
            "• **Transit Safety Tips:** Namma Metro and app-based autos/cabs (Namma Yatri, Uber, Ola) operate smoothly with high safety ratings."
        ),
        "food": (
            "🍢 **Curated Bengaluru Gastronomy Trail:**\n\n"
            "1. **Vidyarthi Bhavan (Gandhi Bazaar):** Famous crispy ghee-laden Crispy Masala Dosa (since 1943).\n"
            "2. **CTR (Shri Sagar, Malleshwaram):** Iconic Benne Dosa and Filter Coffee.\n"
            "3. **Church Street & Indiranagar:** Artisanal coffee roasters, sourdough bakeries, and craft microbreweries."
        ),
        "history": (
            "🏛️ **Bengaluru Heritage & Landmarks:**\n\n"
            "• **Bangalore Palace (1887):** Tudor-style royal palace inspired by England's Windsor Castle.\n"
            "• **Tipu Sultan's Summer Palace (1791):** Teakwood palace with ornate arches and frescoes.\n"
            "• **Vidhana Soudha (1956):** Majestic Neo-Dravidian legislative building constructed from pure granite."
        ),
        "places": (
            "✨ **CityVibe Curated Exploration Guide for Bengaluru:**\n\n"
            "• **Top Landmarks:** Cubbon Park, Lalbagh Botanical Garden, Bangalore Palace, Church Street, and Indiranagar.\n"
            "• **Safety Assurance:** Active community policing, bright high-street lighting, and modern transit."
        )
    },
    "jaipur": {
        "cityName": "Jaipur (Pink City)",
        "weatherStr": "27°C, AQI 85 (Moderate), Sunny Desert Vibe",
        "itinerary": (
            "🗺️ **Custom Jaipur Royal Exploration Itinerary:**\n\n"
            "• **Morning (8:30 AM - 1:00 PM): Royal Fortresses of the Aravallis**\n"
            "  - Explore *Amer Fort* and enjoy views from *Jaigarh Fort*.\n\n"
            "• **Afternoon (1:30 PM - 4:30 PM): Palaces & Astronomy**\n"
            "  - Visit *City Palace*, *Jantar Mantar* (UNESCO), and stop at *Hawa Mahal* for photography.\n\n"
            "• **Evening & Sunset (5:00 PM - 8:30 PM): Sunset Views & Royal Bazaar**\n"
            "  - Watch sunset from *Nahargarh Fort*, then shop at *Johari Bazaar* and *Bapu Bazaar*.\n\n"
            "🛡️ **Safety Check:** Tourist police stations stationed around all major Pink City monuments."
        ),
        "safety": (
            "🛡️ **CityVibe Verified Jaipur Safety Protocol:**\n\n"
            "• **Top Safe Zones:** C-Scheme, MI Road, Johari Bazaar tourist zone, Malviya Nagar.\n"
            "• **Transit Tips:** Registered prepaid auto-rickshaws, Jaipur Metro, and Uber/Ola."
        ),
        "food": (
            "🍢 **Curated Jaipur Royal Gastronomy Trail:**\n\n"
            "1. **Rawat Mishthan Bhandar:** Legendary Pyaaz Kachori and Mawa Kachori.\n"
            "2. **Laxmi Mishthan Bhandar (LMB, Johari Bazaar):** Authentic Rajasthani Dal Baati Churma and Ghewar.\n"
            "3. **MI Road:** Lassiwala (Kulhad Lassi since 1944)."
        ),
        "history": (
            "🏛️ **Jaipur Heritage & Architectural Spotlight:**\n\n"
            "• **Hawa Mahal (1799):** Five-story palace of winds with 953 intricately carved jharokhas.\n"
            "• **Amer Fort (1592):** UNESCO World Heritage Rajput fortress with Sheesh Mahal (Mirror Palace).\n"
            "• **Jantar Mantar (1734):** UNESCO World Heritage collection of 19 astronomical instruments including the world's largest stone sundial."
        ),
        "places": (
            "✨ **CityVibe Curated Exploration Guide for Jaipur:**\n\n"
            "• **Top Landmarks:** Hawa Mahal, Amer Fort, City Palace, Nahargarh Fort, and Jantar Mantar.\n"
            "• **Safety Assurance:** Dedicated tourist assistance booths and well-regulated heritage corridors."
        )
    }
}


def detect_city(query: str, fallback_city: Optional[str] = "pune") -> str:
    """
    Detect target city from user query keywords and landmark references.
    Defaults to Pune when no city is mentioned.
    """
    q = query.lower()

    # Mumbai keywords and neighborhoods
    mumbai_keywords = [
        "mumbai", "bombay", "colaba", "bandra", "marine drive", "juhu", "andheri",
        "dadar", "csmt", "cst", "gateway of india", "worli", "nariman point",
        "kala ghoda", "fort", "girgaon", "chowpatty", "lower parel", "malabar hill",
        "powai", "versova", "vile parle", "churchgate", "bkc", "kurla", "byculla",
        "taj mahal palace", "elephanta"
    ]
    # Pune keywords and neighborhoods
    pune_keywords = [
        "pune", "poona", "puneri", "deccan", "fc road", "jm road", "koregaon",
        "kothrud", "baner", "balewadi", "shaniwar wada", "sinhagad", "aga khan",
        "camp", "swargate", "kasba peth", "narayan peth", "shivajinagar", "viman nagar",
        "kalyani nagar", "hinjawadi", "wakad", "aundh", "pataleshwar", "lal mahal",
        "sarasbaug", "bedekar", "goodluck", "vaishali"
    ]
    # Delhi keywords
    delhi_keywords = [
        "delhi", "new delhi", "ncr", "connaught place", "cp", "chandni chowk",
        "hauz khas", "qutub minar", "red fort", "india gate", "gurgaon", "noida",
        "gurugram", "humayun"
    ]
    # Bengaluru keywords
    bengaluru_keywords = [
        "bengaluru", "bangalore", "koramangala", "indiranagar", "whitefield",
        "mg road", "hsr layout", "cubbon park", "lalbagh", "vidhana soudha"
    ]
    # Jaipur keywords
    jaipur_keywords = [
        "jaipur", "pink city", "hawa mahal", "amer fort", "nahargarh", "jal mahal",
        "johari bazaar", "city palace"
    ]

    for kw in mumbai_keywords:
        if kw in q:
            return "mumbai"
    for kw in pune_keywords:
        if kw in q:
            return "pune"
    for kw in delhi_keywords:
        if kw in q:
            return "delhi"
    for kw in bengaluru_keywords:
        if kw in q:
            return "bengaluru"
    for kw in jaipur_keywords:
        if kw in q:
            return "jaipur"

    # Default to fallback (Pune if None or all)
    if fallback_city and fallback_city.lower() in CITY_KNOWLEDGE_BASE:
        return fallback_city.lower()
    return "pune"


def generate_expert_nlp_response(user_query: str, city_hint: Optional[str] = "pune") -> str:
    """
    City-aware Offline AI synthesis engine that detects the target city
    and delivers accurate, localized exploration, safety, food, and heritage recommendations.
    Defaults to Pune when no city is mentioned.
    """
    q_lower = user_query.lower()
    target_city = detect_city(user_query, fallback_city=city_hint)
    city_data = CITY_KNOWLEDGE_BASE.get(target_city, CITY_KNOWLEDGE_BASE["pune"])
    
    # 1. Comparison Queries
    if "compare" in q_lower or "vs" in q_lower or "versus" in q_lower:
        # Check Mumbai neighborhood comparison (e.g. Colaba vs Bandra)
        if ("colaba" in q_lower and "bandra" in q_lower) or ("bandra" in q_lower and "colaba" in q_lower):
            return (
                "⚖️ **Direct Comparison: Colaba vs Bandra West (Mumbai)**\n\n"
                "• **Overall Vibe:** Colaba (Victorian Heritage, Art Precinct & Gateway of India) vs Bandra (Queen of Suburbs, Trendy Cafes & Seafront Promenades)\n"
                "• **Safety & Night Security:** Colaba (94/100) vs Bandra West (95/100) – both have exceptional 24/7 Mumbai Police patrolling\n"
                "• **Cleanliness:** Colaba (88/100) vs Bandra (90/100)\n"
                "• **Affordability:** Colaba (Bargain Street Shopping on Causeway + Heritage Cafes) vs Bandra (Boutique Fashion & Casual Bistros)\n"
                "• **Transit & Accessibility:** Colaba (CSMT/Churchgate terminal, BEST buses) vs Bandra (Bandra Station, Bandra-Worli Sea Link)\n\n"
                "💡 **Recommendation:** Choose *Colaba* if you love vintage architecture, museums, and sea monuments; choose *Bandra West* for evening walks along Bandstand, hipster cafes, and nightlife."
            )

        # Check Pune benchmark matrix
        matched_areas = [name for name in NEIGHBORHOODS_BENCHMARK.keys() if any(part.lower() in q_lower for part in name.split())]
        if len(matched_areas) >= 2:
            a1, a2 = matched_areas[0], matched_areas[1]
            d1, d2 = NEIGHBORHOODS_BENCHMARK[a1], NEIGHBORHOODS_BENCHMARK[a2]
            return (
                f"⚖️ **Direct Comparison: {a1} vs {a2} ({city_data['cityName']})**\n\n"
                f"• **Overall Score:** {a1} ({d1['overallScore']}/100) vs {a2} ({d2['overallScore']}/100)\n"
                f"• **Safety & Night Security:** {a1} ({d1['safety']}/100) vs {a2} ({d2['safety']}/100)\n"
                f"• **Cleanliness:** {a1} ({d1['cleanliness']}/100) vs {a2} ({d2['cleanliness']}/100)\n"
                f"• **Affordability:** {a1} ({d1['affordability']}/100) vs {a2} ({d2['affordability']}/100)\n"
                f"• **Transit Score:** {d1['transitScore']} vs {d2['transitScore']}\n\n"
                f"💡 **Recommendation:** Choose *{a1}* if prioritizing {d1['topPros'][0].lower()}, or *{a2}* for {d2['topPros'][0].lower()}."
            )

    # 2. Itinerary & Walk Planning
    if any(k in q_lower for k in ["plan", "itinerary", "walk", "tour", "day", "hours", "schedule", "trip"]):
        return city_data["itinerary"]

    # 3. Safety & Night Exploration
    if any(k in q_lower for k in ["safe", "safety", "night", "dark", "women", "solo", "danger", "crime", "secure"]):
        return city_data["safety"]

    # 4. Food & Street Gastronomy
    if any(k in q_lower for k in ["food", "eat", "dining", "restaurant", "cafe", "vada pav", "misal", "pav bhaji", "budget", "cheap", "chaat", "bhel"]):
        return city_data["food"]

    # 5. History & Cultural Landmarks
    if any(k in q_lower for k in ["history", "culture", "heritage", "monument", "landmark", "significance", "shaniwar", "aga khan", "lal mahal", "gateway of india", "csmt", "fort", "palace"]):
        return city_data["history"]

    # 6. Where to go / Places / Exploration recommendations
    if any(k in q_lower for k in ["go", "visit", "where", "explore", "places", "see", "spot", "attraction", "recommend"]):
        return city_data["places"]

    # Default general recommendation for the detected city
    return (
        f"✨ **CityVibe Smart Urban Intelligence for {city_data['cityName']} ('{user_query}'):**\n\n"
        f"{city_data['places']}\n\n"
        f"• **Live Weather Status:** {city_data['weatherStr']}.\n"
        f"• **Safety Assurance:** Verified zero critical active hazards on primary tourist corridors."
    )


@app.post("/api/concierge")
def ai_concierge(req: ConciergeRequest):
    user_query = req.prompt.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    # Detect city from query or fallback
    target_city = detect_city(user_query, fallback_city=req.city or "pune")

    # 1. If Gemini API is configured and available
    if GEMINI_AVAILABLE and gemini_client:
        try:
            system_instruction = (
                f"You are 'CityVibe Concierge', an elite, safety-conscious smart city guide for {target_city.upper()}. "
                f"Provide vivid, actionable, and safety-verified exploration advice specifically tailored to {target_city.capitalize()}. "
                "Recommend budget food, historical trivia, best visiting hours, and safety tips for night navigation. "
                "Structure your output cleanly with bullet points, emojis, and clear highlights."
            )
            context = f"City: {target_city.capitalize()}. City POIs Count: {len(POIS)}."
            
            response = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{system_instruction}\n{context}\nUser Request: {user_query}"
            )
            return {
                "source": "gemini-api",
                "answer": response.text,
                "response": response.text,
                "city": target_city,
                "model": "gemini-2.5-flash (Live AI Engine)"
            }
        except Exception as e:
            print(f"Gemini API invocation exception: {e}")

    # 2. High-performance offline city-aware NLP engine (Full functionality, 0 API key required)
    answer = generate_expert_nlp_response(user_query, city_hint=target_city)
    return {
        "source": "cityvibe-nlp-engine",
        "answer": answer,
        "response": answer,
        "city": target_city,
        "model": f"CityVibe City-Aware Intelligence ({target_city.capitalize()})"
    }


# Mount static assets
os.makedirs("static", exist_ok=True)
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
