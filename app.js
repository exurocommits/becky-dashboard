/* ============================================================
   CONTENT WEEKLY SCORECARD — Bento Dashboard
   ============================================================ */

// ── Globals ──────────────────────────────────────────────────
let charts = {};
let selectedWeekIdx = SCORECARD_DATA.length - 1;

// ── Utilities ────────────────────────────────────────────────

function fmt(n, style) {
  if (style === undefined) style = 'num';
  if (n == null) return '—';
  if (style === 'usd') return '$' + Math.round(n).toLocaleString();
  if (style === 'k')   return n >= 1000 ? (n/1000).toFixed(1).replace('.0','') + 'k' : n.toLocaleString();
  return n.toLocaleString();
}

function fmtDate(iso, opts) {
  if (!opts) opts = { month: 'short', day: 'numeric', year: 'numeric' };
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', opts);
}

function fmtWeekLabel(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function delta(curr, prev, invertGood) {
  if (invertGood === undefined) invertGood = false;
  if (!prev || prev === 0) return null;
  var pct = (curr - prev) / prev * 100;
  return invertGood ? -pct : pct;
}

function deltaClass(pct) {
  if (pct == null) return 'flat';
  if (pct > 2)  return 'up';
  if (pct < -2) return 'down';
  return 'flat';
}

function deltaLabel(pct) {
  if (pct == null) return '—';
  var sign = pct > 0 ? '+' : '';
  var arrow = pct > 2 ? '↑' : pct < -2 ? '↓' : '→';
  return arrow + ' ' + sign + Math.abs(pct).toFixed(1) + '%';
}

function getCSS(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function rolling4wkCost(data, idx) {
  var start = Math.max(0, idx - 3);
  return data.slice(start, idx + 1).reduce(function(s, w) { return s + w.prodCost; }, 0);
}

// ── Sparkline SVG ────────────────────────────────────────────

function buildSparkline(values, color) {
  var w = 100, h = 48, pad = 2;
  var min = Math.min.apply(null, values);
  var max = Math.max.apply(null, values);
  var range = max - min || 1;
  var n = values.length;

  var pts = values.map(function(v, i) {
    var x = pad + (i / (n - 1)) * (w - pad * 2);
    var y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });

  var polyline = pts.map(function(p) { return p.join(','); }).join(' ');
  var fillPath = 'M' + pts[0][0] + ',' + h + ' ' +
    pts.map(function(p) { return 'L' + p[0] + ',' + p[1]; }).join(' ') +
    ' L' + pts[pts.length-1][0] + ',' + h + ' Z';

  return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" class="kpi-sparkline" style="width:100%;height:' + h + 'px"><path d="' + fillPath + '" fill="' + color + '" opacity="0.12"/><polyline points="' + polyline + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

// ── Count-Up Animation ───────────────────────────────────────

function countUp(el, target, prefix, suffix) {
  if (!prefix) prefix = '';
  if (!suffix) suffix = '';
  var duration = 700;
  var start = performance.now();
  var isFloat = target !== Math.floor(target);

  function step(now) {
    var progress = Math.min((now - start) / duration, 1);
    var eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    var value = eased * target;
    var display = isFloat ? value.toFixed(1) : Math.round(value).toLocaleString();
    el.textContent = prefix + display + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Canvas Gradient Helper ───────────────────────────────────

function buildGradient(ctx, hexColor, alpha1, alpha2) {
  if (alpha1 === undefined) alpha1 = 0.20;
  if (alpha2 === undefined) alpha2 = 0.0;
  var height = ctx.canvas.parentElement ? ctx.canvas.parentElement.offsetHeight : 280;
  if (!height || height < 10) height = 280;
  var grad = ctx.createLinearGradient(0, 0, 0, height);
  var r = parseInt(hexColor.slice(1,3), 16);
  var g = parseInt(hexColor.slice(3,5), 16);
  var b = parseInt(hexColor.slice(5,7), 16);
  grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + alpha1 + ')');
  grad.addColorStop(0.6, 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha1 * 0.3) + ')');
  grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',' + alpha2 + ')');
  return grad;
}

// ── Labels (module-level) ────────────────────────────────────

var LABELS = SCORECARD_DATA.map(function(w) { return fmtWeekLabel(w.weekOf); });

// ── Hero Widget ──────────────────────────────────────────────

function renderHeroWidget() {
  var w = SCORECARD_DATA[selectedWeekIdx];
  var prev = selectedWeekIdx > 0 ? SCORECARD_DATA[selectedWeekIdx - 1] : null;

  var heroVal = document.getElementById('hero-value');
  var heroDelta = document.getElementById('hero-delta');

  if (heroVal) {
    heroVal.textContent = fmt(w.podcastPlays);
    countUp(heroVal, w.podcastPlays);
  }

  if (heroDelta) {
    var pct = delta(w.podcastPlays, prev ? prev.podcastPlays : null, false);
    heroDelta.className = 'kpi-delta ' + deltaClass(pct);
    heroDelta.textContent = deltaLabel(pct);
  }
}

// ── Snapshot Widgets ─────────────────────────────────────────

function renderSnapshots() {
  var w = SCORECARD_DATA[selectedWeekIdx];
  var prev = selectedWeekIdx > 0 ? SCORECARD_DATA[selectedWeekIdx - 1] : null;

  // IG Follows snapshot
  var followsEl    = document.getElementById('snap-follows');
  var followsDelta = document.getElementById('snap-follows-delta');
  var followsSpark = document.getElementById('spark-follows');

  if (followsEl) countUp(followsEl, w.igFollows, '+');
  if (followsDelta) {
    var pctF = delta(w.igFollows, prev ? prev.igFollows : null, false);
    followsDelta.className = 'kpi-delta ' + deltaClass(pctF);
    followsDelta.textContent = deltaLabel(pctF);
  }
  if (followsSpark) {
    var fHistory = SCORECARD_DATA.slice(0, selectedWeekIdx + 1).map(function(d) { return d.igFollows; });
    followsSpark.innerHTML = buildSparkline(fHistory, '#00B894');
  }

  // Content Published snapshot
  var pubEl    = document.getElementById('snap-published');
  var pubPills = document.getElementById('snap-published-pills');
  var pubSpark = document.getElementById('spark-published');
  var total    = w.podcastEps + w.reels + w.ytShorts;

  if (pubEl) countUp(pubEl, total);
  if (pubPills) {
    pubPills.innerHTML =
      (w.podcastEps > 0 ? '<span class="output-pill podcast">' + w.podcastEps + ' ep' + (w.podcastEps > 1 ? 's' : '') + '</span>' : '') +
      (w.reels     > 0 ? '<span class="output-pill reels">'   + w.reels     + ' reels</span>'   : '') +
      (w.ytShorts  > 0 ? '<span class="output-pill yt">'      + w.ytShorts  + ' shorts</span>'  : '') +
      (total === 0     ? '<span style="font-size:12px;color:var(--text-3)">No content</span>'    : '');
  }
  if (pubSpark) {
    var pHistory = SCORECARD_DATA.slice(0, selectedWeekIdx + 1).map(function(d) { return d.podcastEps + d.reels + d.ytShorts; });
    pubSpark.innerHTML = buildSparkline(pHistory, '#5B5EF4');
  }
}

// ── Callout Updates (3 bottom chart headers) ─────────────────

function updateCallouts() {
  var w = SCORECARD_DATA[selectedWeekIdx];
  var prev = selectedWeekIdx > 0 ? SCORECARD_DATA[selectedWeekIdx - 1] : null;

  // IG Reach
  var reachEl = document.getElementById('callout-reach');
  var reachDelta = document.getElementById('callout-reach-delta');
  if (reachEl) reachEl.textContent = fmt(w.igReach, 'k');
  if (reachDelta) {
    var pctReach = delta(w.igReach, prev ? prev.igReach : null, false);
    reachDelta.className = 'kpi-delta ' + deltaClass(pctReach);
    reachDelta.textContent = deltaLabel(pctReach);
  }

  // Leads & DMs
  var leadsEl = document.getElementById('callout-leads');
  var leadsDelta = document.getElementById('callout-leads-delta');
  if (leadsEl) leadsEl.textContent = fmt(w.leads);
  if (leadsDelta) {
    var pctLeads = delta(w.leads, prev ? prev.leads : null, false);
    leadsDelta.className = 'kpi-delta ' + deltaClass(pctLeads);
    leadsDelta.textContent = deltaLabel(pctLeads);
  }

  // Production Cost
  var costEl = document.getElementById('callout-cost');
  var costDelta = document.getElementById('callout-cost-delta');
  if (costEl) costEl.textContent = fmt(w.prodCost, 'usd');
  if (costDelta) {
    var pctCost = delta(w.prodCost, prev ? prev.prodCost : null, true);
    costDelta.className = 'kpi-delta ' + deltaClass(pctCost);
    costDelta.textContent = deltaLabel(pctCost);
  }
}

// ── Chart.js Defaults ────────────────────────────────────────

Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = '#71717A';
Chart.defaults.plugins.tooltip.backgroundColor = '#FFFFFF';
Chart.defaults.plugins.tooltip.titleColor = '#121212';
Chart.defaults.plugins.tooltip.bodyColor = '#52525B';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(0,0,0,0.08)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 10;
Chart.defaults.plugins.tooltip.padding = { x: 14, y: 12 };
Chart.defaults.plugins.tooltip.titleFont = { weight: '700', size: 12 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
Chart.defaults.plugins.tooltip.displayColors = true;
Chart.defaults.plugins.tooltip.boxPadding = 5;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 8;
Chart.defaults.plugins.legend.labels.boxHeight = 8;
Chart.defaults.plugins.legend.labels.color = '#71717A';
Chart.defaults.plugins.legend.labels.font = { size: 11 };
Chart.defaults.plugins.legend.labels.padding = 16;

var GRID_COLOR = 'rgba(0,0,0,0.05)';

// ── Charts ───────────────────────────────────────────────────

function initCharts() {

  // ── Chart 1: Podcast Plays (hero, line + area, gradient fill) ──
  var playsCtx = document.getElementById('chart-plays').getContext('2d');
  var playsGrad = buildGradient(playsCtx, '#5B5EF4', 0.22, 0.0);

  charts.plays = new Chart(playsCtx, {
    type: 'line',
    data: {
      labels: LABELS,
      datasets: [{
        label: 'Podcast Plays',
        data: SCORECARD_DATA.map(function(w) { return w.podcastPlays; }),
        borderColor: '#5B5EF4',
        backgroundColor: playsGrad,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#5B5EF4',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        borderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
        y: { grid: { color: GRID_COLOR }, border: { display: false },
             ticks: { font: { size: 10 }, padding: 8 } }
      }
    }
  });

  // ── Chart 2: Publishing Volume (stacked bar, full width) ──
  charts.publishing = new Chart(document.getElementById('chart-publishing'), {
    type: 'bar',
    data: {
      labels: LABELS,
      datasets: [
        {
          label: 'Podcast Eps',
          data: SCORECARD_DATA.map(function(w) { return w.podcastEps; }),
          backgroundColor: '#5B5EF4',
          borderRadius: 0,
          stack: 'pub'
        },
        {
          label: 'Reels',
          data: SCORECARD_DATA.map(function(w) { return w.reels; }),
          backgroundColor: '#E8476A',
          borderRadius: 0,
          stack: 'pub'
        },
        {
          label: 'YT Shorts',
          data: SCORECARD_DATA.map(function(w) { return w.ytShorts; }),
          backgroundColor: '#00B894',
          borderRadius: { topLeft: 3, topRight: 3 },
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
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
        y: {
          stacked: true,
          grid: { color: GRID_COLOR },
          border: { display: false },
          ticks: { stepSize: 2, font: { size: 10 }, padding: 8 }
        }
      }
    }
  });

  // ── Chart 3: IG Reach (line, gradient fill) ──
  var reachCtx = document.getElementById('chart-reach').getContext('2d');
  var reachGrad = buildGradient(reachCtx, '#0EA5E9', 0.20, 0.0);

  charts.reach = new Chart(reachCtx, {
    type: 'line',
    data: {
      labels: LABELS,
      datasets: [{
        label: 'IG Reach',
        data: SCORECARD_DATA.map(function(w) { return w.igReach; }),
        borderColor: '#0EA5E9',
        backgroundColor: reachGrad,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#0EA5E9',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        borderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
        y: { grid: { color: GRID_COLOR }, border: { display: false },
             ticks: { font: { size: 10 }, padding: 8, callback: function(v) { return v >= 1000 ? (v/1000).toFixed(0) + 'k' : v; } } }
      }
    }
  });

  // ── Chart 4: Leads & DMs (bar) ──
  charts.leads = new Chart(document.getElementById('chart-leads'), {
    type: 'bar',
    data: {
      labels: LABELS,
      datasets: [{
        label: 'Leads / DMs',
        data: SCORECARD_DATA.map(function(w) { return w.leads; }),
        backgroundColor: '#F59E0B',
        borderRadius: 6,
        barPercentage: 0.55
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
        y: { grid: { color: GRID_COLOR }, border: { display: false },
             ticks: { font: { size: 10 }, padding: 8, callback: function(v) { return Math.round(v); } } }
      }
    }
  });

  // ── Chart 5: Production Cost (dual line, no fill) ──
  var rollingData = SCORECARD_DATA.map(function(_, i) {
    if (i < 3) return null;
    return SCORECARD_DATA.slice(i - 3, i + 1).reduce(function(s, w) { return s + w.prodCost; }, 0) / 4;
  });

  charts.cost = new Chart(document.getElementById('chart-cost'), {
    type: 'line',
    data: {
      labels: LABELS,
      datasets: [
        {
          label: 'Weekly Cost',
          data: SCORECARD_DATA.map(function(w) { return w.prodCost; }),
          borderColor: '#EF6C30',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#EF6C30',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          borderWidth: 2.5
        },
        {
          label: '4-Wk Avg',
          data: rollingData,
          borderColor: '#94A3B8',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 1.5,
          borderDash: [6, 4]
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
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
        y: { grid: { color: GRID_COLOR }, border: { display: false },
             ticks: { font: { size: 10 }, padding: 8, callback: function(v) { return v != null ? '$' + Math.round(v) : ''; } } }
      }
    }
  });
}

// ── Weekly Scorecard Cards ───────────────────────────────────

function renderScorecardCards() {
  var container = document.getElementById('scorecard-grid');
  if (!container) return;
  var reversed = SCORECARD_DATA.slice().reverse();

  container.innerHTML = reversed.map(function(w, i) {
    var isLatest = i === 0;
    var total = w.podcastEps + w.reels + w.ytShorts;
    var weekNum = SCORECARD_DATA.length - i;

    return '<div class="week-card ' + (isLatest ? 'is-latest' : '') + '">' +
      '<div class="week-card__top-row">' +
        '<div class="week-card__date">' + fmtDate(w.weekOf, { month: 'long', day: 'numeric', year: 'numeric' }) + '</div>' +
        '<span class="week-num-pill">W' + weekNum + '</span>' +
      '</div>' +
      '<div class="week-card__output">' +
        (w.podcastEps > 0 ? '<span class="output-pill podcast">' + w.podcastEps + ' ep' + (w.podcastEps > 1 ? 's' : '') + '</span>' : '') +
        (w.reels > 0 ? '<span class="output-pill reels">' + w.reels + ' reels</span>' : '') +
        (w.ytShorts > 0 ? '<span class="output-pill yt">' + w.ytShorts + ' shorts</span>' : '') +
        (total === 0 ? '<span style="font-size:12px;color:var(--text-3)">No content this week</span>' : '') +
      '</div>' +
      '<div class="week-card__stats">' +
        '<div class="stat-row"><span class="stat-row__label">IG Reach</span><span class="stat-row__value">' + fmt(w.igReach, 'k') + '</span></div>' +
        '<div class="stat-row"><span class="stat-row__label">Follows</span><span class="stat-row__value">+' + w.igFollows + '</span></div>' +
        '<div class="stat-row"><span class="stat-row__label">Podcast Plays</span><span class="stat-row__value">' + fmt(w.podcastPlays) + '</span></div>' +
        '<div class="stat-row"><span class="stat-row__label">Leads / DMs</span><span class="stat-row__value">' + w.leads + '</span></div>' +
      '</div>' +
      '<div class="week-card__cost">' +
        '<span class="cost-badge">' + fmt(w.prodCost, 'usd') + '</span>' +
        '<span class="cost-hours">' + w.prodHours + 'h production</span>' +
      '</div>' +
      (w.notes ? '<div class="week-card__note">&ldquo;' + w.notes + '&rdquo;</div>' : '') +
    '</div>';
  }).join('');
}

// ── Kanban Board ─────────────────────────────────────────────

function renderKanban() {
  var LANES = [
    { id: 'todo',        label: 'Todo',        status: 'Todo' },
    { id: 'in-progress', label: 'In Progress', status: 'In Progress' },
    { id: 'done',        label: 'Done',        status: 'Done' },
    { id: 'deferred',    label: 'Deferred',    status: 'Deferred' }
  ];

  var board = document.getElementById('kanban-board');
  if (!board) return;

  board.innerHTML = LANES.map(function(lane) {
    var cards = IMPROVEMENTS_DATA.filter(function(d) { return d.status === lane.status; });
    return '<div class="kanban-lane kanban-lane--' + lane.id + '">' +
      '<div class="kanban-lane__header">' +
        '<span class="kanban-lane__title">' + lane.label + '</span>' +
        '<span class="kanban-lane__count">' + cards.length + '</span>' +
      '</div>' +
      cards.map(function(card) {
        return '<div class="kanban-card">' +
          '<div class="kanban-card__top">' +
            '<span class="badge badge--' + card.priority.toLowerCase() + '">' + card.priority + '</span>' +
          '</div>' +
          '<div class="kanban-card__request">' + card.request + '</div>' +
          '<div class="kanban-card__meta">' +
            '<span class="area-tag">' + card.area + '</span>' +
            '<span class="area-tag">' + card.owner + '</span>' +
          '</div>' +
          (card.doneDate ? '<div class="done-date">&#10003; ' + fmtDate(card.doneDate, { month: 'short', day: 'numeric' }) + '</div>' : '') +
        '</div>';
      }).join('') +
    '</div>';
  }).join('');
}

// ── Week Selector ────────────────────────────────────────────

function populateWeekSelector() {
  var sel = document.getElementById('week-select');
  if (!sel) return;

  sel.innerHTML = SCORECARD_DATA.map(function(w, i) {
    var selected = i === selectedWeekIdx ? 'selected' : '';
    return '<option value="' + i + '" ' + selected + '>' + fmtWeekLabel(w.weekOf) + '</option>';
  }).join('');

  sel.addEventListener('change', function(e) {
    selectedWeekIdx = +e.target.value;
    renderHeroWidget();
    renderSnapshots();
    updateCallouts();
    highlightSelectedWeek();
  });
}

// ── Highlight Selected Week ──────────────────────────────────

function highlightSelectedWeek() {
  Object.keys(charts).forEach(function(key) {
    var chart = charts[key];
    if (!chart) return;
    chart.data.datasets.forEach(function(ds) {
      if (ds.pointRadius !== undefined) {
        var base = 0;
        ds.pointRadius = SCORECARD_DATA.map(function(_, i) { return i === selectedWeekIdx ? 7 : base; });
        ds.pointHoverRadius = SCORECARD_DATA.map(function(_, i) { return i === selectedWeekIdx ? 9 : 6; });
      }
    });
    chart.update('none');
  });
}

// ── Tab Navigation ───────────────────────────────────────────

function initTabs() {
  var btns = document.querySelectorAll('.tab-btn');
  var views = document.querySelectorAll('.view');

  function switchTab(viewId) {
    btns.forEach(function(b) { b.classList.toggle('active', b.dataset.view === viewId); });
    views.forEach(function(v) { v.classList.toggle('active', v.id === 'view-' + viewId); });
    if (viewId === 'dashboard') window.dispatchEvent(new Event('resize'));
  }

  btns.forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(btn.dataset.view); });
  });
  switchTab('dashboard');
}

// ── Boot ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  renderHeroWidget();
  renderSnapshots();
  updateCallouts();
  initCharts();
  highlightSelectedWeek();
  renderScorecardCards();
  renderKanban();
  populateWeekSelector();
  initTabs();
});
