#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.request
import time
from datetime import datetime
import os
import threading

PORTFOLIO = {
    "TSM": {"weight": 0.10, "entry": 357, "tier": "AI Core"},
    "AVGO": {"weight": 0.15, "entry": 340, "tier": "AI Core"},
    "SNDK": {"weight": 0.05, "entry": 620, "tier": "AI Core"},
    "META": {"weight": 0.08, "entry": 661, "tier": "Platform"},
    "AAPL": {"weight": 0.05, "entry": 220, "tier": "Platform"},
    "KKR": {"weight": 0.03, "entry": 150, "tier": "Financial"},
    "VST": {"weight": 0.08, "entry": 145, "tier": "AI Energy"},
    "CEG": {"weight": 0.07, "entry": 280, "tier": "AI Energy"},
    "LNG": {"weight": 0.10, "entry": 234, "tier": "Energy"},
    "FCX": {"weight": 0.10, "entry": 44, "tier": "Commodity"},
    "MPWR": {"weight": 0.05, "entry": 885, "tier": "Infrastructure"},
    "GLD": {"weight": 0.05, "entry": 265, "tier": "Hedge"},
    "TLT": {"weight": 0.12, "entry": 87, "tier": "Hedge"},
    "CASH": {"weight": 0.01, "entry": 1, "tier": "Cash"}
}


CAPITAL = 100000
data_cache = {"data": None, "last_update": 0}

def calculate_regime_score(qqq_spx, vix, correlation, put_call_ratio, sector_leader):
    score = 0
    if qqq_spx > 0.092: score += 30
    elif qqq_spx > 0.090: score += 20
    elif qqq_spx > 0.088: score += 10
    elif qqq_spx > 0.086: score += 0
    else: score -= 30
    if vix < 15: score += 25
    elif vix < 20: score += 15
    elif vix < 25: score += 0
    elif vix < 30: score -= 15
    else: score -= 25
    if correlation < 0.3: score += 20
    elif correlation < 0.5: score += 10
    elif correlation < 0.7: score -= 10
    else: score -= 20
    if put_call_ratio < 0.8: score += 15
    elif put_call_ratio < 1.2: score += 0
    elif put_call_ratio < 1.5: score -= 5
    else: score -= 15
    if sector_leader == "XLK": score += 10
    elif sector_leader in ["XLI", "XLE"]: score += 5
    elif sector_leader in ["XLV", "XLU"]: score -= 10
    if score >= 60: regime, color, action = "BROAD_RISK_APPETITE", "#00ff88", "AGGRESSIVE"
    elif score >= 20: regime, color, action = "SELECTIVE_ROTATION_BULLISH", "#a8ff78", "GROWTH"
    elif score >= -20: regime, color, action = "SELECTIVE_ROTATION_NEUTRAL", "#ffaa00", "SELECTIVE"
    elif score >= -60: regime, color, action = "SELECTIVE_ROTATION_DEFENSIVE", "#ff8c00", "DEFENSIVE"
    else: regime, color, action = "SYSTEMIK_RISK", "#ff2b2b", "MAX_DEFENSIVE"
    return {"score": score, "regime": regime, "color": color, "action": action, "breakdown": {"qqq_spx": qqq_spx, "vix": vix, "correlation": correlation, "put_call_ratio": put_call_ratio, "sector_leader": sector_leader}}

def fetch_json(url, timeout=10):
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0')
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except: return None

def fetch_stock_prices():
    print("Fetching prices...")
    prices = {}
    for ticker in PORTFOLIO.keys():
        if ticker == "CASH": prices[ticker] = 1.0; continue
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d"
            data = fetch_json(url)
            if data and 'chart' in data and 'result' in data['chart']:
                price = data['chart']['result'][0]['meta']['regularMarketPrice']
                prices[ticker] = price
                time.sleep(0.2)
            else: prices[ticker] = PORTFOLIO[ticker]["entry"]
        except: prices[ticker] = PORTFOLIO[ticker]["entry"]
    return prices

