import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import './App.css';

const API_URL = 'https://web-production-63849.up.railway.app/data';

const getDruckSignal = (pos) => {
  const pct = (pos.current - pos.entry) / pos.entry * 100;
  if (pct <= -15) return { signal: "SELL",  color: "#ff2b2b", bg: "#ff2b2b12", reason: "-%15 geçti → Druck anında keser!" };
  if (pct <= -8)  return { signal: "WATCH", color: "#ff8c00", bg: "#ff8c0012", reason: "Uyarı bölgesi — tezi sorgula" };
  if (pct >= 30)  return { signal: "TRIM",  color: "#00e5ff", bg: "#00e5ff12", reason: "+%30 → Biraz sat, kâr kilitle" };
  if (pct >= 12)  return { signal: "ADD",   color: "#00ff88", bg: "#00ff8812", reason: "Momentum onaylandı → Ekle!" };
  if (pct >= 5)   return { signal: "HOLD+", color: "#a8ff78", bg: "#a8ff7812", reason: "Erken güç — geride bırak" };
  return           { signal: "HOLD",  color: "#556677", bg: "#55667708", reason: "Normal bant — aksiyon yok" };
};

const TIER_COLORS = {
  "AI Core":"#00ff88", "Platform":"#00e5ff", "AI Energy":"#a78bfa",
  "Energy":"#fbbf24", "Commodity":"#f87171", "Infrastructure":"#60a5fa",
  "Hedge":"#e2c96e", "Cash":"#475569"
};

const SIGNAL_TABLE = [
  {sig:"SELL", color:"#ff2b2b",range:"-%15 altı",  desc:"ACİL KES"},
  {sig:"WATCH",color:"#ff8c00",range:"-%8 → -%15", desc:"Tehlike — sorgula"},
  {sig:"HOLD", color:"#556677",range:"-%5 → +%5",  desc:"Normal bant"},
  {sig:"HOLD+",color:"#a8ff78",range:"+%5 → +%12", desc:"Erken momentum"},
  {sig:"ADD",  color:"#00ff88",range:"+%12 → +%30",desc:"Onaylı → Ekle!"},
  {sig:"TRIM", color:"#00e5ff",range:"+%30 üzeri", desc:"Kâr kilitle"},
];

const PENDING_THESES = [
  {id:"T1", ticker:"AVGO", action:"EKLE → %18", trigger:"$350 + VIX <20", detail:"Custom silicon momentum teyit edilirse ekle", color:"#00ff88", status:"MONITORING"},
  {id:"T2", ticker:"TLT", action:"EKLE → %12+", trigger:"Fed pivot Jun 2026", detail:"FOMC'da net dovish sinyal gelirse TLT ekle", color:"#e2c96e", status:"WAITING"},
  {id:"T3", ticker:"FCX", action:"EKLE → %14", trigger:"Bakır $4.50/lb", detail:"AI infra + enerji geçişi bakır talebini artırıyor", color:"#f87171", status:"MONITORING"},
  {id:"T6", ticker:"CRDO", action:"NEW ENTRY", trigger:"Entry $115.98", detail:"Infrastructure play - active monitoring", color:"#60a5fa", status:"ACTIVE"},
];

