/* ============================================================
   CineLog — recommendations.js
   Personalised recommendation engine for recommendations.html
   All data sourced from localStorage — no external API required
   ITEL 203 Group Performance Task #1
   ============================================================ */

/* ── DATA SOURCE ────────────────────────────────────────────── */
const movies = JSON.parse(localStorage.getItem('cinelog_movies') || '[]');
const active  = movies.filter(m => m.status !== 'deleted');
const watched = active.filter(m => m.status === 'watched');
const planList = active.filter(m => m.status === 'plan');

/* ── GENRE PREFERENCE SCORE ─────────────────────────────────── */
/* Returns an object { genre: score } where score is a weighted count.
   Movies rated 4+ get double weight; rated 3 get normal weight.
   If the user has no rated watched movies we fall back to all watched movies.
   If there are no watched movies at all we return null. */
function buildGenreProfile() {
  if (watched.length === 0) return null;

  const scores = {};

  /* Prioritise highly-rated movies: weight 4+ as 2, rated 3 as 1, unrated as 0.5 */
  watched.forEach(m => {
    const w = m.rating >= 4 ? 2 : m.rating === 3 ? 1 : 0.5;
    scores[m.genre] = (scores[m.genre] || 0) + w;
  });

  /* Normalise to a 0–100 scale */
  const max = Math.max(...Object.values(scores), 1);
  Object.keys(scores).forEach(g => {
    scores[g] = Math.round((scores[g] / max) * 100);
  });

  return scores;
}

