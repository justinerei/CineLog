/* ============================================================
   CineLog — script.js
   Main application logic for index.html (Watchlist page)
   ITEL 203 Group Performance Task #1
   ============================================================ */

let movies = JSON.parse(localStorage.getItem('cinelog_movies') || '[]');

let currentFilter = 'all';
let currentSearch = '';
let sortCol       = '';
let sortDir       = 1;          
let selectedRating = 0;         

const saveMovies = () =>
  localStorage.setItem('cinelog_movies', JSON.stringify(movies));

const $ = id => document.getElementById(id);


function showToast(message, type = 'success') {
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span>${type === 'success' ? '✅' : '❌'}</span>
    <span>${message}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}


function bumpStat(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('bump');      
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 220);
}


function updateStats() {
  const total = movies.filter(m => m.status !== 'deleted').length;
  const watched  = movies.filter(m => m.status === 'watched').length;
  const watching = movies.filter(m => m.status === 'watching').length;
  const plan     = movies.filter(m => m.status === 'plan').length;
  const rated    = movies.filter(m => m.rating > 0);
  const avg      = rated.length
    ? (rated.reduce((s, m) => s + m.rating, 0) / rated.length).toFixed(1) + '★'
    : '—';

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


const allStars = document.querySelectorAll('#star-group .star-btn');
const starGroup  = $('star-group');
const lockMsg    = $('rating-lock-msg');


function refreshStars() {
  allStars.forEach(s =>
    s.classList.toggle('active', +s.dataset.val <= selectedRating)
  );
}


function setRatingLock(isLocked) {
  if (isLocked) {
    starGroup.classList.add('disabled');
    lockMsg.classList.add('show');
    selectedRating = 0;
    refreshStars();
    $('rating').value = 0;
  } else {
    starGroup.classList.remove('disabled');
    lockMsg.classList.remove('show');
  }
}

allStars.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    if (starGroup.classList.contains('disabled')) return;
    const val = +btn.dataset.val;
    allStars.forEach(s => s.classList.toggle('active', +s.dataset.val <= val));
  });

  btn.addEventListener('mouseleave', () => {
    refreshStars(); 
  });

  btn.addEventListener('click', () => {
    if (starGroup.classList.contains('disabled')) return;
    selectedRating    = +btn.dataset.val;
    $('rating').value = selectedRating;
    refreshStars();
  });
});

$('status').addEventListener('change', function () {
  setRatingLock(this.value !== 'watched');
});

setRatingLock(true);


// ==========================================
// ADDED: CUSTOM GENRE EVENT LISTENER
// Lalabas yung textbox kung 'Other' ang pinili
// ==========================================
const genreSelect = document.getElementById('genre');
const customGenreGroup = document.getElementById('customGenreGroup');
const customGenreInput = document.getElementById('customGenre');

if (genreSelect && customGenreGroup) {
  genreSelect.addEventListener('change', (e) => {
    // Ginawang toLowerCase() para kahit 'Other' o 'other', kakagat 'to!
    if (e.target.value.toLowerCase() === 'other') {
      customGenreGroup.style.display = 'block'; // Pinipilit ilabas gamit JS
      customGenreInput.required = true;
    } else {
      customGenreGroup.style.display = 'none';  // Pinipilit itago
      customGenreInput.required = false;
      customGenreInput.value = ''; 
    }
  });
}


function setFieldState(inputId, errId, isError) {
  const input = $(inputId);
  const errEl = $(errId);
  if (!input || !errEl) return;

  input.classList.toggle('is-error', isError);
  input.classList.toggle('is-valid', !isError && input.value.trim() !== '');
  errEl.classList.toggle('show', isError);
}


