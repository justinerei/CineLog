/* ============================================================
   CineLog — script.js
   Main application logic for index.html
   Includes OMDB API integration for auto-fill and poster fetch
   ITEL 203 Group Performance Task #1
   ============================================================ */

/* ══════════════════════════════════════════════════════════════
   OMDB API CONFIGURATION
   Free key from https://www.omdbapi.com/apikey.aspx
   ══════════════════════════════════════════════════════════════ */
const OMDB_API_KEY = '72f08bc0';
const OMDB_BASE    = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}`;

/* ── STATE ─────────────────────────────────────────────────── */
let movies = JSON.parse(localStorage.getItem('cinelog_movies') || '[]');

let currentFilter  = 'all';
let currentSearch  = '';
let sortCol        = '';
let sortDir        = 1;
let selectedRating = 0;

/* Holds a pending movie while the duplicate modal is open */
let pendingMovie = null;

/* ── PERSISTENCE ────────────────────────────────────────────── */
const saveMovies = () =>
  localStorage.setItem('cinelog_movies', JSON.stringify(movies));

const $ = id => document.getElementById(id);


/* ══════════════════════════════════════════════════════════════
   OMDB — GENRE MAPPING
   OMDB returns genres like "Action, Adventure, Sci-Fi".
   We take the first and map it to the closest dropdown value.
   ══════════════════════════════════════════════════════════════ */
const GENRE_MAP = {
  'action':      'Action',
  'adventure':   'Adventure',
  'animation':   'Animation',
  'comedy':      'Comedy',
  'crime':       'Crime',
  'drama':       'Drama',
  'fantasy':     'Fantasy',
  'horror':      'Horror',
  'mystery':     'Mystery',
  'romance':     'Romance',
  'sci-fi':      'Sci-Fi',
  'thriller':    'Thriller',
  'documentary': 'Documentary',
  'biography':   'Drama',
  'history':     'Drama',
  'sport':       'Drama',
  'music':       'Drama',
  'western':     'Action',
  'war':         'Action',
  'musical':     'Comedy',
  'family':      'Animation',
};

/* Maps raw OMDB genre string → closest <select> value */
function mapGenre(omdbGenre) {
  if (!omdbGenre) return '';
  const first = omdbGenre.split(',')[0].trim().toLowerCase();
  return GENRE_MAP[first] || '';
}

/* "142 min" → 142 | "N/A" → null */
function parseRuntime(runtime) {
  if (!runtime || runtime === 'N/A') return null;
  const m = runtime.match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

/* "2010" or "2010–2015" → "2010" */
function parseYear(year) {
  if (!year || year === 'N/A') return '';
  return year.slice(0, 4);
}


/* ══════════════════════════════════════════════════════════════
   OMDB — UI HELPERS
   ══════════════════════════════════════════════════════════════ */

/* Set the feedback message below the search bar */
function setOmdbMsg(text, type = '') {
  const el = $('omdbMsg');
  el.textContent   = text;
  el.className     = `omdb-msg ${type}`;
  el.style.display = text ? 'block' : 'none';
}

/* Show/hide the spinner and toggle the Search label */
function setOmdbLoading(isLoading) {
  $('omdbBtnText').style.display = isLoading ? 'none'         : 'inline';
  $('omdbSpinner').style.display = isLoading ? 'inline-block' : 'none';
  $('omdbSearchBtn').disabled    = isLoading;
}


/* ══════════════════════════════════════════════════════════════
   OMDB — SEARCH (returns list of matching titles)
   ══════════════════════════════════════════════════════════════ */
async function omdbSearch() {
  const query = $('omdbSearchInput').value.trim();
  if (!query) { setOmdbMsg('Please type a movie title first.', 'warn'); return; }

  setOmdbLoading(true);
  setOmdbMsg('');
  $('omdbResults').style.display = 'none';

  try {
    const res  = await fetch(`${OMDB_BASE}&s=${encodeURIComponent(query)}&type=movie`);
    const data = await res.json();

    if (data.Response === 'False') {
      setOmdbMsg(`No results found for "${query}". Try a different title.`, 'warn');
      setOmdbLoading(false);
      return;
    }

    renderOmdbResults(data.Search || []);
    setOmdbMsg('');

  } catch (err) {
    setOmdbMsg('Search failed. Check your internet connection.', 'error');
    console.error('OMDB search error:', err);
  }

  setOmdbLoading(false);
}


/* ══════════════════════════════════════════════════════════════
   OMDB — RENDER RESULTS DROPDOWN
   ══════════════════════════════════════════════════════════════ */
function renderOmdbResults(results) {
  const container = $('omdbResults');
  if (!results.length) {
    container.style.display = 'none';
    setOmdbMsg('No movies matched your search.', 'warn');
    return;
  }

  container.innerHTML = results.map(r => `
    <div class="omdb-result-item" data-imdbid="${r.imdbID}" tabindex="0">
      <!-- Poster thumbnail -->
      ${r.Poster !== 'N/A'
        ? `<img class="omdb-result-poster" src="${r.Poster}" alt="" onerror="this.style.display='none'" />`
        : `<div class="omdb-result-no-poster">🎬</div>`}
      <div class="omdb-result-info">
        <div class="omdb-result-title">${r.Title}</div>
        <div class="omdb-result-year">${r.Year}</div>
      </div>
    </div>`
  ).join('');

  container.style.display = 'block';

  /* Click or Enter on a result → fetch full details and fill the form */
  container.querySelectorAll('.omdb-result-item').forEach(item => {
    item.addEventListener('click', () => omdbFetchAndFill(item.dataset.imdbid));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') omdbFetchAndFill(item.dataset.imdbid);
    });
  });
}


/* ══════════════════════════════════════════════════════════════
   OMDB — FETCH FULL DETAILS AND AUTO-FILL THE FORM
   ══════════════════════════════════════════════════════════════ */
async function omdbFetchAndFill(imdbId) {
  $('omdbResults').style.display = 'none';
  setOmdbMsg('Fetching details…', '');
  setOmdbLoading(true);

  try {
    const res  = await fetch(`${OMDB_BASE}&i=${imdbId}&plot=short`);
    const data = await res.json();

    if (data.Response === 'False') {
      setOmdbMsg('Could not load details for that movie.', 'error');
      setOmdbLoading(false);
      return;
    }

    /* ── Fill each form field ── */
    $('movieTitle').value    = data.Title || '';
    $('releaseYear').value   = parseYear(data.Year);
    $('duration').value      = parseRuntime(data.Runtime) || '';

    /* Director — take only the first name if multiple are listed */
    $('director').value = (data.Director && data.Director !== 'N/A')
      ? data.Director.split(',')[0].trim()
      : '';

    /* Genre — map to the closest dropdown option */
    const mappedGenre = mapGenre(data.Genre);
    if (mappedGenre) {
      $('genre').value = mappedGenre;
      const cgg = $('customGenreGroup');
      if (cgg) cgg.style.display = 'none';
    }

    /* Store poster URL and plot in hidden fields for later use */
    $('moviePosterUrl').value = (data.Poster && data.Poster !== 'N/A') ? data.Poster : '';
    $('moviePlot').value      = (data.Plot   && data.Plot   !== 'N/A') ? data.Plot   : '';

    /* Clear the search box */
    $('omdbSearchInput').value = '';

    /* Trigger live validation so green borders appear */
    ['movieTitle','releaseYear','duration','director','genre'].forEach(id => {
      const el = $(id);
      if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    /* Show the poster preview thumbnail */
    showPosterPreview(
      data.Poster !== 'N/A' ? data.Poster : null,
      data.Title
    );

    setOmdbMsg(`✓ Auto-filled: "${data.Title}" (${parseYear(data.Year)})`, 'success');

  } catch (err) {
    setOmdbMsg('Failed to load movie details. Try again.', 'error');
    console.error('OMDB fetch error:', err);
  }

  setOmdbLoading(false);
}


/* ══════════════════════════════════════════════════════════════
   OMDB — POSTER PREVIEW (shown above the form after auto-fill)
   ══════════════════════════════════════════════════════════════ */
function showPosterPreview(posterUrl, title) {
  let preview = $('omdbPosterPreview');

  /* Create the preview element on first use */
  if (!preview) {
    preview = document.createElement('div');
    preview.id        = 'omdbPosterPreview';
    preview.className = 'omdb-poster-preview';
    const form = $('movie-form');
    form.parentNode.insertBefore(preview, form);
  }

  if (posterUrl) {
    preview.innerHTML = `
      <img src="${posterUrl}" alt="${title} poster" class="omdb-preview-img" />
      <div class="omdb-preview-label">
        <span class="omdb-badge">OMDB</span> Poster retrieved
      </div>`;
  } else {
    preview.innerHTML = `
      <div class="omdb-preview-no-img">🎬</div>
      <div class="omdb-preview-label" style="color:var(--text-muted);">No poster available</div>`;
  }

  preview.style.display = 'flex';
}

/* Hide the poster preview on form reset */
function clearPosterPreview() {
  const preview = $('omdbPosterPreview');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
}


/* ══════════════════════════════════════════════════════════════
   OMDB — EVENT LISTENERS (search bar)
   ══════════════════════════════════════════════════════════════ */
$('omdbSearchBtn').addEventListener('click', omdbSearch);

/* Enter key in the search input triggers search */
$('omdbSearchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); omdbSearch(); }
});

/* Click outside the search block collapses the dropdown */
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.omdb-search-wrap');
  if (wrap && !wrap.contains(e.target)) {
    $('omdbResults').style.display = 'none';
  }
});


/* ══════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ══════════════════════════════════════════════════════════════ */
function showToast(message, type = 'success') {
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}


/* ══════════════════════════════════════════════════════════════
   STATS BAR
   ══════════════════════════════════════════════════════════════ */
function bumpStat(id) {
  const el = $(id); if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 220);
}

function updateStats() {
  const total    = movies.filter(m => m.status !== 'deleted').length;
  const watched  = movies.filter(m => m.status === 'watched').length;
  const watching = movies.filter(m => m.status === 'watching').length;
  const plan     = movies.filter(m => m.status === 'plan').length;
  const rated    = movies.filter(m => m.rating > 0);
  const avg      = rated.length
    ? (rated.reduce((s, m) => s + m.rating, 0) / rated.length).toFixed(1) + '★'
    : '—';

  const els = { 'stat-total': total, 'stat-watched': watched, 'stat-watching': watching, 'stat-plan': plan };
  Object.entries(els).forEach(([id, val]) => {
    const el = $(id);
    if (el && el.textContent !== String(val)) { el.textContent = val; bumpStat(id); }
  });
  $('stat-avg').textContent = avg;
}


/* ══════════════════════════════════════════════════════════════
   STAR RATING INPUT
   ══════════════════════════════════════════════════════════════ */
const allStars  = document.querySelectorAll('#star-group .star-btn');
const starGroup = $('star-group');
const lockMsg   = $('rating-lock-msg');

function refreshStars() {
  allStars.forEach(s => s.classList.toggle('active', +s.dataset.val <= selectedRating));
}

function setRatingLock(isLocked) {
  if (isLocked) {
    starGroup.classList.add('disabled'); lockMsg.classList.add('show');
    selectedRating = 0; refreshStars(); $('rating').value = 0;
  } else {
    starGroup.classList.remove('disabled'); lockMsg.classList.remove('show');
  }
}

allStars.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    if (starGroup.classList.contains('disabled')) return;
    allStars.forEach(s => s.classList.toggle('active', +s.dataset.val <= +btn.dataset.val));
  });
  btn.addEventListener('mouseleave', refreshStars);
  btn.addEventListener('click', () => {
    if (starGroup.classList.contains('disabled')) return;
    selectedRating = +btn.dataset.val; $('rating').value = selectedRating; refreshStars();
  });
});

$('status').addEventListener('change', function () { setRatingLock(this.value !== 'watched'); });
setRatingLock(true);


/* ══════════════════════════════════════════════════════════════
   CUSTOM GENRE INPUT
   ══════════════════════════════════════════════════════════════ */
const genreSelect      = document.getElementById('genre');
const customGenreGroup = document.getElementById('customGenreGroup');
const customGenreInput = document.getElementById('customGenre');

if (genreSelect && customGenreGroup) {
  genreSelect.addEventListener('change', (e) => {
    if (e.target.value.toLowerCase() === 'other') {
      customGenreGroup.style.display = 'block';
      customGenreInput.required = true;
    } else {
      customGenreGroup.style.display = 'none';
      customGenreInput.required = false;
      customGenreInput.value = '';
    }
  });
}


/* ══════════════════════════════════════════════════════════════
   NOTES CHARACTER COUNTER
   Live "48 / 300" counter below the textarea
   ══════════════════════════════════════════════════════════════ */
$('notes').addEventListener('input', function () {
  const count   = this.value.length;
  const counter = $('notesCount');
  if (!counter) return;
  counter.textContent = count;
  counter.style.color = count > 280 ? 'var(--red)'
                      : count > 250 ? '#ffc832'
                      : 'var(--text-muted)';
});


/* ══════════════════════════════════════════════════════════════
   FORM VALIDATION
   ══════════════════════════════════════════════════════════════ */
function setFieldState(inputId, errId, isError) {
  const input = $(inputId), errEl = $(errId);
  if (!input || !errEl) return;
  input.classList.toggle('is-error', isError);
  input.classList.toggle('is-valid', !isError && input.value.trim() !== '');
  errEl.classList.toggle('show', isError);
}

function validateForm() {
  let isValid   = true;
  const title   = $('movieTitle').value.trim();
  const yearVal = $('releaseYear').value;
  const year    = Number(yearVal);
  const dur     = $('duration').value;
  const director = $('director').value.trim();
  const status  = $('status').value;
  const notes   = $('notes').value.trim();
  let genre     = $('genre').value;
  if (genre.toLowerCase() === 'other') genre = $('customGenre').value.trim();

  if (!title)  { setFieldState('movieTitle',  'err-title',    true);  isValid = false; } else setFieldState('movieTitle',  'err-title',    false);
  if (!yearVal || year < 1888 || year > 2030) { setFieldState('releaseYear', 'err-year', true); isValid = false; } else setFieldState('releaseYear', 'err-year', false);
  if (dur !== '' && (isNaN(+dur) || +dur < 1 || +dur > 600)) { setFieldState('duration', 'err-duration', true); isValid = false; } else setFieldState('duration', 'err-duration', false);
  if (director && /\d/.test(director)) { setFieldState('director', 'err-director', true); isValid = false; } else setFieldState('director', 'err-director', false);
  if (!genre)  { setFieldState('genre',  'err-genre',  true);  isValid = false; } else setFieldState('genre',  'err-genre',  false);
  if (!status) { setFieldState('status', 'err-status', true);  isValid = false; } else setFieldState('status', 'err-status', false);
  if (notes.length > 300) { setFieldState('notes', 'err-notes', true); isValid = false; } else setFieldState('notes', 'err-notes', false);
  return isValid;
}

['movieTitle','releaseYear','duration','director','genre','customGenre','status','notes'].forEach(id => {
  const el = $(id); if (!el) return;
  el.addEventListener('input',  validateForm);
  el.addEventListener('change', validateForm);
});


/* ══════════════════════════════════════════════════════════════
   FORM RESET
   ══════════════════════════════════════════════════════════════ */
function resetFormState() {
  $('movie-form').reset();
  if (customGenreGroup) customGenreGroup.style.display = 'none';
  selectedRating = 0; $('rating').value = 0;
  refreshStars(); setRatingLock(true);

  /* Reset notes counter */
  const counter = $('notesCount');
  if (counter) { counter.textContent = '0'; counter.style.color = 'var(--text-muted)'; }

  /* Clear OMDB hidden fields and UI */
  $('moviePosterUrl').value = '';
  $('moviePlot').value      = '';
  clearPosterPreview();
  setOmdbMsg('');
  $('omdbSearchInput').value = '';

  /* Strip all validation state */
  ['movieTitle','releaseYear','duration','director','genre','customGenre','status','notes'].forEach(id => {
    const el = $(id); if (el) el.classList.remove('is-error','is-valid');
  });
  document.querySelectorAll('.error-msg').forEach(el => el.classList.remove('show'));
}


/* ══════════════════════════════════════════════════════════════
   FINALIZE ADD MOVIE
   Commits the movie to storage and refreshes all UI.
   Called from normal submit and from "Add Anyway".
   ══════════════════════════════════════════════════════════════ */
function finalizeAddMovie(movie) {
  movies.unshift(movie);
  saveMovies();
  renderTable();
  updateStats();
  showToast(`"${movie.title}" added to your watchlist!`);
  resetFormState();
}


/* ══════════════════════════════════════════════════════════════
   DUPLICATE DETECTION
   ══════════════════════════════════════════════════════════════ */
function findDuplicate(title) {
  return movies.find(
    m => m.title.toLowerCase() === title.toLowerCase() && m.status !== 'deleted'
  ) || null;
}

function showDuplicateModal(existing) {
  $('dupMovieTitle').textContent = `"${existing.title}"`;
  const [badgeClass, badgeLabel] = STATUS_MAP[existing.status] || ['badge-plan', existing.status];
  $('dupExistingInfo').innerHTML = `
    <div style="font-weight:600;color:var(--text-primary);margin-bottom:0.5rem;">
      ${existing.title} <span style="color:var(--text-muted);font-weight:400;">(${existing.year})</span>
    </div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;margin-bottom:0.5rem;">
      <span class="badge ${badgeClass}">${badgeLabel}</span>
      <span class="genre-pill">${existing.genre}</span>
    </div>
    <div style="color:var(--text-secondary);font-size:0.8rem;">
      ${existing.director !== '—' ? `<div>Director: ${existing.director}</div>` : ''}
      <div>${buildStarsHTML(existing.rating)}</div>
    </div>`;
  $('duplicateModal').classList.add('active');
}

$('btnDupAddAnyway').addEventListener('click', () => {
  if (pendingMovie) { finalizeAddMovie(pendingMovie); pendingMovie = null; }
  $('duplicateModal').classList.remove('active');
});
$('btnDupCancel').addEventListener('click', () => {
  pendingMovie = null; $('duplicateModal').classList.remove('active');
});
document.querySelector('.close-duplicate-modal').addEventListener('click', () => {
  pendingMovie = null; $('duplicateModal').classList.remove('active');
});
window.addEventListener('click', (e) => {
  if (e.target === $('duplicateModal')) { pendingMovie = null; $('duplicateModal').classList.remove('active'); }
});


/* ══════════════════════════════════════════════════════════════
   FORM SUBMISSION
   ══════════════════════════════════════════════════════════════ */
$('movie-form').addEventListener('submit', function (e) {
  e.preventDefault();
  if (!validateForm()) { showToast('Please fix the errors before adding.', 'error'); return; }

  let finalGenre = $('genre').value;
  if (finalGenre.toLowerCase() === 'other') finalGenre = $('customGenre').value.trim();

  /* Build the movie object — includes OMDB posterUrl and plot if available */
  const movie = {
    id:        Date.now(),
    title:     $('movieTitle').value.trim(),
    year:      Number($('releaseYear').value),
    duration:  $('duration').value ? Number($('duration').value) : null,
    director:  $('director').value.trim() || '—',
    genre:     finalGenre,
    status:    $('status').value,
    rating:    selectedRating,
    notes:     $('notes').value.trim(),
    posterUrl: $('moviePosterUrl').value || '',   /* OMDB poster URL */
    plot:      $('moviePlot').value      || '',   /* OMDB short plot */
  };

  /* Duplicate check */
  const duplicate = findDuplicate(movie.title);
  if (duplicate) {
    pendingMovie = movie;
    showDuplicateModal(duplicate);
    return;
  }

  finalizeAddMovie(movie);
});


/* ══════════════════════════════════════════════════════════════
   DELETE MOVIE
   ══════════════════════════════════════════════════════════════ */
function deleteMovie(id) {
  const target = movies.find(m => m.id === id);
  if (!target) return;
  if (target.status === 'deleted') {
    movies = movies.filter(m => m.id !== id);
    showToast(`"${target.title}" permanently deleted.`, 'error');
  } else {
    target.status = 'deleted';
    showToast(`"${target.title}" moved to History.`, 'error');
  }
  saveMovies(); renderTable(); updateStats();
}
window.deleteMovie = deleteMovie;


/* ══════════════════════════════════════════════════════════════
   STAR HTML BUILDER (read-only display)
   ══════════════════════════════════════════════════════════════ */
function buildStarsHTML(n) {
  if (!n) return '<span style="color:var(--text-muted);font-size:0.72rem;">—</span>';
  let html = '<span class="stars-display">';
  for (let i = 1; i <= 5; i++) html += i <= n ? '★' : '<span class="empty">★</span>';
  return html + '</span>';
}

/* ── STATUS MAP ─────────────────────────────────────────────── */
const STATUS_MAP = {
  watched:  ['badge-watched',  '✓ Watched'],
  watching: ['badge-watching', '▶ Watching'],
  plan:     ['badge-plan',     '◷ Plan to Watch'],
  dropped:  ['badge-dropped',  '✕ Dropped'],
  deleted:  ['badge-deleted',  '🗑 Deleted'],
};


/* ══════════════════════════════════════════════════════════════
   FILTER & SORT DATA
   ══════════════════════════════════════════════════════════════ */
function getDisplayData() {
  return movies
    .filter(m => {
      const matchFilter = currentFilter === 'all' ? m.status !== 'deleted' : m.status === currentFilter;
      const q = currentSearch.toLowerCase();
      const matchSearch = !q || m.title.toLowerCase().includes(q)
        || m.genre.toLowerCase().includes(q) || m.director.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    })
    .sort((a, b) => {
      if (!sortCol) return 0;
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return av < bv ? -1 * sortDir : av > bv ? 1 * sortDir : 0;
    });
}


/* ══════════════════════════════════════════════════════════════
   TABLE RENDERER
   Shows a small poster thumbnail in the title cell
   when posterUrl is available on the movie object.
   ══════════════════════════════════════════════════════════════ */
function renderTable() {
  const tbody = $('movie-tbody'), emptyState = $('empty-state'), data = getDisplayData();
  if (!data.length) { tbody.innerHTML = ''; emptyState.style.display = ''; return; }
  emptyState.style.display = 'none';

  tbody.innerHTML = data.map((m, i) => {
    const [badgeClass, badgeLabel] = STATUS_MAP[m.status] || ['badge-plan', m.status];

    /* Tiny poster thumbnail — only rendered when the URL exists */
    const posterThumb = m.posterUrl
      ? `<img src="${m.posterUrl}" alt="" class="table-poster-thumb" onerror="this.style.display='none'" />`
      : '';

    return `
      <tr data-id="${m.id}" class="clickable-row">
        <td class="row-num">${i + 1}</td>
        <td class="movie-title-cell">
          <div style="display:flex;align-items:center;gap:0.6rem;">
            ${posterThumb}
            <div>
              ${m.title}
              <small>${m.director !== '—' ? m.director : ''}${m.duration ? ` · ${m.duration}m` : ''}</small>
            </div>
          </div>
        </td>
        <td><span class="genre-pill">${m.genre}</span></td>
        <td style="color:var(--text-secondary);">${m.year}</td>
        <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
        <td>${buildStarsHTML(m.rating)}</td>
        <td><button class="btn-delete" onclick="deleteMovie(${m.id})" title="Remove '${m.title}'">✕</button></td>
      </tr>`;
  }).join('');
}


/* ══════════════════════════════════════════════════════════════
   FILTER TABS / SEARCH / SORT
   ══════════════════════════════════════════════════════════════ */
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentFilter = tab.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderTable();
  });
});

$('searchInput').addEventListener('input', function () { currentSearch = this.value; renderTable(); });

document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    if (sortCol === th.dataset.col) sortDir *= -1;
    else { sortCol = th.dataset.col; sortDir = 1; }
    renderTable();
  });
});


/* ══════════════════════════════════════════════════════════════
   NOTES MODAL
   Two-column layout: poster image (left) + details (right).
   Poster and plot only shown when the movie has them stored.
   ══════════════════════════════════════════════════════════════ */
const modal         = document.getElementById('notesModal');
const closeModalBtn = document.querySelector('.close-modal');

function openNotesModal(movie) {
  /* Basic fields */
  document.getElementById('modalMovieTitle').textContent = movie.title;

  const [badgeClass, badgeLabel] = STATUS_MAP[movie.status] || ['badge-plan', movie.status];
  const mStatus = document.getElementById('modalMovieStatus');
  mStatus.className = `badge ${badgeClass}`; mStatus.textContent = badgeLabel;

  document.getElementById('modalMovieYear').textContent     = movie.year;
  document.getElementById('modalMovieDuration').textContent = movie.duration ? `${movie.duration}m` : 'N/A';
  document.getElementById('modalMovieGenre').textContent    = movie.genre;
  document.getElementById('modalMovieDirector').textContent = movie.director !== '—' ? movie.director : 'N/A';

  const mRating = document.getElementById('modalMovieRating');
  mRating.innerHTML = movie.status === 'watched'
    ? buildStarsHTML(movie.rating)
    : '<span style="color:#666;font-style:italic;">Not yet watched</span>';

  /* Poster column */
  const posterCol = document.getElementById('modalPosterCol');
  const posterImg = document.getElementById('modalPosterImg');
  if (movie.posterUrl) {
    posterImg.src           = movie.posterUrl;
    posterImg.alt           = movie.title + ' poster';
    posterCol.style.display = 'block';
  } else {
    posterCol.style.display = 'none';
  }

  /* OMDB plot */
  const plotWrap = document.getElementById('modalPlotWrap');
  if (movie.plot) {
    document.getElementById('modalMoviePlot').textContent = movie.plot;
    plotWrap.style.display = 'block';
  } else {
    plotWrap.style.display = 'none';
  }

  /* Notes */
  const mNotes = document.getElementById('modalMovieNotes');
  if (movie.notes && movie.notes.trim()) {
    mNotes.textContent = movie.notes; mNotes.style.fontStyle = 'normal'; mNotes.style.color = '#ccc';
  } else {
    mNotes.textContent = 'No notes saved for this movie.'; mNotes.style.fontStyle = 'italic'; mNotes.style.color = '#666';
  }

  modal.classList.add('active');
}

closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
window.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });


/* ══════════════════════════════════════════════════════════════
   TABLE ROW CLICK DELEGATION
   ══════════════════════════════════════════════════════════════ */
$('movie-tbody').addEventListener('click', (e) => {
  if (e.target.closest('.btn-delete')) return;
  const row = e.target.closest('tr'); if (!row) return;
  const movie = movies.find(m => m.id === Number(row.dataset.id)); if (!movie) return;
  if (e.target.closest('.badge')) { openUpdateModal(movie); return; }
  openNotesModal(movie);
});


/* ══════════════════════════════════════════════════════════════
   UPDATE STATUS MODAL
   ══════════════════════════════════════════════════════════════ */
const updateModal    = document.getElementById('updateModal');
const closeUpdateBtn = document.querySelector('.close-update-modal');
const updTitle       = document.getElementById('updateMovieTitle');
const updId          = document.getElementById('updateMovieId');
const updStatus      = document.getElementById('updateStatus');
const updStarGroup   = document.getElementById('update-star-group');
const updLockMsg     = document.getElementById('update-rating-lock');
const updRatingInput = document.getElementById('updateRating');
const updStars       = document.querySelectorAll('.upd-star-btn');
const btnSaveUpdate  = document.getElementById('btnSaveUpdate');
let currentUpdRating = 0;

function refreshUpdStars() {
  updStars.forEach(s => s.classList.toggle('active', +s.dataset.val <= currentUpdRating));
}
function setUpdRatingLock(isLocked) {
  if (isLocked) {
    updStarGroup.classList.add('disabled'); updLockMsg.classList.add('show');
    currentUpdRating = 0; refreshUpdStars(); updRatingInput.value = 0;
  } else {
    updStarGroup.classList.remove('disabled'); updLockMsg.classList.remove('show');
  }
}
updStars.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    if (updStarGroup.classList.contains('disabled')) return;
    updStars.forEach(s => s.classList.toggle('active', +s.dataset.val <= +btn.dataset.val));
  });
  btn.addEventListener('mouseleave', refreshUpdStars);
  btn.addEventListener('click', () => {
    if (updStarGroup.classList.contains('disabled')) return;
    currentUpdRating = +btn.dataset.val; updRatingInput.value = currentUpdRating; refreshUpdStars();
  });
});
updStatus.addEventListener('change', function () { setUpdRatingLock(this.value !== 'watched'); });

function openUpdateModal(movie) {
  updTitle.textContent = movie.title;
  updId.value = movie.id; updStatus.value = movie.status;
  if (movie.status === 'watched') {
    setUpdRatingLock(false);
    currentUpdRating = movie.rating || 0; updRatingInput.value = currentUpdRating; refreshUpdStars();
  } else setUpdRatingLock(true);
  updateModal.classList.add('active');
}

closeUpdateBtn.addEventListener('click', () => updateModal.classList.remove('active'));
window.addEventListener('click', (e) => { if (e.target === updateModal) updateModal.classList.remove('active'); });

btnSaveUpdate.addEventListener('click', () => {
  const movieId = Number(updId.value), newStatus = updStatus.value, newRating = Number(updRatingInput.value);
  const idx = movies.findIndex(m => m.id === movieId);
  if (idx > -1) {
    movies[idx].status = newStatus;
    movies[idx].rating = newStatus === 'watched' ? newRating : 0;
    saveMovies(); renderTable(); updateStats();
    showToast(`"${movies[idx].title}" status updated!`);
  }
  updateModal.classList.remove('active');
});


/* ══════════════════════════════════════════════════════════════
   INITIALISE
   ══════════════════════════════════════════════════════════════ */
renderTable();
updateStats();