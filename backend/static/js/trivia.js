// --- DOM Elements ---
const triviaModalOverlay = document.getElementById('trivia-modal-overlay');
const topicSelectionView = document.getElementById('topic-selection');
const gameView = document.getElementById('game-view');
const topicTitleEl = document.getElementById('topic-title');
const scoreEl = document.getElementById('score');
const loaderContainer = document.getElementById('loader-container');
const qaContainer = document.getElementById('qa-container');
const questionTextEl = document.getElementById('question-text');
const answersGridEl = document.getElementById('answers-grid');
const funFactTextEl = document.getElementById('fun-fact-text');
const nextQuestionBtn = document.getElementById('next-question-btn');

// --- State Variables ---
let currentTopic = '';
let score = 0;
let currentCorrectAnswer = '';

export function initTrivia() {
    // Make functions available to inline onclick handlers
    window.startGame = startGame;
    window.goHome = goHome;
    window.goBackToTopics = goBackToTopics;
    nextQuestionBtn.addEventListener('click', fetchNewQuestion);
}

export function openTriviaModal() {
    triviaModalOverlay.classList.remove('hidden', 'pointer-events-none');
    setTimeout(() => {
        triviaModalOverlay.classList.add('visible', 'animate-fadeInUp');
    }, 10);
}

function goHome() {
    triviaModalOverlay.classList.remove('visible');
    setTimeout(() => {
        triviaModalOverlay.classList.add('hidden', 'pointer-events-none');
        gameView.classList.add('hidden');
        topicSelectionView.classList.remove('hidden');
    }, 300);
}

function goBackToTopics() {
    gameView.classList.add('hidden');
    topicSelectionView.classList.remove('hidden');
}

async function startGame(topic) {
    currentTopic = topic;
    score = 0;
    scoreEl.textContent = score;
    topicTitleEl.textContent = topic;
    topicSelectionView.classList.add('hidden');
    gameView.classList.remove('hidden');
    await fetchNewQuestion();
}

async function fetchNewQuestion() {
    qaContainer.classList.add('hidden');
    loaderContainer.classList.remove('hidden');
    funFactTextEl.textContent = '';
    nextQuestionBtn.classList.add('hidden');
    answersGridEl.innerHTML = '';

    try {
        const response = await fetch('/get_trivia_question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: currentTopic })
        });
        if (!response.ok) throw new Error("Failed to fetch from backend");
        const data = await response.json();
        displayQuestion(data);
    } catch (error) {
        console.error("Couldn't fetch new trivia question.", error);
        questionTextEl.textContent = "Could not load a question. Please try again.";
    }
}

function displayQuestion(data) {
    questionTextEl.textContent = data.question;
    currentCorrectAnswer = data.correct_answer;
    
    data.options.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option;
        button.className = 'answer-btn w-full p-4 bg-gray-700 rounded-lg text-lg font-semibold hover:bg-gray-600 transition-colors';
        button.onclick = () => checkAnswer(button, option, data.fun_fact);
        answersGridEl.appendChild(button);
    });
    
    loaderContainer.classList.add('hidden');
    qaContainer.classList.remove('hidden');
}

function checkAnswer(buttonEl, selectedOption, funFact) {
    const answerButtons = answersGridEl.querySelectorAll('.answer-btn');
    answerButtons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === currentCorrectAnswer) btn.classList.add('correct');
    });

    if (selectedOption === currentCorrectAnswer) {
        score++;
        scoreEl.textContent = score;
    } else {
        buttonEl.classList.add('incorrect');
    }
    
    funFactTextEl.textContent = `💡 Fun Fact: ${funFact}`;
    nextQuestionBtn.classList.remove('hidden');
}