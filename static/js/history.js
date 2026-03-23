/**
 * AlfredForge — History tab (unified trade history + analytics)
 */

const HistoryTab = {
  _trades: [],
  _filteredTrades: [],

  async load() {
    try {
      this._trades = await fetch('/api/trades?limit=500').then(r => r.json());
    } catch (e) {
      this._trades = [];
      console.error('History tab load error:', e);
    }

    this._filteredTrades = [...this._trades];
    this.renderFilters();
    this.renderTable(this._filteredTrades);
    this.renderAnalytics(this._filteredTrades);
  },

  renderFilters() {
    const sourceFilter = document.getElementById('history-source-filter');
    const outcomeFilter = document.getElementById('history-outcome-filter');

    const applyFilters = () => {
      const source = sourceFilter?.value || '';
      const outcome = outcomeFilter?.value || '';

      this._filteredTrades = this._trades.filter(t => {
        if (source && t.source !== source) return false;
        if (outcome && t.outcome !== outcome) return false;
        return true;
      });

      this.renderTable(this._filteredTrades);
      this.renderAnalytics(this._filteredTrades);
    };

    if (sourceFilter) sourceFilter.addEventListener('change', applyFilters);
    if (outcomeFilter) outcomeFilter.addEventListener('change', applyFilters);
  },

  renderTable(trades) {
    const container = document.getElementById('history-table-container');
    if (!container) return;

    const closed = trades.filter(t => ['WIN', 'LOSS'].includes(t.outcome));

    if (!closed.length) {
      container.innerHTML = '<div class="empty-state">No closed trades matching filters</div>';
      return;
    }

    const cols = ['Date', 'Ticker', 'Strategy', 'Entry $', 'Exit $', 'Credit', 'P&L', '%', 'Outcome', 'Source'];
    const rows = closed.map(t => {
      const pct = (t.pnl !== null && t.max_loss) ? (t.pnl / Math.abs(t.max_loss) * 100) : 0;
      return [
        formatDate(t.date_exit),
        t.ticker || '—',
        t.strategy || '—',
        formatCurrency(t.s_entry),
        formatCurrency(t.s_exit),
        formatCurrency(t.credit),
        pnlStr(t.pnl),
        formatPct(pct),
        t.outcome,
        t.source || '—',
      ];
    });

    container.innerHTML = '';
    container.appendChild(buildTable(cols, rows, { paginate: true, sortable: true, exportId: 'history-export' }));

    // Wire up export button
    const exportBtn = document.getElementById('history-export');
    if (exportBtn) {
      exportBtn.onclick = () => exportCSV(cols, rows, 'alfredforge-trades');
    }
  },

  renderAnalytics(trades) {
    const closed = trades.filter(t => ['WIN', 'LOSS'].includes(t.outcome));

    initEquityCurve('chart-equity', closed);
    initDrawdownChart('chart-drawdown', closed);

    // Best / worst trade cards
    const sorted = [...closed]
      .filter(t => t.pnl !== null)
      .sort((a, b) => (b.pnl || 0) - (a.pnl || 0));

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    const bestEl = document.getElementById('best-trade');
    const worstEl = document.getElementById('worst-trade');

    if (bestEl) {
      if (best) {
        bestEl.innerHTML = `
          <div class="metric-value pnl-positive">${pnlStr(best.pnl)}</div>
          <div class="metric-subtitle">${best.ticker || '—'} · ${formatDate(best.date_exit)}</div>
          <div class="metric-subtitle">${best.strategy || '—'}</div>
        `;
      } else {
        bestEl.innerHTML = '<div class="empty-state">No data</div>';
      }
    }

    if (worstEl) {
      if (worst && worst.pnl < 0) {
        worstEl.innerHTML = `
          <div class="metric-value pnl-negative">${pnlStr(worst.pnl)}</div>
          <div class="metric-subtitle">${worst.ticker || '—'} · ${formatDate(worst.date_exit)}</div>
          <div class="metric-subtitle">${worst.strategy || '—'}</div>
        `;
      } else {
        worstEl.innerHTML = '<div class="empty-state">No losses yet</div>';
      }
    }

    // Summary stats for history tab
    if (closed.length > 0) {
      const wins = closed.filter(t => t.outcome === 'WIN').length;
      const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
      const avgPnl = totalPnl / closed.length;
      const maxDrawdown = this._calcMaxDrawdown(closed);

      const statsEl = document.getElementById('history-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div class="history-stat">
            <span class="history-stat-label">Total Trades</span>
            <span class="history-stat-value">${closed.length}</span>
          </div>
          <div class="history-stat">
            <span class="history-stat-label">Win Rate</span>
            <span class="history-stat-value">${formatPct(wins / closed.length * 100, false)}</span>
          </div>
          <div class="history-stat">
            <span class="history-stat-label">Total P&L</span>
            <span class="history-stat-value ${pnlClass(totalPnl)}">${pnlStr(totalPnl)}</span>
          </div>
          <div class="history-stat">
            <span class="history-stat-label">Avg P&L</span>
            <span class="history-stat-value ${pnlClass(avgPnl)}">${pnlStr(avgPnl)}</span>
          </div>
          <div class="history-stat">
            <span class="history-stat-label">Max Drawdown</span>
            <span class="history-stat-value pnl-negative">${maxDrawdown.toFixed(1)}%</span>
          </div>
        `;
      }
    }
  },

  _calcMaxDrawdown(trades) {
    const sorted = [...trades]
      .filter(t => t.date_exit && t.pnl !== null)
      .sort((a, b) => a.date_exit.localeCompare(b.date_exit));

    let cum = 0, peak = 0, maxDD = 0;
    sorted.forEach(t => {
      cum += t.pnl || 0;
      peak = Math.max(peak, cum);
      if (peak > 0) {
        const dd = (peak - cum) / peak * 100;
        maxDD = Math.max(maxDD, dd);
      }
    });
    return maxDD;
  },
};
