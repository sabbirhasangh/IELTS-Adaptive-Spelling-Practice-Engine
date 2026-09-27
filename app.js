/**
 * IELTS Adaptive Spelling Practice Engine
 * Ported from Apps Script resetAndPullNewCards
 */

const STORAGE_KEY = 'ielts_master_log';

let masterLog = [];
let practiceSession = [];
let currentCardIndex = 0;
let sessionCorrectCount = 0;

// Initialize System on DOM Load
document.addEventListener('DOMContentLoaded', async () => {
  await initializeMasterLog();
  resetAndPullNewCards();
  setupEventListeners();
});

/**
 * Initializes Master Log data from localStorage or fetches data/words.json
 */
async function initializeMasterLog() {
  const localData = localStorage.getItem(STORAGE_KEY);
  
  if (localData) {
    masterLog = JSON.parse(localData);
  } else {
    try {
      const response = await fetch('data/words.json');
      const rawWords = await response.json();
      
      masterLog = rawWords.map((item, index) => ({
        masterRowId: index + 2,
        category: item.category || 'General',
        bangla: item.bangla,
        correctAns: item.word,
        trick: item.trick || '',
        mistakes: 0,
        tries: 0,
        priorityScore: 0
      }));
      
      saveMasterLog();
    } catch (error) {
      console.error('Failed to load words.json dataset:', error);
    }
  }
  updateMetricsDisplay();
}

/**
 * Persists Master Log to browser local storage
 */
function saveMasterLog() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(masterLog));
  updateMetricsDisplay();
}

/**
 * Core Algorithm: Calculates priority scores, sorts worst-first,
 * and builds a 10-card deck using 40% High Priority / 40% Unattempted / 20% Low Try quotas.
 */
function resetAndPullNewCards() {
  // Update Priority Scores & Sort Master Log (Hardest First)
  masterLog.forEach(row => {
    row.priorityScore = (row.mistakes * 10) + row.tries;
  });

  masterLog.sort((a, b) => b.priorityScore - a.priorityScore);

  // Categorize cards into Spaced Repetition Pools
  const highPriority = []; // Mistakes > 0
  const unattempted = [];  // Tries === 0
  const lowTry = [];       // Tries > 0 && Mistakes === 0

  masterLog.forEach(row => {
    if (row.mistakes > 0) {
      highPriority.push(row);
    } else if (row.tries === 0) {
      unattempted.push(row);
    } else {
      lowTry.push(row);
    }
  });

  // Fisher-Yates Shuffle
  function shuffle(arr) {
    for (let k = arr.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [arr[k], arr[r]] = [arr[r], arr[k]];
    }
    return arr;
  }

  shuffle(highPriority);
  shuffle(unattempted);
  shuffle(lowTry);

  const selectedCards = [];
  function pullFromPool(pool, count) {
    while (pool.length > 0 && count > 0) {
      selectedCards.push(pool.pop());
      count--;
    }
    return count;
  }

  // Quota Allocation (4 High Priority, 4 Unattempted, 2 Refreshers)
  const remHP = pullFromPool(highPriority, 4);
  const remUN = pullFromPool(unattempted, 4 + remHP);
  const remLT = pullFromPool(lowTry, 2 + remUN);

  // Fallback System
  if (selectedCards.length < 10) {
    const backupPool = [...highPriority, ...unattempted, ...lowTry];
    shuffle(backupPool);
    pullFromPool(backupPool, 10 - selectedCards.length);
  }

  practiceSession = selectedCards;
  currentCardIndex = 0;
  sessionCorrectCount = 0;

  renderCard();
}

/**
 * Renders current flashcard on the UI
 */
function renderCard() {
  const form = document.getElementById('practice-form');
  const feedback = document.getElementById('feedback');
  const trickBox = document.getElementById('memory-trick');
  const nextBtn = document.getElementById('next-btn');
  const userInput = document.getElementById('user-input');

  feedback.classList.add('hidden');
  trickBox.classList.add('hidden');
  nextBtn.classList.add('hidden');
  form.style.display = 'block';

  if (currentCardIndex >= practiceSession.length) {
    renderSessionComplete();
    return;
  }

  const currentCard = practiceSession[currentCardIndex];
  
  document.getElementById('card-badge').innerText = `Card ${currentCardIndex + 1}/${practiceSession.length}`;
  document.getElementById('score-badge').innerText = `Score: ${sessionCorrectCount}/${currentCardIndex}`;
  document.getElementById('bangla-hint').innerText = `${currentCard.bangla} (${currentCard.category})`;
  userInput.value = '';
  userInput.focus();
}

/**
 * Evaluates user input and updates local state
 */
function handleSubmission(e) {
  e.preventDefault();

  const userInput = document.getElementById('user-input').value.trim();
  if (!userInput) return;

  const currentCard = practiceSession[currentCardIndex];
  const targetWord = currentCard.correctAns.trim();
  const isCorrect = userInput.toLowerCase() === targetWord.toLowerCase();

  // Log performance back to Master Log
  const masterEntry = masterLog.find(item => item.masterRowId === currentCard.masterRowId);
  if (masterEntry) {
    masterEntry.tries += 1;
    if (!isCorrect) {
      masterEntry.mistakes += 1;
    }
    masterEntry.priorityScore = (masterEntry.mistakes * 10) + masterEntry.tries;
    saveMasterLog();
  }

  // UI Feedback
  const feedback = document.getElementById('feedback');
  const trickBox = document.getElementById('memory-trick');
  const form = document.getElementById('practice-form');
  const nextBtn = document.getElementById('next-btn');

  form.style.display = 'none';

  if (isCorrect) {
    sessionCorrectCount++;
    feedback.innerText = '✅ CORRECT!';
    feedback.className = 'feedback-box correct';
  } else {
    feedback.innerText = `❌ WRONG! Correct Answer: "${targetWord}"`;
    feedback.className = 'feedback-box wrong';
  }

  feedback.classList.remove('hidden');

  if (currentCard.trick) {
    trickBox.innerText = `💡 Syllable Breakdown / Trick: ${currentCard.trick}`;
    trickBox.classList.remove('hidden');
  }

  nextBtn.classList.remove('hidden');
  nextBtn.focus();
}

function renderSessionComplete() {
  document.getElementById('card-badge').innerText = 'Session Complete';
  document.getElementById('bangla-hint').innerText = `🎉 Micro-Session Finished! Final Score: ${sessionCorrectCount}/10`;
  document.getElementById('practice-form').style.display = 'none';
  document.getElementById('next-btn').classList.add('hidden');
}

function updateMetricsDisplay() {
  const totalWords = masterLog.length;
  const attempted = masterLog.filter(item => item.tries > 0).length;
  const totalMistakes = masterLog.reduce((acc, item) => acc + item.mistakes, 0);

  document.getElementById('stat-total-words').innerText = totalWords;
  document.getElementById('stat-attempted').innerText = attempted;
  document.getElementById('stat-mistakes').innerText = totalMistakes;
}

function setupEventListeners() {
  document.getElementById('practice-form').addEventListener('submit', handleSubmission);
  
  document.getElementById('next-btn').addEventListener('click', () => {
    currentCardIndex++;
    renderCard();
  });

  document.getElementById('reset-session-btn').addEventListener('click', () => {
    resetAndPullNewCards();
  });
}