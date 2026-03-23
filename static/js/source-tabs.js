/**
 * AlfredForge — Backtest & Simulation tabs (source-filtered views of trade history)
 */

function makeSourceTab(source, prefix) {
  return {
    _trades: [],
    _filtered: [],
    _charts: {},
    _handler: null,

    async load() {
      try {
        this._trades = await fetch(`/api/trades?source=${source}&limit=5000`).then(r => r.json());
      } catch (e) {
        this._trades = [];
      }
      this._updateContext();
      this._wireFilters();
      this._populateDropdowns();
      this._applyFilters();
    },

    _populateDropdowns() {
      const tickers = [...new Set(this._trades.map(t => t.ticker).filter(Boolean))].sort();
      const strategies = [...new Set(this._trades.map(t => t.strategy).filter(Boolean))].sort();

      const tickerEl = document.getElementById(`${prefix}-ticker-filter`);
      if (tickerEl) {
        const cur = tickerEl.value;
        tickerEl.innerHTML = '<option value="">All Tickers</option>' +
          tickers.map(t => `<option value="${t}">${t}</option>`).join('');
        if (tickers.includes(cur)) tickerEl.value = cur;
      }

      const stratEl = document.getElementById(`${prefix}-strategy-filter`);
      if (stratEl) {
        const cur = stratEl.value;
        stratEl.innerHTML = '<option value="">All Strategies</option>' +
          strategies.map(s => `<option value="${s}">${s}</option>`).join('');
        if (strategies.includes(cur)) stratEl.value = cur;
      }
    },

    _updateContext() {
      const el = document.getElementById(`${prefix}-context`);
      if (!el) return;
      const closed = this._trades.filter(t => ['WIN', 'LOSS'].includes(t.outcome)).length;
      const tickers = [...new Set(this._trades.map(t => t.ticker).filter(Boolean))];
      const strats = [...new Set(this._trades.map(t => t.strategy).filter(Boolean))];
      el.textContent = `${source.charAt(0).toUpperCase() + source.slice(1)} trades · ${this._trades.length.toLocaleString()} total · ${closed.toLocaleString()} closed · ${tickers.join(' / ')} · ${strats.join(' / ')}`;
    },

    _wireFilters() {
      if (!this._handler) this._handler = () => this._applyFilters();

      const ids = [
        `${prefix}-ticker-filter`, `${prefix}-strategy-filter`,
        `${prefix}-outcome-filter`, `${prefix}-date-from`, `${prefix}-date-to`,
      ];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.removeEventListener('change', this._handler);
        el.removeEventListener('input', this._handler);
        el.addEventListener('change', this._handler);
        el.addEventListener('input', this._handler);
      });

      const reset = document.getElementById(`${prefix}-reset`);
      if (reset) reset.onclick = () => {
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        this._applyFilters();
      };

      const exportBtn = document.getElementById(`${prefix}-export`);
      if (exportBtn) exportBtn.onclick = () => this._exportCSV();
    },

    _applyFilters() {
      const ticker   = document.getElementById(`${prefix}-ticker-filter`)?.value || '';
      const strategy = document.getElementById(`${prefix}-strategy-filter`)?.value || '';
      const outcome  = document.getElementById(`${prefix}-outcome-filter`)?.value || '';
      const dateFrom = document.getElementById(`${prefix}-date-from`)?.value || '';
      const dateTo   = document.getElementById(`${prefix}-date-to`)?.value || '';

      this._filtered = this._trades.filter(t => {
        if (ticker   && t.ticker   !== ticker)   return false;
        if (strategy && t.strategy !== strategy) return false;
        if (outcome  && t.outcome  !== outcome)  return false;
        if (dateFrom && t.date_entry < dateFrom) return false;
        if (dateTo   && t.date_entry > dateTo)   return false;
        return true;
      });

      const closed = this._filtered.filter(t => ['WIN', 'LOSS'].includes(t.outcome));
      this._renderStats(closed);
      this._renderTable(closed);
      this._renderCharts(closed);
    },

    _renderStats(trades) {
      const el = document.getElementById(`${prefix}-stats`);
      if (!el) return;
      if (!trades.length) { el.innerHTML = ''; return; }

      const wins = trades.filter(t => t.outcome === 'WIN').length;
      const losses = trades.length - wins;
      const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
      const totalRisk = trades.reduce((s, t) => s + Math.abs(t.max_loss || 0), 0);
      const returnPct = totalRisk ? (totalPnl / totalRisk * 100) : 0;
      const avgPnl = totalPnl / trades.length;
      const avgWinPnl = wins ? trades.filter(t => t.outcome === 'WIN').reduce((s, t) => s + (t.pnl || 0), 0) / wins : 0;
      const avgLossPnl = losses ? trades.filter(t => t.outcome === 'LOSS').reduce((s, t) => s + (t.pnl || 0), 0) / losses : 0;
      const expectancy = (wins / trades.length) * avgWinPnl + (losses / trades.length) * avgLossPnl;
      const maxDD = this._calcMaxDrawdown(trades);

      el.innerHTML = `
        <div class="history-stat"><span class="history-stat-label">Trades</span><span class="history-stat-value">${trades.length.toLocaleString()}</span></div>
        <div class="history-stat"><span class="history-stat-label">Win Rate</span><span class="history-stat-value">${formatPct(wins / trades.length * 100, false)}</span></div>
        <div class="history-stat"><span class="history-stat-label">Total P&L</span><span class="history-stat-value ${pnlClass(totalPnl)}">${pnlStr(totalPnl)}</span></div>
        <div class="history-stat"><span class="history-stat-label">Return on Risk</span><span class="history-stat-value ${pnlClass(returnPct)}">${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%</span></div>
        <div class="history-stat"><span class="history-stat-label">Avg P&L</span><span class="history-stat-value ${pnlClass(avgPnl)}">${pnlStr(avgPnl)}</span></div>
        <div class="history-stat"><span class="history-stat-label">Expectancy</span><span class="history-stat-value ${pnlClass(expectancy)}">${pnlStr(expectancy)}</span></div>
        <div class="history-stat"><span class="history-stat-label">Max Drawdown</span><span class="history-stat-value pnl-negative">${maxDD.toFixed(1)}%</span></div>
      `;
    },

    _renderTable(trades) {
      const container = document.getElementById(`${prefix}-table-container`);
      if (!container) return;
      if (!trades.length) {
        container.innerHTML = '<div class="empty-state">No trades match the current filters</div>';
        return;
      }

      const cols = ['Date', 'Ticker', 'Strategy', 'Entry $', 'Credit', 'P&L', 'Return %', 'VIX', 'Outcome'];
      const rows = trades.map(t => {
        const ret = (t.pnl !== null && t.max_loss) ? (t.pnl / Math.abs(t.max_loss) * 100) : 0;
        return [
          formatDate(t.date_exit || t.date_entry),
          t.ticker || '—', t.strategy || '—',
          formatCurrency(t.s_entry), formatCurrency(t.credit),
          pnlStr(t.pnl), formatPct(ret),
          t.vix ? t.vix.toFixed(1) : '—',
          t.outcome,
        ];
      });

      container.innerHTML = '';
      container.appendChild(buildTable(cols, rows, { paginate: true, sortable: true }));
    },

    _renderCharts(trades) {
      // Equity curve
      initEquityCurve(`chart-${prefix}-equity`, trades);

      // Allocation donut by ticker
      const byTicker = {};
      trades.forEach(t => {
        const k = t.ticker || 'Other';
        byTicker[k] = (byTicker[k] || 0) + 1;
      });
      const donutData = Object.entries(byTicker).map(([label, value]) => ({ label, value }));
      if (donutData.length) {
        this._charts.donut = initDonutChart(`chart-${prefix}-alloc`, donutData);
      }

      // Monthly P&L bar — group by month from trades array
      const byMonth = {};
      trades.forEach(t => {
        if (!t.date_exit || t.pnl === null) return;
        const month = t.date_exit.slice(0, 7); // YYYY-MM
        byMonth[month] = (byMonth[month] || 0) + (t.pnl || 0);
      });
      const monthlyData = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, pnl]) => ({ month, pnl }));
      if (monthlyData.length) {
        this._charts.monthly = initPnlBarChart(`chart-${prefix}-monthly`, monthlyData);
      }

      // Strategy bar
      const byStrategy = {};
      trades.forEach(t => {
        const k = t.strategy || 'Other';
        byStrategy[k] = (byStrategy[k] || 0) + (t.pnl || 0);
      });
      const stratData = Object.entries(byStrategy).map(([strategy, pnl]) => ({ strategy, pnl }));
      if (stratData.length) {
        this._charts.strategy = initStrategyChart(`chart-${prefix}-strategy`, stratData);
      }
    },

    _exportCSV() {
      const cols = ['Date', 'Ticker', 'Strategy', 'Entry $', 'Credit', 'P&L', 'Return %', 'VIX', 'Outcome'];
      const closed = this._filtered.filter(t => ['WIN', 'LOSS'].includes(t.outcome));
      const rows = closed.map(t => {
        const ret = (t.pnl !== null && t.max_loss) ? (t.pnl / Math.abs(t.max_loss) * 100) : 0;
        return [t.date_exit || t.date_entry, t.ticker, t.strategy, t.s_entry, t.credit, t.pnl, ret.toFixed(2), t.vix, t.outcome];
      });
      exportCSV(cols, rows, `alfredforge-${source}`);
    },

    _calcMaxDrawdown(trades) {
      const sorted = [...trades]
        .filter(t => t.date_exit && t.pnl !== null)
        .sort((a, b) => a.date_exit.localeCompare(b.date_exit));
      let cum = 0, peak = 0, maxDD = 0;
      sorted.forEach(t => {
        cum += t.pnl || 0;
        peak = Math.max(peak, cum);
        if (peak > 0) maxDD = Math.max(maxDD, (peak - cum) / peak * 100);
      });
      return maxDD;
    },
  };
}

const BacktestTab = makeSourceTab('backtest', 'backtest');
const SimulationTab = makeSourceTab('simulation', 'simulation');
