/**
 * AlfredForge — Overview dashboard tab
 */

const OverviewTab = {
  _charts: {},

  async load() {
    let portfolio = {}, monthly = [], strategy = [], cumulative = [], log = [], milestone = {};
    try {
      [portfolio, monthly, strategy, cumulative, log, milestone] = await Promise.all([
        fetch('/api/portfolio').then(r => r.json()),
        fetch('/api/monthly-pnl?source=paper').then(r => r.json()),
        fetch('/api/strategy-pnl').then(r => r.json()),
        fetch('/api/cumulative-pnl?source=paper').then(r => r.json()),
        fetch('/api/agent/log').then(r => r.json()),
        fetch('/api/milestone').then(r => r.json()),
      ]);
    } catch (e) {
      console.error('Overview load error:', e);
    }

    this.renderMilestone(milestone);
    this.renderMetrics(portfolio, milestone);
    this.renderPortfolioChart(cumulative);
    this.renderAllocationDonut(portfolio);
    this.renderMonthlyChart(monthly);
    this.renderStrategyChart(strategy);
    this.renderAgentFeed(log);
  },

  renderMilestone(m) {
    const banner = document.getElementById('milestone-banner');
    if (!banner || !m) return;

    const closed = m.closed || 0;
    const goal = m.goal || 20;
    const pct = m.pct_complete || 0;
    const wr = m.win_rate || 0;
    const onTrack = m.on_track;
    const statusColor = onTrack ? 'var(--accent)' : 'var(--red)';
    const statusLabel = closed === 0 ? 'Starting' : (onTrack ? `WR ${wr.toFixed(0)}% ✓` : `WR ${wr.toFixed(0)}% ✗`);

    banner.innerHTML = `
      <div class="milestone-card">
        <div class="milestone-header">
          <span class="milestone-title">PAPER TRADE MILESTONE</span>
          <span class="milestone-count">${closed}/${goal} trades closed</span>
          <span class="milestone-badge" style="color:${statusColor};border-color:${statusColor}22;background:${statusColor}11">${statusLabel}</span>
          <span class="milestone-eta">${goal - closed} to go</span>
        </div>
        <div class="milestone-track">
          <div class="milestone-fill" style="width:${Math.min(pct, 100)}%;background:${statusColor}"></div>
        </div>
        <div class="milestone-sub">
          ${pct.toFixed(0)}% complete &nbsp;·&nbsp; Goal: ${goal} closed trades with &gt;60% WR to unlock live trading
          &nbsp;·&nbsp; ${m.skipped || 0} skipped · ${m.open || 0} open · Total P&amp;L ${pnlStr(m.total_pnl || 0)}
        </div>
      </div>`;
  },

  renderMetrics(p, m) {
    const container = document.getElementById('overview-metrics');
    if (!container) return;
    container.innerHTML = '';

    // Show paper-only stats from by_source
    const paper = (p.by_source || {}).paper || {};
    const paperPnl = paper.pnl || 0;
    const paperWR = paper.win_rate || 0;
    const capital = p.capital_total_aud || 2000;

    const cards = [
      { label: 'Paper Capital', value: formatCurrency(capital + paperPnl), subtitle: 'Paper account value', type: 'primary' },
      { label: 'Paper P&L', value: pnlStr(paperPnl), subtitle: `${paper.total || 0} closed trades`, type: paperPnl >= 0 ? 'positive' : 'negative' },
      { label: 'Paper Win Rate', value: formatPct(paperWR, false), subtitle: `${paper.wins || 0}W / ${paper.losses || 0}L`, type: paperWR >= 60 ? 'positive' : 'default' },
      { label: 'Avg Win', value: formatCurrency(m.avg_win || 0), subtitle: 'Per winning trade', type: 'positive' },
      { label: 'Best Trade', value: formatCurrency(m.best_trade || 0), subtitle: 'Paper trading', type: 'positive' },
    ];

    cards.forEach(c => container.appendChild(MetricCard(c)));
  },

  renderPortfolioChart(data) {
    const el = document.getElementById('chart-portfolio');
    if (!data || !data.length) {
      if (el) el.innerHTML = '<div class="chart-empty">No paper trades closed yet</div>';
      return;
    }
    this._charts.portfolio = initPortfolioChart('chart-portfolio', data);
  },

  renderAllocationDonut(p) {
    const data = [
      { label: 'Options', value: p.allocation_options_pct || 60 },
      { label: 'Crypto', value: p.allocation_crypto_pct || 20 },
      { label: 'Cash', value: p.allocation_cash_pct || 20 },
    ];
    this._charts.donut = initDonutChart('chart-allocation', data);
  },

  renderMonthlyChart(data) {
    if (!data || !data.length) {
      const el = document.getElementById('chart-monthly');
      if (el) el.innerHTML = '<div class="chart-empty">No monthly data yet</div>';
      return;
    }
    this._charts.monthly = initPnlBarChart('chart-monthly', data);
  },

  renderStrategyChart(data) {
    if (!data || !data.length) {
      const el = document.getElementById('chart-strategy');
      if (el) el.innerHTML = '<div class="chart-empty">No strategy data yet</div>';
      return;
    }
    this._charts.strategy = initStrategyChart('chart-strategy', data);
  },

  renderAgentFeed(logs) {
    const feed = document.getElementById('agent-feed');
    if (!feed) return;

    if (!logs || !logs.length) {
      feed.innerHTML = '<div class="empty-state">No agent activity yet</div>';
      return;
    }

    feed.innerHTML = logs.map(l =>
      `<div class="feed-entry">
        <span class="feed-time">${formatDate(l.ts)}</span>
        <span class="feed-msg">${escapeHtml(l.message || '')}</span>
      </div>`
    ).join('');
  },
};

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// ── Settings tab ──────────────────────────────────────────────────────────────

