// main.js — dashboard + always-visible leaderboard with editable username
import { signup, login, logout, onAuthStateChange, getUser, upsertProfile, getProfile } from './auth.js';
import { fetchQuestions, subscribeQuestions, saveScore, getScore, getLeaderboard } from './quiz.js';

const authSection = document.getElementById('auth-section');
const quizSection = document.getElementById('quiz-section');
const quizContainer = document.getElementById('quiz-container');
const scoreboard = document.getElementById('scoreboard');
const userNav = document.getElementById('user-nav');
const leaderboardList = document.getElementById('leaderboard-list');

let user = null;
let originalQuestions = [];
let quizQuestions = [];
let currentQuestion = 0;
let userScore = 0;

// util
function escapeHtml(t = '') { return String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function focusFirstInput() { const i = authSection?.querySelector('input'); if (i) i.focus(); }

// render user nav with Edit username
function renderUserNav(emailOrId) {
  if (!userNav) return;
  const display = escapeHtml(emailOrId || 'User');
  userNav.innerHTML = `
    <span style="margin-right:8px">Hello, ${display}</span>
    <button id="edit-username-btn" class="secondary">Edit username</button>
    <button id="logout-btn" style="margin-left:8px">Logout</button>
  `;
  document.getElementById('logout-btn')?.addEventListener('click', async () => await logout());
  document.getElementById('edit-username-btn')?.addEventListener('click', showEditUsernameForm);
}

// Show inline edit form in the authSection
async function showEditUsernameForm() {
  if (!user) return;
  // fetch current username from profiles (preferred) or user metadata
  const currentProfileName = await getProfile(user.id) || user.user_metadata?.username || '';
  authSection.hidden = false;
  quizSection.hidden = true;
  authSection.innerHTML = `
    <div style="padding:12px">
      <h2>Edit Username</h2>
      <div id="edit-error" style="color:#b71c1c;margin-bottom:8px"></div>
      <label>Username:
        <input type="text" id="edit-username-input" value="${escapeHtml(currentProfileName)}" maxlength="30" minlength="2" />
      </label>
      <div style="margin-top:10px">
        <button id="save-username-btn">Save</button>
        <button id="cancel-username-btn" class="secondary">Cancel</button>
      </div>
      <div style="margin-top:8px;color:#666">Usernames must be unique. Avoid special characters.</div>
    </div>
  `;
  focusFirstInput();

  document.getElementById('cancel-username-btn')?.addEventListener('click', () => {
    // return to dashboard
    renderDashboardForUser();
  });

  document.getElementById('save-username-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('edit-username-input');
    if (!input) return;
    const newUsername = input.value.trim();
    if (newUsername.length < 2) {
      document.getElementById('edit-error').textContent = 'Username must be at least 2 characters.';
      return;
    }
    // basic validation: allowed chars (letters, numbers, underscore, dash)
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(newUsername)) {
      document.getElementById('edit-error').textContent = 'Allowed: letters, numbers, underscore (_) and dash (-).';
      return;
    }
    // attempt to upsert profile (will fail if username already exists due to unique constraint)
    document.getElementById('edit-error').textContent = 'Saving...';
    const res = await upsertProfile(user.id, newUsername);
    if (res?.error) {
      // Postgres unique violation contains 'duplicate' or constraint name - show friendly message
      const msg = String(res.error.message || res.error).toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
        document.getElementById('edit-error').textContent = 'Username already taken. Choose another.';
      } else {
        document.getElementById('edit-error').textContent = 'Failed to save username.';
      }
      return;
    }
    // success
    document.getElementById('edit-error').textContent = '';
    // update UI: refresh nav, dashboard and leaderboard
    renderUserNav(newUsername);
    await renderLeaderboard();
    renderDashboardForUser();
  });
}