export default function DruckDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tab, setTab] = useState("positions");

  const fetchData = async () => {
    try {
      const response = await fetch(API_URL);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setLastUpdate(new Date());
        setLoading(false);
      }
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const metrics = useMemo(() => {
    if (!data) return { score: 0, sells: 0, adds: 0, trims: 0 };
    const positions = data.positions.filter(p => p.ticker !== 'CASH');
    const sigs = positions.map(p => getDruckSignal(p).signal);
    const sells = sigs.filter(s => s === "SELL").length;
    const adds = sigs.filter(s => s === "ADD").length;
    const trims = sigs.filter(s => s === "TRIM").length;
    const score = Math.max(0, Math.min(100, 70 - sells * 15 + adds * 5 - trims * 2));
    return { score, sells, adds, trims };
  }, [data]);

  const tierData = useMemo(() => {
    if (!data) return [];
    const m = {};
    data.positions.forEach(p => {
      const tier = p.ticker === 'CASH' ? 'Cash' : p.tier;
      m[tier] = (m[tier] || 0) + p.weight * 100;
    });
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [data]);

  const grouped = useMemo(() => {
    if (!data) return {};
    const g = {};
    data.positions.filter(p => p.ticker !== 'CASH').forEach(p => {
      if (!g[p.tier]) g[p.tier] = [];
      g[p.tier].push(p);
    });
    return g;
  }, [data]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading Druck Portfolio...</p>
      </div>
    );
  }

  if (!data) return <div className="error">Failed to load portfolio data</div>;

  const retColor = data.total_pnl_pct >= 2 ? "#00ff88" : data.total_pnl_pct <= -2 ? "#ff2b2b" : "#bccdd8";
  const scoreColor = metrics.score >= 70 ? "#00ff88" : metrics.score >= 50 ? "#ffaa00" : "#ff2b2b";

  return (
    <div className="app">
      <div className="header-bar">
        <div>
          <div className="mono" style={{fontSize:10,letterSpacing:3,color:"rgba(0,255,136,.5)"}}>DRUCK PORTFOLIO v2.1</div>
          <div className="mono" style={{fontSize:20,color:"#00ff88",marginTop:2}}>💼 LIVE SYSTEM</div>
        </div>
        <div style={{display:"flex",gap:20,alignItems:"center"}}>
          <div><div className="mono" style={{fontSize:9,color:"rgba(188,205,216,.4)"}}>NAV</div><div className="mono" style={{fontSize:24,color:"#00ff88"}}>${Math.round(data.total_value).toLocaleString()}</div></div>
          <div><div className="mono" style={{fontSize:9,color:"rgba(188,205,216,.4)"}}>P&L</div><div className="mono" style={{fontSize:24,color:retColor}}>{data.total_pnl >= 0 ? "+" : ""}{data.total_pnl_pct.toFixed(2)}%</div></div>
          <div><div className="mono" style={{fontSize:9,color:"rgba(188,205,216,.4)"}}>VIX</div><div className="mono" style={{fontSize:24,color:data.macro.vix > 25 ? "#ff8c00" : "#556677"}}>{data.macro.vix}</div></div>
          <div><div className="mono" style={{fontSize:9,color:"rgba(188,205,216,.4)"}}>DRUCK SCORE</div><div className="mono" style={{fontSize:24,color:scoreColor}}>{metrics.score}/100</div></div>
        </div>
        <div className="mono" style={{fontSize:9,color:"rgba(188,205,216,.28)"}}>Last: {lastUpdate?.toLocaleTimeString('tr-TR')}</div>
      </div>

      <div className="main-grid">
        <div className="left-panel">
          <div className="tabs">
            <button className={`tab ${tab==="positions"?"active":""}`} onClick={()=>setTab("positions")}>POSITIONS</button>
            <button className={`tab ${tab==="theses"?"active":""}`} onClick={()=>setTab("theses")}>THESES</button>
          </div>

          <div className="content-area">
            {tab === "positions" && (
              <div className="fi">
                {Object.entries(grouped).map(([tier, positions]) => (
                  <div key={tier} className="panel">
                    <div className="ptitle" style={{color:TIER_COLORS[tier]}}>{tier.toUpperCase()}</div>
                    {positions.map(p => {
                      const sig = getDruckSignal(p);
                      const pnl = ((p.current - p.entry) / p.entry) * 100;
                      return (
                        <div key={p.ticker} className="pos-row">
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span className="mono ticker-name">{p.ticker}</span>
                            <span className="mono" style={{fontSize:11,color:"rgba(188,205,216,.38)"}}>{(p.weight*100).toFixed(0)}%</span>
                            <span className="sig-badge" style={{background:sig.bg,color:sig.color,border:`1px solid ${sig.color}28`}}>{sig.signal}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:12}}>
                            <span className="mono" style={{fontSize:12,color:"rgba(188,205,216,.5)"}}>${p.entry} → ${p.current}</span>
                            <span className="mono pnl-text" style={{color:pnl>=0?"#00ff88":"#ff2b2b"}}>{pnl>=0?"+":""}{pnl.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div className="panel">
                  <div className="ptitle">ALLOCATION</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={tierData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                        {tierData.map((entry, i) => (<Cell key={i} fill={TIER_COLORS[entry.name] || "#556677"} />))}
                      </Pie>
                      <Tooltip contentStyle={{background:"#0d0f16",border:"1px solid #1a1d28",borderRadius:4}} itemStyle={{color:"#bccdd8"}}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>
                    {tierData.map(t => (
                      <div key={t.name} style={{display:"flex",alignItems:"center",gap:4}}>
                        <div style={{width:10,height:10,background:TIER_COLORS[t.name],borderRadius:2}}/>
                        <span className="mono" style={{fontSize:10,color:"rgba(188,205,216,.5)"}}>{t.name} {t.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <div className="ptitle">SIGNAL TABLE</div>
                  {SIGNAL_TABLE.map(s => (
                    <div key={s.sig} className="signal-row" style={{border:`1px solid ${s.color}16`,background:`${s.color}06`}}>
                      <span className="mono sig-label" style={{color:s.color,border:`1px solid ${s.color}28`}}>{s.sig}</span>
                      <span className="mono" style={{fontSize:9,color:"rgba(188,205,216,.42)"}}>{s.range}</span>
                      <span style={{fontSize:12,color:"rgba(188,205,216,.58)"}}>{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "theses" && (
              <div className="fi">
                {PENDING_THESES.map(t => (
                  <div key={t.id} className="panel thesis-card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span className="mono" style={{fontSize:14,color:t.color}}>{t.id}</span>
                        <span className="mono ticker-name">{t.ticker}</span>
                        <span className="mono" style={{fontSize:10,padding:"2px 6px",background:`${t.color}15`,color:t.color,border:`1px solid ${t.color}28`,borderRadius:3}}>{t.status}</span>
                      </div>
                      <span className="mono" style={{fontSize:11,color:t.color}}>{t.action}</span>
                    </div>
                    <div style={{fontSize:13,color:"rgba(188,205,216,.65)",marginBottom:6}}><strong>Trigger:</strong> {t.trigger}</div>
                    <div style={{fontSize:12,color:"rgba(188,205,216,.45)",lineHeight:1.5}}>{t.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="right-panel">
          <div className="ai-header">
            <div className="mono" style={{fontSize:8,letterSpacing:3,color:"rgba(0,229,255,.42)"}}>LIVE MONITORING</div>
            <div className="mono" style={{fontSize:16,color:"#00e5ff"}}>ACTIVE ALERTS</div>
          </div>

          <div className="alert-grid">
            <div className="alert-card"><div className="mono alert-label">RETURN</div><div className="mono alert-value" style={{color:retColor}}>{data.total_pnl >= 0 ? "+" : ""}{data.total_pnl_pct.toFixed(2)}%</div></div>
            <div className="alert-card"><div className="mono alert-label">SCORE</div><div className="mono alert-value" style={{color:scoreColor}}>{metrics.score}/100</div></div>
            <div className="alert-card"><div className="mono alert-label">SELLS</div><div className="mono alert-value" style={{color:metrics.sells>0?"#ff2b2b":"#00ff88"}}>{metrics.sells}</div></div>
          </div>

          <div className="divider"/>

          <div className="alert-section">
            <div className="ptitle">ACTIVE ALERTS</div>
            {data.positions.filter(p => p.ticker !== 'CASH' && getDruckSignal(p).signal !== "HOLD").map(p => {
              const sig = getDruckSignal(p);
              return (
                <div key={p.ticker} className="alert-item">
                  <span className="mono" style={{color:sig.color,fontSize:12}}>{p.ticker}</span>
                  <span className="mono sig-badge-small" style={{color:sig.color,border:`1px solid ${sig.color}28`}}>{sig.signal}</span>
                  <span style={{fontSize:11,color:"rgba(188,205,216,.42)"}}>{sig.reason}</span>
                </div>
              );
            })}
            {data.positions.filter(p => getDruckSignal(p).signal !== "HOLD").length === 0 && (
              <span className="mono" style={{fontSize:10,color:"rgba(0,255,136,.4)"}}>✓ All positions healthy</span>
            )}
          </div>

          <div className="thesis-summary">
            <div className="mono" style={{fontSize:8,letterSpacing:2,color:"rgba(255,170,0,.42)",marginBottom:8}}>PENDING THESES ({PENDING_THESES.length})</div>
            {PENDING_THESES.map(t => (
              <div key={t.id} className="thesis-mini">
                <span className="mono" style={{fontSize:11,color:t.color}}>{t.ticker}</span>
                <span className="mono" style={{fontSize:8,padding:"1px 4px",border:`1px solid ${t.color}25`,color:t.color}}>{t.action.split(" ")[0]}</span>
                <span style={{fontSize:10,color:"rgba(188,205,216,.32)"}}>{t.trigger.slice(0,28)}...</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
