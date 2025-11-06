// main.js — show a post-login "dashboard" so user chooses when to start the quiz.
// Replaces previous auto-start behavior.
import { signup, login, logout, onAuthStateChange, getUser } from './auth.js';
import { fetchQuestions, subscribeQuestions, saveScore, getScore, getLeaderboard } from './quiz.js';

const authSection = document.getElementById('auth-section');
const quizSection = document.getElementById('quiz-section');
const quizContainer = document.getElementById('quiz-container');
const scoreboard = document.getElementById('scoreboard');
const userNav = document.getElementById('user-nav');
const leaderboardSection = document.getElementById('leaderboard-section');
const leaderboardList = document.getElementById('leaderboard-list');
const showLeaderboardBtn = document.getElementById('show-leaderboard');
const closeLeaderboardBtn = document.getElementById('close-leaderboard');
const restartBtn = document.getElementById('restart-quiz');

let user = null;
let originalQuestions = [];
let quizQuestions = [];
let currentQuestion = 0;
let userScore = 0;

// Utility
function escapeHtml(text = '') {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function focusFirstInput() {
  const input = authSection.querySelector('input');
  if (input) input.focus();
}

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
  authSection.hidden = false;
  quizSection.hidden = true;
  authSection.innerHTML = `
    <form id="signup-form" autocomplete="on">
      <h2>Sign Up</h2>
      <div id="error-message"></div>
      <label>Email:<input type="email" name="email" required autocomplete="email"></label>
      <label>Password:<input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
      <input type="submit" value="Create Account">
      <button type="button" id="show-login">Already have an account?</button>
    </form>
  `;
  focusFirstInput();
  document.getElementById('signup-form').onsubmit = async e => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    const res = await signup(email, password);
    if (res?.error) {
      authSection.querySelector('#error-message').textContent = res.error.message || JSON.stringify(res.error);
    } else {
      authSection.querySelector('#error-message').textContent = 'Signed up — check email if verification required. Then log in.';
    }
  };
  document.getElementById('show-login').onclick = renderAuth;
}

function renderUserDashboard(email) {
  // Show a small dashboard — user decides when to start the quiz
  authSection.hidden = false;
  quizSection.hidden = true;
  authSection.innerHTML = `
    <div id="user-dashboard">
      <h2>Welcome, ${escapeHtml(email)}</h2>
      <div style="display:flex;gap:0.6rem;margin-top:0.6rem;">
        <button id="start-quiz">Start Quiz</button>
        <button id="view-leaderboard">Leaderboard</button>
        <button id="logout-btn">Logout</button>
      </div>
      <div id="dashboard-note" style="margin-top:0.6rem;color:#666;font-size:0.95rem;">
        Click "Start Quiz" when you're ready. Use "Leaderboard" to view top scores.
      </div>
    </div>
  `;

  document.getElementById('start-quiz').onclick = async () => {
    // ensure questions are loaded before starting
    try {
      authSection.hidden = true;
      quizSection.hidden = false;
      if (!originalQuestions.length) {
        originalQuestions = await fetchQuestions();
        subscribeQuestions(async () => { originalQuestions = await fetchQuestions(); });
      }
      startQuiz();
    } catch (err) {
      console.error('Failed to load questions before starting', err);
      authSection.hidden = false;
      quizSection.hidden = true;
      document.getElementById('dashboard-note').textContent = 'Unable to load questions. Try again later.';
    }
  };
  document.getElementById('view-leaderboard').onclick = showLeaderboard;
  document.getElementById('logout-btn').onclick = async () => { await logout(); };
}

// Leaderboard
async function showLeaderboard() {
  leaderboardList.innerHTML = 'Loading...';
  leaderboardSection.hidden = false;
  try {
    const data = await getLeaderboard(20);
    leaderboardList.innerHTML = '';
    if (!data.length) {
      leaderboardList.innerHTML = '<p>No scores yet.</p>';
      return;
    }
    data.forEach((row, i) => {
      const name = row.email || row.user_id;
      const el = document.createElement('div');
      el.className = 'leaderboard-item';
      el.innerHTML = `<div>${i + 1}. ${escapeHtml(name)}</div><div>${row.score}</div>`;
      leaderboardList.appendChild(el);
    });
  } catch (err) {
    console.error('Leaderboad load error', err);
    leaderboardList.innerHTML = `<p>Failed to load leaderboard: ${escapeHtml(err.message || String(err))}</p>`;
  }
}
function hideLeaderboard() {
  leaderboardSection.hidden = true;
}

