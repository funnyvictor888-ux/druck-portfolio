import { useState, useEffect } from 'react'
import './App.css'

const API_URL = 'https://web-production-63849.up.railway.app/data'

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = async () => {
    try {
      const response = await fetch(API_URL)
      const result = await response.json()
      if (result.success) {
        setData(result.data)
        setLastUpdate(new Date())
        setLoading(false)
      }
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading Druck Portfolio...</p>
      </div>
    )
  }

  if (!data) {
    return <div className="error">Failed to load portfolio data</div>
  }

  const equity = data.positions.filter(p => p.tier !== 'Cash' && p.tier !== 'Hedge')
  const hedges = data.positions.filter(p => p.tier === 'Hedge' && p.ticker !== 'CASH')
  const cash = data.positions.find(p => p.ticker === 'CASH')

  return (
    <div className="dashboard">
      <header className="header">
        <h1>💼 DRUCK PORTFOLIO</h1>
        <div className="header-stats">
          <div className="stat">
            <span className="label">Total Value</span>
            <span className="value">${data.total_value.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="label">P&L</span>
            <span className={`value ${data.total_pnl >= 0 ? 'positive' : 'negative'}`}>
              ${data.total_pnl.toLocaleString()} ({data.total_pnl_pct.toFixed(2)}%)
            </span>
          </div>
          <div className="stat">
            <span className="label">VIX</span>
            <span className="value">{data.macro.vix}</span>
          </div>
          <div className="stat">
            <span className="label">Last Update</span>
            <span className="value-small">{lastUpdate?.toLocaleTimeString()}</span>
          </div>
        </div>
      </header>

      <div className="content">
        <section className="positions">
          <h2>🎯 Equity Positions</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Tier</th>
                <th>Entry</th>
                <th>Current</th>
                <th>Weight</th>
                <th>Value</th>
                <th>P&L</th>
                <th>P&L %</th>
              </tr>
            </thead>
            <tbody>
              {equity.map(pos => (
                <tr key={pos.ticker}>
                  <td className="ticker">{pos.ticker}</td>
                  <td><span className="badge">{pos.tier}</span></td>
                  <td>${pos.entry}</td>
                  <td className={pos.current > pos.entry ? 'positive' : pos.current < pos.entry ? 'negative' : ''}>
                    ${pos.current}
                  </td>
                  <td>{(pos.weight * 100).toFixed(0)}%</td>
                  <td>${pos.value.toLocaleString()}</td>
                  <td className={pos.pnl >= 0 ? 'positive' : 'negative'}>
                    ${pos.pnl.toLocaleString()}
                  </td>
                  <td className={pos.pnl_pct >= 0 ? 'positive' : 'negative'}>
                    {pos.pnl_pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="hedges">
          <h2>🛡️ Hedges</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Entry</th>
                <th>Current</th>
                <th>Weight</th>
                <th>Value</th>
                <th>P&L %</th>
              </tr>
            </thead>
            <tbody>
              {hedges.map(pos => (
                <tr key={pos.ticker}>
                  <td className="ticker">{pos.ticker}</td>
                  <td>${pos.entry}</td>
                  <td>${pos.current}</td>
                  <td>{(pos.weight * 100).toFixed(0)}%</td>
                  <td>${pos.value.toLocaleString()}</td>
                  <td className={pos.pnl_pct >= 0 ? 'positive' : 'negative'}>
                    {pos.pnl_pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="allocation">
          <h2>📊 Allocation</h2>
          <div className="allocation-grid">
            <div className="alloc-card">
              <div className="alloc-label">Equity</div>
              <div className="alloc-value positive">
                {((equity.reduce((sum, p) => sum + p.weight, 0)) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="alloc-card">
              <div className="alloc-label">Hedges</div>
              <div className="alloc-value neutral">
                {((hedges.reduce((sum, p) => sum + p.weight, 0)) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="alloc-card">
              <div className="alloc-label">Cash</div>
              <div className="alloc-value">{(cash?.weight * 100).toFixed(0)}%</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
