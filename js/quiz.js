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
    const retryIncorrectBtn = document.getElementById('btn-retry-incorrect');
    const pdfBtn = document.getElementById('pdf-btn');
    
    // Modal PDF
    const pdfModal = document.getElementById('pdf-modal');
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

    // --- PDF.js State ---
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    const canvas = document.getElementById('the-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const pdfLoading = document.getElementById('pdf-loading');

    // --- Initialization ---
    init();

    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        currentThemeId = urlParams.get('tema');
        originSource = urlParams.get('origen'); 

        let backUrl = 'index.html'; 
        let backText = 'Inicio';

        if (originSource === 'alumnos') {
            backUrl = 'menu_alumnos.html';
            backText = 'Alumnos';
        } else if (originSource === 'general') {
            backUrl = 'menu_general.html';
            backText = 'General';
        }

        const headerBackLink = document.getElementById('btn-back-header');
        const headerBackText = document.getElementById('txt-back-header');
        const resultBackLink = document.getElementById('btn-back-results');

        if(headerBackLink) {
            headerBackLink.href = backUrl;
            if(headerBackText) headerBackText.textContent = backText;
        }
        if(resultBackLink) {
            resultBackLink.href = backUrl;
            resultBackLink.innerText = "Volver a " + backText;
        }

        if (!currentThemeId) currentThemeId = '1';

        quizTitle.textContent = `Tema ${currentThemeId}`;

        try {
            await loadQuestions(currentThemeId);
        } catch (error) {
            console.error(error);
            quizTitle.textContent = 'Error';
            loadingState.innerHTML = `<p class="text-red-500">Error al cargar.<br><a href="${backUrl}" class="underline">Volver</a></p>`;
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
        let path = originSource === 'alumnos' ? `data/alumnos/tema${id}.json` : `data/general/tema${id}.json`;
        
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        let rawQuestions = await response.json();
        questions = shuffleArray(rawQuestions);
        userAnswers = new Array(questions.length).fill(null);
        
        loadingState.classList.add('hidden');
        questionContainer.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
        renderQuestion(0);
    }

    function renderQuestion(index) {
        questionContainer.classList.remove('fade-in');
        void questionContainer.offsetWidth; 
        questionContainer.classList.add('fade-in');

        if(pdfBtn) pdfBtn.classList.add('hidden');
        
        const question = questions[index];
        questionCounter.textContent = `Pregunta ${index + 1} de ${questions.length}`;
        const progress = ((index + 1) / questions.length) * 100;
        progressBar.style.width = `${progress}%`;
        questionText.textContent = question.pregunta;
        optionsContainer.innerHTML = '';

        let optionsWithIndex = question.opciones.map((opt, i) => ({ text: opt, originalIndex: i }));

        if (userAnswers[index] === null) {
             shuffleArray(optionsWithIndex);
             question.shuffledOptions = optionsWithIndex; 
        } else {
             optionsWithIndex = question.shuffledOptions || optionsWithIndex;
        }

        optionsWithIndex.forEach((optObj, visualIndex) => {
            const btn = document.createElement('button');
            btn.className = `option-btn w-full text-left p-3 md:p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-medium text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent relative overflow-hidden`;
            btn.dataset.originalIndex = optObj.originalIndex;

            if (userAnswers[index] !== null) {
                const isCorrect = optObj.originalIndex === question.respuesta_correcta;
                const isSelected = optObj.originalIndex === userAnswers[index]; 
                
                if (isCorrect) btn.classList.add('correct');
                else if (isSelected) btn.classList.add('incorrect');
                else btn.classList.add('opacity-50');
                
                btn.disabled = true;
                
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

    function handleAnswer(idx, qIdx, btn) {
        const question = questions[qIdx];
        userAnswers[qIdx] = idx;

        const buttons = optionsContainer.querySelectorAll('button');
        buttons.forEach((btn) => {
            btn.disabled = true;
            const btnIdx = parseInt(btn.dataset.originalIndex);
            if (btnIdx === question.respuesta_correcta) btn.classList.add('correct');
            else if (btnIdx === idx) btn.classList.add('incorrect');
            else btn.classList.add('opacity-50');
        });

        nextBtn.disabled = false;
        nextBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'hidden');

        if (question.pagina && pdfBtn) {
            pdfBtn.classList.remove('hidden');
            pdfBtn.onclick = () => openPdf(question.pagina);
        }
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
        const incorrectQuestions = [];
        userAnswers.forEach((ans, idx) => {
            if (ans === questions[idx].respuesta_correcta) score++;
            else incorrectQuestions.push(questions[idx]);
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

        if (incorrectQuestions.length > 0 && retryIncorrectBtn) {
            retryIncorrectBtn.classList.remove('hidden');
            retryIncorrectBtn.onclick = () => startRetryMode(incorrectQuestions);
        } else if (retryIncorrectBtn) {
            retryIncorrectBtn.classList.add('hidden');
        }

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

    function startRetryMode(failedQuestions) {
        questions = shuffleArray(failedQuestions);
        userAnswers = new Array(questions.length).fill(null);
        currentQuestionIndex = 0;
        score = 0;
        questions.forEach(q => delete q.shuffledOptions);

        resultsContainer.classList.add('hidden');
        questionContainer.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
        quizTitle.textContent = `Repaso: Tema ${currentThemeId}`;
        renderQuestion(0);
    }

    // --- PDF.js Functions ---
    window.openPdf = function(pagina) {
        const id = currentThemeId || '1'; 
        const pdfPath = `pdfs/Tema${id}.pdf`; 
        
        if(pdfModal) pdfModal.classList.remove('hidden');
        if(pdfLoading) pdfLoading.classList.remove('hidden');

        if(modalQuestionContent) {
            modalQuestionContent.innerHTML = '';
            const qTitle = document.createElement('h3');
            qTitle.className = "text-lg font-bold text-gray-800 mb-4 leading-tight";
            qTitle.textContent = questionText.textContent;
            const optionsClone = optionsContainer.cloneNode(true);
            modalQuestionContent.appendChild(qTitle);
            modalQuestionContent.appendChild(optionsClone);
        }

        pdfjsLib.getDocument(pdfPath).promise.then(function(pdfDoc_) {
            pdfDoc = pdfDoc_;
            document.getElementById('page-count').textContent = pdfDoc.numPages;
            pageNum = parseInt(pagina); 
            queueRenderPage(pageNum);
        }).catch(function(error) {
            console.error('Error PDF:', error);
            if(pdfLoading) pdfLoading.classList.add('hidden');
        });
    }

    function renderPage(num) {
        pageRendering = true;
        pdfDoc.getPage(num).then(function(page) {
            const container = document.getElementById('pdf-scroll-container');
            const desiredWidth = container.clientWidth - 20; 
            const viewport = page.getViewport({scale: 1});
            const responsiveScale = desiredWidth / viewport.width;
            const finalScale = responsiveScale > 1 ? responsiveScale : (window.innerWidth < 768 ? responsiveScale : 1.5);
            const scaledViewport = page.getViewport({scale: finalScale});

            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;

            const renderContext = { canvasContext: ctx, viewport: scaledViewport };
            const renderTask = page.render(renderContext);

            renderTask.promise.then(function() {
                pageRendering = false;
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
                if(pdfLoading) pdfLoading.classList.add('hidden');
            });
        });
        document.getElementById('page-num').textContent = num;
    }

    function queueRenderPage(num) {
        if (pageRendering) pageNumPending = num;
        else renderPage(num);
    }

    window.prevPage = function() {
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    }

    window.nextPage = function() {
        if (pageNum >= pdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    }

    window.closePdf = function() {
        if(pdfModal) pdfModal.classList.add('hidden');
        if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
});