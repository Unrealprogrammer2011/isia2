import { signup, login, logout, onAuthStateChange, getUser } from './auth.js';
import { fetchQuestions, subscribeQuestions, saveScore, getScore } from './quiz.js';

const authSection = document.getElementById('auth-section');
const quizSection = document.getElementById('quiz-section');
const quizContainer = document.getElementById('quiz-container');
const scoreboard = document.getElementById('scoreboard');
const userNav = document.getElementById('user-nav');

let user = null;
let quizQuestions = [];
let currentQuestion = 0;
let userScore = 0;

// Accessibility: focus management helpers
function focusFirstInput() {
  const input = authSection.querySelector('input');
  if (input) input.focus();
}

// Auth UI
function renderAuth() {
  quizSection.hidden = true;
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
    const { error } = await login(email, password);
    if (error) {
      authSection.querySelector('#error-message').textContent = error.message;
      focusFirstInput();
    }
  };
  document.getElementById('show-signup').onclick = renderSignup;
}

function renderSignup() {
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
    const { error } = await signup(email, password);
    if (error) {
      authSection.querySelector('#error-message').textContent = error.message;
      focusFirstInput();
    } else {
      renderAuth();
    }
  };
  document.getElementById('show-login').onclick = renderAuth;
}

function renderUserNav(email) {
  userNav.innerHTML = `
    <span>Hello, ${email}</span>
    <button id="logout-btn" aria-label="Sign out">Logout</button>
  `;
  document.getElementById('logout-btn').onclick = async () => {
    await logout();
  };
}

// Quiz UI
function renderQuiz() {
  authSection.innerHTML = '';
  quizSection.hidden = false;
  renderUserNav(user.email);
  quizContainer.innerHTML = '';
  scoreboard.textContent = '';
  currentQuestion = 0;
  userScore = 0;
  showScore();
  showQuestion();
}

function showScore() {
  scoreboard.innerHTML = `Score: <span>${userScore}</span> / ${quizQuestions.length}`;
}

function showQuestion() {
  if (currentQuestion >= quizQuestions.length) {
    // Quiz ended, save score
    saveScore(user.id, userScore).then(() =>
      scoreboard.innerHTML = `Your final score: <span>${userScore}</span> out of ${quizQuestions.length}`
    );
    quizContainer.innerHTML = `<h2>Quiz Finished!</h2>
      <p>Your Score: <strong>${userScore} / ${quizQuestions.length}</strong></p>
      <button id="restart-btn">Play Again</button>
    `;
    document.getElementById('restart-btn').onclick = () => renderQuiz();
    return;
  }
  // Show question and options
  const q = quizQuestions[currentQuestion];
  quizContainer.innerHTML = `
    <div class="quiz-card" tabindex="0">
      <h3>Q${currentQuestion + 1}. ${q.question}</h3>
      <div class="quiz-options" role="radiogroup" aria-labelledby="question-${q.id}">
        ${q.options.map((opt, idx) => `
          <button class="quiz-option" role="radio" aria-checked="false" data-idx="${idx}" tabindex="${idx === 0 ? "0" : "-1"}">
            ${opt}
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
}

function handleAnswer(selectedIdx, btn) {
  const q = quizQuestions[currentQuestion];
  const correct = selectedIdx === q.answer;
  btn.classList.add(correct ? 'correct' : 'incorrect');
  btn.setAttribute('aria-checked', 'true');
  if (correct) userScore += 1;
  showScore();
  setTimeout(() => {
    currentQuestion += 1;
    showQuestion();
  }, 900);
}

// Initialization
async function startApp() {
  // Listen to auth changes
  onAuthStateChange(async session => {
    user = session?.user || null;
    if (!user) {
      renderAuth();
      userNav.innerHTML = '';
    } else {
      renderUserNav(user.email);
      quizQuestions = await fetchQuestions();
      renderQuiz();
      // Realtime questions updates
      subscribeQuestions(async () => {
        quizQuestions = await fetchQuestions();
        renderQuiz();
      });
      const prevScore = await getScore(user.id);
      if (prevScore > 0) {
        scoreboard.innerHTML += `<br><em>Best score so far: ${prevScore}</em>`;
      }
    }
  });

  // Try get user on page load
  user = await getUser();
  if (!user) renderAuth();
  else {
    quizQuestions = await fetchQuestions();
    renderQuiz();
  }
}

startApp();