const SettingsTab = {
  async load() {
    let cfg = {};
    try {
      cfg = await fetch('/api/config').then(r => r.json());
    } catch (e) {}
    this.render(cfg);
  },

  render(cfg) {
    const container = document.getElementById('settings-form');
    if (!container) return;

    container.innerHTML = `
      <div class="settings-grid">
        <div class="settings-section">
          <h3 class="settings-section-title">OpenClaw Gateway</h3>
          <div class="form-group">
            <label class="form-label">Endpoint URL</label>
            <input class="form-input" id="cfg-endpoint" type="text" value="${cfg.openclaw_endpoint || 'http://localhost:18789'}">
          </div>
          <div class="form-group">
            <label class="form-label">Auth Token</label>
            <input class="form-input" id="cfg-token" type="password" placeholder="Leave blank to keep existing">
          </div>
          <button class="btn btn-ghost" onclick="SettingsTab.testConnection()">Test Connection</button>
          <div id="cfg-test-result" class="wizard-test-result" style="margin-top:8px"></div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Models</h3>
          <div class="form-group">
            <label class="form-label">Primary Model</label>
            <select class="form-input" id="cfg-primary-model">
              <option value="google/gemini-2.5-flash" ${cfg.primary_model === 'google/gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash</option>
              <option value="anthropic/claude-haiku-4-5" ${cfg.primary_model === 'anthropic/claude-haiku-4-5' ? 'selected' : ''}>Claude Haiku 4.5</option>
              <option value="minimax/MiniMax-M2.5" ${cfg.primary_model === 'minimax/MiniMax-M2.5' ? 'selected' : ''}>MiniMax M2.5</option>
              <option value="ollama/qwen2.5:32b" ${cfg.primary_model === 'ollama/qwen2.5:32b' ? 'selected' : ''}>Qwen2.5 32B (local)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fallback Model</label>
            <select class="form-input" id="cfg-fallback-model">
              <option value="minimax/MiniMax-M2.5" ${cfg.fallback_model === 'minimax/MiniMax-M2.5' ? 'selected' : ''}>MiniMax M2.5</option>
              <option value="google/gemini-2.5-flash" ${cfg.fallback_model === 'google/gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash</option>
              <option value="ollama/qwen2.5:32b" ${cfg.fallback_model === 'ollama/qwen2.5:32b' ? 'selected' : ''}>Qwen2.5 32B (local)</option>
            </select>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Portfolio</h3>
          <div class="form-group">
            <label class="form-label">Total Capital (AUD)</label>
            <input class="form-input" id="cfg-capital" type="number" value="${cfg.capital_total_aud || 2000}">
          </div>
          <div class="form-group">
            <label class="form-label">Options Allocation %</label>
            <input class="form-input" id="cfg-options-pct" type="number" value="${cfg.allocation_options_pct ?? 60}">
          </div>
          <div class="form-group">
            <label class="form-label">Crypto Allocation %</label>
            <input class="form-input" id="cfg-crypto-pct" type="number" value="${cfg.allocation_crypto_pct ?? 20}">
          </div>
          <div class="form-group">
            <label class="form-label">Cash Allocation %</label>
            <input class="form-input" id="cfg-cash-pct" type="number" value="${cfg.allocation_cash_pct ?? 20}">
          </div>
          <div class="form-group">
            <label class="form-label">Monthly Contribution (AUD)</label>
            <input class="form-input" id="cfg-monthly" type="number" value="${cfg.monthly_contribution || 0}">
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Brokers</h3>
          <div class="form-group">
            <label class="form-label">Stocks Broker</label>
            <select class="form-input" id="cfg-broker-stocks">
              <option value="skip" ${cfg.broker_stocks === 'skip' ? 'selected' : ''}>Skip (paper trading only)</option>
              <option value="interactive_brokers" ${cfg.broker_stocks === 'interactive_brokers' ? 'selected' : ''}>Interactive Brokers</option>
              <option value="tastytrade" ${cfg.broker_stocks === 'tastytrade' ? 'selected' : ''}>tastytrade</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Crypto Broker</label>
            <select class="form-input" id="cfg-broker-crypto">
              <option value="skip" ${cfg.broker_crypto === 'skip' ? 'selected' : ''}>Skip</option>
              <option value="coinbase" ${cfg.broker_crypto === 'coinbase' ? 'selected' : ''}>Coinbase</option>
              <option value="binance" ${cfg.broker_crypto === 'binance' ? 'selected' : ''}>Binance</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-actions">
        <button class="btn btn-primary" onclick="SettingsTab.save()">Save Configuration</button>
        <div id="cfg-save-result" class="wizard-test-result" style="margin-top:8px"></div>
      </div>
    `;
  },

  async testConnection() {
    const endpoint = document.getElementById('cfg-endpoint')?.value;
    const token = document.getElementById('cfg-token')?.value;
    const resultEl = document.getElementById('cfg-test-result');
    if (resultEl) resultEl.textContent = 'Testing…';

    try {
      const resp = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, token: token || undefined }),
      });
      const data = await resp.json();
      if (resultEl) {
        resultEl.textContent = data.ok ? '✓ ' + data.message : '✗ ' + data.message;
        resultEl.className = 'wizard-test-result ' + (data.ok ? 'test-ok' : 'test-fail');
      }
    } catch (e) {
      if (resultEl) {
        resultEl.textContent = '✗ ' + e.message;
        resultEl.className = 'wizard-test-result test-fail';
      }
    }
  },

  async save() {
    const token = document.getElementById('cfg-token')?.value;
    const payload = {
      openclaw_endpoint: document.getElementById('cfg-endpoint')?.value,
      primary_model: document.getElementById('cfg-primary-model')?.value,
      fallback_model: document.getElementById('cfg-fallback-model')?.value,
      capital_total_aud: parseFloat(document.getElementById('cfg-capital')?.value) || 2000,
      allocation_options_pct: parseInt(document.getElementById('cfg-options-pct')?.value) || 60,
      allocation_crypto_pct: parseInt(document.getElementById('cfg-crypto-pct')?.value) || 20,
      allocation_cash_pct: parseInt(document.getElementById('cfg-cash-pct')?.value) || 20,
      monthly_contribution: parseFloat(document.getElementById('cfg-monthly')?.value) || 0,
      broker_stocks: document.getElementById('cfg-broker-stocks')?.value,
      broker_crypto: document.getElementById('cfg-broker-crypto')?.value,
    };
    if (token) payload.openclaw_token = token;

    try {
      const resp = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      const resultEl = document.getElementById('cfg-save-result');
      if (resultEl) {
        resultEl.textContent = data.ok ? '✓ Configuration saved' : '✗ Save failed';
        resultEl.className = 'wizard-test-result ' + (data.ok ? 'test-ok' : 'test-fail');
      }
    } catch (e) {
      const resultEl = document.getElementById('cfg-save-result');
      if (resultEl) {
        resultEl.textContent = '✗ ' + e.message;
        resultEl.className = 'wizard-test-result test-fail';
      }
    }
  },
};
