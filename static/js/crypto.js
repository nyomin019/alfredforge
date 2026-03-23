/**
 * AlfredForge — Crypto trading tab
 */

const CryptoTab = {
  _chart: null,

  async load() {
    this.renderMetrics();
    this.initChart('BTC-USD', '1d');
    this.renderPositions();
    this.renderHistory();
    this.initControls();
  },

  renderMetrics() {
    const container = document.getElementById('crypto-metrics');
    if (!container) return;
    container.innerHTML = '';

    const cards = [
      { label: 'Crypto Trades', value: '0', subtitle: 'No crypto trades yet', type: 'default' },
      { label: 'Win Rate', value: '—', subtitle: 'No data', type: 'default' },
      { label: 'Total P&L', value: '$0.00', subtitle: 'Paper money', type: 'default' },
      { label: 'Avg Win', value: '$0.00', subtitle: 'Per winning trade', type: 'positive' },
      { label: 'Open Positions', value: '0', subtitle: 'No active trades', type: 'default' },
    ];

    cards.forEach(c => container.appendChild(MetricCard(c)));
  },

  initChart(symbol, tf) {
    if (this._chart) {
      this._chart.load(symbol, tf);
      return;
    }
    this._chart = new CandleChart('chart-crypto-candle');
    this._chart.load(symbol, tf);
  },

  renderPositions() {
    const container = document.getElementById('crypto-positions');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No open crypto positions</div>';
  },

  renderHistory() {
    const container = document.getElementById('crypto-history');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No crypto trades in history</div>';
  },

  initControls() {
    const symbolSelect = document.getElementById('crypto-symbol');
    if (symbolSelect) {
      symbolSelect.addEventListener('change', (e) => {
        this.initChart(e.target.value, this._currentTf || '1d');
      });
    }

    document.querySelectorAll('#crypto-tf .tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#crypto-tf .tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._currentTf = btn.dataset.tf;
        const sym = document.getElementById('crypto-symbol')?.value || 'BTC-USD';
        this.initChart(sym, btn.dataset.tf);
      });
    });
  },
};