function validateForm() {
  let isValid = true;

  const title    = $('movieTitle').value.trim();
  const yearVal  = $('releaseYear').value;
  const year     = Number(yearVal);
  const dur      = $('duration').value;
  const director = $('director').value.trim();
  const status   = $('status').value;
  const notes    = $('notes').value.trim();
  
  // UPDATED: Check for custom genre if 'other' is selected
  let genre = $('genre').value;
  if (genre === 'other') {
    genre = $('customGenre').value.trim();
  }
  

  if (!title) { setFieldState('movieTitle', 'err-title', true); isValid = false; } else { setFieldState('movieTitle', 'err-title', false); }
  if (!yearVal || year < 1888 || year > 2030) { setFieldState('releaseYear', 'err-year', true); isValid = false; } else { setFieldState('releaseYear', 'err-year', false); }
  if (dur !== '' && (isNaN(Number(dur)) || Number(dur) < 1 || Number(dur) > 600)) { setFieldState('duration', 'err-duration', true); isValid = false; } else { setFieldState('duration', 'err-duration', false); }
  if (director && /\d/.test(director)) { setFieldState('director', 'err-director', true); isValid = false; } else { setFieldState('director', 'err-director', false); }
  
  // Validation sa Genre na Inupdate
  if (!genre) { setFieldState('genre', 'err-genre', true); isValid = false; } else { setFieldState('genre', 'err-genre', false); }
  
  if (!status) { setFieldState('status', 'err-status', true); isValid = false; } else { setFieldState('status', 'err-status', false); }
  if (notes.length > 300) { setFieldState('notes', 'err-notes', true); isValid = false; } else { setFieldState('notes', 'err-notes', false); }

  return isValid;
}

['movieTitle', 'releaseYear', 'duration', 'director', 'genre', 'customGenre', 'status', 'notes'].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input',  validateForm);
  el.addEventListener('change', validateForm);
});


$('movie-form').addEventListener('submit', function (e) {
  e.preventDefault(); 

  if (!validateForm()) {
    showToast('Please fix the errors before adding.', 'error');
    return;
  }

  // UPDATED: Kukunin ang Custom Genre pagka-submit
  let finalGenre = $('genre').value;
  if (finalGenre === 'other') {
    finalGenre = $('customGenre').value.trim();
  }

  const movie = {
    id:       Date.now(), 
    title:    $('movieTitle').value.trim(),
    year:     Number($('releaseYear').value),
    duration: $('duration').value ? Number($('duration').value) : null,
    director: $('director').value.trim() || '—',
    genre:    finalGenre, // Ginagamit na yung nakuha natin sa taas
    status:   $('status').value,
    rating:   selectedRating,
    notes:    $('notes').value.trim(),
  };

  movies.unshift(movie);
  saveMovies();

  renderTable();
  updateStats();
  showToast(`"${movie.title}" added to your watchlist!`);

  this.reset();
  
  // ADDED: Itatago ulit yung custom genre textfield pagkatapos mag-submit
  if (customGenreGroup) {
      customGenreGroup.style.display = 'none';
  }

  selectedRating    = 0;
  $('rating').value = 0;
  refreshStars();
  setRatingLock(true); 

  ['movieTitle', 'releaseYear', 'duration', 'director', 'genre', 'customGenre', 'status', 'notes']
    .forEach(id => {
      const el = $(id);
      if (el) el.classList.remove('is-error', 'is-valid');
    });
  document.querySelectorAll('.error-msg').forEach(el => el.classList.remove('show'));
});


function deleteMovie(id) {
  const target = movies.find(m => m.id === id);
  if (!target) return;

  if (target.status === 'deleted') {
    // If it's already in history, permanently delete it
    movies = movies.filter(m => m.id !== id);
    showToast(`"${target.title}" permanently deleted.`, 'error');
  } else {
    // Soft delete: move to history
    target.status = 'deleted';
    showToast(`"${target.title}" moved to History.`, 'error');
  }

  saveMovies();
  renderTable();
  updateStats();
}
window.deleteMovie = deleteMovie;


function buildStarsHTML(n) {
  if (!n) return '<span style="color:var(--text-muted);font-size:0.72rem;">—</span>';
  let html = '<span class="stars-display">';
  for (let i = 1; i <= 5; i++) html += i <= n ? '★' : '<span class="empty">★</span>';
  return html + '</span>';
}

const STATUS_MAP = {
  watched:  ['badge-watched',  '✓ Watched'],
  watching: ['badge-watching', '▶ Watching'],
  plan:     ['badge-plan',     '◷ Plan to Watch'],
  dropped:  ['badge-dropped',  '✕ Dropped'],
  deleted:  ['badge-deleted',  '🗑 Deleted'] 
};


