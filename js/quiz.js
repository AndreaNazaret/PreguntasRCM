document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const quizTitle = document.getElementById('quiz-title');
    const progressBar = document.getElementById('progress-bar');
    const loadingState = document.getElementById('loading-state');
    const questionContainer = document.getElementById('question-container');
    const resultsContainer = document.getElementById('results-container');
    const questionCounter = document.getElementById('question-counter');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn'); // Optional, if we want to allow going back

    // Results elements
    const scoreCorrect = document.getElementById('score-correct');
    const scoreTotal = document.getElementById('score-total');
    const scorePercent = document.getElementById('score-percent');
    const resultMessage = document.getElementById('result-message');
    const resultIcon = document.getElementById('result-icon');

    // --- State ---
    let currentThemeId = null;
    let questions = [];
    let currentQuestionIndex = 0;
    let userAnswers = []; // Array to store user's selected index for each question
    let score = 0;

    // --- Initialization ---
    init();

    async function init() {
        // 1. Get Theme ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        currentThemeId = urlParams.get('tema');

        if (!currentThemeId) {
            alert('No se especificó un tema. Redirigiendo al menú.');
            window.location.href = 'index.html';
            return;
        }

        // 2. Set Title
        quizTitle.textContent = `Tema ${currentThemeId}`;

        // 3. Fetch Data
        try {
            await loadQuestions(currentThemeId);
        } catch (error) {
            console.error(error);
            quizTitle.textContent = 'Error';
            loadingState.innerHTML = `<p class="text-red-500">Error al cargar las preguntas. <br> <a href="index.html" class="underline">Volver</a></p>`;
        }
    }

    async function loadQuestions(id) {
        // Construct path: data/tema{id}.json
        // Note: Adjust path if your structure is different. 
        // Based on file list: data/tema1.json exists.
        const response = await fetch(`data/tema${id}.json`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        questions = await response.json();

        // Shuffle questions
        questions.sort(() => Math.random() - 0.5);

        // Initialize user answers array with nulls
        userAnswers = new Array(questions.length).fill(null);

        // Hide loading, show quiz
        loadingState.classList.add('hidden');
        questionContainer.classList.remove('hidden');
        nextBtn.classList.remove('hidden');

        // Render first question
        renderQuestion(0);
    }

    function renderQuestion(index) {
        // Animation reset
        questionContainer.classList.remove('fade-in');
        void questionContainer.offsetWidth; // trigger reflow
        questionContainer.classList.add('fade-in');

        const question = questions[index];

        // Update Counter
        questionCounter.textContent = `Pregunta ${index + 1} de ${questions.length}`;

        // Update Progress Bar
        const progress = ((index + 1) / questions.length) * 100;
        progressBar.style.width = `${progress}%`;

        // Update Text
        questionText.textContent = question.pregunta;

        // Render Options
        optionsContainer.innerHTML = '';

        question.opciones.forEach((opcion, i) => {
            const btn = document.createElement('button');
            btn.className = `option-btn w-full text-left p-3 md:p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-medium text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent relative overflow-hidden`;

            // Check if this question was already answered
            if (userAnswers[index] !== null) {
                // If answered, show state immediately
                if (i === question.respuesta_correcta) {
                    btn.classList.add('correct');
                } else if (i === userAnswers[index]) {
                    btn.classList.add('incorrect');
                } else {
                    btn.classList.add('opacity-50');
                }
                btn.disabled = true;
            } else {
                // If not answered, add click handler
                btn.onclick = () => handleAnswer(i, index, btn);
            }

            // Add content
            btn.innerHTML = `<span class="mr-2 font-bold text-gray-400">${String.fromCharCode(65 + i)}.</span> ${opcion}`;

            optionsContainer.appendChild(btn);
        });

        // Update Navigation Buttons
        // prevBtn.style.display = index > 0 ? 'flex' : 'none'; // Uncomment if you want back button

        if (index === questions.length - 1) {
            nextBtn.innerHTML = `Finalizar <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        } else {
            nextBtn.innerHTML = `Siguiente <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
        }

        // Disable next button until answered? 
        // For now, let's allow skipping or enforce answering. 
        // Let's enforce answering for better UX in a quiz.
        // If not answered, disable next.
        if (userAnswers[index] === null) {
            nextBtn.disabled = true;
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            nextBtn.disabled = false;
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    function handleAnswer(selectedIndex, questionIndex, btnElement) {
        const question = questions[questionIndex];

        // Save answer
        userAnswers[questionIndex] = selectedIndex;

        // Visual Feedback
        const buttons = optionsContainer.querySelectorAll('button');
        buttons.forEach((btn, i) => {
            btn.disabled = true; // Disable all buttons
            if (i === question.respuesta_correcta) {
                btn.classList.add('correct');
            } else if (i === selectedIndex) {
                btn.classList.add('incorrect');
            } else {
                btn.classList.add('opacity-50');
            }
        });

        // Enable Next Button
        nextBtn.disabled = false;
        nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');

        // Optional: Auto-advance after a delay?
        // setTimeout(() => {
        //     if (currentQuestionIndex < questions.length - 1) {
        //         currentQuestionIndex++;
        //         renderQuestion(currentQuestionIndex);
        //     }
        // }, 1500);
    }

    nextBtn.onclick = () => {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion(currentQuestionIndex);
        } else {
            showResults();
        }
    };

    // Optional Prev Button Logic
    // prevBtn.onclick = () => {
    //     if (currentQuestionIndex > 0) {
    //         currentQuestionIndex--;
    //         renderQuestion(currentQuestionIndex);
    //     }
    // };

    function showResults() {
        // Calculate Score
        score = 0;
        userAnswers.forEach((answer, index) => {
            if (answer === questions[index].respuesta_correcta) {
                score++;
            }
        });

        const total = questions.length;
        const percentage = (score / total) * 100;

        // Update UI
        questionContainer.classList.add('hidden');
        nextBtn.classList.add('hidden');
        if (prevBtn) prevBtn.classList.add('hidden');

        resultsContainer.classList.remove('hidden');

        scoreCorrect.textContent = score;
        scoreTotal.textContent = total;
        scorePercent.textContent = `${Math.round(percentage)}% Aciertos`;

        // Custom Message
        if (percentage >= 80) {
            resultMessage.textContent = "¡Excelente trabajo! Dominas el tema.";
            resultIcon.classList.replace('text-blue-600', 'text-green-500');
            resultIcon.parentElement.classList.replace('bg-blue-100', 'bg-green-100');
        } else if (percentage >= 50) {
            resultMessage.textContent = "Buen intento, pero puedes mejorar.";
            resultIcon.classList.replace('text-blue-600', 'text-yellow-500');
            resultIcon.parentElement.classList.replace('bg-blue-100', 'bg-yellow-100');
        } else {
            resultMessage.textContent = "Sigue practicando. ¡Tú puedes!";
            resultIcon.classList.replace('text-blue-600', 'text-red-500');
            resultIcon.parentElement.classList.replace('bg-blue-100', 'bg-red-100');
        }
    }

});
