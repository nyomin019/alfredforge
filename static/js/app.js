/**
 * AlfredForge — Main application router
 */

const App = {
  currentTab: 'overview',
  portfolio: null,
  _pollTimer: null,
  _clockTimer: null,

  async init() {
    let status;
    try {
      status = await fetch('/api/status').then(r => r.json());
    } catch (e) {
      status = { setup_complete: false };
    }

    if (!status.setup_complete) {
      SetupWizard.show();
      return;
    }

    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('setup-overlay').classList.add('hidden');

    this.initClock();
    this.initNavLinks();

    await this.poll();
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => this.poll(), 5000);

    this.switchTab('overview');
  },

  initClock() {
    if (this._clockTimer) clearInterval(this._clockTimer);
    const el = document.getElementById('aest-clock');
    if (!el) return;

    const etFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const etDateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
    });
    const aestFmt = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const aestDateFmt = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      day: '2-digit', month: 'short', year: 'numeric',
    });

    const getMarketStatus = (now) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
      }).formatToParts(now);
      const get = t => parts.find(p => p.type === t)?.value;
      const day = get('weekday');
      const h = parseInt(get('hour'));
      const m = parseInt(get('minute'));
      const mins = h * 60 + m;

      if (day === 'Sat' || day === 'Sun') return { label: 'MARKET CLOSED', cls: 'market-closed' };

      if (mins >= 630 && mins < 690)  return { label: 'ENTRY WINDOW', cls: 'market-entry' }; // 10:30–11:30 ET
      if (mins >= 570 && mins < 960)  return { label: 'NYSE OPEN', cls: 'market-open' };      // 9:30–4:00 ET
      if (mins >= 480 && mins < 570)  return { label: 'PRE-MARKET', cls: 'market-pre' };      // 8:00–9:30 ET
      if (mins >= 960 && mins < 1200) return { label: 'AFTER HOURS', cls: 'market-after' };   // 4:00–8:00 PM ET
      return { label: 'MARKET CLOSED', cls: 'market-closed' };
    };

    const update = () => {
      const now = new Date();
      const aestTime = aestFmt.format(now);
      const aestDate = aestDateFmt.format(now);
      const etTime = etFmt.format(now);
      const status = getMarketStatus(now);

      el.innerHTML =
        `<span class="clock-aest">${aestDate} &nbsp;${aestTime} AEST</span>` +
        `<span class="clock-sep">·</span>` +
        `<span class="clock-et">NY ${etTime}</span>` +
        `<span class="clock-sep">·</span>` +
        `<span class="market-status ${status.cls}">${status.label}</span>`;
    };

    update();
    this._clockTimer = setInterval(update, 1000);
  },

  async poll() {
    let portfolio = null, status = null, vix = null;
    try {
      [portfolio, status, vix] = await Promise.all([
        fetch('/api/portfolio').then(r => r.json()),
        fetch('/api/status').then(r => r.json()),
        fetch('/api/vix').then(r => r.json()),
      ]);
    } catch (e) {
      // network error, skip update
    }
    if (portfolio) {
      this.portfolio = portfolio;
      this.updateTopbar(portfolio);
    }
    if (status) {
      this.updateStatusDots(status);
    }
    if (vix) {
      this.updateVix(vix);
    }
  },

  updateVix(v) {
    const el = document.getElementById('vix-badge');
    if (!el || v.vix === null || v.vix === undefined) return;
    const val = Number(v.vix).toFixed(1);
    const inRange = v.in_range;
    el.textContent = `VIX ${val} ${inRange ? 'IN RANGE' : 'OUT OF RANGE'}`;
    el.className = 'topbar-vix ' + (inRange ? 'topbar-vix--ok' : 'topbar-vix--warn');
    el.classList.remove('hidden');
  },

  updateTopbar(p) {
    const totalEl = document.getElementById('topbar-total');
    const todayEl = document.getElementById('topbar-today');
    const alltimeEl = document.getElementById('topbar-alltime');

    if (totalEl) {
      const capital = p.capital_total_aud || 2000;
      const totalValue = capital + (p.total_pnl || 0);
      totalEl.textContent = formatCurrency(totalValue);
    }
    if (todayEl) {
      // Today P&L is not tracked separately yet — show total as placeholder
      todayEl.textContent = '—';
    }
    if (alltimeEl) {
      const pnl = p.total_pnl || 0;
      alltimeEl.textContent = pnlStr(pnl);
      alltimeEl.className = 'topbar-value ' + pnlClass(pnl);
    }
  },

  updateStatusDots(s) {
    const alfredDot = document.getElementById('dot-alfred');
    const claudeDot = document.getElementById('dot-claude');

    if (alfredDot) {
      alfredDot.className = 'status-dot ' + (s.openclaw?.online ? 'status-dot--online' : 'status-dot--offline');
    }
    if (claudeDot) {
      // Claude Code is always available if the app is running
      claudeDot.className = 'status-dot status-dot--online';
    }
  },

  switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach(el => el.classList.add('hidden'));
    const panel = document.getElementById('tab-' + name);
    if (panel) panel.classList.remove('hidden');

    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const link = document.querySelector(`.nav-link[data-tab="${name}"]`);
    if (link) link.classList.add('active');

    this.currentTab = name;

    const tabMap = {
      overview: typeof OverviewTab !== 'undefined' ? OverviewTab : null,
      options: typeof OptionsTab !== 'undefined' ? OptionsTab : null,
      crypto: typeof CryptoTab !== 'undefined' ? CryptoTab : null,
      agent: typeof AgentTab !== 'undefined' ? AgentTab : null,
      history: typeof HistoryTab !== 'undefined' ? HistoryTab : null,
      settings: typeof SettingsTab !== 'undefined' ? SettingsTab : null,
    };

    const tab = tabMap[name];
    if (tab && typeof tab.load === 'function') {
      tab.load().catch(e => console.error(`Tab ${name} load error:`, e));
    }
  },

  initNavLinks() {
    document.querySelectorAll('.nav-link[data-tab]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        App.switchTab(el.dataset.tab);
      });
    });
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
