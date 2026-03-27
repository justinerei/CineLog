/* ============================================================
   CineLog — recommendations.js
   Personalised recommendation engine for recommendations.html
   Fetches real movie posters from OMDB API for every card.
   ITEL 203 Group Performance Task #1
   ============================================================ */

/* ══════════════════════════════════════════════════════════════
   OMDB API CONFIGURATION
   Same key used in script.js
   ══════════════════════════════════════════════════════════════ */
const OMDB_KEY  = '72f08bc0';
const OMDB_BASE = `https://www.omdbapi.com/?apikey=${OMDB_KEY}`;

/* ── DATA SOURCE ────────────────────────────────────────────── */
const movies   = JSON.parse(localStorage.getItem('cinelog_movies') || '[]');
const active   = movies.filter(m => m.status !== 'deleted');
const watched  = active.filter(m => m.status === 'watched');
const planList = active.filter(m => m.status === 'plan');

/* ── IN-MEMORY POSTER CACHE ─────────────────────────────────── */
/* Caches OMDB results within the page session so we don't fire
   duplicate API requests for the same title. */
const posterCache = {};

/* ── FETCH POSTER FROM OMDB ─────────────────────────────────── */
/* Returns a poster URL string or null.
   Tries exact title + year first, then title-only as fallback. */
async function fetchPoster(title, year) {
  const cacheKey = `${title.toLowerCase()}|${year}`;
  if (posterCache[cacheKey] !== undefined) return posterCache[cacheKey];

  try {
    /* First attempt: exact match with year */
    const url1 = `${OMDB_BASE}&t=${encodeURIComponent(title)}&y=${year}&type=movie`;
    const res1  = await fetch(url1);
    const data1 = await res1.json();

    if (data1.Response === 'True' && data1.Poster && data1.Poster !== 'N/A') {
      posterCache[cacheKey] = data1.Poster;
      return data1.Poster;
    }

    /* Second attempt: title only (in case the year doesn't match OMDB exactly) */
    const url2 = `${OMDB_BASE}&t=${encodeURIComponent(title)}&type=movie`;
    const res2  = await fetch(url2);
    const data2 = await res2.json();

    if (data2.Response === 'True' && data2.Poster && data2.Poster !== 'N/A') {
      posterCache[cacheKey] = data2.Poster;
      return data2.Poster;
    }

    posterCache[cacheKey] = null;
    return null;

  } catch {
    posterCache[cacheKey] = null;
    return null;
  }
}

/* ── GENRE PREFERENCE SCORE ─────────────────────────────────── */
/* Builds a weighted { genre: 0-100 } profile from watch history.
   4★+ movies get double weight, 3★ normal weight, unrated = 0.5.
   Returns null when there are no watched movies. */
function buildGenreProfile() {
  if (watched.length === 0) return null;

  const scores = {};
  watched.forEach(m => {
    const w = m.rating >= 4 ? 2 : m.rating === 3 ? 1 : 0.5;
    scores[m.genre] = (scores[m.genre] || 0) + w;
  });

  /* Normalise to 0–100 */
  const max = Math.max(...Object.values(scores), 1);
  Object.keys(scores).forEach(g => {
    scores[g] = Math.round((scores[g] / max) * 100);
  });

  return scores;
}

/* ── FAVOURITE DIRECTOR ─────────────────────────────────────── */
/* Returns [name, count] for the director with the most watched
   films (requires ≥ 2 to qualify). Returns null otherwise. */