// Render a small dashboard for logged in user (Start Quiz, show best score)
function renderDashboardForUser() {
  if (!user) { renderAuth(); return; }
  authSection.hidden = false;
  quizSection.hidden = true;
  const displayName = user.user_metadata?.username || '';
  authSection.innerHTML = `
    <div style="padding:12px">
      <h2>Welcome, ${escapeHtml(displayName || user.email || user.id)}</h2>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button id="start-quiz-btn">Start Quiz</button>
        <button id="refresh-lb-btn" class="secondary">Refresh Leaderboard</button>
      </div>
      <div style="margin-top:10px;color:#666" id="dashboard-note">Click Start Quiz when you are ready.</div>
    </div>
  `;
  document.getElementById('start-quiz-btn')?.addEventListener('click', async () => {
    authSection.hidden = true;
    quizSection.hidden = false;
    if (!originalQuestions.length) {
      originalQuestions = await fetchQuestions();
      subscribeQuestions(async () => { originalQuestions = await fetchQuestions(); });
    }
    startQuiz();
  });
  document.getElementById('refresh-lb-btn')?.addEventListener('click', () => renderLeaderboard());
}

// Auth UI
function renderAuth() {
  quizSection.hidden = true;
  authSection.hidden = false;
  authSection.innerHTML = `
    <form id="login-form" autocomplete="on">
      <h2>Login</h2>
      <div id="error-message"></div>
      <label>Email:<input type="email" name="email" required autocomplete="email"></label>
      <label>Password:<input type="password" name="password" required autocomplete="current-password"></label>
      <input type="submit" value="Login">
      <button type="button" id="show-signup">Need an account?</button>
    </form>
  `;
  focusFirstInput();
  document.getElementById('login-form').onsubmit = async e => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    const res = await login(email, password);
    if (res?.error) {
      authSection.querySelector('#error-message').textContent = res.error.message || JSON.stringify(res.error);
    }
  };
  document.getElementById('show-signup').onclick = renderSignup;
}

function renderSignup() {
  quizSection.hidden = true;
  authSection.hidden = false;
  authSection.innerHTML = `
    <form id="signup-form" autocomplete="on">
      <h2>Create Account</h2>
      <div id="error-message"></div>
      <label>Username:<input type="text" name="username" required minlength="2" maxlength="30" autocomplete="username"></label>
      <label>Email:<input type="email" name="email" required autocomplete="email"></label>
      <label>Password:<input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
      <input type="submit" value="Sign Up">
      <button type="button" id="show-login">Back to Login</button>
    </form>
  `;
  focusFirstInput();
  document.getElementById('signup-form').onsubmit = async e => {
    e.preventDefault();
    const username = e.target.username.value.trim();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    // basic validation
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(username)) {
      authSection.querySelector('#error-message').textContent = 'Username: 2–30 chars, letters, numbers, _ or - only.';
      return;
    }
    const res = await signup(email, password, username);
    if (res?.error) {
      authSection.querySelector('#error-message').textContent = res.error.message || JSON.stringify(res.error);
    } else {
      // After signUp the user may require email confirmation. If auto-logged in, upsert profile now.
      // Try to upsert profile when user is returned (if session present)
      try {
        const sessionUser = res?.data?.user ?? null;
        if (sessionUser && sessionUser.id) {
          await upsertProfile(sessionUser.id, username);
        }
      } catch (err) { console.warn('upsertProfile at signup', err); }
      authSection.querySelector('#error-message').textContent = 'Signed up. If email verification is required, confirm then log in.';
    }
  };
  document.getElementById('show-login').onclick = renderAuth;
}

// Leaderboard
async function renderLeaderboard() {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = 'Loading…';
  try {
    const data = await getLeaderboard(20); // returns username when available
    if (!data.length) {
      leaderboardList.innerHTML = '<p>No scores yet.</p>';
      return;
    }
    leaderboardList.innerHTML = '';
    data.forEach((r, i) => {
      const name = r.username || r.user_id;
      const el = document.createElement('div');
      el.className = 'leaderboard-item';
      el.innerHTML = `<div class="name">${i+1}. ${escapeHtml(name)}</div><div class="score">${r.score}</div>`;
      leaderboardList.appendChild(el);
    });
  } catch (err) {
    console.error('Leaderboard load failed', err);
    leaderboardList.innerHTML = `<p class="muted">Unable to load leaderboard</p>`;
  }
}

