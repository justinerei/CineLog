/* ============================================================
   CineLog — stats.js
   All chart rendering and summary card logic for statistics.html
   Uses Chart.js (loaded via CDN in statistics.html)
   ITEL 203 Group Performance Task #1
   ============================================================ */

/* ── DATA SOURCE ────────────────────────────────────────────── */
/* Read the movies array from localStorage, same key used by script.js */
const movies = JSON.parse(localStorage.getItem('cinelog_movies') || '[]');

/* Active movies = everything except soft-deleted entries */
const active = movies.filter(m => m.status !== 'deleted');

/* ── CHART COLOR PALETTE ────────────────────────────────────── */
/* Ordered list of distinct colours used for multi-series charts */
const CHART_COLORS = [
  '#aaff2e', '#ffc832', '#4a9eff', '#ff6b6b',
  '#c084fc', '#34d399', '#fb923c', '#f472b6',
  '#a78bfa', '#38bdf8', '#4ade80', '#facc15',
  '#e879f9', '#f87171', '#60a5fa',
];

/* ── CHART.JS GLOBAL DEFAULTS ───────────────────────────────── */
/* Apply the dark-theme defaults once so every chart inherits them */
Chart.defaults.color           = '#9a9a9a';
Chart.defaults.borderColor     = '#252525';
Chart.defaults.font.family     = "'Outfit', sans-serif";
Chart.defaults.font.size       = 12;
Chart.defaults.plugins.tooltip.backgroundColor = '#1c1c1c';
Chart.defaults.plugins.tooltip.borderColor     = '#252525';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.titleColor      = '#ffffff';
Chart.defaults.plugins.tooltip.bodyColor       = '#9a9a9a';
Chart.defaults.plugins.tooltip.padding         = 10;

/* ── UTILITY: COUNT BY FIELD ────────────────────────────────── */
/* Returns an object { fieldValue: count } for a given field on an array */
function countBy(arr, key) {
  return arr.reduce((acc, item) => {
    const val = (item[key] !== undefined && item[key] !== null && item[key] !== '')
      ? String(item[key])
      : 'Unknown';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

/* ── SUMMARY CARDS ──────────────────────────────────────────── */
/* Populate the five top-level summary stat cards */
function renderSummaryCards() {
  const total   = active.length;
  const watched = active.filter(m => m.status === 'watched');

  /* Completion rate = watched ÷ total (ignoring deleted) */
  const completionRate = total > 0 ? Math.round((watched.length / total) * 100) : 0;

  /* Average rating across all rated watched movies */
  const rated    = watched.filter(m => m.rating > 0);
  const avgRating = rated.length
    ? (rated.reduce((s, m) => s + m.rating, 0) / rated.length).toFixed(1) + '★'
    : '—';

  /* Total watch time — sum of duration for movies marked Watched */
  const withDuration = watched.filter(m => m.duration);
  const totalMins    = withDuration.reduce((s, m) => s + m.duration, 0);
  let totalHours = '—';
  if (totalMins > 0) {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    totalHours = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
  }

  /* Most frequent genre across all active movies */
  const genreCounts = countBy(active, 'genre');
  const topGenreEntry = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];
  const topGenre = topGenreEntry ? topGenreEntry[0] : '—';

  document.getElementById('s-total').textContent      = total;
  document.getElementById('s-completion').textContent = total > 0 ? completionRate + '%' : '—';
  document.getElementById('s-avg-rating').textContent = avgRating;
  document.getElementById('s-hours').textContent      = totalHours;
  document.getElementById('s-top-genre').textContent  = topGenre;
}

/* ── GENRE DOUGHNUT CHART ───────────────────────────────────── */
/* Shows the distribution of genres across all active movies */
function renderGenreChart() {
  const genreCounts = countBy(active, 'genre');

  /* Sort genres by count descending for a cleaner doughnut layout */
  const sorted  = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  const labels  = sorted.map(([g]) => g);
  const data    = sorted.map(([, c]) => c);
  const total   = data.reduce((s, n) => s + n, 0);

  const ctx = document.getElementById('genreChart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderColor:     '#0b0b0b',
        borderWidth:     3,
        hoverOffset:     10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding:   14,
            boxWidth:  11,
            boxHeight: 11,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            /* Show count and percentage in the tooltip */
            label: (ctx) => {
              const pct = Math.round((ctx.parsed / total) * 100);
              return ` ${ctx.label}: ${ctx.parsed} movie${ctx.parsed !== 1 ? 's' : ''} (${pct}%)`;
            },
          },
        },
      },
      cutout: '60%',
    },
  });
}

