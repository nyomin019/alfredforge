/**
 * AlfredForge — Setup wizard (5-step first-run config)
 */

const SetupWizard = {
  step: 1,
  totalSteps: 5,
  data: {},

  show() {
    document.getElementById('setup-overlay').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    this.step = 1;
    this.render();
  },

  render() {
    const container = document.getElementById('wizard-body');
    const dots = document.getElementById('wizard-dots');
    const prevBtn = document.getElementById('wizard-prev');
    const nextBtn = document.getElementById('wizard-next');
    const title = document.getElementById('wizard-title');

    if (!container) return;

    // Progress dots
    dots.innerHTML = '';
    for (let i = 1; i <= this.totalSteps; i++) {
      const dot = document.createElement('div');
      dot.className = 'wizard-dot' + (i === this.step ? ' active' : '') + (i < this.step ? ' done' : '');
      dots.appendChild(dot);
    }

    prevBtn.style.display = this.step === 1 ? 'none' : 'inline-flex';
    nextBtn.textContent = this.step === this.totalSteps ? 'Finish' : 'Next →';

    const steps = [
      {
        title: 'Welcome to AlfredForge',
        html: `
          <div class="wizard-welcome">
            <div class="wizard-logo">AF</div>
            <p class="wizard-desc">Professional trading dashboard for paper options trading and portfolio monitoring.</p>
            <p class="wizard-desc">Let's set up your configuration in a few quick steps.</p>
            <div class="wizard-features">
              <div class="wizard-feature">Options paper trading via Alfred</div>
              <div class="wizard-feature">Real-time candle charts</div>
              <div class="wizard-feature">P&L analytics and equity curve</div>
              <div class="wizard-feature">OpenClaw gateway integration</div>
            </div>
          </div>
        `,
      },
      {
        title: 'OpenClaw Connection',
        html: `
          <div class="wizard-form">
            <div class="form-group">
              <label class="form-label">Gateway Endpoint</label>
              <input class="form-input" id="wiz-endpoint" type="text" placeholder="http://localhost:18789" value="${this.data.openclaw_endpoint || 'http://localhost:18789'}">
              <span class="form-hint">Your local OpenClaw gateway URL</span>
            </div>
            <div class="form-group">
              <label class="form-label">Auth Token</label>
              <input class="form-input" id="wiz-token" type="password" placeholder="Paste gateway token here" value="${this.data.openclaw_token || ''}">
              <span class="form-hint">Found in ~/.openclaw/openclaw.json → gateway.auth.token</span>
            </div>
            <button class="btn btn-ghost" id="wiz-test-btn" onclick="SetupWizard.testConnection()">Test Connection</button>
            <div id="wiz-test-result" class="wizard-test-result"></div>
          </div>
        `,
      },
      {
        title: 'Model Configuration',
        html: `
          <div class="wizard-form">
            <div class="form-group">
              <label class="form-label">Primary Model</label>
              <select class="form-input" id="wiz-primary-model">
                <option value="google/gemini-2.5-flash" ${(this.data.primary_model || 'google/gemini-2.5-flash') === 'google/gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash (recommended)</option>
                <option value="anthropic/claude-haiku-4-5" ${this.data.primary_model === 'anthropic/claude-haiku-4-5' ? 'selected' : ''}>Claude Haiku 4.5</option>
                <option value="minimax/MiniMax-M2.5" ${this.data.primary_model === 'minimax/MiniMax-M2.5' ? 'selected' : ''}>MiniMax M2.5</option>
                <option value="ollama/qwen2.5:32b" ${this.data.primary_model === 'ollama/qwen2.5:32b' ? 'selected' : ''}>Qwen2.5 32B (local)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Fallback Model</label>
              <select class="form-input" id="wiz-fallback-model">
                <option value="minimax/MiniMax-M2.5" ${(this.data.fallback_model || 'minimax/MiniMax-M2.5') === 'minimax/MiniMax-M2.5' ? 'selected' : ''}>MiniMax M2.5</option>
                <option value="google/gemini-2.5-flash" ${this.data.fallback_model === 'google/gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash</option>
                <option value="ollama/qwen2.5:32b" ${this.data.fallback_model === 'ollama/qwen2.5:32b' ? 'selected' : ''}>Qwen2.5 32B (local)</option>
              </select>
            </div>
          </div>
        `,
      },
      {
        title: 'Portfolio Setup',
        html: `
          <div class="wizard-form">
            <div class="form-group">
              <label class="form-label">Total Capital (AUD)</label>
              <input class="form-input" id="wiz-capital" type="number" min="0" step="100" value="${this.data.capital_total_aud || 2000}">
            </div>
            <div class="form-group">
              <label class="form-label">Options Allocation %</label>
              <input class="form-input" id="wiz-alloc-options" type="number" min="0" max="100" value="${this.data.allocation_options_pct ?? 60}">
            </div>
            <div class="form-group">
              <label class="form-label">Crypto Allocation %</label>
              <input class="form-input" id="wiz-alloc-crypto" type="number" min="0" max="100" value="${this.data.allocation_crypto_pct ?? 20}">
            </div>
            <div class="form-group">
              <label class="form-label">Cash Allocation %</label>
              <input class="form-input" id="wiz-alloc-cash" type="number" min="0" max="100" value="${this.data.allocation_cash_pct ?? 20}">
            </div>
            <div class="form-group">
              <label class="form-label">Monthly Contribution (AUD)</label>
              <input class="form-input" id="wiz-monthly" type="number" min="0" step="50" value="${this.data.monthly_contribution || 0}">
            </div>
          </div>
        `,
      },
      {
        title: 'All Set!',
        html: `
          <div class="wizard-welcome">
            <div class="wizard-logo wizard-logo--green">✓</div>
            <p class="wizard-desc">Your AlfredForge dashboard is configured and ready.</p>
            <p class="wizard-desc">Click <strong>Finish</strong> to launch the dashboard and start monitoring your paper trades.</p>
            <div class="wizard-features">
              <div class="wizard-feature">Trades imported from paper-trades.json and sim file</div>
              <div class="wizard-feature">Live chart data from yfinance</div>
              <div class="wizard-feature">Auto-refreshes every 5 seconds</div>
            </div>
          </div>
        `,
      },
    ];

    const step = steps[this.step - 1];
    title.textContent = step.title;
    container.innerHTML = step.html;
  },

  _collectStep() {
    switch (this.step) {
      case 2:
        this.data.openclaw_endpoint = document.getElementById('wiz-endpoint')?.value || 'http://localhost:18789';
        this.data.openclaw_token = document.getElementById('wiz-token')?.value || '';
        break;
      case 3:
        this.data.primary_model = document.getElementById('wiz-primary-model')?.value || 'google/gemini-2.5-flash';
        this.data.fallback_model = document.getElementById('wiz-fallback-model')?.value || 'minimax/MiniMax-M2.5';
        break;
      case 4:
        this.data.capital_total_aud = parseFloat(document.getElementById('wiz-capital')?.value) || 2000;
        this.data.allocation_options_pct = parseInt(document.getElementById('wiz-alloc-options')?.value) || 60;
        this.data.allocation_crypto_pct = parseInt(document.getElementById('wiz-alloc-crypto')?.value) || 20;
        this.data.allocation_cash_pct = parseInt(document.getElementById('wiz-alloc-cash')?.value) || 20;
        this.data.monthly_contribution = parseFloat(document.getElementById('wiz-monthly')?.value) || 0;
        break;
    }
  },

  next() {
    this._collectStep();
    if (this.step === this.totalSteps) {
      this.finish();
      return;
    }
    this.step++;
    this.render();
  },

  prev() {
    if (this.step > 1) {
      this._collectStep();
      this.step--;
      this.render();
    }
  },

  async testConnection() {
    const endpoint = document.getElementById('wiz-endpoint')?.value;
    const token = document.getElementById('wiz-token')?.value;
    const resultEl = document.getElementById('wiz-test-result');
    if (resultEl) resultEl.textContent = 'Testing…';

    try {
      const resp = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, token }),
      });
      const data = await resp.json();
      if (resultEl) {
        resultEl.textContent = data.ok ? '✓ ' + data.message : '✗ ' + data.message;
        resultEl.className = 'wizard-test-result ' + (data.ok ? 'test-ok' : 'test-fail');
      }
    } catch (e) {
      if (resultEl) {
        resultEl.textContent = '✗ Connection failed: ' + e.message;
        resultEl.className = 'wizard-test-result test-fail';
      }
    }
  },

  async finish() {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.data, setup_complete: true }),
      });
    } catch (e) {
      console.error('Failed to save config:', e);
    }
    document.getElementById('setup-overlay').classList.add('hidden');
    App.init();
  },
};
