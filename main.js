// main.js — updated renderLeaderboard to avoid stuck "Loading…" and display errors/fallbacks
// Replace just the renderLeaderboard function (or update main.js with this function)

async function renderLeaderboard() {
  if (!leaderboardList) return;
  // show loading spinner and text
  leaderboardList.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><span class="spinner" aria-hidden="true"></span><span>Loading…</span></div>`;
  let timeoutReached = false;

  // safety timeout: if request hangs, show a friendly message after 6s
  const timeout = setTimeout(() => {
    timeoutReached = true;
    if (leaderboardList) leaderboardList.innerHTML = '<p class="muted">Still loading… please check your connection or refresh.</p>';
  }, 6000);

  try {
    const data = await getLeaderboard(20);
    clearTimeout(timeout);
    // if timeout already replaced UI, we'll overwrite it now with real data
    if (!data || data.length === 0) {
      leaderboardList.innerHTML = '<p class="muted">No scores yet. Be the first to play!</p>';
      return;
    }
    // Build list
    leaderboardList.innerHTML = '';
    data.forEach((r, i) => {
      const name = r.username || r.user_id || 'Player';
      const el = document.createElement('div');
      el.className = 'leaderboard-item';
      el.innerHTML = `<div class="name">${i+1}. ${escapeHtml(name)}</div><div class="score">${r.score}</div>`;
      leaderboardList.appendChild(el);
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('Leaderboard load failed', err);
    // user-visible friendly message
    leaderboardList.innerHTML = `<p class="muted">Unable to load leaderboard. Try refreshing the page.</p>`;
  } finally {
    // If the timeout already displayed a message, do nothing extra — we've already set content.
    if (timeoutReached) {
      // we may still have overwritten by try/catch; that's fine
    }
  }
}