function getDisplayData() {
  return movies
    .filter(m => {
      const matchFilter = currentFilter === 'all' 
      ? m.status !== 'deleted' 
      : m.status === currentFilter;
      const q = currentSearch.toLowerCase();
      const matchSearch = !q
        || m.title.toLowerCase().includes(q)
        || m.genre.toLowerCase().includes(q)
        || m.director.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    })
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


function renderTable() {
  const tbody      = $('movie-tbody');
  const emptyState = $('empty-state');
  const data       = getDisplayData();

  if (!data.length) {
    tbody.innerHTML        = '';
    emptyState.style.display = '';
    return;
  }

  emptyState.style.display = 'none';

  tbody.innerHTML = data.map((m, i) => {
    const [badgeClass, badgeLabel] = STATUS_MAP[m.status] || ['badge-plan', m.status];

    // ==========================================
    // ADDED: class="clickable-row" so CSS can add a pointer cursor
    // ==========================================
    return `
      <tr data-id="${m.id}" class="clickable-row">
        <td class="row-num">${i + 1}</td>
        <td class="movie-title-cell">
          ${m.title}
          <small>
            ${m.director !== '—' ? m.director : ''}
            ${m.duration ? ` · ${m.duration}m` : ''}
          </small>
        </td>
        <td><span class="genre-pill">${m.genre}</span></td>
        <td style="color:var(--text-secondary);">${m.year}</td>
        <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
        <td>${buildStarsHTML(m.rating)}</td>
        <td>
          <button
            class="btn-delete"
            onclick="deleteMovie(${m.id})"
            title="Remove '${m.title}'">
            ✕
          </button>
        </td>
      </tr>`;
  }).join('');
}


document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentFilter = tab.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderTable();
  });
});

$('searchInput').addEventListener('input', function () {
  currentSearch = this.value;
  renderTable();
});

document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    if (sortCol === th.dataset.col) {
      sortDir *= -1;                
    } else {
      sortCol  = th.dataset.col;
      sortDir  = 1;                 
    }
    renderTable();
  });
});


// ==========================================
// ADDED: MODAL LOGIC AND EVENT DELEGATION
// ==========================================

const modal = document.getElementById('notesModal');
const closeModalBtn = document.querySelector('.close-modal');

// Kunin lahat ng elements sa loob ng modal natin
const mTitle = document.getElementById('modalMovieTitle');
const mStatus = document.getElementById('modalMovieStatus');
const mYear = document.getElementById('modalMovieYear');
const mDuration = document.getElementById('modalMovieDuration');
const mGenre = document.getElementById('modalMovieGenre');
const mDirector = document.getElementById('modalMovieDirector');
const mRating = document.getElementById('modalMovieRating');
const mNotes = document.getElementById('modalMovieNotes');

function openNotesModal(movie) {
  // 1. I-set ang Title
  mTitle.textContent = movie.title;
  
  // 2. I-set ang Status Badge (gamit yung STATUS_MAP natin sa taas)
  const [badgeClass, badgeLabel] = STATUS_MAP[movie.status] || ['badge-plan', movie.status];
  mStatus.className = `badge ${badgeClass}`;
  mStatus.textContent = badgeLabel;

  // 3. I-set ang Meta Info
  mYear.textContent = movie.year;
  mDuration.textContent = movie.duration ? `${movie.duration}m` : 'N/A';
  mGenre.textContent = movie.genre;
  mDirector.textContent = movie.director !== '—' ? movie.director : 'N/A';

  // 4. I-set ang Rating (Titingnan kung 'watched' ba ang status)
  if (movie.status === 'watched') {
    // Gagamitin natin yung buildStarsHTML function na ginawa natin para sa table
    mRating.innerHTML = buildStarsHTML(movie.rating);
  } else {
    mRating.innerHTML = '<span style="color: #666; font-style: italic;">Not yet watched</span>';
  }
  
  // 5. I-set ang Notes
  if (movie.notes && movie.notes.trim() !== "") {
    mNotes.textContent = movie.notes;
    mNotes.style.fontStyle = "normal";
    mNotes.style.color = "#ccc";
  } else {
    mNotes.textContent = "Walang notes na naka-save para sa movie na ito.";
    mNotes.style.fontStyle = "italic";
    mNotes.style.color = "#666";
  }
  
  // Buksan ang modal
  modal.classList.add('active');
}

closeModalBtn.addEventListener('click', () => {
  modal.classList.remove('active');
});

window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('active');
  }
});

