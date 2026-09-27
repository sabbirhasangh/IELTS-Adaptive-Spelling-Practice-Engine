let wordsData = [];
let currentBatch = [];

// DOM Elements
const practiceRows = document.getElementById('practice-rows');
const nextBatchBtn = document.getElementById('next-batch-btn');
const openLogBtn = document.getElementById('open-log-btn');
const closeLogBtn = document.getElementById('close-log-btn');
const logModal = document.getElementById('log-modal');
const masterLogRows = document.getElementById('master-log-rows');

// 1. Fetch JSON Data on Load
async function loadWords() {
  try {
    const response = await fetch('data/words.json');
    wordsData = await response.json();
    
    // Initialize stats if missing
    wordsData.forEach(word => {
      word.mistake_count = word.mistake_count || 0;
      word.total_tries = word.total_tries || 0;
      word.priority_score = word.priority_score || 0;
    });

    loadNewBatch();
    renderMasterLog();
  } catch (error) {
    console.error('Error loading words.json:', error);
  }
}

// 2. Load 10 Adaptive Rows
function loadNewBatch() {
  // Sort high priority / mistake words first, then shuffle slightly
  const sortedWords = [...wordsData].sort((a, b) => b.priority_score - a.priority_score);
  
  // Pick top 10 or random sample
  currentBatch = sortedWords.slice(0, 10);

  practiceRows.innerHTML = '';
  currentBatch.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="row-id">${item.id || index + 1}</td>
      <td class="hint-text">${item.bangla_pronunciation || item.word}</td>
      <td>
        <input 
          type="text" 
          class="input-field word-input" 
          data-index="${index}" 
          placeholder="Type English spelling..."
          autocomplete="off"
        />
        <div class="memory-hint hidden" id="hint-${index}">${item.memory_trick || ''}</div>
      </td>
      <td>
        <span class="status-badge pending" id="status-${index}">Pending</span>
      </td>
    `;
    practiceRows.appendChild(tr);
  });

  // Add event listeners to input fields
  document.querySelectorAll('.word-input').forEach(input => {
    input.addEventListener('change', (e) => gradeRow(e.target));
    input.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') gradeRow(e.target);
    });
  });
}

// 3. Live Grading System
function gradeRow(inputEl) {
  const index = inputEl.dataset.index;
  const userAnswer = inputEl.value.trim().toLowerCase();
  const currentWord = currentBatch[index];
  const correctAnswer = (currentWord.word || currentWord.correct_answer || '').toLowerCase();
  
  const statusBadge = document.getElementById(`status-${index}`);
  const hintEl = document.getElementById(`hint-${index}`);

  if (!userAnswer) return;

  currentWord.total_tries += 1;

  if (userAnswer === correctAnswer) {
    statusBadge.textContent = 'Correct ✓';
    statusBadge.className = 'status-badge correct';
    inputEl.style.borderColor = '#22c55e';
  } else {
    currentWord.mistake_count += 1;
    currentWord.priority_score += 10; // Elevate priority for wrong answers
    statusBadge.textContent = `Wrong: ${correctAnswer}`;
    statusBadge.className = 'status-badge incorrect';
    inputEl.style.borderColor = '#ef4444';
    if (hintEl) hintEl.classList.remove('hidden');
  }

  renderMasterLog();
}

// 4. Render Master Log View
function renderMasterLog() {
  masterLogRows.innerHTML = '';
  wordsData.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.category || 'General'}</td>
      <td><strong>${item.bangla_pronunciation || '-'}</strong></td>
      <td>${item.word || item.correct_answer}</td>
      <td>${item.memory_trick || '-'}</td>
      <td>${item.mistake_count}</td>
      <td>${item.total_tries}</td>
      <td><strong>${item.priority_score}</strong></td>
    `;
    masterLogRows.appendChild(tr);
  });
}

// Event Listeners for Batching & Modal
nextBatchBtn.addEventListener('click', loadNewBatch);
openLogBtn.addEventListener('click', () => logModal.classList.remove('hidden'));
closeLogBtn.addEventListener('click', () => logModal.classList.add('hidden'));

// Initialize on page load
loadWords();