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
    
    // --- ELEMENTO NUEVO: Botón Repetir Incorrectas ---
    const retryIncorrectBtn = document.getElementById('btn-retry-incorrect');
    
    // Botón PDF en el footer (Modo Manual)
    const pdfBtn = document.getElementById('pdf-btn');

    // Elementos del Modal PDF (Vista Dividida)
    const pdfModal = document.getElementById('pdf-modal');
    const pdfFrame = document.getElementById('pdf-frame');
    const modalQuestionContent = document.getElementById('modal-question-content');

    // Resultados
    const scoreCorrect = document.getElementById('score-correct');
    const scoreTotal = document.getElementById('score-total');
    const scorePercent = document.getElementById('score-percent');
    const resultMessage = document.getElementById('result-message');
    const resultIcon = document.getElementById('result-icon');

    // --- State ---
    let currentThemeId = null;
    let questions = [];
    let currentQuestionIndex = 0;
    let userAnswers = []; 
    let score = 0;
    let originSource = null; 

    // --- Initialization ---
    init();

    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        currentThemeId = urlParams.get('tema');
        originSource = urlParams.get('origen'); 

        // Lógica de los botones "Volver"
        const headerBackLink = document.getElementById('btn-back-header');
        const headerBackText = document.getElementById('txt-back-header');
        const resultBackLink = document.getElementById('btn-back-results');
        
        let backUrl = 'index.html'; 
        let backText = 'Inicio';

        if (originSource === 'alumnos') {
            backUrl = 'menu_alumnos.html';
            backText = 'Alumnos';
        } else if (originSource === 'general') {
            backUrl = 'menu_general.html';
            backText = 'General';
        }

        if(headerBackLink) {
            headerBackLink.href = backUrl;
            if(headerBackText) headerBackText.textContent = backText;
        }
        if(resultBackLink) {
            resultBackLink.href = backUrl;
            resultBackLink.innerText = "Volver a " + backText;
        }

        // Validar Tema
        if (!currentThemeId) {
            currentThemeId = '1'; // Default fallback
        }

        quizTitle.textContent = `Tema ${currentThemeId}`;

        try {
            await loadQuestions(currentThemeId);
        } catch (error) {
            console.error(error);
            quizTitle.textContent = 'Error';
            loadingState.innerHTML = `<p class="text-red-500">Error al cargar datos.<br><a href="${backUrl}" class="underline">Volver</a></p>`;
        }
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async function loadQuestions(id) {
        // Seleccion de ruta
        let path = '';
        if (originSource === 'alumnos') {
            path = `data/alumnos/tema${id}.json`;
        } else {
            path = `data/general/tema${id}.json`;
        }

        console.log(`Cargando preguntas desde: ${path}`); 

        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        let rawQuestions = await response.json();
        
        questions = shuffleArray(rawQuestions);
        userAnswers = new Array(questions.length).fill(null);
        
        loadingState.classList.add('hidden');
        questionContainer.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
        
        renderQuestion(0);
    }

    function renderQuestion(index) {
        // Animación
        questionContainer.classList.remove('fade-in');
        void questionContainer.offsetWidth; 
        questionContainer.classList.add('fade-in');

        // Ocultar botón PDF al cambiar de pregunta (hasta que responda)
        if(pdfBtn) pdfBtn.classList.add('hidden');
        
        const question = questions[index];

        questionCounter.textContent = `Pregunta ${index + 1} de ${questions.length}`;

        const progress = ((index + 1) / questions.length) * 100;
        progressBar.style.width = `${progress}%`;

        questionText.textContent = question.pregunta;

        optionsContainer.innerHTML = '';

        // Aleatorizar opciones
        let optionsWithIndex = question.opciones.map((opt, i) => ({
            text: opt,
            originalIndex: i
        }));

        if (userAnswers[index] === null) {
             shuffleArray(optionsWithIndex);
             question.shuffledOptions = optionsWithIndex; 
        } else {
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
            
            btn.dataset.originalIndex = optObj.originalIndex;

            if (userAnswers[index] !== null) {
                // Lógica post-respuesta
                const isCorrectAnswer = optObj.originalIndex === question.respuesta_correcta;
                const isUserSelected = optObj.originalIndex === userAnswers[index]; 

                if (isCorrectAnswer) {
                    btn.classList.add('correct'); 
                } else if (isUserSelected) {
                    btn.classList.add('incorrect'); 
                } else {
                    btn.classList.add('opacity-50');
                }
                btn.disabled = true;
                
                // Si la pregunta ya estaba respondida, mostramos el botón PDF si aplica
                if(question.pagina && pdfBtn) {
                    pdfBtn.classList.remove('hidden');
                    pdfBtn.onclick = () => openPdf(question.pagina);
                }

            } else {
                btn.onclick = () => handleAnswer(optObj.originalIndex, index, btn);
            }

            btn.innerHTML = `<span class="mr-2 font-bold text-gray-400">${String.fromCharCode(65 + visualIndex)}.</span> ${optObj.text}`;
            optionsContainer.appendChild(btn);
        });

        // Configuración Botón Siguiente
        if (index === questions.length - 1) {
            nextBtn.innerHTML = `Finalizar <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        } else {
            nextBtn.innerHTML = `Siguiente <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
        }

        if (userAnswers[index] === null) {
            nextBtn.disabled = true;
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
            nextBtn.classList.add('hidden'); 
        } else {
            nextBtn.disabled = false;
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'hidden');
        }
    }

    function handleAnswer(selectedOriginalIndex, questionIndex, btnElement) {
        const question = questions[questionIndex];
        userAnswers[questionIndex] = selectedOriginalIndex;

        // Feedback Visual
        const buttons = optionsContainer.querySelectorAll('button');
        buttons.forEach((btn) => {
            btn.disabled = true;
            const btnOriginalIndex = parseInt(btn.dataset.originalIndex);

            if (btnOriginalIndex === question.respuesta_correcta) {
                btn.classList.add('correct');
            } else if (btnOriginalIndex === selectedOriginalIndex) {
                btn.classList.add('incorrect');
            } else {
                btn.classList.add('opacity-50');
            }
        });

        // Habilitar siguiente
        nextBtn.disabled = false;
        nextBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'hidden');

        // Mostrar Botón PDF Manualmente
        if (question.pagina && pdfBtn) {
            pdfBtn.classList.remove('hidden');
            pdfBtn.onclick = () => openPdf(question.pagina);
        }
    }

    // --- FUNCIONES DEL MODAL PDF (Split View) ---
    
    window.openPdf = function(pagina) {
        const id = currentThemeId || '1'; 
        const pdfPath = `pdfs/Tema${id}.pdf#page=${pagina}`; 
        
        // 1. Cargar PDF
        if(pdfFrame) pdfFrame.src = pdfPath;
        
        // 2. Rellenar Contexto (Pregunta a la izquierda)
        if(modalQuestionContent) {
            modalQuestionContent.innerHTML = '';
            
            // Título
            const qTitle = document.createElement('h3');
            qTitle.className = "text-lg font-bold text-gray-800 mb-4 leading-tight";
            qTitle.textContent = questionText.textContent;
            
            // Clonar opciones (para mostrar contexto visual con colores)
            const optionsClone = optionsContainer.cloneNode(true);
            
            modalQuestionContent.appendChild(qTitle);
            modalQuestionContent.appendChild(optionsClone);
        }

        // 3. Mostrar modal
        if(pdfModal) pdfModal.classList.remove('hidden');
    }

    window.closePdf = function() {
        if(pdfModal) pdfModal.classList.add('hidden');
        setTimeout(() => {
            if(pdfFrame) pdfFrame.src = ""; 
        }, 300);
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
        // Array para guardar las preguntas que el usuario falló
        const incorrectQuestions = [];

        userAnswers.forEach((answerIndex, index) => {
            if (answerIndex === questions[index].respuesta_correcta) {
                score++;
            } else {
                // Guardamos el objeto pregunta fallada
                incorrectQuestions.push(questions[index]);
            }
        });

        const total = questions.length;
        const percentage = total === 0 ? 0 : (score / total) * 100;

        questionContainer.classList.add('hidden');
        nextBtn.classList.add('hidden');
        if(pdfBtn) pdfBtn.classList.add('hidden'); 
        if (prevBtn) prevBtn.classList.add('hidden');

        resultsContainer.classList.remove('hidden');

        scoreCorrect.textContent = score;
        scoreTotal.textContent = total;
        scorePercent.textContent = `${Math.round(percentage)}% Aciertos`;

        // --- LÓGICA DEL BOTÓN REPETIR FALLOS ---
        // Si hay fallos, mostramos el botón y le asignamos la función
        if (incorrectQuestions.length > 0 && retryIncorrectBtn) {
            retryIncorrectBtn.classList.remove('hidden');
            retryIncorrectBtn.onclick = () => {
                startRetryMode(incorrectQuestions);
            };
        } else if (retryIncorrectBtn) {
            retryIncorrectBtn.classList.add('hidden');
        }
        // --------------------------------------

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

    // --- NUEVA FUNCIÓN: MODO REPASO ---
    function startRetryMode(failedQuestions) {
        // 1. Sobrescribimos el array de preguntas global SOLO con las falladas
        // Las barajamos para que no salgan en el mismo orden
        questions = shuffleArray(failedQuestions);
        
        // 2. Reiniciamos el estado del cuestionario
        userAnswers = new Array(questions.length).fill(null);
        currentQuestionIndex = 0;
        score = 0;
        
        // Limpiamos el orden de opciones barajado previamente para que se re-barajen
        questions.forEach(q => delete q.shuffledOptions);

        // 3. Actualizamos la UI
        resultsContainer.classList.add('hidden'); // Ocultar resultados
        questionContainer.classList.remove('hidden'); // Mostrar preguntas
        nextBtn.classList.remove('hidden'); // Mostrar botón siguiente
        
        // Opcional: Actualizar título para indicar que es repaso
        quizTitle.textContent = `Repaso: Tema ${currentThemeId}`;
        
        // 4. Renderizar la primera pregunta del repaso
        renderQuestion(0);
    }
});