// QUIZ FLOW (start only when user presses Start Quiz)
function startQuiz() {
  // shuffle and reset
  quizQuestions = (originalQuestions || []).slice();
  // simple shuffle
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
    scoreboard.textContent = '';
    return;
  }
  if (currentQuestion >= quizQuestions.length) {
    quizContainer.innerHTML = `<h2>Quiz Finished!</h2>
      <p>Your Score: <strong>${userScore} / ${quizQuestions.length}</strong></p>
      <button id="restart-btn">Play Again</button>
      <button id="view-leaderboard-cta">View Leaderboard</button>
    `;
    if (user && user.id) {
      saveScore(user.id, userScore, user.email).catch(err => console.warn('Unable to save score', err));
    }
    document.getElementById('restart-btn').onclick = () => startQuiz();
    document.getElementById('view-leaderboard-cta').onclick = showLeaderboard;
    scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
    return;
  }

  const q = quizQuestions[currentQuestion];
  quizContainer.innerHTML = `
    <div class="quiz-card" tabindex="0">
      <h3 id="question-${q.id}">Q${currentQuestion + 1}. ${escapeHtml(q.question)}</h3>
      <div class="quiz-options" role="radiogroup" aria-labelledby="question-${q.id}">
        ${q.options.map((opt, idx) => `
          <button class="quiz-option" role="radio" aria-checked="false" data-idx="${idx}" tabindex="${idx === 0 ? '0' : '-1'}">
            ${escapeHtml(opt)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
  scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
  const optionEls = quizContainer.querySelectorAll('.quiz-option');
  optionEls.forEach(btn => {
    btn.onclick = () => handleAnswer(parseInt(btn.dataset.idx, 10), btn);
    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = btn.nextElementSibling || optionEls[0];
        next.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = btn.previousElementSibling || optionEls[optionEls.length - 1];
        prev.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });
}

function handleAnswer(selectedIdx, btn) {
  const q = quizQuestions[currentQuestion];
  const correct = selectedIdx === q.answer;
  btn.classList.add(correct ? 'correct' : 'incorrect');
  btn.setAttribute('aria-checked', 'true');
  if (correct) userScore += 1;
  scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
  setTimeout(() => {
    currentQuestion += 1;
    showQuestion();
  }, 700);
}

// Initialization
async function startApp() {
  // wire small UI buttons
  showLeaderboardBtn?.addEventListener('click', showLeaderboard);
  closeLeaderboardBtn?.addEventListener('click', hideLeaderboard);
  restartBtn?.addEventListener('click', () => {
    if (originalQuestions.length) startQuiz();
  });

  onAuthStateChange(async (_event, session) => {
    user = session?.user || null;
    if (!user) {
      renderAuth();
      userNav.innerHTML = '';
    } else {
      // Show dashboard, do not auto-start quiz
      renderUserNav(user.email);
      renderUserDashboard(user.email);
      // Preload questions silently so Start is fast
      try {
        originalQuestions = await fetchQuestions();
        subscribeQuestions(async () => {
          originalQuestions = await fetchQuestions();
        });
      } catch (err) {
        console.warn('Preload questions failed', err);
      }
      try {
        const prevScore = await getScore(user.id);
        if (prevScore > 0) {
          // show best score on the dashboard if needed
          const note = document.getElementById('dashboard-note');
          if (note) note.innerHTML = `Best score: <strong>${prevScore}</strong>. Click "Start Quiz" when ready.`;
          else scoreboard.innerHTML += `<br><em>Best score: ${prevScore}</em>`;
        }
      } catch (err) { console.warn('getScore failed', err); }
    }
  });

  // On page load, try to get existing session but DO NOT auto-start quiz.
  user = await getUser();
  if (!user) renderAuth();
  else {
    renderUserNav(user.email || user.id);
    // show dashboard
    renderUserDashboard(user.email || user.id);
    try {
      originalQuestions = await fetchQuestions();
    } catch (err) {
      console.warn('Failed to load questions on startup', err);
    }
  }
}

startApp();
