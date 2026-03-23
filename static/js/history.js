/**
 * AlfredForge — History tab (all trades: paper + simulation + backtest)
 */

const HistoryTab = {
  _trades: [],
  _filtered: [],
  _handler: null,

  async load() {
    try {
      this._trades = await fetch('/api/trades?limit=5000').then(r => r.json());
    } catch (e) {
      this._trades = [];
    }

    this._updateContext();
    this._wireFilters();
    this._populateCascade();
    this._applyFilters();
  },

  _updateContext() {
    const el = document.getElementById('history-context');
    if (!el) return;
    const bySource = {};
    this._trades.forEach(t => {
      bySource[t.source] = (bySource[t.source] || 0) + 1;
    });
    const parts = Object.entries(bySource)
      .map(([s, n]) => `${s.charAt(0).toUpperCase() + s.slice(1)} (${n})`);
    el.textContent = `All trade records · Filter by source, ticker, strategy, or date · ${parts.join(' · ')}`;
  },

  // Rebuild ticker + strategy dropdowns based on currently selected source (cascade)
  _populateCascade() {
    const source = document.getElementById('history-source-filter')?.value || '';
    const baseTrades = source ? this._trades.filter(t => t.source === source) : this._trades;

    const tickers = [...new Set(baseTrades.map(t => t.ticker).filter(Boolean))].sort();
    const strategies = [...new Set(baseTrades.map(t => t.strategy).filter(Boolean))].sort();

    const tickerEl = document.getElementById('history-ticker-filter');
    if (tickerEl) {
      const cur = tickerEl.value;
      tickerEl.innerHTML = '<option value="">All Tickers</option>' +
        tickers.map(t => `<option value="${t}">${t}</option>`).join('');
      if (tickers.includes(cur)) tickerEl.value = cur;
    }

    const stratEl = document.getElementById('history-strategy-filter');
    if (stratEl) {
      const cur = stratEl.value;
      stratEl.innerHTML = '<option value="">All Strategies</option>' +
        strategies.map(s => `<option value="${s}">${s}</option>`).join('');
      if (strategies.includes(cur)) stratEl.value = cur;
    }
  },

  _wireFilters() {
    // Use a single stored handler so removeEventListener works correctly
    if (!this._handler) this._handler = () => {
      this._populateCascade();
      this._applyFilters();
    };

    const filterIds = [
      'history-source-filter', 'history-ticker-filter',
      'history-strategy-filter', 'history-outcome-filter',
      'history-date-from', 'history-date-to',
    ];

    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.removeEventListener('change', this._handler);
      el.removeEventListener('input', this._handler);
      el.addEventListener('change', this._handler);
      el.addEventListener('input', this._handler);
    });

    const reset = document.getElementById('history-reset');
    if (reset) reset.onclick = () => {
      filterIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      this._populateCascade();
      this._applyFilters();
    };

    const exportBtn = document.getElementById('history-export');
    if (exportBtn) exportBtn.onclick = () => this._exportCSV();
  },

  _applyFilters() {
    const source   = document.getElementById('history-source-filter')?.value || '';
    const ticker   = document.getElementById('history-ticker-filter')?.value || '';
    const strategy = document.getElementById('history-strategy-filter')?.value || '';
    const outcome  = document.getElementById('history-outcome-filter')?.value || '';
    const dateFrom = document.getElementById('history-date-from')?.value || '';
    const dateTo   = document.getElementById('history-date-to')?.value || '';

    this._filtered = this._trades.filter(t => {
      if (source   && t.source   !== source)   return false;
      if (ticker   && t.ticker   !== ticker)   return false;
      if (strategy && t.strategy !== strategy) return false;
      if (outcome  && t.outcome  !== outcome)  return false;
      if (dateFrom && t.date_entry < dateFrom) return false;
      if (dateTo   && t.date_entry > dateTo)   return false;
      return true;
    });

    const closed = this._filtered.filter(t => ['WIN','LOSS'].includes(t.outcome));
    this._renderStats(closed);
    this._renderTable(closed);
    this._renderCharts(closed);
  },

  _renderStats(trades) {
    const el = document.getElementById('history-stats');
    if (!el) return;
    if (!trades.length) { el.innerHTML = ''; return; }

    const wins = trades.filter(t => t.outcome === 'WIN').length;
    const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    const totalRisk = trades.reduce((s, t) => s + Math.abs(t.max_loss || 0), 0);
    const returnPct = totalRisk ? (totalPnl / totalRisk * 100) : 0;
    const avgPnl = totalPnl / trades.length;
    const maxDD = this._calcMaxDrawdown(trades);
    const expectancy = (wins / trades.length) * (trades.filter(t => t.outcome === 'WIN').reduce((s,t) => s+(t.pnl||0), 0) / (wins||1))
                     + ((trades.length - wins) / trades.length) * (trades.filter(t => t.outcome === 'LOSS').reduce((s,t) => s+(t.pnl||0), 0) / ((trades.length-wins)||1));

    el.innerHTML = `
      <div class="history-stat"><span class="history-stat-label">Total Trades</span><span class="history-stat-value">${trades.length.toLocaleString()}</span></div>
      <div class="history-stat"><span class="history-stat-label">Win Rate</span><span class="history-stat-value">${formatPct(wins/trades.length*100, false)}</span></div>
      <div class="history-stat"><span class="history-stat-label">Total P&L</span><span class="history-stat-value ${pnlClass(totalPnl)}">${pnlStr(totalPnl)}</span></div>
      <div class="history-stat"><span class="history-stat-label">Return on Risk</span><span class="history-stat-value ${pnlClass(returnPct)}">${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%</span></div>
      <div class="history-stat"><span class="history-stat-label">Avg P&L</span><span class="history-stat-value ${pnlClass(avgPnl)}">${pnlStr(avgPnl)}</span></div>
      <div class="history-stat"><span class="history-stat-label">Expectancy</span><span class="history-stat-value ${pnlClass(expectancy)}">${pnlStr(expectancy)}</span></div>
      <div class="history-stat"><span class="history-stat-label">Max Drawdown</span><span class="history-stat-value pnl-negative">${maxDD.toFixed(1)}%</span></div>
    `;
  },

  _renderTable(trades) {
    const container = document.getElementById('history-table-container');
    if (!container) return;

    if (!trades.length) {
      container.innerHTML = '<div class="empty-state">No trades match the current filters</div>';
      return;
    }

    const cols = ['Date', 'Ticker', 'Strategy', 'Source', 'Entry $', 'Credit', 'P&L', 'Return %', 'VIX', 'Outcome'];
    const rows = trades.map(t => {
      const ret = (t.pnl !== null && t.max_loss) ? (t.pnl / Math.abs(t.max_loss) * 100) : 0;
      return [
        formatDate(t.date_exit || t.date_entry),
        t.ticker || '—',
        t.strategy || '—',
        t.source || '—',
        formatCurrency(t.s_entry),
        formatCurrency(t.credit),
        pnlStr(t.pnl),
        formatPct(ret),
        t.vix ? t.vix.toFixed(1) : '—',
        t.outcome,
      ];
    });

    container.innerHTML = '';
    container.appendChild(buildTable(cols, rows, { paginate: true, sortable: true }));
  },

  _renderCharts(trades) {
    initEquityCurve('chart-equity', trades);
    initDrawdownChart('chart-drawdown', trades);

    const sorted = [...trades].filter(t => t.pnl !== null).sort((a,b) => (b.pnl||0)-(a.pnl||0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    const bestEl = document.getElementById('best-trade');
    if (bestEl) bestEl.innerHTML = best
      ? `<div class="metric-value pnl-positive">${pnlStr(best.pnl)}</div>
         <div class="metric-subtitle">${best.ticker||'—'} · ${best.strategy||'—'}</div>
         <div class="metric-subtitle">${formatDate(best.date_exit)}</div>`
      : '<div class="empty-state">No data</div>';

    const worstEl = document.getElementById('worst-trade');
    if (worstEl) worstEl.innerHTML = worst && worst.pnl < 0
      ? `<div class="metric-value pnl-negative">${pnlStr(worst.pnl)}</div>
         <div class="metric-subtitle">${worst.ticker||'—'} · ${worst.strategy||'—'}</div>
         <div class="metric-subtitle">${formatDate(worst.date_exit)}</div>`
      : '<div class="empty-state">No losses yet</div>';
  },

  _exportCSV() {
    const cols = ['Date','Ticker','Strategy','Source','Entry $','Credit','P&L','Return %','VIX','Outcome'];
    const closed = this._filtered.filter(t => ['WIN','LOSS'].includes(t.outcome));
    const rows = closed.map(t => {
      const ret = (t.pnl !== null && t.max_loss) ? (t.pnl / Math.abs(t.max_loss) * 100) : 0;
      return [
        t.date_exit || t.date_entry, t.ticker, t.strategy, t.source,
        t.s_entry, t.credit, t.pnl, ret.toFixed(2), t.vix, t.outcome,
      ];
    });
    exportCSV(cols, rows, 'alfredforge-trades');
  },

  _calcMaxDrawdown(trades) {
    const sorted = [...trades]
      .filter(t => t.date_exit && t.pnl !== null)
      .sort((a,b) => a.date_exit.localeCompare(b.date_exit));
    let cum = 0, peak = 0, maxDD = 0;
    sorted.forEach(t => {
      cum += t.pnl || 0;
      peak = Math.max(peak, cum);
      if (peak > 0) maxDD = Math.max(maxDD, (peak - cum) / peak * 100);
    });
    return maxDD;
  },
};
