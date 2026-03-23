/**
 * AlfredForge — Chart library (lightweight-charts + Chart.js)
 */

const ACCENT = '#1877f2';
const GREEN = '#31a24c';
const RED = '#e02020';
const SURFACE = '#ffffff';
const BORDER = '#dddfe2';
const TEXT_MUTED = '#65676b';

// ── CandleChart ───────────────────────────────────────────────────────────────

class CandleChart {
  constructor(containerId) {
    this.containerId = containerId;
    this.chart = null;
    this.candleSeries = null;
    this.volumeSeries = null;
    this._init();
  }

  _init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.innerHTML = '';

    if (typeof LightweightCharts === 'undefined') {
      container.innerHTML = '<div class="chart-error">Chart library not loaded</div>';
      return;
    }

    this.chart = LightweightCharts.createChart(container, {
      layout: {
        background: { color: SURFACE },
        textColor: TEXT_MUTED,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: BORDER },
        horzLines: { color: BORDER },
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: { borderColor: BORDER },
      timeScale: { borderColor: BORDER, timeVisible: true },
      width: container.clientWidth || 600,
      height: container.clientHeight || 320,
    });

    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: GREEN,
      downColor: RED,
      borderUpColor: GREEN,
      borderDownColor: RED,
      wickUpColor: GREEN,
      wickDownColor: RED,
    });

    this.volumeSeries = this.chart.addHistogramSeries({
      color: ACCENT,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const ro = new ResizeObserver(() => {
      if (this.chart && container.clientWidth > 0) {
        this.chart.resize(container.clientWidth, container.clientHeight || 320);
      }
    });
    ro.observe(container);
  }

  async load(symbol, timeframe) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    if (!this.chart) this._init();
    if (!this.chart) return;

    try {
      const data = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=200`).then(r => r.json());
      if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div class="chart-error">No data available</div>';
        return;
      }

      const candles = data.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      const volumes = data.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? GREEN + '66' : RED + '66',
      }));

      this.candleSeries.setData(candles);
      this.volumeSeries.setData(volumes);
      this.chart.timeScale().fitContent();
    } catch (e) {
      console.error('CandleChart load error:', e);
    }
  }

  addTradeMarkers(trades) {
    if (!this.candleSeries) return;
    const markers = trades
      .filter(t => t.date_entry && ['WIN', 'LOSS', 'OPEN'].includes(t.outcome || t.status))
      .map(t => {
        const isWin = t.outcome === 'WIN';
        const ts = Math.floor(new Date(t.date_entry).getTime() / 1000);
        return {
          time: ts,
          position: isWin ? 'belowBar' : 'aboveBar',
          color: isWin ? GREEN : RED,
          shape: isWin ? 'arrowUp' : 'arrowDown',
          text: t.ticker || '',
        };
      });
    if (markers.length > 0) this.candleSeries.setMarkers(markers);
  }
}

// ── Portfolio equity curve (Chart.js line) ────────────────────────────────────

function initPortfolioChart(containerId, data) {
  const canvas = document.getElementById(containerId);
  if (!canvas) return null;

  const labels = data.map(d => d.date);
  const values = data.map(d => d.cumulative_pnl);
  const lastVal = values[values.length - 1] || 0;

  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 200);
  gradient.addColorStop(0, ACCENT + '44');
  gradient.addColorStop(1, ACCENT + '00');

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Cumulative P&L',
        data: values,
        borderColor: lastVal >= 0 ? ACCENT : RED,
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => formatCurrency(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: {
          ticks: { color: TEXT_MUTED, maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 11 } },
          grid: { color: BORDER },
        },
        y: {
          ticks: { color: TEXT_MUTED, callback: v => '$' + v.toFixed(0), font: { family: 'JetBrains Mono', size: 11 } },
          grid: { color: BORDER },
        },
      },
    },
  });
}

// ── Monthly P&L bars ──────────────────────────────────────────────────────────

function initPnlBarChart(containerId, data) {
  const canvas = document.getElementById(containerId);
  if (!canvas) return null;

  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.month),
      datasets: [{
        label: 'Monthly P&L',
        data: data.map(d => d.pnl),
        backgroundColor: data.map(d => d.pnl >= 0 ? GREEN + 'cc' : RED + 'cc'),
        borderColor: data.map(d => d.pnl >= 0 ? GREEN : RED),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => formatCurrency(ctx.parsed.y) },
        },
      },
      scales: {
        x: {
          ticks: { color: TEXT_MUTED, font: { family: 'JetBrains Mono', size: 11 } },
          grid: { color: BORDER },
        },
        y: {
          ticks: { color: TEXT_MUTED, callback: v => '$' + v.toFixed(0), font: { family: 'JetBrains Mono', size: 11 } },
          grid: { color: BORDER },
        },
      },
    },
  });
}

// ── Allocation donut ──────────────────────────────────────────────────────────

function initDonutChart(containerId, data) {
  const canvas = document.getElementById(containerId);
  if (!canvas) return null;

  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        data: data.map(d => d.value),
        backgroundColor: [ACCENT + 'cc', '#3d9cff' + 'cc', '#ffa940' + 'cc', '#ff4757' + 'cc'],
        borderColor: SURFACE,
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: TEXT_MUTED, font: { family: 'DM Sans', size: 12 }, padding: 16 },
        },
        tooltip: {
          callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}%` },
        },
      },
    },
  });
}

