// debug main.js - swap this in to get visible errors and logs
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

function log(...args) { console.log('[APP]', ...args); }
function showError(msg) {
  // show an error UI in authSection or quizContainer
  if (authSection && !authSection.hidden) {
    let el = authSection.querySelector('#error-message');
    if (!el) {
      el = document.createElement('div');
      el.id = 'error-message';
      authSection.prepend(el);
    }
    el.textContent = msg;
  } else if (quizContainer) {
    quizContainer.innerHTML = `<div id="app-error" style="color:#b71c1c;padding:1rem;background:#fff3f3;border-radius:8px;">${msg}</div>`;
  } else {
    console.warn('showError fallback:', msg);
  }
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function escapeHtml(s = '') {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function focusFirstInput() {
  const input = authSection.querySelector('input');
  if (input) input.focus();
}

function renderAuth() {
  log('renderAuth');
  quizSection.hidden = true;
  authSection.hidden = false;
  authSection.innerHTML = `
    <form id="login-form" autocomplete="on">
      <h2>Login</h2>
      <div id="error-message" style="color:#b71c1c"></div>
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
    log('login attempt', email);
    const res = await login(email, password);
    if (res?.error) {
      authSection.querySelector('#error-message').textContent = res.error.message || JSON.stringify(res.error);
      log('login error', res.error);
    } else {
      log('login success', res);
    }
  };
  document.getElementById('show-signup').onclick = renderSignup;
}

function renderSignup() {
  log('renderSignup');
  authSection.hidden = false;
  quizSection.hidden = true;
  authSection.innerHTML = `
    <form id="signup-form" autocomplete="on">
      <h2>Sign Up</h2>
      <div id="error-message" style="color:#b71c1c"></div>
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
    log('signup attempt', email);
    const res = await signup(email, password);
    if (res?.error) {
      authSection.querySelector('#error-message').textContent = res.error.message || JSON.stringify(res.error);
      log('signup error', res.error);
    } else {
      authSection.querySelector('#error-message').textContent = 'Signed up — check email if verification required. Try logging in.';
      log('signup success', res);
    }
  };
  document.getElementById('show-login').onclick = renderAuth;
}

function renderUserNav(email) {
  userNav.innerHTML = `
    <span>Hello, ${escapeHtml(email)}</span>
    <button id="logout-btn" aria-label="Sign out">Logout</button>
  `;
  document.getElementById('logout-btn').onclick = async () => {
    await logout();
  };
}

async function showLeaderboard() {
  try {
    leaderboardList.innerHTML = 'Loading...';
    const rows = await getLeaderboard(20);
    leaderboardList.innerHTML = '';
    if (!rows.length) leaderboardList.innerHTML = '<p>No scores yet.</p>';
    rows.forEach((r,i) => {
      const el = document.createElement('div');
      el.className = 'leaderboard-item';
      el.innerHTML = `<div>${i+1}. ${escapeHtml(r.email || r.user_id)}</div><div>${r.score}</div>`;
      leaderboardList.appendChild(el);
    });
    leaderboardSection.hidden = false;
  } catch (err) {
    console.error('leaderboard error', err);
    showError('Failed to load leaderboard: ' + (err.message || err));
  }
}
function hideLeaderboard() {
  leaderboardSection.hidden = true;
}

function showQuestion() {
  try {
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
        saveScore(user.id, userScore, user.email).catch(err => {
          console.warn('saveScore failed', err);
        });
      }
      document.getElementById('restart-btn').onclick = () => renderQuiz();
      document.getElementById('view-leaderboard-cta').onclick = () => showLeaderboard();
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
  } catch (err) {
    console.error('showQuestion error', err);
    showError('Unexpected error: ' + (err.message || err));
  }
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

function renderQuiz() {
  authSection.hidden = true;
  quizSection.hidden = false;
  renderUserNav(user.email);
  quizQuestions = shuffleArray(originalQuestions);
  currentQuestion = 0;
  userScore = 0;
  scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
  showQuestion();
}

async function startApp() {
  log('App starting');
  // wire UI buttons (if present)
  showLeaderboardBtn?.addEventListener('click', showLeaderboard);
  closeLeaderboardBtn?.addEventListener('click', hideLeaderboard);
  restartBtn?.addEventListener('click', () => {
    if (originalQuestions.length) renderQuiz();
  });

  onAuthStateChange(async (_event, session) => {
    log('auth state changed', _event, session);
    user = session?.user || null;
    if (!user) {
      renderAuth();
      userNav.innerHTML = '';
    } else {
      renderUserNav(user.email || user.id);
      try {
        originalQuestions = await fetchQuestions();
        if (!originalQuestions || !originalQuestions.length) {
          showError('No questions found. Check DB or RLS policies.');
        }
        renderQuiz();
        subscribeQuestions(async () => {
          log('questions changed via realtime');
          originalQuestions = await fetchQuestions();
        });
      } catch (err) {
        console.error('Failed to load questions', err);
        showError('Failed to load questions: ' + (err.message || err));
        quizContainer.innerHTML = '';
      }
      try {
        const prevScore = await getScore(user.id);
        if (prevScore > 0) {
          scoreboard.innerHTML += `<br><em>Best score: ${prevScore}</em>`;
        }
      } catch (err) {
        console.warn('getScore failed', err);
      }
    }
  });

  // Try get user on page load
  try {
    user = await getUser();
    log('initial getUser', user);
    if (!user) renderAuth();
    else {
      originalQuestions = await fetchQuestions();
      renderQuiz();
    }
  } catch (err) {
    console.error('startApp error', err);
    showError('Startup error: ' + (err.message || err));
  }
}

startApp();