function getFavouriteDirector() {
  const withDir = watched.filter(m => m.director && m.director !== '—');
  if (withDir.length < 2) return null;

  const counts = withDir.reduce((acc, m) => {
    acc[m.director] = (acc[m.director] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] >= 2 ? sorted[0] : null;
}

/* ── SCORE A PLAN-TO-WATCH MOVIE ────────────────────────────── */
function scoreMovie(movie, genreProfile) {
  if (!genreProfile) return 0;
  return genreProfile[movie.genre] || 0;
}

/* ── BUILD A RECOMMENDATION CARD (skeleton) ─────────────────── */
/* Renders the card shell immediately with a poster placeholder.
   The real poster image is injected asynchronously after the
   OMDB API responds. Each card gets a unique data-card-id so
   the async poster loader can target the right element. */
function buildRecCard(movie, score, reason, cardId) {
  const matchPct = score > 0
    ? `<div class="rec-match-pct">${score}<span class="rec-match-label">match</span></div>`
    : '';

  const metaParts = [movie.year];
  if (movie.duration) metaParts.push(`${movie.duration}m`);
  if (movie.director && movie.director !== '—') metaParts.push(movie.director);

  /* If the movie already has a stored poster URL (added via OMDB on the home page),
     use it directly and skip the async fetch for that card. */
  const hasCachedPoster = !!(movie.posterUrl);
  const posterHtml = hasCachedPoster
    ? `<img class="rec-poster-img" src="${movie.posterUrl}" alt="${movie.title} poster"
          onerror="this.parentElement.innerHTML='<div class=rec-poster-placeholder>🎬</div>'" />`
    : `<div class="rec-poster-skeleton" id="rec-poster-${cardId}">
         <div class="rec-poster-shimmer"></div>
       </div>`;

  return `
    <div class="rec-card" data-card-id="${cardId}">
      ${matchPct}
      <!-- Poster column -->
      <div class="rec-poster-col">
        ${posterHtml}
      </div>
      <!-- Details column -->
      <div class="rec-details-col">
        <div class="rec-title">${movie.title}</div>
        <div class="rec-meta">${metaParts.join(' · ')}</div>
        <span class="genre-pill">${movie.genre}</span>
        ${reason ? `<div class="rec-reason">${reason}</div>` : ''}
      </div>
    </div>`;
}

/* ── ASYNC POSTER INJECTOR ──────────────────────────────────── */
/* After cards are rendered in the DOM, this fires OMDB requests
   for each card that still has a skeleton placeholder, then
   replaces the skeleton with the real poster (or a fallback icon). */
async function loadPostersForGrid(movies, cardIds) {
  const fetchPromises = movies.map(async (movie, i) => {
    /* If the movie already had a stored poster, nothing to do */
    if (movie.posterUrl) return;

    const cardId      = cardIds[i];
    const skeletonEl  = document.getElementById(`rec-poster-${cardId}`);
    if (!skeletonEl) return;

    const posterUrl = await fetchPoster(movie.title, movie.year);

    if (posterUrl) {
      /* Replace the skeleton with the real poster image */
      const img = document.createElement('img');
      img.className = 'rec-poster-img';
      img.src       = posterUrl;
      img.alt       = `${movie.title} poster`;
      img.onerror   = () => {
        img.replaceWith(makeFallbackIcon());
      };
      skeletonEl.replaceWith(img);
    } else {
      /* No poster found — show the placeholder icon */
      skeletonEl.replaceWith(makeFallbackIcon());
    }
  });

  /* Fire all poster requests concurrently */
  await Promise.all(fetchPromises);
}

/* Creates the fallback poster placeholder element */
function makeFallbackIcon() {
  const div = document.createElement('div');
  div.className   = 'rec-poster-placeholder';
  div.textContent = '🎬';
  return div;
}

/* ── UNIQUE CARD ID COUNTER ─────────────────────────────────── */
let cardIdCounter = 0;
function nextCardId() { return ++cardIdCounter; }


/* ══════════════════════════════════════════════════════════════
   RENDER: TASTE PROFILE SECTION
   ══════════════════════════════════════════════════════════════ */
function renderTasteProfile(genreProfile, favDirector) {
  const tagsContainer = document.getElementById('taste-tags');
  const dirContainer  = document.getElementById('taste-director');
  const introText     = document.getElementById('taste-intro-text');

  if (!genreProfile) {
    introText.textContent = 'Watch and rate some movies to build your taste profile.';
    tagsContainer.innerHTML = `
      <span class="taste-tag" style="opacity:0.4;">Genre 1</span>
      <span class="taste-tag" style="opacity:0.25;">Genre 2</span>
      <span class="taste-tag" style="opacity:0.12;">Genre 3</span>`;
    dirContainer.innerHTML = '';
    return;
  }

  const topGenres = Object.entries(genreProfile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (!topGenres.length) {
    tagsContainer.innerHTML = '<span style="color:var(--text-muted);font-size:0.84rem;">No genre data yet.</span>';
  } else {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];
    tagsContainer.innerHTML = topGenres.map(([genre, score], i) => `
      <span class="taste-tag">
        <span style="font-size:1rem;line-height:1;">${medals[i] || '▸'}</span>
        ${genre}
        <span style="font-family:var(--font-bebas);color:var(--text-muted);font-size:0.8rem;">${score}</span>
      </span>`).join('');

    const highRated = watched.filter(m => m.rating >= 4).length;
    introText.textContent = highRated > 0
      ? `Based on ${highRated} movie${highRated !== 1 ? 's' : ''} you rated 4★ or higher.`
      : `Based on all ${watched.length} movie${watched.length !== 1 ? 's' : ''} you've watched.`;
  }

  if (favDirector) {
    dirContainer.innerHTML = `
      🎬 &nbsp;<strong style="color:var(--text-primary);">Favourite Director:</strong>
      ${favDirector[0]}
      <span style="color:var(--text-muted);margin-left:4px;">(${favDirector[1]} films watched)</span>`;
  } else {
    dirContainer.innerHTML = '';
  }
}


/* ══════════════════════════════════════════════════════════════
   RENDER: BEST PICKS SECTION
   Top Plan-to-Watch movies ranked by genre match score.
   Posters fetched from OMDB for each card.
   ══════════════════════════════════════════════════════════════ */
async function renderBestPicks(genreProfile) {
  const grid  = document.getElementById('best-picks-grid');
  const empty = document.getElementById('best-picks-empty');

  const scored = planList
    .map(m => ({ movie: m, score: scoreMovie(m, genreProfile) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (!scored.length) {
    grid.style.display  = 'none';
    empty.style.display = 'block';
    return;
  }

  function getReason(score) {
    if (score >= 80) return '⚡ Excellent match — this is exactly your kind of film.';
    if (score >= 50) return '👍 Good match — aligns well with your taste.';
    return '🙂 Decent match — you might enjoy this one.';
  }

  /* Assign a unique ID to each card for the async poster loader */
  const cardIds = scored.map(() => nextCardId());

  grid.innerHTML = scored
    .map(({ movie, score }, i) => buildRecCard(movie, score, getReason(score), cardIds[i]))
    .join('');
  grid.style.display = '';

  /* Load posters asynchronously without blocking the render */
  loadPostersForGrid(scored.map(s => s.movie), cardIds);
}


/* ══════════════════════════════════════════════════════════════
   RENDER: EXPLORE NEW GENRES SECTION
   Plan-to-Watch movies in genres outside the user's top genres.
   ══════════════════════════════════════════════════════════════ */
async function renderExploreSection(genreProfile) {
  const grid  = document.getElementById('explore-grid');
  const empty = document.getElementById('explore-empty');

  /* Genres with a score above 30 are considered "strong" preferences */
  const strongGenres = new Set(
    genreProfile
      ? Object.entries(genreProfile).filter(([, s]) => s > 30).map(([g]) => g)
      : []
  );

  const explorable = planList
    .filter(m => !strongGenres.has(m.genre))
    .slice(0, 6);

  if (!explorable.length) {
    grid.style.display  = 'none';
    empty.style.display = 'block';
    return;
  }

  const cardIds = explorable.map(() => nextCardId());

  grid.innerHTML = explorable
    .map((m, i) => buildRecCard(m, 0, "🌐 A genre you haven't explored much yet — worth a try!", cardIds[i]))
    .join('');
  grid.style.display = '';

  loadPostersForGrid(explorable, cardIds);
}


/* ══════════════════════════════════════════════════════════════
   RENDER: FALLBACK SECTION (no watch history)
   Shows the full Plan to Watch queue sorted by year.
   ══════════════════════════════════════════════════════════════ */
async function renderFallback() {
  const section = document.getElementById('fallback-section');
  const grid    = document.getElementById('fallback-grid');
  section.style.display = 'block';

  if (!planList.length) {
    grid.innerHTML = `
      <p style="color:var(--text-muted);font-size:0.84rem;font-style:italic;grid-column:1/-1;">
        Add some movies to your "Plan to Watch" list on the home page.
      </p>`;
    return;
  }

  const sorted  = [...planList].sort((a, b) => b.year - a.year).slice(0, 9);
  const cardIds = sorted.map(() => nextCardId());

  grid.innerHTML = sorted
    .map((m, i) => buildRecCard(m, 0, '◷ On your Plan to Watch list', cardIds[i]))
    .join('');

  loadPostersForGrid(sorted, cardIds);
}


/* ══════════════════════════════════════════════════════════════
   INITIALISE
   ══════════════════════════════════════════════════════════════ */
async function init() {
  const emptyAll  = document.getElementById('rec-empty-all');
  const emptyPlan = document.getElementById('rec-empty-plan');
  const content   = document.getElementById('rec-content');

  /* Case 1: no movies at all */
  if (active.length === 0) {
    emptyAll.style.display  = 'flex';
    emptyPlan.style.display = 'none';
    content.style.display   = 'none';
    return;
  }

  /* Case 2: has movies but no Plan to Watch entries */
  if (planList.length === 0) {
    emptyAll.style.display  = 'none';
    emptyPlan.style.display = 'flex';
    content.style.display   = 'none';
    return;
  }

  /* Case 3: show the full personalised UI */
  emptyAll.style.display  = 'none';
  emptyPlan.style.display = 'none';
  content.style.display   = 'block';

  const genreProfile = buildGenreProfile();
  const favDirector  = getFavouriteDirector();

  renderTasteProfile(genreProfile, favDirector);

  if (!genreProfile) {
    /* No watch history — hide personalised sections, show plain queue */
    document.getElementById('best-picks-grid').closest('.mb-8').style.display  = 'none';
    document.getElementById('best-picks-empty').style.display = 'none';
    document.getElementById('explore-grid').closest('.mb-8').style.display     = 'none';
    document.getElementById('explore-empty').style.display    = 'none';
    await renderFallback();
  } else {
    document.getElementById('fallback-section').style.display = 'none';
    /* Both sections run concurrently for faster poster loading */
    await Promise.all([
      renderBestPicks(genreProfile),
      renderExploreSection(genreProfile),
    ]);
  }
}

init();