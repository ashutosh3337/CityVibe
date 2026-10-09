"""
CityVibe Automated Test Suite
Verifies all 6 hackathon pillars, REST API endpoints, edge cases,
safe routing simulator, benchmark comparator, report submission, and NLP synthesis.
"""

import sys
import json
import urllib.request
import urllib.error

# Force UTF-8 on Windows terminal
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("========================================")
    print("🚀 Starting CityVibe Technical Test Suite")
    print("========================================")
    passed = 0
    failed = 0

    # Test 1: Health Check & System Status
    try:
        res = urllib.request.urlopen(f"{BASE_URL}/api/health")
        data = json.loads(res.read().decode())
        assert res.status == 200
        assert data["status"] == "healthy"
        assert data["activePoisCount"] >= 8
        assert data["activeHazardZonesCount"] >= 4
        print("✅ [1/8] Health Check & Diagnostics API: PASSED")
        passed += 1
    except Exception as e:
        print(f"❌ [1/8] Health Check API: FAILED ({e})")
        failed += 1

    # Test 2: Exploration POIs & Category Filtering
    try:
        res_all = urllib.request.urlopen(f"{BASE_URL}/api/pois")
        data_all = json.loads(res_all.read().decode())
        assert len(data_all) >= 8

        res_food = urllib.request.urlopen(f"{BASE_URL}/api/pois?category=food")
        data_food = json.loads(res_food.read().decode())
        assert len(data_food) >= 2
        assert all(p["category"] == "food" for p in data_food)
        print("✅ [2/8] POI Exploration & Filtering: PASSED")
        passed += 1
    except Exception as e:
        print(f"❌ [2/8] POI Exploration API: FAILED ({e})")
        failed += 1

    # Test 3: Safety Hazard Zones
    try:
        res_safety = urllib.request.urlopen(f"{BASE_URL}/api/safety-zones")
        data_safety = json.loads(res_safety.read().decode())
        assert len(data_safety) >= 4
        assert any(z["type"] == "Accident-Prone Zone" for z in data_safety)
        assert any("Waterlogging" in z["type"] for z in data_safety)
        print("✅ [3/8] Safety & Hazard Zones Intelligence: PASSED")
        passed += 1
    except Exception as e:
        print(f"❌ [3/8] Safety Zones API: FAILED ({e})")
        failed += 1

    # Test 4: Neighborhood Benchmarking & Comparison
    try:
        res_bench = urllib.request.urlopen(f"{BASE_URL}/api/benchmarks/compare?areaA=Deccan%20%26%20FC%20Road&areaB=Koregaon%20Park")
        data_bench = json.loads(res_bench.read().decode())
        assert "areaA" in data_bench
        assert "areaB" in data_bench
        assert "overallWinner" in data_bench
        print("✅ [4/8] Best vs. Worst 5-Pillar Comparator: PASSED")
        passed += 1
    except Exception as e:
        print(f"❌ [4/8] Benchmarking API: FAILED ({e})")
        failed += 1

    # Test 5: Safe Route Simulator
    try:
        payload = json.dumps({"originPoiId": "poi-1", "destPoiId": "poi-4"}).encode()
        req = urllib.request.Request(f"{BASE_URL}/api/route-plan", data=payload, headers={"Content-Type": "application/json"})
        res_route = urllib.request.urlopen(req)
        data_route = json.loads(res_route.read().decode())
        assert data_route["safestRoute"]["safetyScore"] > data_route["fastestRoute"]["safetyScore"]
        assert len(data_route["safestRoute"]["coordinates"]) >= 3
        print("✅ [5/8] Safe vs. Fast Route Simulator: PASSED")
        passed += 1
    except Exception as e:
        print(f"❌ [5/8] Safe Route API: FAILED ({e})")
        failed += 1

    # Test 6: Multimodal Citizen Report Submission & Upvoting
    try:
        report_payload = json.dumps({
            "category": "safety",
            "neighborhood": "Deccan & FC Road",
            "title": "Severe road waterlogging near promenade",
            "description": "Rising flood water due to high tide and heavy drain overflow.",
            "mediaType": "voice_note"
        }).encode()
        req_rep = urllib.request.Request(f"{BASE_URL}/api/reports", data=report_payload, headers={"Content-Type": "application/json"})
        res_rep = urllib.request.urlopen(req_rep)
        data_rep = json.loads(res_rep.read().decode())
        assert data_rep["status"] == "success"
        new_id = data_rep["report"]["id"]
        assert data_rep["report"]["hazardLevel"] == "High" # NLP Auto-triage

        # Test Upvote
        req_upvote = urllib.request.Request(f"{BASE_URL}/api/reports/{new_id}/upvote", data=b"", headers={"Content-Type": "application/json"})
        res_upvote = urllib.request.urlopen(req_upvote)
        data_upvote = json.loads(res_upvote.read().decode())
        assert data_upvote["upvotes"] == 2
        print("✅ [6/8] Multimodal Citizen Report & NLP Triage: PASSED")
        passed += 1
    except Exception as e:
        print(f"❌ [6/8] Citizen Reporting API: FAILED ({e})")
        failed += 1

    # Test 7: AI City Concierge & NLP Synthesis (Zero Key Required)
    try:
        test_queries = [
            "Plan a 4-hour budget walk in Colaba with safe food",
            "What are the safest night areas in Bandra?",
            "Compare Colaba and Bandra West for safety and transit",
            "Tell me the historical significance of Gateway of India and CSMT"
        ]
        for q in test_queries:
            q_payload = json.dumps({"prompt": q}).encode("utf-8")
            req_q = urllib.request.Request(f"{BASE_URL}/api/concierge", data=q_payload, headers={"Content-Type": "application/json"})
            res_q = urllib.request.urlopen(req_q)
            data_q = json.loads(res_q.read().decode("utf-8"))
            assert len(data_q["answer"]) > 50
            assert "model" in data_q

        print("✅ [7/8] AI Concierge & Offline/Online Synthesis: PASSED")
        passed += 1
    except Exception as e:
        print(f"❌ [7/8] AI Concierge API: FAILED ({e})")
        failed += 1

    # Test 8: Edge Cases & Validation Handling
    try:
        # 1. Blank concierge prompt -> 400
        try:
            req_bad = urllib.request.Request(f"{BASE_URL}/api/concierge", data=json.dumps({"prompt": ""}).encode(), headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req_bad)
            assert False, "Should fail on empty prompt"
        except urllib.error.HTTPError as he:
            assert he.code == 400

        # 2. Non-existent POI routing -> 404
        try:
            req_bad_route = urllib.request.Request(f"{BASE_URL}/api/route-plan", data=json.dumps({"originPoiId": "non-existent", "destPoiId": "poi-1"}).encode(), headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req_bad_route)
            assert False, "Should fail on invalid POI ID"
        except urllib.error.HTTPError as he:
            assert he.code == 404

        print("✅ [8/8] Error Handling & Edge Cases: PASSED")
        passed += 1
    except Exception as e:
        print(f"❌ [8/8] Edge Cases Validation: FAILED ({e})")
        failed += 1

    print("========================================")
    print(f"📊 Test Results: {passed}/8 PASSED, {failed} FAILED")
    print("========================================")
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
