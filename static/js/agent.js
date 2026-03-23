/**
 * AlfredForge — Agent monitor tab
 */

const AgentTab = {
  async load() {
    let status = {}, tokens = {}, metrics = {}, log = [];
    try {
      [status, tokens, metrics, log] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/tokens').then(r => r.json()),
        fetch('/api/metrics').then(r => r.json()),
        fetch('/api/agent/log').then(r => r.json()),
      ]);
    } catch (e) {
      console.error('Agent tab load error:', e);
    }

    this.renderAlfredPanel(status, tokens);
    this.renderMetricsPanel(metrics);
    this.renderLog(log);
  },

  renderAlfredPanel(status, tokens) {
    const container = document.getElementById('alfred-status');
    if (!container) return;

    const oc = status.openclaw || {};
    const isOnline = oc.online;
    const latency = oc.latency_ms != null ? `${oc.latency_ms}ms` : '—';

    const monthBudgetUsd = 10;
    const usedPct = Math.min(100, ((tokens.cost_month_usd || 0) / monthBudgetUsd) * 100);

    container.innerHTML = `
      <div class="agent-status-row">
        <span class="status-dot ${isOnline ? 'status-dot--online' : 'status-dot--offline'}"></span>
        <span class="agent-label">${isOnline ? 'Connected' : 'Offline'}</span>
        <span class="agent-latency">${isOnline ? latency : '—'}</span>
      </div>
      <div class="agent-detail-row">
        <span class="detail-label">Endpoint</span>
        <span class="detail-value mono">${status.openclaw?.online ? 'localhost:18789' : '—'}</span>
      </div>
      <div class="agent-detail-row">
        <span class="detail-label">Broker (Stocks)</span>
        <span class="detail-value">${status.broker_stocks || 'skip'}</span>
      </div>
      <div class="agent-detail-row">
        <span class="detail-label">Broker (Crypto)</span>
        <span class="detail-value">${status.broker_crypto || 'skip'}</span>
      </div>

      <div class="agent-divider"></div>
      <h4 class="agent-section-title">Token Usage</h4>

      <div class="agent-detail-row">
        <span class="detail-label">Today</span>
        <span class="detail-value mono">${(tokens.today || 0).toLocaleString()} tokens</span>
      </div>
      <div class="agent-detail-row">
        <span class="detail-label">This month</span>
        <span class="detail-value mono">${(tokens.month || 0).toLocaleString()} tokens</span>
      </div>
      <div class="agent-detail-row">
        <span class="detail-label">Cost today</span>
        <span class="detail-value mono">$${(tokens.cost_today_usd || 0).toFixed(4)}</span>
      </div>
      <div class="agent-detail-row">
        <span class="detail-label">Cost this month</span>
        <span class="detail-value mono">$${(tokens.cost_month_usd || 0).toFixed(4)}</span>
      </div>

      <div class="usage-bar-wrap">
        <div class="usage-bar">
          <div class="usage-bar-fill" style="width: ${usedPct.toFixed(1)}%"></div>
        </div>
        <span class="usage-bar-label">${usedPct.toFixed(1)}% of $${monthBudgetUsd} budget</span>
      </div>
    `;
  },

  renderMetricsPanel(m) {
    const container = document.getElementById('system-metrics');
    if (!container) return;

    const cpuClass = (m.cpu_pct || 0) > 80 ? 'metric-warn' : '';
    const memClass = (m.mem_pct || 0) > 85 ? 'metric-warn' : '';

    container.innerHTML = `
      <div class="sys-metric">
        <div class="sys-metric-label">CPU Usage</div>
        <div class="sys-metric-bar-wrap">
          <div class="sys-metric-bar">
            <div class="sys-metric-fill ${cpuClass}" style="width: ${Math.min(100, m.cpu_pct || 0)}%"></div>
          </div>
          <span class="sys-metric-value ${cpuClass}">${(m.cpu_pct || 0).toFixed(1)}%</span>
        </div>
      </div>
      <div class="sys-metric">
        <div class="sys-metric-label">Memory Usage</div>
        <div class="sys-metric-bar-wrap">
          <div class="sys-metric-bar">
            <div class="sys-metric-fill ${memClass}" style="width: ${Math.min(100, m.mem_pct || 0)}%"></div>
          </div>
          <span class="sys-metric-value ${memClass}">${(m.mem_pct || 0).toFixed(1)}%</span>
        </div>
      </div>
      <div class="agent-detail-row" style="margin-top:16px">
        <span class="detail-label">RAM</span>
        <span class="detail-value mono">${(m.mem_used_gb || 0).toFixed(1)} / ${(m.mem_total_gb || 0).toFixed(1)} GB</span>
      </div>
      <div class="agent-detail-row">
        <span class="detail-label">DB Size</span>
        <span class="detail-value mono">${m.db_size_kb || 0} KB</span>
      </div>
      <div class="agent-detail-row">
        <span class="detail-label">Uptime</span>
        <span class="detail-value mono">${formatUptime(m.uptime_s || 0)}</span>
      </div>
    `;
  },

  renderLog(log) {
    const container = document.getElementById('agent-log');
    if (!container) return;

    if (!log || !log.length) {
      container.innerHTML = '<div class="empty-state">No log entries yet</div>';
      return;
    }

    container.innerHTML = log.map(entry =>
      `<div class="log-line">
        <span class="log-ts">${entry.ts || ''}</span>
        <span class="log-level log-level--${(entry.level || 'info').toLowerCase()}">${(entry.level || 'INFO').toUpperCase()}</span>
        <span class="log-agent">[${entry.agent || 'system'}]</span>
        <span class="log-msg">${escapeHtml(entry.message || '')}</span>
      </div>`
    ).join('');
  },
};