// Event Delegation - listens for clicks anywhere inside the table body
$('movie-tbody').addEventListener('click', (e) => {
  if (e.target.closest('.btn-delete')) return;

  const row = e.target.closest('tr');
  if (!row) return; 

  const movieId = Number(row.dataset.id); 
  const movie = movies.find(m => m.id === movieId); 
  if (!movie) return;

  // Kung mismong STATUS BADGE ang kinlick, buksan ang Edit Status Modal
  if (e.target.closest('.badge')) {
    openUpdateModal(movie);
    return; // Pigilan ang pagbukas ng Notes Modal
  }

  // Kung sa ibang part ng row kinlick, buksan ang Notes Modal
  openNotesModal(movie);
});

// ==========================================
// ADDED: UPDATE STATUS MODAL LOGIC
// ==========================================
const updateModal = document.getElementById('updateModal');
const closeUpdateBtn = document.querySelector('.close-update-modal');
const updTitle = document.getElementById('updateMovieTitle');
const updId = document.getElementById('updateMovieId');
const updStatus = document.getElementById('updateStatus');
const updStarGroup = document.getElementById('update-star-group');
const updLockMsg = document.getElementById('update-rating-lock');
const updRatingInput = document.getElementById('updateRating');
const updStars = document.querySelectorAll('.upd-star-btn');
const btnSaveUpdate = document.getElementById('btnSaveUpdate');

let currentUpdRating = 0;

function refreshUpdStars() {
  updStars.forEach(s => {
    s.classList.toggle('active', +s.dataset.val <= currentUpdRating);
  });
}

function setUpdRatingLock(isLocked) {
  if (isLocked) {
    updStarGroup.classList.add('disabled');
    updLockMsg.classList.add('show');
    currentUpdRating = 0;
    refreshUpdStars();
    updRatingInput.value = 0;
  } else {
    updStarGroup.classList.remove('disabled');
    updLockMsg.classList.remove('show');
  }
}

// Hover and click logic for the Update Modal Stars
updStars.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    if (updStarGroup.classList.contains('disabled')) return;
    const val = +btn.dataset.val;
    updStars.forEach(s => s.classList.toggle('active', +s.dataset.val <= val));
  });
  btn.addEventListener('mouseleave', refreshUpdStars);
  
  btn.addEventListener('click', () => {
    if (updStarGroup.classList.contains('disabled')) return;
    currentUpdRating = +btn.dataset.val;
    updRatingInput.value = currentUpdRating;
    refreshUpdStars();
  });
});

// Makinig sa pagpalit ng status sa dropdown
updStatus.addEventListener('change', function() {
  setUpdRatingLock(this.value !== 'watched');
});

// Function para buksan ang Update Modal
function openUpdateModal(movie) {
  updTitle.textContent = movie.title;
  updId.value = movie.id;
  updStatus.value = movie.status;
  
  // Kung 'watched' na siya, buksan ang stars at ilagay ang current rating
  if (movie.status === 'watched') {
    setUpdRatingLock(false);
    currentUpdRating = movie.rating || 0;
    updRatingInput.value = currentUpdRating;
    refreshUpdStars();
  } else {
    setUpdRatingLock(true);
  }
  
  updateModal.classList.add('active');
}

// Close events
closeUpdateBtn.addEventListener('click', () => updateModal.classList.remove('active'));
window.addEventListener('click', (e) => {
  if (e.target === updateModal) updateModal.classList.remove('active');
});

// Save button logic
btnSaveUpdate.addEventListener('click', () => {
  const movieId = Number(updId.value);
  const newStatus = updStatus.value;
  const newRating = Number(updRatingInput.value);

  // Hanapin yung movie at i-update yung data
  const movieIndex = movies.findIndex(m => m.id === movieId);
  if (movieIndex > -1) {
    movies[movieIndex].status = newStatus;
    // Kung nilipat sa 'watched', kunin ang rating. Kung hindi, i-zero ang rating.
    movies[movieIndex].rating = newStatus === 'watched' ? newRating : 0;
    
    saveMovies();
    renderTable();
    updateStats();
    showToast(`"${movies[movieIndex].title}" status updated!`);
  }
  
  updateModal.classList.remove('active');
});

/* ── INITIALISE ─────────────────────────────────────────────── */
renderTable();
updateStats();