// ── Strategy horizontal bar ───────────────────────────────────────────────────

function initStrategyChart(containerId, data) {
  const canvas = document.getElementById(containerId);
  if (!canvas) return null;

  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.strategy),
      datasets: [{
        label: 'P&L by Strategy',
        data: data.map(d => d.pnl),
        backgroundColor: data.map(d => d.pnl >= 0 ? GREEN + 'cc' : RED + 'cc'),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => formatCurrency(ctx.parsed.x) },
        },
      },
      scales: {
        x: {
          ticks: { color: TEXT_MUTED, callback: v => '$' + v.toFixed(0), font: { family: 'JetBrains Mono', size: 11 } },
          grid: { color: BORDER },
        },
        y: {
          ticks: { color: TEXT_MUTED, font: { family: 'JetBrains Mono', size: 11 } },
          grid: { color: BORDER },
        },
      },
    },
  });
}

// ── Equity curve ──────────────────────────────────────────────────────────────

function initEquityCurve(containerId, trades) {
  const canvas = document.getElementById(containerId);
  if (!canvas) return null;

  const sorted = [...trades]
    .filter(t => t.date_exit && t.pnl !== null)
    .sort((a, b) => a.date_exit.localeCompare(b.date_exit));

  let cum = 0;
  const labels = [];
  const values = [];
  sorted.forEach(t => {
    cum += t.pnl || 0;
    labels.push(t.date_exit);
    values.push(round2(cum));
  });

  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 200);
  gradient.addColorStop(0, ACCENT + '44');
  gradient.addColorStop(1, ACCENT + '00');

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Equity',
        data: values,
        borderColor: ACCENT,
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => formatCurrency(ctx.parsed.y) } },
      },
      scales: {
        x: { ticks: { color: TEXT_MUTED, maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 11 } }, grid: { color: BORDER } },
        y: { ticks: { color: TEXT_MUTED, callback: v => '$' + v.toFixed(0), font: { family: 'JetBrains Mono', size: 11 } }, grid: { color: BORDER } },
      },
    },
  });
}

// ── Drawdown chart ────────────────────────────────────────────────────────────

function initDrawdownChart(containerId, trades) {
  const canvas = document.getElementById(containerId);
  if (!canvas) return null;

  const sorted = [...trades]
    .filter(t => t.date_exit && t.pnl !== null)
    .sort((a, b) => a.date_exit.localeCompare(b.date_exit));

  let cum = 0;
  let peak = 0;
  const labels = [];
  const drawdowns = [];

  sorted.forEach(t => {
    cum += t.pnl || 0;
    peak = Math.max(peak, cum);
    const dd = peak > 0 ? ((cum - peak) / peak * 100) : 0;
    labels.push(t.date_exit);
    drawdowns.push(round2(dd));
  });

  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 200);
  gradient.addColorStop(0, RED + '66');
  gradient.addColorStop(1, RED + '00');

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Drawdown %',
        data: drawdowns,
        borderColor: RED,
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.parsed.y.toFixed(2) + '%' } },
      },
      scales: {
        x: { ticks: { color: TEXT_MUTED, maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 11 } }, grid: { color: BORDER } },
        y: { ticks: { color: TEXT_MUTED, callback: v => v.toFixed(1) + '%', font: { family: 'JetBrains Mono', size: 11 } }, grid: { color: BORDER } },
      },
    },
  });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