/* ── RATING DISTRIBUTION BAR CHART ─────────────────────────── */
/* Shows how many watched movies received each star rating (1–5) */
function renderRatingChart() {
  const watched = active.filter(m => m.status === 'watched');

  /* Count movies per star level; 0-rated movies are excluded */
  const ratingCounts = [1, 2, 3, 4, 5].map(n =>
    watched.filter(m => m.rating === n).length
  );

  const ctx = document.getElementById('ratingChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['1 ★', '2 ★★', '3 ★★★', '4 ★★★★', '5 ★★★★★'],
      datasets: [{
        label: 'Movies',
        data:  ratingCounts,
        /* Gradient opacity: dimmer for low stars, brighter for high stars */
        backgroundColor: ratingCounts.map((_, i) => `rgba(170, 255, 46, ${0.2 + i * 0.16})`),
        borderColor:     '#aaff2e',
        borderWidth:     1,
        borderRadius:    5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid:  { display: false },
          ticks: { color: '#aaff2e', font: { size: 13 } },
        },
        y: {
          grid:      { color: 'rgba(255,255,255,0.04)' },
          ticks:     { stepSize: 1 },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ── WATCH STATUS BAR CHART ─────────────────────────────────── */
/* Displays the count of movies in each watch-status category */
function renderStatusChart() {
  const labels = ['Watched', 'Watching', 'Plan to Watch', 'Dropped'];
  const keys   = ['watched', 'watching', 'plan', 'dropped'];
  const data   = keys.map(k => active.filter(m => m.status === k).length);

  /* Each status gets its own colour matching the badge colours in the main app */
  const bgColors     = ['rgba(170,255,46,0.18)', 'rgba(255,200,50,0.18)', 'rgba(100,100,100,0.2)', 'rgba(255,68,68,0.18)'];
  const borderColors = ['#aaff2e', '#ffc832', '#555555', '#ff4444'];

  const ctx = document.getElementById('statusChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Movies',
        data,
        backgroundColor: bgColors,
        borderColor:     borderColors,
        borderWidth:     2,
        borderRadius:    5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid:      { color: 'rgba(255,255,255,0.04)' },
          ticks:     { stepSize: 1 },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ── MOVIES PER RELEASE YEAR LINE CHART ─────────────────────── */
/* Plots how many movies in your list were released each year */
function renderYearChart() {
  const yearCounts = countBy(active, 'year');

  /* Sort years chronologically for a sensible left-to-right timeline */
  const years  = Object.keys(yearCounts).sort((a, b) => Number(a) - Number(b));
  const counts = years.map(y => yearCounts[y]);

  const ctx = document.getElementById('yearChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: 'Movies',
        data:  counts,
        borderColor:          '#aaff2e',
        backgroundColor:      'rgba(170, 255, 46, 0.07)',
        borderWidth:          2,
        pointRadius:          5,
        pointHoverRadius:     7,
        pointBackgroundColor: '#aaff2e',
        pointBorderColor:     '#0b0b0b',
        pointBorderWidth:     2,
        tension:              0.35,
        fill:                 true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' } },
        y: {
          grid:      { color: 'rgba(255,255,255,0.04)' },
          ticks:     { stepSize: 1 },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ── TOP DIRECTORS LIST ─────────────────────────────────────── */
/* Renders a horizontal bar leaderboard of the most-logged directors */
function renderTopDirectors() {
  /* Exclude movies where director is unknown ('—') */
  const withDir    = active.filter(m => m.director && m.director !== '—');
  const dirCounts  = countBy(withDir, 'director');
  const sorted     = Object.entries(dirCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max        = sorted.length ? sorted[0][1] : 1;

  const container = document.getElementById('topDirectors');

  if (!sorted.length) {
    container.innerHTML = `
      <p style="color:var(--text-muted);font-size:0.84rem;font-style:italic;padding:1rem 0;">
        No director data yet. Add movies with director info to see this chart.
      </p>`;
    return;
  }

  /* Build each director row: rank | name | bar | count */
  container.innerHTML = sorted.map(([dir, count], i) => `
    <div class="dir-row">
      <span class="dir-rank">${i + 1}</span>
      <span class="dir-name" title="${dir}">${dir}</span>
      <div class="dir-bar-wrap">
        <div class="dir-bar" style="width:${Math.round((count / max) * 100)}%"></div>
      </div>
      <span class="dir-count">${count} film${count !== 1 ? 's' : ''}</span>
    </div>
  `).join('');
}

/* ── INITIALISE ─────────────────────────────────────────────── */
/* Show the empty state if there are no movies at all, otherwise render everything */
if (active.length === 0) {
  document.getElementById('stats-empty').style.display   = 'flex';
  document.getElementById('stats-content').style.display = 'none';
} else {
  document.getElementById('stats-empty').style.display   = 'none';
  document.getElementById('stats-content').style.display = 'block';
  renderSummaryCards();
  renderGenreChart();
  renderRatingChart();
  renderStatusChart();
  renderYearChart();
  renderTopDirectors();
}