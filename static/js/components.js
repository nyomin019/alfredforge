/**
 * AlfredForge — Shared UI components and utilities
 */

// ── Formatters ────────────────────────────────────────────────────────────────

function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(n, showSign = true) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const sign = showSign && n > 0 ? '+' : '';
  return sign + Number(n).toFixed(1) + '%';
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(',', '');
}

function formatMono(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toFixed(decimals);
}

function pnlClass(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return n >= 0 ? 'pnl-positive' : 'pnl-negative';
}

function pnlStr(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '-';
  return sign + '$' + abs.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatUptime(secs) {
  if (!secs) return '0s';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── DOM Components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, subtitle, type = 'default' }) {
  const card = document.createElement('div');
  card.className = `metric-card metric-card--${type}`;

  const lbl = document.createElement('div');
  lbl.className = 'metric-label';
  lbl.textContent = label;

  const val = document.createElement('div');
  val.className = 'metric-value';
  if (typeof value === 'string' && (value.startsWith('+') || value.startsWith('-'))) {
    val.className += ' ' + (value.startsWith('+') ? 'pnl-positive' : 'pnl-negative');
  }
  val.textContent = value;

  card.appendChild(lbl);
  card.appendChild(val);

  if (subtitle) {
    const sub = document.createElement('div');
    sub.className = 'metric-subtitle';
    sub.textContent = subtitle;
    card.appendChild(sub);
  }

  return card;
}

function Badge(text, type) {
  const span = document.createElement('span');
  span.className = `badge badge--${(type || text || '').toLowerCase()}`;
  span.textContent = text;
  return span;
}

function StatusDot(active) {
  const span = document.createElement('span');
  span.className = 'status-dot ' + (active ? 'status-dot--online' : 'status-dot--offline');
  return span;
}

// ── Table Builder ─────────────────────────────────────────────────────────────

function buildTable(columns, rows, { paginate = false, sortable = false, exportId = null } = {}) {
  const PAGE_SIZE = 50;
  let currentPage = 0;
  let sortCol = -1;
  let sortDir = 1;
  let currentRows = [...rows];

  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';

  function renderTable(rowsToRender) {
    const start = paginate ? currentPage * PAGE_SIZE : 0;
    const pageRows = paginate ? rowsToRender.slice(start, start + PAGE_SIZE) : rowsToRender;

    const table = document.createElement('table');
    table.className = 'data-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach((col, i) => {
      const th = document.createElement('th');
      th.textContent = col;
      if (sortable) {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          if (sortCol === i) sortDir *= -1;
          else { sortCol = i; sortDir = 1; }
          currentRows.sort((a, b) => {
            const av = a[i], bv = b[i];
            if (av === bv) return 0;
            return (av < bv ? -1 : 1) * sortDir;
          });
          currentPage = 0;
          refresh();
        });
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    pageRows.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        if (typeof cell === 'string' && (cell.startsWith('+$') || cell.startsWith('-$'))) {
          td.className = cell.startsWith('+') ? 'pnl-positive' : 'pnl-negative';
        }
        if (typeof cell === 'object' && cell instanceof HTMLElement) {
          td.appendChild(cell);
        } else {
          td.textContent = cell ?? '—';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function refresh() {
    wrapper.innerHTML = '';
    wrapper.appendChild(renderTable(currentRows));

    if (paginate && currentRows.length > PAGE_SIZE) {
      const pager = document.createElement('div');
      pager.className = 'table-pager';
      const totalPages = Math.ceil(currentRows.length / PAGE_SIZE);

      const prevBtn = document.createElement('button');
      prevBtn.className = 'btn btn-ghost btn--sm';
      prevBtn.textContent = '← Prev';
      prevBtn.disabled = currentPage === 0;
      prevBtn.addEventListener('click', () => { currentPage--; refresh(); });

      const info = document.createElement('span');
      info.className = 'pager-info';
      info.textContent = `Page ${currentPage + 1} of ${totalPages} (${currentRows.length} rows)`;

      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn btn-ghost btn--sm';
      nextBtn.textContent = 'Next →';
      nextBtn.disabled = currentPage >= totalPages - 1;
      nextBtn.addEventListener('click', () => { currentPage++; refresh(); });

      pager.appendChild(prevBtn);
      pager.appendChild(info);
      pager.appendChild(nextBtn);
      wrapper.appendChild(pager);
    }

    if (exportId) {
      const exportBtn = document.getElementById(exportId);
      if (exportBtn) {
        exportBtn.onclick = () => exportCSV(columns, currentRows, exportId);
      }
    }
  }

  refresh();
  return wrapper;
}

function exportCSV(columns, rows, filename) {
  const lines = [columns.join(',')];
  rows.forEach(row => {
    lines.push(row.map(cell => {
      const s = (cell instanceof HTMLElement ? cell.textContent : String(cell ?? '')).replace(/"/g, '""');
      return `"${s}"`;
    }).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
