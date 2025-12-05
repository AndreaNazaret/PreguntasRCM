document.addEventListener('DOMContentLoaded', () => {
    const loadingState = document.getElementById('loading-state');
    const examContainer = document.getElementById('exam-container');
    const submitBar = document.getElementById('submit-bar');
    const retryBar = document.getElementById('retry-bar');
    const resultsHeader = document.getElementById('results-header');

    const pdfModal = document.getElementById('pdf-modal');
    const modalQuestionContent = document.getElementById('modal-question-content');
    const pdfLoading = document.getElementById('pdf-loading');
    const canvas = document.getElementById('the-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;

    const TOTAL_QUESTIONS = 15; 
    const PENALTY = 0.33; 
    const TOTAL_THEMES = 6; 
    
    let examQuestions = [];
    let userAnswers = {}; 
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;

    init();

    async function init() {
        try {
            const promises = [];
            const basePath = 'data/alumnos/'; 

            for (let i = 1; i <= TOTAL_THEMES; i++) {
                const url = `${basePath}tema${i}.json`;
                const p = fetch(url).then(res => res.ok ? res.json() : []).catch(err => []);
                promises.push(p);
            }

            const allThemesData = await Promise.all(promises);
            let selectedQuestions = [];
            let reservePool = [];

            allThemesData.forEach((themeQuestions, index) => {
                if (Array.isArray(themeQuestions) && themeQuestions.length > 0) {
                    themeQuestions.forEach(q => q.temaOrigen = index + 1);
                    const shuffledTheme = shuffleArray([...themeQuestions]);
                    selectedQuestions.push(shuffledTheme[0]);
                    if (shuffledTheme.length > 1) reservePool = reservePool.concat(shuffledTheme.slice(1));
                }
            });

            const needed = TOTAL_QUESTIONS - selectedQuestions.length;
            if (needed > 0 && reservePool.length >= needed) {
                const shuffledReserve = shuffleArray(reservePool);
                selectedQuestions = selectedQuestions.concat(shuffledReserve.slice(0, needed));
            }

            if (selectedQuestions.length === 0) throw new Error("No hay preguntas.");
            examQuestions = shuffleArray(selectedQuestions);
            renderExam();
            
        } catch (error) {
            console.error(error);
            loadingState.innerHTML = `<p class="text-red-500">Error cargando examen.</p>`;
        }
    }

    function renderExam() {
        loadingState.classList.add('hidden');
        examContainer.classList.remove('hidden');
        submitBar.classList.remove('hidden');
        submitBar.classList.add('flex');
        examContainer.innerHTML = '';

        examQuestions.forEach((q, index) => {
            let optionsMap = q.opciones.map((opt, i) => ({ text: opt, originalIndex: i }));
            optionsMap = shuffleArray(optionsMap);
            q.shuffledOptions = optionsMap;

            const qElement = document.createElement('div');
            qElement.className = "bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow";
            qElement.id = `question-${index}`;
            
            let html = `
                <div class="flex justify-between items-center mb-4 q-header">
                    <span class="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">PREGUNTA ${index + 1}</span>
                    <span class="q-meta"></span>
                </div>
                <h3 class="text-lg font-semibold text-gray-800 mb-6 leading-snug">${q.pregunta}</h3>
                <div class="space-y-3 options-wrapper">`;

            optionsMap.forEach((opt) => {
                html += `
                    <div class="option-card border border-gray-200 rounded-lg p-4 cursor-pointer flex items-center group select-none"
                        onclick="selectOption(${index}, ${opt.originalIndex}, this)" id="opt-${index}-${opt.originalIndex}">
                        <div class="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 flex items-center justify-center mr-3 indicator-circle transition-colors">
                            <div class="w-2.5 h-2.5 rounded-full bg-blue-500 opacity-0 transition-opacity check-dot"></div>
                        </div>
                        <span class="text-gray-700 text-sm md:text-base">${opt.text}</span>
                    </div>`;
            });

            html += `</div>
                <div class="mt-4 pt-4 border-t border-gray-100 hidden feedback-area flex justify-end">
                     <button onclick="openPdf(${q.temaOrigen}, ${q.pagina}, ${index})" class="text-blue-600 hover:text-blue-800 font-bold text-xs uppercase border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-50 flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                        Ver PDF
                    </button>
                </div>
            `;
            qElement.innerHTML = html;
            examContainer.appendChild(qElement);
        });
    }

    window.selectOption = function(qIndex, optIndex, element) {
        if (resultsHeader.classList.contains('block')) return;
        userAnswers[qIndex] = optIndex;
        const parent = document.getElementById(`question-${qIndex}`);
        parent.querySelectorAll('.option-card').forEach(el => {
            el.classList.remove('selected-option', 'border-blue-500', 'bg-blue-50');
            el.querySelector('.indicator-circle').classList.remove('border-blue-500');
            el.querySelector('.check-dot').classList.add('opacity-0');
        });
        element.classList.add('selected-option', 'border-blue-500', 'bg-blue-50');
        element.querySelector('.indicator-circle').classList.add('border-blue-500');
        element.querySelector('.check-dot').classList.remove('opacity-0');
    };

    window.submitExam = function() {
        const answered = Object.keys(userAnswers).length;
        if (answered < examQuestions.length && !confirm(`Faltan ${examQuestions.length - answered}. ¿Entregar?`)) return;
        if (answered === examQuestions.length && !confirm("¿Entregar examen?")) return;

        submitBar.classList.add('hidden');
        submitBar.classList.remove('flex');
        retryBar.classList.remove('hidden');
        retryBar.classList.add('flex');

        let correctCount = 0;
        let incorrectCount = 0;
        let blankCount = 0;

        examQuestions.forEach((q, index) => {
            const qDiv = document.getElementById(`question-${index}`);
            const feedbackArea = qDiv.querySelector('.feedback-area');
            const metaSpan = qDiv.querySelector('.q-meta');
            const userSel = userAnswers[index];
            const correctIndex = q.respuesta_correcta;

            feedbackArea.classList.remove('hidden');
            metaSpan.innerHTML = `<span class="text-xs font-mono text-gray-500 bg-gray-100 border border-gray-200 px-2 py-1 rounded">Tema ${q.temaOrigen}</span>`;
            qDiv.querySelectorAll('.option-card').forEach(o => o.style.pointerEvents = 'none');

            if (userSel === undefined) {
                blankCount++;
                const correctDiv = document.getElementById(`opt-${index}-${correctIndex}`);
                if(correctDiv) highlightCorrect(correctDiv);
            } else if (userSel === correctIndex) {
                correctCount++;
                const userDiv = document.getElementById(`opt-${index}-${userSel}`);
                userDiv.classList.remove('selected-option');
                userDiv.classList.add('correct-answer');
            } else {
                incorrectCount++;
                const userDiv = document.getElementById(`opt-${index}-${userSel}`);
                const correctDiv = document.getElementById(`opt-${index}-${correctIndex}`);
                userDiv.classList.remove('selected-option');
                userDiv.classList.add('wrong-answer');
                if(correctDiv) highlightCorrect(correctDiv);
            }
        });

        let rawPoints = correctCount - (incorrectCount * PENALTY);
        if (rawPoints < 0) rawPoints = 0;
        const finalScore = (rawPoints / examQuestions.length) * 10;

        document.getElementById('res-correct').innerText = correctCount;
        document.getElementById('res-incorrect').innerText = incorrectCount;
        document.getElementById('res-blank').innerText = blankCount;
        const scoreEl = document.getElementById('res-score');
        scoreEl.innerText = finalScore.toFixed(2);
        scoreEl.className = "text-7xl font-bold my-4 " + (finalScore >= 5 ? "text-green-400" : "text-red-400");
        
        resultsHeader.classList.remove('hidden');
        resultsHeader.classList.add('block');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    function highlightCorrect(div) {
        div.classList.add('correct-answer', 'ring-2', 'ring-green-500');
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // --- PDF.js Logic (High Quality) ---
    window.openPdf = function(tema, pagina, qIndex) {
        const pdfPath = `pdfs/Tema${tema}.pdf`;
        
        if(pdfModal) pdfModal.classList.remove('hidden');
        if(pdfLoading) pdfLoading.classList.remove('hidden');

        // Copiar contenido al modal para el contexto
        if(modalQuestionContent) {
            const qDiv = document.getElementById(`question-${qIndex}`);
            const qTitle = qDiv.querySelector('h3').innerText;
            const optsHTML = qDiv.querySelector('.options-wrapper').innerHTML;
            modalQuestionContent.innerHTML = `
                <h3 class="text-sm font-bold text-gray-800 mb-2">${qTitle}</h3>
                <div class="space-y-2 text-xs pointer-events-none opacity-75">${optsHTML}</div>
            `;
        }

        pdfjsLib.getDocument(pdfPath).promise.then(function(pdfDoc_) {
            pdfDoc = pdfDoc_;
            document.getElementById('page-count').textContent = pdfDoc.numPages;
            pageNum = parseInt(pagina);
            queueRenderPage(pageNum);
        }).catch(function(error) {
            console.error(error);
            if(pdfLoading) pdfLoading.classList.add('hidden');
        });
    }

    function renderPage(num) {
        pageRendering = true;
        pdfDoc.getPage(num).then(function(page) {
            const container = document.getElementById('pdf-scroll-container');
            // Detectar ancho real y usar PixelRatio para nitidez
            const pixelRatio = window.devicePixelRatio || 1;
            const desiredWidth = container.clientWidth - 20;
            
            const viewport = page.getViewport({scale: 1});
            const scale = desiredWidth / viewport.width;
            const scaledViewport = page.getViewport({scale: scale});

            // Ajustar tamaño interno del canvas para HD
            canvas.width = Math.floor(scaledViewport.width * pixelRatio);
            canvas.height = Math.floor(scaledViewport.height * pixelRatio);
            
            // Ajustar tamaño visual en CSS
            canvas.style.width = Math.floor(scaledViewport.width) + "px";
            canvas.style.height = Math.floor(scaledViewport.height) + "px";

            const renderContext = {
                canvasContext: ctx,
                viewport: scaledViewport,
                transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] // Escalar contexto
            };
            
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

    window.prevPage = function() { if (pageNum > 1) { pageNum--; queueRenderPage(pageNum); } }
    window.nextPage = function() { if (pageNum < pdfDoc.numPages) { pageNum++; queueRenderPage(pageNum); } }
    window.closePdf = function() { 
        if(pdfModal) pdfModal.classList.add('hidden'); 
        if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
});