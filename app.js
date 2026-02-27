/* ============================================================
   CONTENT WEEKLY SCORECARD — App Logic
   ============================================================ */

// ── Globals ──────────────────────────────────────────────────
let charts = {};
let selectedWeekIdx = SCORECARD_DATA.length - 1;

// ── Utilities ────────────────────────────────────────────────

function fmt(n, style = 'num') {
  if (n == null) return '—';
  if (style === 'usd') return '$' + Math.round(n).toLocaleString();
  if (style === 'k')   return n >= 1000 ? (n/1000).toFixed(1).replace('.0','') + 'k' : n.toLocaleString();
  return n.toLocaleString();
}

function fmtDate(iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', opts);
}

function fmtWeekLabel(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function delta(curr, prev, invertGood = false) {
  if (!prev || prev === 0) return null;
  const pct = (curr - prev) / prev * 100;
  return invertGood ? -pct : pct;  // invert for cost/hours (less = good)
}

function deltaClass(pct) {
  if (pct == null) return 'flat';
  if (pct > 2)  return 'up';
  if (pct < -2) return 'down';
  return 'flat';
}

function deltaLabel(pct) {
  if (pct == null) return '—';
  const sign = pct > 0 ? '+' : '';
  const arrow = pct > 2 ? '↑' : pct < -2 ? '↓' : '→';
  return `${arrow} ${sign}${Math.abs(pct).toFixed(1)}%`;
}

function getCSS(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function rolling4wkCost(data, idx) {
  const start = Math.max(0, idx - 3);
  return data.slice(start, idx + 1).reduce((s, w) => s + w.prodCost, 0);
}

// ── Sparkline SVG ────────────────────────────────────────────

function buildSparkline(values, color) {
  const w = 100, h = 28, pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;

  const pts = values.map((v, i) => {
    const x = pad + (i / (n - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });

  const polyline = pts.map(p => p.join(',')).join(' ');
  const fillPath = `M${pts[0][0]},${h} ` +
    pts.map(p => `L${p[0]},${p[1]}`).join(' ') +
    ` L${pts[pts.length-1][0]},${h} Z`;

  return `
    <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="kpi-sparkline" style="width:100%;height:${h}px">
      <path d="${fillPath}" fill="${color}" opacity="0.12"/>
      <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
  `;
}

// ── Count-Up Animation ───────────────────────────────────────

function countUp(el, target, prefix = '', suffix = '') {
  const duration = 700;
  const start = performance.now();
  const isFloat = target !== Math.floor(target);

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    // easeOutExpo
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const value = eased * target;
    const display = isFloat
      ? value.toFixed(1)
      : Math.round(value).toLocaleString();
    el.textContent = prefix + display + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── KPI Cards ────────────────────────────────────────────────

const KPI_DEFS = [
  {
    key: 'total',
    label: 'Total Published',
    getValue: w => w.podcastEps + w.reels + w.ytShorts,
    format: n => fmt(n),
    color: () => getCSS('--c-podcast'),
    invertGood: false,
    accentHex: '#7C6EFA',
    sparkData: () => SCORECARD_DATA.map(w => w.podcastEps + w.reels + w.ytShorts)
  },
  {
    key: 'igReach',
    label: 'IG Reach',
    getValue: w => w.igReach,
    format: n => fmt(n, 'k'),
    color: () => getCSS('--c-reach'),
    invertGood: false,
    accentHex: '#64B5F6',
    sparkData: () => SCORECARD_DATA.map(w => w.igReach)
  },
  {
    key: 'igFollows',
    label: 'IG Follows',
    getValue: w => w.igFollows,
    format: n => fmt(n),
    color: () => '#10B981',
    invertGood: false,
    accentHex: '#4DD0A0',
    sparkData: () => SCORECARD_DATA.map(w => w.igFollows)
  },
  {
    key: 'plays',
    label: 'Podcast Plays',
    getValue: w => w.podcastPlays,
    format: n => fmt(n),
    color: () => getCSS('--c-podcast'),
    invertGood: false,
    accentHex: '#7C6EFA',
    sparkData: () => SCORECARD_DATA.map(w => w.podcastPlays)
  },
  {
    key: 'leads',
    label: 'Leads / DMs',
    getValue: w => w.leads,
    format: n => fmt(n),
    color: () => getCSS('--c-leads'),
    invertGood: false,
    accentHex: '#FFD54F',
    sparkData: () => SCORECARD_DATA.map(w => w.leads)
  },
  {
    key: 'prodCost',
    label: 'Prod Cost',
    getValue: w => w.prodCost,
    format: n => fmt(n, 'usd'),
    color: () => getCSS('--c-cost'),
    invertGood: true,
    accentHex: '#FF7043',
    sparkData: () => SCORECARD_DATA.map(w => w.prodCost),
    sub: () => {
      const r = rolling4wkCost(SCORECARD_DATA, selectedWeekIdx);
      return `4-wk total: ${fmt(r, 'usd')}`;
    }
  }
];

function renderKPIs() {
  const grid = document.getElementById('kpi-grid');
  const curr = SCORECARD_DATA[selectedWeekIdx];
  const prev = selectedWeekIdx > 0 ? SCORECARD_DATA[selectedWeekIdx - 1] : null;

  grid.innerHTML = KPI_DEFS.map((def, i) => {
    const currVal = def.getValue(curr);
    const prevVal = prev ? def.getValue(prev) : null;
    const pct = delta(currVal, prevVal, def.invertGood);
    const cls = deltaClass(pct);
    const lbl = deltaLabel(pct);
    const spark = buildSparkline(def.sparkData(), def.color());
    const sub = def.sub ? `<div class="week-card__note" style="margin-top:6px;font-size:11px;font-style:normal;color:var(--text-3)">${def.sub()}</div>` : '';

    return `
      <div class="kpi-card" style="animation-delay:${i*50}ms; --kpi-accent:${def.accentHex}">
        <div class="kpi-label">${def.label}</div>
        <div class="kpi-value" data-target="${currVal}" data-format="${def.key}">
          ${def.format(currVal)}
        </div>
        <span class="kpi-delta ${cls}">${lbl}</span>
        ${sub}
        ${spark}
      </div>
    `;
  }).join('');
}

// ── Charts ───────────────────────────────────────────────────

const LABELS = SCORECARD_DATA.map(w => fmtWeekLabel(w.weekOf));

Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = '#606078';
Chart.defaults.plugins.tooltip.backgroundColor = '#1E1E28';
Chart.defaults.plugins.tooltip.titleColor = '#F0F0FF';
Chart.defaults.plugins.tooltip.bodyColor = '#A0A0B8';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.padding = { x: 12, y: 10 };
Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 11 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 11 };
Chart.defaults.plugins.tooltip.displayColors = true;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 8;
Chart.defaults.plugins.legend.labels.boxHeight = 8;
Chart.defaults.plugins.legend.labels.color = '#A0A0B8';
Chart.defaults.plugins.legend.labels.font = { size: 11 };

const GRID_COLOR = 'rgba(255,255,255,0.04)';

function baseScales(tickFmt) {
  return {
    x: {
      grid: { display: false },
      ticks: { font: { size: 10 } }
    },
    y: {
      grid: { color: GRID_COLOR },
      border: { display: false },
      ticks: {
        font: { size: 10 },
        callback: tickFmt || (v => v)
      }
    }
  };
}

function initCharts() {
  // ── Chart 1: Publishing Volume (stacked bar)
  charts.publishing = new Chart(document.getElementById('chart-publishing'), {
    type: 'bar',
    data: {
      labels: LABELS,
      datasets: [
        {
          label: 'Podcast Eps',
          data: SCORECARD_DATA.map(w => w.podcastEps),
          backgroundColor: getCSS('--c-podcast'),
          borderRadius: 0,
          stack: 'pub'
        },
        {
          label: 'Reels',
          data: SCORECARD_DATA.map(w => w.reels),
          backgroundColor: getCSS('--c-reels'),
          borderRadius: 0,
          stack: 'pub'
        },
        {
          label: 'YT Shorts',
          data: SCORECARD_DATA.map(w => w.ytShorts),
          backgroundColor: getCSS('--c-yt'),
          borderRadius: { topLeft: 4, topRight: 4 },
          stack: 'pub'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { stacked: true, grid: { color: GRID_COLOR }, border: { display: false },
             ticks: { stepSize: 2, font: { size: 10 } } }
      }
    }
  });

  // ── Chart 2: Podcast Plays (line + area)
  charts.plays = new Chart(document.getElementById('chart-plays'), {
    type: 'line',
    data: {
      labels: LABELS,
      datasets: [{
        label: 'Podcast Plays',
        data: SCORECARD_DATA.map(w => w.podcastPlays),
        borderColor: getCSS('--c-podcast'),
        backgroundColor: 'rgba(124,110,250,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: getCSS('--c-podcast'),
        pointHoverRadius: 6,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: baseScales()
    }
  });

  // ── Chart 3: IG Reach (line, no fill — volatile)
  charts.reach = new Chart(document.getElementById('chart-reach'), {
    type: 'line',
    data: {
      labels: LABELS,
      datasets: [{
        label: 'IG Reach',
        data: SCORECARD_DATA.map(w => w.igReach),
        borderColor: getCSS('--c-reach'),
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: getCSS('--c-reach'),
        pointHoverRadius: 6,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: baseScales(v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v)
    }
  });

  // ── Chart 4: Leads (bar)
  charts.leads = new Chart(document.getElementById('chart-leads'), {
    type: 'bar',
    data: {
      labels: LABELS,
      datasets: [{
        label: 'Leads / DMs',
        data: SCORECARD_DATA.map(w => w.leads),
        backgroundColor: getCSS('--c-leads'),
        borderRadius: 5,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: baseScales(v => Math.round(v))
    }
  });

  // ── Chart 5: Prod Cost + 4-wk rolling avg (line)
  const rollingData = SCORECARD_DATA.map((_, i) => {
    if (i < 3) return null;
    return SCORECARD_DATA.slice(i - 3, i + 1).reduce((s, w) => s + w.prodCost, 0) / 4;
  });

  charts.cost = new Chart(document.getElementById('chart-cost'), {
    type: 'line',
    data: {
      labels: LABELS,
      datasets: [
        {
          label: 'Weekly Cost',
          data: SCORECARD_DATA.map(w => w.prodCost),
          borderColor: getCSS('--c-cost'),
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: getCSS('--c-cost'),
          pointHoverRadius: 6,
          borderWidth: 2
        },
        {
          label: '4-Wk Avg',
          data: rollingData,
          borderColor: getCSS('--c-rolling'),
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          borderDash: [5, 4]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: baseScales(v => v != null ? '$' + Math.round(v) : '')
    }
  });
}

// ── Weekly Scorecard Cards ───────────────────────────────────

function renderScorecardCards() {
  const container = document.getElementById('scorecard-grid');
  const reversed = [...SCORECARD_DATA].reverse();

  container.innerHTML = reversed.map((w, i) => {
    const isLatest = i === 0;
    const total = w.podcastEps + w.reels + w.ytShorts;

    return `
      <div class="week-card ${isLatest ? 'is-latest' : ''}">
        <div class="week-card__date">${fmtDate(w.weekOf, { month: 'long', day: 'numeric', year: 'numeric' })}</div>

        <div class="week-card__output">
          ${w.podcastEps > 0 ? `<span class="output-pill podcast">🎙 ${w.podcastEps} ep${w.podcastEps > 1 ? 's' : ''}</span>` : ''}
          ${w.reels > 0      ? `<span class="output-pill reels">📱 ${w.reels} reels</span>` : ''}
          ${w.ytShorts > 0   ? `<span class="output-pill yt">▶ ${w.ytShorts} shorts</span>` : ''}
          ${total === 0      ? `<span style="font-size:12px;color:var(--text-3)">No content this week</span>` : ''}
        </div>

        <div class="week-card__stats">
          <div class="stat-row">
            <span class="stat-row__label">IG Reach</span>
            <span class="stat-row__value">${fmt(w.igReach, 'k')}</span>
          </div>
          <div class="stat-row">
            <span class="stat-row__label">Follows</span>
            <span class="stat-row__value">+${w.igFollows}</span>
          </div>
          <div class="stat-row">
            <span class="stat-row__label">Podcast Plays</span>
            <span class="stat-row__value">${fmt(w.podcastPlays)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-row__label">Leads / DMs</span>
            <span class="stat-row__value">${w.leads}</span>
          </div>
        </div>

        <div class="week-card__cost">
          <span class="cost-badge">${fmt(w.prodCost, 'usd')}</span>
          <span class="cost-hours">${w.prodHours}h production</span>
        </div>

        ${w.notes ? `<div class="week-card__note">"${w.notes}"</div>` : ''}
      </div>
    `;
  }).join('');
}

// ── Kanban Board ─────────────────────────────────────────────

function renderKanban() {
  const LANES = [
    { id: 'todo',        label: 'Todo',        status: 'Todo' },
    { id: 'in-progress', label: 'In Progress', status: 'In Progress' },
    { id: 'done',        label: 'Done',        status: 'Done' },
    { id: 'deferred',    label: 'Deferred',    status: 'Deferred' }
  ];

  const board = document.getElementById('kanban-board');

  board.innerHTML = LANES.map(lane => {
    const cards = IMPROVEMENTS_DATA.filter(d => d.status === lane.status);
    return `
      <div class="kanban-lane kanban-lane--${lane.id}">
        <div class="kanban-lane__header">
          <span class="kanban-lane__title">${lane.label}</span>
          <span class="kanban-lane__count">${cards.length}</span>
        </div>
        ${cards.map(card => `
          <div class="kanban-card">
            <div class="kanban-card__top">
              <span class="badge badge--${card.priority.toLowerCase()}">${card.priority}</span>
            </div>
            <div class="kanban-card__request">${card.request}</div>
            <div class="kanban-card__meta">
              <span class="area-tag">${card.area}</span>
              <span class="area-tag">${card.owner}</span>
            </div>
            ${card.doneDate ? `<div class="done-date">✓ ${fmtDate(card.doneDate, { month: 'short', day: 'numeric' })}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

// ── Week Selector ─────────────────────────────────────────────

function populateWeekSelector() {
  const sel = document.getElementById('week-select');
  sel.innerHTML = SCORECARD_DATA.map((w, i) => {
    const selected = i === selectedWeekIdx ? 'selected' : '';
    return `<option value="${i}" ${selected}>${fmtWeekLabel(w.weekOf)}</option>`;
  }).join('');
  sel.addEventListener('change', e => {
    selectedWeekIdx = +e.target.value;
    renderKPIs();
    highlightSelectedWeek();
  });
}

function highlightSelectedWeek() {
  Object.values(charts).forEach(chart => {
    if (!chart) return;
    chart.data.datasets.forEach(ds => {
      if (ds.pointRadius !== undefined) {
        const base = 3;
        ds.pointRadius = SCORECARD_DATA.map((_, i) => i === selectedWeekIdx ? 7 : base);
        ds.pointHoverRadius = SCORECARD_DATA.map((_, i) => i === selectedWeekIdx ? 9 : 6);
      }
    });
    chart.update('none');
  });
}

// ── Tab Navigation ────────────────────────────────────────────

function initTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  const views = document.querySelectorAll('.view');

  function switchTab(viewId) {
    btns.forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
    views.forEach(v => v.classList.toggle('active', v.id === 'view-' + viewId));
    if (viewId === 'dashboard') window.dispatchEvent(new Event('resize'));
  }

  btns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.view)));
  switchTab('dashboard');
}

// ── Boot ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  populateWeekSelector();
  renderKPIs();
  initCharts();
  highlightSelectedWeek();
  renderScorecardCards();
  renderKanban();
  initTabs();
});