/* ── FAVOURITE DIRECTOR ─────────────────────────────────────── */
/* Returns the director with the most watched movies (needs >= 2 to qualify) */
function getFavouriteDirector() {
  const withDir = watched.filter(m => m.director && m.director !== '—');
  if (withDir.length < 2) return null;

  const counts = withDir.reduce((acc, m) => {
    acc[m.director] = (acc[m.director] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] >= 2 ? sorted[0] : null; /* [name, count] */
}

/* ── SCORE A PLAN-TO-WATCH MOVIE ────────────────────────────── */
/* Returns a 0–100 score for how well a movie fits the genre profile */
function scoreMovie(movie, genreProfile) {
  if (!genreProfile) return 0;
  return genreProfile[movie.genre] || 0;
}

/* ── BUILD A RECOMMENDATION CARD ────────────────────────────── */
/* Returns the HTML string for a single recommendation card */
function buildRecCard(movie, score, reason) {
  const matchPct = score > 0 ? `
    <div class="rec-match-pct">${score}<span class="rec-match-label">match</span></div>` : '';

  const metaParts = [movie.year];
  if (movie.duration) metaParts.push(`${movie.duration}m`);
  if (movie.director && movie.director !== '—') metaParts.push(movie.director);

  return `
    <div class="rec-card">
      ${matchPct}
      <div class="rec-title">${movie.title}</div>
      <div class="rec-meta">${metaParts.join(' · ')}</div>
      <span class="genre-pill">${movie.genre}</span>
      ${reason ? `<div class="rec-reason">${reason}</div>` : ''}
    </div>`;
}

/* ── RENDER TASTE PROFILE SECTION ───────────────────────────── */
/* Populates the genre tags and favourite director in the taste profile card */
function renderTasteProfile(genreProfile, favDirector) {
  const tagsContainer    = document.getElementById('taste-tags');
  const dirContainer     = document.getElementById('taste-director');
  const introText        = document.getElementById('taste-intro-text');

  if (!genreProfile) {
    /* No watched movies — show a gentle prompt instead */
    introText.textContent = 'Watch and rate some movies to build your taste profile.';
    tagsContainer.innerHTML = `
      <span class="taste-tag" style="opacity:0.4;">Genre 1</span>
      <span class="taste-tag" style="opacity:0.25;">Genre 2</span>
      <span class="taste-tag" style="opacity:0.12;">Genre 3</span>`;
    dirContainer.innerHTML  = '';
    return;
  }

  /* Sort genres by score and take the top 6 */
  const topGenres = Object.entries(genreProfile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (topGenres.length === 0) {
    tagsContainer.innerHTML = '<span style="color:var(--text-muted);font-size:0.84rem;">No genre data available yet.</span>';
  } else {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];
    tagsContainer.innerHTML = topGenres.map(([genre, score], i) => `
      <span class="taste-tag">
        <span style="font-size:1rem;line-height:1;">${medals[i] || '▸'}</span>
        ${genre}
        <span style="font-family:var(--font-bebas);color:var(--text-muted);font-size:0.8rem;">${score}</span>
      </span>`).join('');

    /* Describe how the profile was derived */
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

/* ── RENDER BEST PICKS SECTION ──────────────────────────────── */
/* Top Plan-to-Watch movies ranked by genre match score */
function renderBestPicks(genreProfile) {
  const grid  = document.getElementById('best-picks-grid');
  const empty = document.getElementById('best-picks-empty');

  /* Score and sort the plan list, then show the top 6 with a score > 0 */
  const scored = planList
    .map(m => ({ movie: m, score: scoreMovie(m, genreProfile) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (scored.length === 0) {
    grid.style.display  = 'none';
    empty.style.display = 'block';
    return;
  }

  /* Determine the reason text based on how good the score is */
  function getReason(score) {
    if (score >= 80) return '⚡ Excellent match — this is exactly your kind of film.';
    if (score >= 50) return '👍 Good match — aligns well with your taste.';
    return '🙂 Decent match — you might enjoy this one.';
  }

  grid.innerHTML = scored
    .map(({ movie, score }) => buildRecCard(movie, score, getReason(score)))
    .join('');
}

/* ── RENDER EXPLORE NEW GENRES SECTION ─────────────────────── */
/* Plan-to-Watch movies in genres the user hasn't watched much */
function renderExploreSection(genreProfile) {
  const grid  = document.getElementById('explore-grid');
  const empty = document.getElementById('explore-empty');

  /* Genres already highly favoured (score > 30) */
  const strongGenres = new Set(
    genreProfile
      ? Object.entries(genreProfile).filter(([, s]) => s > 30).map(([g]) => g)
      : []
  );

  /* Plan movies in genres outside the strong set */
  const explorable = planList
    .filter(m => !strongGenres.has(m.genre))
    .slice(0, 6);

  if (explorable.length === 0) {
    grid.style.display  = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.innerHTML = explorable
    .map(m => buildRecCard(m, 0, '🌐 A genre you haven\' explored much yet — worth a try!'))
    .join('');
}

/* ── RENDER FALLBACK SECTION (no watch history) ─────────────── */
/* When there are no watched movies we can't personalise — just show the plan list */
function renderFallback() {
  const section = document.getElementById('fallback-section');
  const grid    = document.getElementById('fallback-grid');

  section.style.display = 'block';

  if (planList.length === 0) {
    grid.innerHTML = `
      <p style="color:var(--text-muted);font-size:0.84rem;font-style:italic;grid-column:1/-1;">
        Add some movies to your "Plan to Watch" list on the home page.
      </p>`;
    return;
  }

  /* Sort by year descending — newest first */
  const sorted = [...planList].sort((a, b) => b.year - a.year).slice(0, 9);
  grid.innerHTML = sorted
    .map(m => buildRecCard(m, 0, '◷ On your Plan to Watch list'))
    .join('');
}

/* ── INITIALISE ─────────────────────────────────────────────── */
function init() {
  const emptyAll  = document.getElementById('rec-empty-all');
  const emptyPlan = document.getElementById('rec-empty-plan');
  const content   = document.getElementById('rec-content');
  const bestSection   = document.getElementById('best-picks-grid').closest('.mb-8')?.parentElement;
  const exploreSection = document.getElementById('explore-grid').closest('.mb-8')?.parentElement;

  /* ── Case 1: no movies at all ── */
  if (active.length === 0) {
    emptyAll.style.display  = 'flex';
    emptyPlan.style.display = 'none';
    content.style.display   = 'none';
    return;
  }

  /* ── Case 2: has movies but no Plan to Watch list ── */
  if (planList.length === 0) {
    emptyAll.style.display  = 'none';
    emptyPlan.style.display = 'flex';
    content.style.display   = 'none';
    return;
  }

  /* ── Case 3: has plan movies — show the full recommendations UI ── */
  emptyAll.style.display  = 'none';
  emptyPlan.style.display = 'none';
  content.style.display   = 'block';

  const genreProfile = buildGenreProfile();
  const favDirector  = getFavouriteDirector();

  renderTasteProfile(genreProfile, favDirector);

  if (!genreProfile) {
    /* No watch history — hide personalised sections, show fallback */
    document.querySelector('#best-picks-grid').closest('.mb-8').style.display  = 'none';
    document.querySelector('#explore-grid').closest('.mb-8').style.display     = 'none';
    document.querySelectorAll('.mb-2').forEach(el => {
      if (el.querySelector('#best-picks-grid, #explore-grid')) el.style.display = 'none';
    });
    renderFallback();
  } else {
    document.getElementById('fallback-section').style.display = 'none';
    renderBestPicks(genreProfile);
    renderExploreSection(genreProfile);
  }
}

init();