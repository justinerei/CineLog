/* ============================================================
   CineLog — script.js
   Main application logic for index.html (Watchlist page)
   ITEL 203 Group Performance Task #1
   ============================================================ */

/* ── DATA STORE ───────────────────────────────────────────────
   Movies are stored as an array in localStorage so data
   persists between page reloads.
   ──────────────────────────────────────────────────────────── */
let movies = JSON.parse(localStorage.getItem('cinelog_movies') || '[]');

/* Current state for filtering, searching, and sorting */
let currentFilter = 'all';
let currentSearch = '';
let sortCol       = '';
let sortDir       = 1;          /* 1 = ascending, -1 = descending */
let selectedRating = 0;         /* currently chosen star count */

/* ── HELPERS ──────────────────────────────────────────────────
   Small utility functions used throughout the script.
   ──────────────────────────────────────────────────────────── */

/** Save movies array to localStorage */
const saveMovies = () =>
  localStorage.setItem('cinelog_movies', JSON.stringify(movies));

/** Shorthand to get a DOM element by its id */
const $ = id => document.getElementById(id);


/* ── TOAST NOTIFICATIONS ──────────────────────────────────────
   Shows a brief pop-up message at the bottom-right corner.
   type: 'success' | 'error'
   ──────────────────────────────────────────────────────────── */
