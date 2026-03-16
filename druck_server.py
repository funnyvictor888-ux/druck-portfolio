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
    "META": {"weight": 0.08, "entry": 661, "tier": "Platform"},
    "VST": {"weight": 0.08, "entry": 145, "tier": "AI Energy"},
    "CEG": {"weight": 0.07, "entry": 280, "tier": "AI Energy"},
    "LNG": {"weight": 0.10, "entry": 234, "tier": "Energy"},
    "FCX": {"weight": 0.10, "entry": 44, "tier": "Commodity"},
    "MPWR": {"weight": 0.05, "entry": 885, "tier": "Infrastructure"},
    "CRDO": {"weight": 0.03, "entry": 115.98, "tier": "Infrastructure"},
    "GLD": {"weight": 0.05, "entry": 265, "tier": "Hedge"},
    "TLT": {"weight": 0.12, "entry": 87, "tier": "Hedge"},
    "CASH": {"weight": 0.11, "entry": 1, "tier": "Cash"}
}

CAPITAL = 100000
data_cache = {"data": None, "last_update": 0}

def fetch_json(url, timeout=10):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except: return None

def fetch_stock_prices():
    print("Fetching prices...")
    prices = {}
    for ticker in PORTFOLIO.keys():
        if ticker == "CASH":
            prices[ticker] = 1.0
            continue
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d"
            data = fetch_json(url)
            if data and 'chart' in data and 'result' in data['chart']:
                price = data['chart']['result'][0]['meta']['regularMarketPrice']
                prices[ticker] = price
                time.sleep(0.1)
        except:
            prices[ticker] = PORTFOLIO[ticker]["entry"]
    return prices

def fetch_macro_data():
    print("Fetching macro...")
    try:
        vix_url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d"
        vix_data = fetch_json(vix_url)
        vix = vix_data['chart']['result'][0]['meta']['regularMarketPrice'] if vix_data else 25.65
        return {'vix': vix, 'dxy': 103.5}
    except:
        return {'vix': 25.65, 'dxy': 103.5}

def calculate_portfolio():
    prices = fetch_stock_prices()
    macro = fetch_macro_data()
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
        
        positions.append({
            "ticker": ticker,
            "entry": config["entry"],
            "current": round(current_price, 2),
            "weight": config["weight"],
            "tier": config["tier"],
            "value": round(current_value, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "shares": round(shares, 4)
        })
        
        total_value += current_value
        total_pnl += pnl
    
    return {
        "positions": positions,
        "total_value": round(total_value, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": round((total_pnl / CAPITAL) * 100, 2),
        "macro": macro,
        "timestamp": datetime.now().isoformat()
    }

def update_data_loop():
    while True:
        time.sleep(5 * 60)
        try:
            print(f"\nAuto-update {datetime.now().strftime('%H:%M:%S')}")
            data_cache["data"] = calculate_portfolio()
            data_cache["last_update"] = time.time()
            print("Updated!")
        except Exception as e:
            print(f"Error: {e}")

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        if self.path in ['/api/portfolio', '/data']:
            if data_cache["data"]:
                response = {"success": True, "data": data_cache["data"]}
            else:
                response = {"success": False, "error": "No data yet"}
            self.wfile.write(json.dumps(response, indent=2).encode())
            
        elif self.path == '/health':
            response = {"status": "online", "timestamp": datetime.now().isoformat()}
            self.wfile.write(json.dumps(response).encode())
            
        elif self.path == '/refresh':
            data_cache["data"] = calculate_portfolio()
            data_cache["last_update"] = time.time()
            response = {"success": True, "data": data_cache["data"]}
            self.wfile.write(json.dumps(response).encode())
            
        else:
            self.wfile.write(json.dumps({"error": "Not found"}).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        pass

def main():
    PORT = int(os.environ.get('PORT', 8080))
    
    print("="*60)
    print("DRUCK PORTFOLIO SERVER")
    print("="*60)
    print(f"Port: {PORT}")
    print("="*60)
    
    print("\nInitial fetch...")
    data_cache["data"] = calculate_portfolio()
    data_cache["last_update"] = time.time()
    
    if data_cache["data"]:
        print(f"Portfolio: ${data_cache['data']['total_value']:,.0f}")
        print(f"P&L: ${data_cache['data']['total_pnl']:,.0f} ({data_cache['data']['total_pnl_pct']:.2f}%)")
    
    print(f"\nStarting server on port {PORT}...")
    server = HTTPServer(('0.0.0.0', PORT), RequestHandler)
    print("Server running!\n")
    
    update_thread = threading.Thread(target=update_data_loop, daemon=True)
    update_thread.start()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")
        server.shutdown()

if __name__ == "__main__":
    main()