// QUIZ flow (same as before)
function startQuiz() {
  quizQuestions = (originalQuestions || []).slice();
  for (let i = quizQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [quizQuestions[i], quizQuestions[j]] = [quizQuestions[j], quizQuestions[i]];
  }
  currentQuestion = 0;
  userScore = 0;
  showQuestion();
}

function showQuestion() {
  if (!Array.isArray(quizQuestions) || quizQuestions.length === 0) {
    quizContainer.innerHTML = `<p>No questions available.</p>`;
    if (scoreboard) scoreboard.textContent = '';
    return;
  }
  if (currentQuestion >= quizQuestions.length) {
    quizContainer.innerHTML = `<h2>Quiz Finished!</h2>
      <p>Your Score: <strong>${userScore} / ${quizQuestions.length}</strong></p>
      <button id="restart-btn">Play Again</button>
    `;
    if (user?.id) saveScore(user.id, userScore).catch(err => console.warn('saveScore', err));
    document.getElementById('restart-btn')?.addEventListener('click', startQuiz);
    if (scoreboard) scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
    // refresh leaderboard to show updated score
    renderLeaderboard();
    return;
  }

  const q = quizQuestions[currentQuestion];
  quizContainer.innerHTML = `
    <div class="quiz-card" tabindex="0">
      <h3 id="question-${q.id}">Q${currentQuestion + 1}. ${escapeHtml(q.question)}</h3>
      <div class="quiz-options" role="radiogroup" aria-labelledby="question-${q.id}">
        ${q.options.map((opt, idx) => `<button class="quiz-option" role="radio" data-idx="${idx}" tabindex="${idx === 0 ? '0' : '-1'}">${escapeHtml(opt)}</button>`).join('')}
      </div>
    </div>
  `;
  if (scoreboard) scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
  const optionEls = quizContainer.querySelectorAll('.quiz-option');
  optionEls.forEach(btn => {
    btn.onclick = () => handleAnswer(parseInt(btn.dataset.idx, 10), btn);
    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); (btn.nextElementSibling || optionEls[0]).focus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); (btn.previousElementSibling || optionEls[optionEls.length - 1]).focus(); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
    });
  });
}

function handleAnswer(selectedIdx, btn) {
  const q = quizQuestions[currentQuestion];
  const correct = selectedIdx === q.answer;
  btn.classList.add(correct ? 'correct' : 'incorrect');
  btn.setAttribute('aria-checked', 'true');
  if (correct) userScore += 1;
  if (scoreboard) scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
  setTimeout(() => { currentQuestion += 1; showQuestion(); }, 700);
}

// Initialization
async function startApp() {
  // initial leaderboard render
  await renderLeaderboard();

  // listen auth state
  onAuthStateChange(async (session) => {
    user = session?.user ?? null;
    if (!user) {
      renderAuth();
      renderUserNav('Guest');
    } else {
      // ensure profile exists if username present in metadata
      const usernameFromMeta = user.user_metadata?.username ?? null;
      if (usernameFromMeta) {
        try { await upsertProfile(user.id, usernameFromMeta); } catch (err) { console.warn('upsertProfile', err); }
      }
      // preload questions
      try {
        originalQuestions = await fetchQuestions();
        subscribeQuestions(async () => { originalQuestions = await fetchQuestions(); });
      } catch (err) { console.warn('loadQuestions', err); }

      // render nav and dashboard
      const displayName = await getProfile(user.id) || user.user_metadata?.username || user.email || user.id;
      renderUserNav(displayName);
      renderDashboardForUser();

      // refresh leaderboard
      renderLeaderboard();
    }
  });

  // check existing session on load
  user = await getUser();
  if (!user) renderAuth();
  else {
    const displayName = await getProfile(user.id) || user.user_metadata?.username || user.email || user.id;
    renderUserNav(displayName);
    authSection.hidden = false;
    quizSection.hidden = true;
    authSection.innerHTML = `<p style="padding:12px">Welcome back. Use the dashboard to start the quiz or edit your username.</p>`;
    try { originalQuestions = await fetchQuestions(); } catch (err) { console.warn('loadQuestions on boot', err); }
  }

  // refresh leaderboard every 30s
  setInterval(() => renderLeaderboard(), 30_000);
}

// startApp(); v6