function showToast(message, type = 'success') {
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span>${type === 'success' ? '✅' : '❌'}</span>
    <span>${message}</span>`;
  container.appendChild(el);

  /* Auto-remove after 3 seconds with fade-out */
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}


/* ── STAT COUNTER ANIMATION ───────────────────────────────────
   Bumps the scale of a stat number briefly for a satisfying
   feedback effect whenever the value changes.
   ──────────────────────────────────────────────────────────── */
function bumpStat(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('bump');      /* reset if already bumping */
  /* Force reflow so the animation re-triggers */
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 220);
}

/** Update all five stat counters in the stats bar */
function updateStats() {
  const total    = movies.length;
  const watched  = movies.filter(m => m.status === 'watched').length;
  const watching = movies.filter(m => m.status === 'watching').length;
  const plan     = movies.filter(m => m.status === 'plan').length;
  const rated    = movies.filter(m => m.rating > 0);
  const avg      = rated.length
    ? (rated.reduce((s, m) => s + m.rating, 0) / rated.length).toFixed(1) + '★'
    : '—';

  /* Only bump if the value changed (to avoid unnecessary animation) */
  const els = {
    'stat-total':    total,
    'stat-watched':  watched,
    'stat-watching': watching,
    'stat-plan':     plan,
  };

  Object.entries(els).forEach(([id, val]) => {
    const el = $(id);
    if (el && el.textContent !== String(val)) {
      el.textContent = val;
      bumpStat(id);
    }
  });

  $('stat-avg').textContent = avg;
}


/* ── STAR RATING WIDGET ───────────────────────────────────────
   Interactive stars for rating a movie.
   Stars are DISABLED when the watch status is not "watched".
   ──────────────────────────────────────────────────────────── */
const allStars   = document.querySelectorAll('.star-btn');
const starGroup  = $('star-group');
const lockMsg    = $('rating-lock-msg');

/** Refresh star highlights based on selectedRating */
function refreshStars() {
  allStars.forEach(s =>
    s.classList.toggle('active', +s.dataset.val <= selectedRating)
  );
}

/** Enable or disable the rating widget depending on status */
function setRatingLock(isLocked) {
  if (isLocked) {
    /* Disable: grey out stars and show lock message */
    starGroup.classList.add('disabled');
    lockMsg.classList.add('show');
    selectedRating = 0;
    refreshStars();
    $('rating').value = 0;
  } else {
    /* Enable: restore normal interaction */
    starGroup.classList.remove('disabled');
    lockMsg.classList.remove('show');
  }
}

/* Hover effect — highlight stars up to hovered star */
allStars.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    if (starGroup.classList.contains('disabled')) return;
    const val = +btn.dataset.val;
    allStars.forEach(s => s.classList.toggle('active', +s.dataset.val <= val));
  });

  btn.addEventListener('mouseleave', () => {
    refreshStars(); /* revert to selectedRating on mouse leave */
  });

  /* Click — lock in the rating */
  btn.addEventListener('click', () => {
    if (starGroup.classList.contains('disabled')) return;
    selectedRating    = +btn.dataset.val;
    $('rating').value = selectedRating;
    refreshStars();
  });
});

/* Listen to status changes to enable/disable rating */
$('status').addEventListener('change', function () {
  /* Rating is only meaningful when a movie has been watched */
  setRatingLock(this.value !== 'watched');
});

/* Initialise as locked (no status selected yet) */
setRatingLock(true);


/* ── FORM VALIDATION ──────────────────────────────────────────
   Each required field is validated before submission.
   Inline error messages are shown below the field.
   ──────────────────────────────────────────────────────────── */

/**
 * Set or clear the error state on a specific field.
 * @param {string} inputId  - element id of the input
 * @param {string} errId    - element id of its error message div
 * @param {boolean} isError - true to show error, false to clear
 */
function setFieldState(inputId, errId, isError) {
  const input = $(inputId);
  const errEl = $(errId);
  if (!input || !errEl) return;

  input.classList.toggle('is-error', isError);
  /* Only mark valid if the field has a value */
  input.classList.toggle('is-valid', !isError && input.value.trim() !== '');
  errEl.classList.toggle('show', isError);
}

/**
 * Run validation on all fields.
 * @returns {boolean} true if the whole form is valid
 */
function validateForm() {
  let isValid = true;

  const title    = $('movieTitle').value.trim();
  const yearVal  = $('releaseYear').value;
  const year     = Number(yearVal);
  const dur      = $('duration').value;
  const director = $('director').value.trim();
  const genre    = $('genre').value;
  const status   = $('status').value;
  const notes    = $('notes').value.trim();

  /* Title — required */
  if (!title) {
    setFieldState('movieTitle', 'err-title', true);
    isValid = false;
  } else {
    setFieldState('movieTitle', 'err-title', false);
  }

  /* Year — required, must be 1888–2030 */
  if (!yearVal || year < 1888 || year > 2030) {
    setFieldState('releaseYear', 'err-year', true);
    isValid = false;
  } else {
    setFieldState('releaseYear', 'err-year', false);
  }

  /* Duration — optional, but if provided must be 1–600 */
  if (dur !== '' && (isNaN(Number(dur)) || Number(dur) < 1 || Number(dur) > 600)) {
    setFieldState('duration', 'err-duration', true);
    isValid = false;
  } else {
    setFieldState('duration', 'err-duration', false);
  }

  /* Director — optional, but must not contain digits */
  if (director && /\d/.test(director)) {
    setFieldState('director', 'err-director', true);
    isValid = false;
  } else {
    setFieldState('director', 'err-director', false);
  }

  /* Genre — required */
  if (!genre) {
    setFieldState('genre', 'err-genre', true);
    isValid = false;
  } else {
    setFieldState('genre', 'err-genre', false);
  }

  /* Status — required */
  if (!status) {
    setFieldState('status', 'err-status', true);
    isValid = false;
  } else {
    setFieldState('status', 'err-status', false);
  }

  /* Notes — optional, max 300 characters */
  if (notes.length > 300) {
    setFieldState('notes', 'err-notes', true);
    isValid = false;
  } else {
    setFieldState('notes', 'err-notes', false);
  }

  return isValid;
}

/* Live validation — re-validate on every input/change event */
['movieTitle', 'releaseYear', 'duration', 'director', 'genre', 'status', 'notes'].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input',  validateForm);
  el.addEventListener('change', validateForm);
});


/* ── FORM SUBMIT ──────────────────────────────────────────────
   Creates a new movie object and prepends it to the list.
   ──────────────────────────────────────────────────────────── */
$('movie-form').addEventListener('submit', function (e) {
  e.preventDefault(); /* Prevent default page-reload behaviour */

  /* Stop if validation fails */
  if (!validateForm()) {
    showToast('Please fix the errors before adding.', 'error');
    return;
  }

  /* Build the new movie record */
  const movie = {
    id:       Date.now(),                         /* unique timestamp id */
    title:    $('movieTitle').value.trim(),
    year:     Number($('releaseYear').value),
    duration: $('duration').value ? Number($('duration').value) : null,
    director: $('director').value.trim() || '—',
    genre:    $('genre').value,
    status:   $('status').value,
    rating:   selectedRating,
    notes:    $('notes').value.trim(),
  };

  /* Add to the beginning so newest appears first */
  movies.unshift(movie);
  saveMovies();

  /* Refresh UI */
  renderTable();
  updateStats();
  showToast(`"${movie.title}" added to your watchlist!`);

  /* ── Reset the form to blank state ── */
  this.reset();
  selectedRating    = 0;
  $('rating').value = 0;
  refreshStars();
  setRatingLock(true); /* lock rating again since status is cleared */

  /* Remove validation classes from all fields */
  ['movieTitle', 'releaseYear', 'duration', 'director', 'genre', 'status', 'notes']
    .forEach(id => {
      const el = $(id);
      if (el) el.classList.remove('is-error', 'is-valid');
    });
  document.querySelectorAll('.error-msg').forEach(el => el.classList.remove('show'));
});


/* ── DELETE MOVIE ─────────────────────────────────────────────
   Called by the delete button in each table row.
   The function is exposed globally so onclick="" works.
   ──────────────────────────────────────────────────────────── */
function deleteMovie(id) {
  const target = movies.find(m => m.id === id);
  if (!target) return;

  /* Remove from array */
  movies = movies.filter(m => m.id !== id);
  saveMovies();

  /* Refresh UI */
  renderTable();
  updateStats();
  showToast(`"${target.title}" removed.`, 'error');
}

/* Make deleteMovie accessible from inline onclick attributes */
window.deleteMovie = deleteMovie;


/* ── RATING HTML HELPER ───────────────────────────────────────
   Returns the HTML string for a 5-star display.
   ──────────────────────────────────────────────────────────── */
function buildStarsHTML(n) {
  if (!n) {
    return '<span style="color:var(--text-muted);font-size:0.72rem;">—</span>';
  }
  let html = '<span class="stars-display">';
  for (let i = 1; i <= 5; i++) {
    html += i <= n ? '★' : '<span class="empty">★</span>';
  }
  return html + '</span>';
}


/* ── STATUS BADGE MAP ─────────────────────────────────────────
   Maps a status value to its CSS class and display label.
   ──────────────────────────────────────────────────────────── */
const STATUS_MAP = {
  watched:  ['badge-watched',  '✓ Watched'],
  watching: ['badge-watching', '▶ Watching'],
  plan:     ['badge-plan',     '◷ Plan to Watch'],
  dropped:  ['badge-dropped',  '✕ Dropped'],
};


/* ── GET FILTERED + SORTED DATA ───────────────────────────────
   Returns a filtered and (optionally) sorted copy of movies.
   ──────────────────────────────────────────────────────────── */
function getDisplayData() {
  return movies
    /* 1. Apply active filter tab */
    .filter(m => {
      const matchFilter = currentFilter === 'all' || m.status === currentFilter;

      /* 2. Apply search query */
      const q = currentSearch.toLowerCase();
      const matchSearch = !q
        || m.title.toLowerCase().includes(q)
        || m.genre.toLowerCase().includes(q)
        || m.director.toLowerCase().includes(q);

      return matchFilter && matchSearch;
    })
    /* 3. Apply column sort */
    .sort((a, b) => {
      if (!sortCol) return 0;
      let av = a[sortCol];
      let bv = b[sortCol];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return -1 * sortDir;
      if (av > bv) return  1 * sortDir;
      return 0;
    });
}


/* ── RENDER TABLE ─────────────────────────────────────────────
   Re-draws the entire <tbody> from the current data.
   ──────────────────────────────────────────────────────────── */
function renderTable() {
  const tbody      = $('movie-tbody');
  const emptyState = $('empty-state');
  const data       = getDisplayData();

  /* Show empty-state illustration if no results */
  if (!data.length) {
    tbody.innerHTML        = '';
    emptyState.style.display = '';
    return;
  }

  emptyState.style.display = 'none';

  /* Build rows HTML */
  tbody.innerHTML = data.map((m, i) => {
    const [badgeClass, badgeLabel] = STATUS_MAP[m.status] || ['badge-plan', m.status];

    return `
      <tr data-id="${m.id}">
        <td class="row-num">${i + 1}</td>

        <!-- Title with director + duration sub-text -->
        <td class="movie-title-cell">
          ${m.title}
          <small>
            ${m.director !== '—' ? m.director : ''}
            ${m.duration ? ` · ${m.duration}m` : ''}
          </small>
        </td>

        <!-- Genre pill -->
        <td><span class="genre-pill">${m.genre}</span></td>

        <!-- Release year -->
        <td style="color:var(--text-secondary);">${m.year}</td>

        <!-- Status badge -->
        <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>

        <!-- Star rating -->
        <td>${buildStarsHTML(m.rating)}</td>

        <!-- Delete button — calls deleteMovie(id) -->
        <td>
          <button
            class="btn-delete"
            onclick="deleteMovie(${m.id})"
            title="Remove '${m.title}'"
            aria-label="Delete ${m.title}">
            ✕
          </button>
        </td>
      </tr>`;
  }).join('');
}


/* ── FILTER TABS ──────────────────────────────────────────────
   Clicking a tab updates currentFilter and re-renders the table.
   ──────────────────────────────────────────────────────────── */
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentFilter = tab.dataset.filter;

    /* Highlight only the clicked tab */
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    renderTable();
  });
});


/* ── SEARCH ───────────────────────────────────────────────────
   Filters the table in real-time as the user types.
   ──────────────────────────────────────────────────────────── */
$('searchInput').addEventListener('input', function () {
  currentSearch = this.value;
  renderTable();
});


/* ── COLUMN SORT ──────────────────────────────────────────────
   Clicking a <th> with data-col sorts by that column.
   Clicking the same column again reverses direction.
   ──────────────────────────────────────────────────────────── */
document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    if (sortCol === th.dataset.col) {
      sortDir *= -1;                /* reverse direction */
    } else {
      sortCol  = th.dataset.col;
      sortDir  = 1;                 /* reset to ascending */
    }
    renderTable();
  });
});


/* ── INITIALISE ───────────────────────────────────────────────
   Run on page load to populate the table and stats
   from whatever is already in localStorage.
   ──────────────────────────────────────────────────────────── */
renderTable();
updateStats();

// Kunin ang mga Modal Elements
const modal = document.getElementById('notesModal');
const closeModalBtn = document.querySelector('.close-modal');
const modalTitle = document.getElementById('modalMovieTitle');
const modalNotes = document.getElementById('modalMovieNotes');



// Function para buksan ang modal
// Tawagin mo 'to kapag kinlick yung row sa table
function openNotesModal(title, notes) {
  modalTitle.textContent = title;

  // Check kung may notes ba o wala
  if (notes && notes.trim() !== "") {
    modalNotes.textContent = notes;
  } else {
    modalNotes.textContent = "Walang notes na naka-save para sa movie na ito.";
  }
  
  // I-show ang modal
  modal.classList.add('active');
}

// Function para isara ang modal gamit ang 'X'
closeModalBtn.addEventListener('click', () => {
  modal.classList.remove('active');
});

// Function para isara ang modal kapag kinlick yung labas ng box
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('active');
  }
});