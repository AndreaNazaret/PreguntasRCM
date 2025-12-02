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
    const prevBtn = document.getElementById('prev-btn');

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
    let userAnswers = []; // Almacena si el usuario acertó (true) o falló (false) o null
    let score = 0;
    let originSource = null; // Para guardar de dónde venimos

    // --- Initialization ---
    init();

    async function init() {
        // 1. Get Params
        const urlParams = new URLSearchParams(window.location.search);
        currentThemeId = urlParams.get('tema');
        originSource = urlParams.get('origen'); // 'alumnos' o 'general'

        // Lógica de Navegación "Volver"
        const headerBackLink = document.getElementById('header-back-link');
        const resultBackLink = document.getElementById('result-back-link');
        
        // Definir a dónde volvemos
        let backUrl = 'index.html'; // Default
        let backText = 'Inicio';

        if (originSource === 'alumnos') {
            backUrl = 'menu_alumnos.html';
            backText = 'Menú Alumnos';
        } else if (originSource === 'general') {
            backUrl = 'menu_general.html';
            backText = 'Menú General';
        }

        // Aplicar a los botones
        if(headerBackLink) {
            headerBackLink.href = backUrl;
            headerBackLink.querySelector('span').textContent = backText;
        }
        if(resultBackLink) {
            resultBackLink.href = backUrl;
        }

        // 2. Validar Tema
        if (!currentThemeId) {
            alert('No se especificó un tema. Redirigiendo.');
            window.location.href = backUrl;
            return;
        }

        quizTitle.textContent = `Tema ${currentThemeId}`;

        // 3. Cargar Datos
        try {
            // NOTA: Si tienes JSON diferentes para alumnos y general,
            // puedes usar la variable originSource para cambiar la ruta del fetch.
            // Ejemplo: const path = originSource === 'alumnos' ? `data/alumnos/tema${currentThemeId}.json` : `data/tema${currentThemeId}.json`;
            
            await loadQuestions(currentThemeId);
        } catch (error) {
            console.error(error);
            quizTitle.textContent = 'Error';
            loadingState.innerHTML = `<p class="text-red-500">Error al cargar. <br> <a href="${backUrl}" class="underline">Volver</a></p>`;
        }
    }

    // --- Utility: Fisher-Yates Shuffle ---
    // Función para mezclar arrays aleatoriamente
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async function loadQuestions(id) {
        const response = await fetch(`data/tema${id}.json`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        let rawQuestions = await response.json();
        
        // 1. ALEATORIZAR PREGUNTAS AQUÍ
        // Mezclamos el orden de las preguntas apenas cargan
        questions = shuffleArray(rawQuestions);

        userAnswers = new Array(questions.length).fill(null);

        loadingState.classList.add('hidden');
        questionContainer.classList.remove('hidden');
        nextBtn.classList.remove('hidden');

        renderQuestion(0);
    }

    function renderQuestion(index) {
        // Animation reset
        questionContainer.classList.remove('fade-in');
        void questionContainer.offsetWidth; // trigger reflow
        questionContainer.classList.add('fade-in');

        const question = questions[index];

        questionCounter.textContent = `Pregunta ${index + 1} de ${questions.length}`;

        const progress = ((index + 1) / questions.length) * 100;
        progressBar.style.width = `${progress}%`;

        questionText.textContent = question.pregunta;

        optionsContainer.innerHTML = '';

        // 2. ALEATORIZAR OPCIONES
        // Creamos un array de objetos que guarda el texto y su índice original
        // Ejemplo: [{txt: "Aloha", idx: 0}, {txt: "CSMA", idx: 1}...]
        let optionsWithIndex = question.opciones.map((opt, i) => ({
            text: opt,
            originalIndex: i
        }));

        // Si ya respondimos, NO remezclamos para que no cambien de sitio visualmente al volver (si implementas volver)
        // Pero como este quiz es lineal, podemos mezclar siempre.
        // Para consistencia, lo ideal es guardar el orden mezclado, pero lo haremos simple: mezclar al renderizar.
        // NOTA: Si usas botón "Anterior", deberías guardar el orden mezclado en el estado `questions`.
        // Como tu código actual es lineal, mezclamos aquí mismo:
        
        // Solo mezclamos si el usuario aún no ha respondido esta pregunta (para evitar saltos raros si hubiera redibujado)
        // O simplemente mezclamos cada vez. Para asegurar aleatoriedad real:
        if (userAnswers[index] === null) {
             shuffleArray(optionsWithIndex);
             // Guardamos este orden específico en la pregunta para persistencia visual si fuera necesario
             question.shuffledOptions = optionsWithIndex; 
        } else {
             // Si ya respondió, usamos el orden que se generó (si existiera) o mezclamos de nuevo (cuidado visual)
             // Para simplificar tu caso lineal: Usamos el guardado o generamos uno nuevo.
             if(question.shuffledOptions) {
                 optionsWithIndex = question.shuffledOptions;
             } else {
                 shuffleArray(optionsWithIndex);
                 question.shuffledOptions = optionsWithIndex;
             }
        }

        optionsWithIndex.forEach((optObj, visualIndex) => {
            const btn = document.createElement('button');
            btn.className = `option-btn w-full text-left p-3 md:p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-medium text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent relative overflow-hidden`;
            
            // Guardamos el índice original (0, 1, 2, 3) en el dataset del botón
            btn.dataset.originalIndex = optObj.originalIndex;

            // Check estado previo
            if (userAnswers[index] !== null) {
                // Lógica de visualización tras responder
                const isCorrectAnswer = optObj.originalIndex === question.respuesta_correcta;
                const isUserSelected = optObj.originalIndex === userAnswers[index]; // userAnswers guarda el índice original seleccionado

                if (isCorrectAnswer) {
                    btn.classList.add('correct'); // Verde
                } else if (isUserSelected) {
                    btn.classList.add('incorrect'); // Rojo
                } else {
                    btn.classList.add('opacity-50');
                }
                btn.disabled = true;
            } else {
                // Click handler: Pasamos el índice ORIGINAL, no el visual (i)
                btn.onclick = () => handleAnswer(optObj.originalIndex, index, btn);
            }

            // Usamos letras A, B, C, D basadas en el orden visual (visualIndex)
            btn.innerHTML = `<span class="mr-2 font-bold text-gray-400">${String.fromCharCode(65 + visualIndex)}.</span> ${optObj.text}`;

            optionsContainer.appendChild(btn);
        });

        // Botón Siguiente
        if (index === questions.length - 1) {
            nextBtn.innerHTML = `Finalizar <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        } else {
            nextBtn.innerHTML = `Siguiente <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
        }

        if (userAnswers[index] === null) {
            nextBtn.disabled = true;
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            nextBtn.disabled = false;
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    // IMPORTANTE: selectedOriginalIndex es el índice tal cual viene en el JSON (0, 1, 2 o 3)
    function handleAnswer(selectedOriginalIndex, questionIndex, btnElement) {
        const question = questions[questionIndex];

        // Guardamos la respuesta del usuario (índice original)
        userAnswers[questionIndex] = selectedOriginalIndex;

        // Feedback Visual
        const buttons = optionsContainer.querySelectorAll('button');
        
        buttons.forEach((btn) => {
            btn.disabled = true;
            // Recuperamos el índice original guardado en el dataset HTML
            const btnOriginalIndex = parseInt(btn.dataset.originalIndex);

            if (btnOriginalIndex === question.respuesta_correcta) {
                btn.classList.add('correct'); // La correcta se pone verde
            } else if (btnOriginalIndex === selectedOriginalIndex) {
                btn.classList.add('incorrect'); // Si la que pulsaste es esta y está mal, se pone roja
            } else {
                btn.classList.add('opacity-50');
            }
        });

        // Habilitar siguiente
        nextBtn.disabled = false;
        nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    nextBtn.onclick = () => {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion(currentQuestionIndex);
        } else {
            showResults();
        }
    };

    function showResults() {
        score = 0;
        // Calculamos score basándonos en userAnswers
        userAnswers.forEach((answerIndex, index) => {
            if (answerIndex === questions[index].respuesta_correcta) {
                score++;
            }
        });

        const total = questions.length;
        const percentage = total === 0 ? 0 : (score / total) * 100;

        questionContainer.classList.add('hidden');
        nextBtn.classList.add('hidden');
        if (prevBtn) prevBtn.classList.add('hidden');

        resultsContainer.classList.remove('hidden');

        scoreCorrect.textContent = score;
        scoreTotal.textContent = total;
        scorePercent.textContent = `${Math.round(percentage)}% Aciertos`;

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