def fetch_macro_data():
    print("Fetching macro...")
    macro = {'vix': 25.65, 'dxy': 103.5, 'qqq_spx': 0.088}
    try:
        vix_url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d"
        vix_data = fetch_json(vix_url)
        if vix_data and 'chart' in vix_data:
            vix = vix_data['chart']['result'][0]['meta'].get('regularMarketPrice')
            if vix: macro['vix'] = round(vix, 2)
    except: pass
    return macro

def calculate_portfolio():
    prices = fetch_stock_prices()
    macro = fetch_macro_data()
    regime = calculate_regime_score(macro.get('qqq_spx', 0.088), macro.get('vix', 25.65), 0.30, 1.3, "XLI")
    positions = []
    total_value = 0
    total_pnl = 0
    for ticker, config in PORTFOLIO.items():
        current_price = prices.get(ticker, config["entry"])
        position_value = CAPITAL * config["weight"]
        shares = position_value / config["entry"]
        current_value = shares * current_price
        pnl = current_value - position_value
        pnl_pct = (pnl / position_value) * 100
        positions.append({"ticker": ticker, "entry": config["entry"], "current": round(current_price, 2), "weight": config["weight"], "tier": config["tier"], "value": round(current_value, 2), "pnl": round(pnl, 2), "pnl_pct": round(pnl_pct, 2), "shares": round(shares, 4)})
        total_value += current_value
        total_pnl += pnl
    return {"positions": positions, "total_value": round(total_value, 2), "total_pnl": round(total_pnl, 2), "total_pnl_pct": round((total_pnl / CAPITAL) * 100, 2), "macro": macro, "regime": regime, "timestamp": datetime.now().isoformat()}

def update_data_loop():
    while True:
        time.sleep(5 * 60)
        try:
            print(f"\nAuto-update {datetime.now().strftime('%H:%M:%S')}")
            data_cache["data"] = calculate_portfolio()
            data_cache["last_update"] = time.time()
            print("Updated!")
        except Exception as e: print(f"Error: {e}")

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        if self.path in ['/api/portfolio', '/data']:
            response = {"success": True, "data": data_cache["data"]} if data_cache["data"] else {"success": False, "error": "No data yet"}
            self.wfile.write(json.dumps(response, indent=2).encode())
        elif self.path == '/health': self.wfile.write(json.dumps({"status": "online", "timestamp": datetime.now().isoformat()}).encode())
        elif self.path == '/refresh': data_cache["data"] = calculate_portfolio(); data_cache["last_update"] = time.time(); self.wfile.write(json.dumps({"success": True, "data": data_cache["data"]}).encode())
        else: self.wfile.write(json.dumps({"error": "Not found"}).encode())
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    def log_message(self, format, *args): pass

def main():
    PORT = int(os.environ.get('PORT', 8080))
    print("="*60)
    print("DRUCK PORTFOLIO SERVER V2 - REGIME INTELLIGENCE")
    print("="*60)
    print(f"Port: {PORT}")
    print("="*60)
    print("\nInitial fetch...")
    data_cache["data"] = calculate_portfolio()
    data_cache["last_update"] = time.time()
    if data_cache["data"]:
        print(f"\nPortfolio: ${data_cache['data']['total_value']:,.0f}")
        print(f"P&L: ${data_cache['data']['total_pnl']:,.0f} ({data_cache['data']['total_pnl_pct']:.2f}%)")
        print(f"Regime: {data_cache['data']['regime']['regime']}")
        print(f"Score: {data_cache['data']['regime']['score']}")
        print(f"Action: {data_cache['data']['regime']['action']}")
    print(f"\nStarting server on port {PORT}...")
    server = HTTPServer(('0.0.0.0', PORT), RequestHandler)
    print("Server running!\n")
    update_thread = threading.Thread(target=update_data_loop, daemon=True)
    update_thread.start()
    try: server.serve_forever()
    except KeyboardInterrupt: print("\nStopped"); server.shutdown()

if __name__ == "__main__": main()
