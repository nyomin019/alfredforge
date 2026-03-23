/**
 * AlfredForge — Options trading tab
 */

const OptionsTab = {
  _chart: null,

  async load() {
    let trades = [], positions = [], portfolio = {};
    try {
      [trades, positions, portfolio] = await Promise.all([
        fetch('/api/trades?source=paper&limit=200').then(r => r.json()),
        fetch('/api/positions').then(r => r.json()),
        fetch('/api/portfolio').then(r => r.json()),
      ]);
    } catch (e) {
      console.error('Options tab load error:', e);
    }

    this.renderMetrics(portfolio, trades);
    this.initChart('META', '1d');
    this.renderPositions(positions);
    this.renderHistory(trades);
    this.initControls();
  },

  renderMetrics(portfolio, trades) {
    const container = document.getElementById('options-metrics');
    if (!container) return;
    container.innerHTML = '';

    const closed = trades.filter(t => ['WIN', 'LOSS'].includes(t.outcome));
    const wins = closed.filter(t => t.outcome === 'WIN').length;
    const winRate = closed.length ? (wins / closed.length * 100) : 0;
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const skipped = trades.filter(t => t.status === 'SKIPPED' || t.outcome === 'SKIP').length;

    const cards = [
      { label: 'Paper Trades', value: String(closed.length), subtitle: `${skipped} skipped (VIX/filter)`, type: 'default' },
      { label: 'Win Rate', value: formatPct(winRate, false), subtitle: `${wins}W / ${closed.length - wins}L`, type: winRate >= 60 ? 'positive' : 'default' },
      { label: 'Total P&L', value: pnlStr(totalPnl), subtitle: 'Paper money', type: totalPnl >= 0 ? 'positive' : 'negative' },
      { label: 'Avg Win', value: formatCurrency(portfolio.avg_win || 0), subtitle: 'Per winning trade', type: 'positive' },
      { label: 'Open Positions', value: String(positions ? positions.length : 0), subtitle: 'Active trades', type: 'default' },
    ];

    cards.forEach(c => container.appendChild(MetricCard(c)));
  },

  initChart(symbol, tf) {
    if (this._chart) {
      this._chart.load(symbol, tf);
      return;
    }
    this._chart = new CandleChart('chart-options-candle');
    this._chart.load(symbol, tf);
  },

  renderPositions(positions) {
    const container = document.getElementById('options-positions');
    if (!container) return;

    if (!positions || !positions.length) {
      container.innerHTML = '<div class="empty-state">No open positions</div>';
      return;
    }

    const cols = ['Ticker', 'Strategy', 'Entry $', 'Credit', 'Max P', 'Max L', 'Strikes', 'Entered'];
    const rows = positions.map(p => [
      p.ticker || '—',
      p.strategy || '—',
      formatCurrency(p.s_entry),
      formatCurrency(p.credit),
      formatCurrency(p.max_profit),
      formatCurrency(p.max_loss),
      p.put_short && p.call_short ? `${p.put_short}p / ${p.call_short}c` : '—',
      formatDate(p.date_entry),
    ]);

    container.innerHTML = '';
    container.appendChild(buildTable(cols, rows, { paginate: false }));
  },

  renderHistory(trades) {
    const container = document.getElementById('options-history');
    if (!container) return;

    const closed = trades.filter(t => ['WIN', 'LOSS'].includes(t.outcome));

    // Stats bar
    const statsEl = document.getElementById('options-stats');
    if (statsEl) {
      if (closed.length) {
        const wins = closed.filter(t => t.outcome === 'WIN').length;
        const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
        const totalRisk = closed.reduce((s, t) => s + Math.abs(t.max_loss || 0), 0);
        const returnPct = totalRisk ? (totalPnl / totalRisk * 100) : 0;
        const avgPnl = totalPnl / closed.length;
        const avgWin = wins ? closed.filter(t => t.outcome === 'WIN').reduce((s, t) => s + (t.pnl || 0), 0) / wins : 0;
        const avgLoss = (closed.length - wins) ? closed.filter(t => t.outcome === 'LOSS').reduce((s, t) => s + (t.pnl || 0), 0) / (closed.length - wins) : 0;
        const expectancy = (wins / closed.length) * avgWin + ((closed.length - wins) / closed.length) * avgLoss;
        statsEl.innerHTML = `
          <div class="history-stat"><span class="history-stat-label">Total Trades</span><span class="history-stat-value">${closed.length}</span></div>
          <div class="history-stat"><span class="history-stat-label">Win Rate</span><span class="history-stat-value">${formatPct(wins / closed.length * 100, false)}</span></div>
          <div class="history-stat"><span class="history-stat-label">Total P&L</span><span class="history-stat-value ${pnlClass(totalPnl)}">${pnlStr(totalPnl)}</span></div>
          <div class="history-stat"><span class="history-stat-label">Return on Risk</span><span class="history-stat-value ${pnlClass(returnPct)}">${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%</span></div>
          <div class="history-stat"><span class="history-stat-label">Avg P&L</span><span class="history-stat-value ${pnlClass(avgPnl)}">${pnlStr(avgPnl)}</span></div>
          <div class="history-stat"><span class="history-stat-label">Expectancy</span><span class="history-stat-value ${pnlClass(expectancy)}">${pnlStr(expectancy)}</span></div>
        `;
      } else {
        statsEl.innerHTML = `
          <div class="history-stat"><span class="history-stat-label">Total Trades</span><span class="history-stat-value">0</span></div>
          <div class="history-stat"><span class="history-stat-label">Win Rate</span><span class="history-stat-value">—</span></div>
          <div class="history-stat"><span class="history-stat-label">Total P&L</span><span class="history-stat-value">$0.00</span></div>
          <div class="history-stat"><span class="history-stat-label">Return on Risk</span><span class="history-stat-value">0.0%</span></div>
          <div class="history-stat"><span class="history-stat-label">Avg P&L</span><span class="history-stat-value">—</span></div>
          <div class="history-stat"><span class="history-stat-label">Expectancy</span><span class="history-stat-value">—</span></div>
        `;
      }
    }

    if (!closed.length) {
      container.innerHTML = '<div class="empty-state">No closed trades yet</div>';
      return;
    }

    const cols = ['Date', 'Ticker', 'Strategy', 'Entry $', 'Exit $', 'Credit', 'P&L', 'Outcome', 'VIX'];
    const rows = closed.map(t => [
      formatDate(t.date_exit),
      t.ticker || '—',
      t.strategy || '—',
      formatCurrency(t.s_entry),
      formatCurrency(t.s_exit),
      formatCurrency(t.credit),
      pnlStr(t.pnl),
      t.outcome,
      t.vix ? t.vix.toFixed(1) : '—',
    ]);

    container.innerHTML = '';
    container.appendChild(buildTable(cols, rows, { paginate: true, exportId: 'options-export' }));
  },

  initControls() {
    const symbolSelect = document.getElementById('options-symbol');
    if (symbolSelect) {
      symbolSelect.removeEventListener('change', this._onSymbolChange);
      this._onSymbolChange = (e) => this.initChart(e.target.value, this._currentTf || '1d');
      symbolSelect.addEventListener('change', this._onSymbolChange);
    }

    document.querySelectorAll('#options-tf .tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#options-tf .tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._currentTf = btn.dataset.tf;
        const sym = document.getElementById('options-symbol')?.value || 'META';
        this.initChart(sym, btn.dataset.tf);
      });
    });
  },
};
