// main.js — dashboard + always-visible leaderboard updated for usernames
import { signup, login, logout, onAuthStateChange, getUser, upsertProfile } from './auth.js';
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
function escapeHtml(t=''){return String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function focusFirstInput(){ const i = authSection?.querySelector('input'); if (i) i.focus(); }

function renderUserNav(emailOrId){
  if (!userNav) return;
  userNav.innerHTML = `<span>Hello, ${escapeHtml(emailOrId || 'User')}</span><button id="logout-btn">Logout</button>`;
  const btn = document.getElementById('logout-btn');
  if (btn) btn.onclick = async () => await logout();
}

function renderAuth(){
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

function renderSignup(){
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
    const res = await signup(email, password, username);
    if (res?.error) {
      authSection.querySelector('#error-message').textContent = res.error.message || JSON.stringify(res.error);
    } else {
      // res may return user (if auto-confirm); otherwise user will sign in after verification
      authSection.querySelector('#error-message').textContent = 'Signed up. If email verification is required, please confirm then log in.';
    }
  };
  document.getElementById('show-login').onclick = renderAuth;
}

async function renderLeaderboard() {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = 'Loading…';
  try {
    const data = await getLeaderboard(20);
    if (!data.length) {
      leaderboardList.innerHTML = '<p>No scores yet.</p>';
      return;
    }
    leaderboardList.innerHTML = '';
    data.forEach((r, i) => {
      const el = document.createElement('div');
      el.className = 'leaderboard-item';
      const name = r.username || r.user_id;
      el.innerHTML = `<div class="name">${i+1}. ${escapeHtml(name)}</div><div class="score">${r.score}</div>`;
      leaderboardList.appendChild(el);
    });
  } catch (err) {
    console.error('Leaderboard load failed', err);
    leaderboardList.innerHTML = `<p class="muted">Unable to load leaderboard</p>`;
  }
}

function startQuiz(){
  quizQuestions = (originalQuestions || []).slice();
  for (let i = quizQuestions.length - 1; i > 0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [quizQuestions[i], quizQuestions[j]] = [quizQuestions[j], quizQuestions[i]];
  }
  currentQuestion = 0;
  userScore = 0;
  showQuestion();
}

function showQuestion(){
  if (!Array.isArray(quizQuestions) || quizQuestions.length === 0){
    quizContainer.innerHTML = `<p>No questions available.</p>`;
    scoreboard.textContent = '';
    return;
  }
  if (currentQuestion >= quizQuestions.length){
    quizContainer.innerHTML = `<h2>Quiz Finished!</h2>
      <p>Your Score: <strong>${userScore} / ${quizQuestions.length}</strong></p>
      <button id="restart-btn">Play Again</button>
    `;
    if (user?.id) saveScore(user.id, userScore).catch(err => console.warn('saveScore', err));
    document.getElementById('restart-btn')?.addEventListener('click', startQuiz);
    scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
    // refresh leaderboard so new score appears
    renderLeaderboard();
    return;
  }

  const q = quizQuestions[currentQuestion];
  quizContainer.innerHTML = `
    <div class="quiz-card" tabindex="0">
      <h3 id="question-${q.id}">Q${currentQuestion+1}. ${escapeHtml(q.question)}</h3>
      <div class="quiz-options" role="radiogroup" aria-labelledby="question-${q.id}">
        ${q.options.map((opt, idx)=>`<button class="quiz-option" role="radio" data-idx="${idx}" tabindex="${idx===0?'0':'-1'}">${escapeHtml(opt)}</button>`).join('')}
      </div>
    </div>
  `;
  scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
  const optionEls = quizContainer.querySelectorAll('.quiz-option');
  optionEls.forEach(btn=>{
    btn.onclick = ()=> handleAnswer(parseInt(btn.dataset.idx,10), btn);
    btn.addEventListener('keydown', e=>{
      if (e.key==='ArrowDown'||e.key==='ArrowRight'){ e.preventDefault(); (btn.nextElementSibling||optionEls[0]).focus(); }
      if (e.key==='ArrowUp'||e.key==='ArrowLeft'){ e.preventDefault(); (btn.previousElementSibling||optionEls[optionEls.length-1]).focus(); }
      if (e.key==='Enter'||e.key===' '){ e.preventDefault(); btn.click(); }
    });
  });
}

function handleAnswer(selectedIdx, btn){
  const q = quizQuestions[currentQuestion];
  const correct = selectedIdx === q.answer;
  btn.classList.add(correct ? 'correct' : 'incorrect');
  btn.setAttribute('aria-checked','true');
  if (correct) userScore += 1;
  scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
  setTimeout(()=>{ currentQuestion += 1; showQuestion(); }, 700);
}

// Initialization
async function startApp(){
  // preload leaderboard
  await renderLeaderboard();

  // listen for auth state changes
  onAuthStateChange(async (session) => {
    user = session?.user ?? null;
    if (!user) {
      renderAuth();
      renderUserNav('Guest');
    } else {
      // if username was provided during signup, ensure profile exists
      const username = user.user_metadata?.username ?? null;
      if (username) {
        try { await upsertProfile(user.id, username); } catch (err) { console.warn('upsertProfile', err); }
      }
      // load questions in background
      try {
        originalQuestions = await fetchQuestions();
        subscribeQuestions(async ()=> { originalQuestions = await fetchQuestions(); });
      } catch (err) {
        console.warn('loadQuestions', err);
      }

      // render a simple dashboard (choose when to start)
      renderUserNav(user.email || user.id);
      authSection.hidden = false;
      quizSection.hidden = true;
      authSection.innerHTML = `
        <div style="padding:12px">
          <h2>Welcome, ${escapeHtml(user.user_metadata?.username || user.email || user.id)}</h2>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button id="start-quiz-btn">Start Quiz</button>
            <button id="view-lb-btn">Refresh Leaderboard</button>
            <button id="logout-btn-small">Logout</button>
          </div>
          <div style="margin-top:10px;color:#666" id="dashboard-note">Click Start Quiz when you are ready.</div>
        </div>
      `;
      document.getElementById('start-quiz-btn')?.addEventListener('click', ()=> {
        authSection.hidden = true; quizSection.hidden = false; startQuiz();
      });
      document.getElementById('view-lb-btn')?.addEventListener('click', ()=> renderLeaderboard());
      document.getElementById('logout-btn-small')?.addEventListener('click', async ()=> await logout());
      // show best score if exists
      try {
        const best = await getScore(user.id);
        if (best > 0) {
          const note = document.getElementById('dashboard-note');
          if (note) note.innerHTML = `Best score: <strong>${best}</strong>. Click Start Quiz when ready.`;
        }
      } catch (err) { console.warn('getScore', err); }
    }
  });

  // try existing session on load
  user = await getUser();
  if (!user) renderAuth();
  else {
    renderUserNav(user.email || user.id);
    authSection.hidden = false;
    quizSection.hidden = true;
    authSection.innerHTML = `<p style="padding:12px">Welcome back. Use the dashboard to start the quiz or view the leaderboard.</p>`;
    try { originalQuestions = await fetchQuestions(); } catch (err) { console.warn('loadQuestions on boot', err); }
  }

  // refresh leaderboard every 30s
  setInterval(() => renderLeaderboard(), 30_000);
}

startApp();
