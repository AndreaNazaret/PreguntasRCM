// Variables Globales
let currentMode = ''; 
let questions = [];
let userAnswers = {}; 

// PDF.js State
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
const canvas = document.getElementById('the-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const pdfLoading = document.getElementById('pdf-loading');
const pdfModal = document.getElementById('pdf-modal');
const modalQuestionContent = document.getElementById('modal-question-content');

function startMode(mode) {
    currentMode = mode;
    document.getElementById('mode-selector').classList.add('hidden');
    document.getElementById('loading-state').classList.remove('hidden');
    
    const title = document.getElementById('mode-title');
    if(mode === 'practice') {
        title.innerText = "PRÁCTICA (Feedback)";
        title.classList.add('text-indigo-700');
    } else {
        title.innerText = "SIMULACRO";
        title.classList.add('text-red-700');
        document.getElementById('exam-submit-bar').classList.remove('hidden');
        document.getElementById('exam-submit-bar').classList.add('flex');
    }
    loadAllQuestions();
}

async function loadAllQuestions() {
    const basePath = 'data/alumnos/';
    const promises = [];
    for (let i = 1; i <= 6; i++) {
        promises.push(fetch(`${basePath}tema${i}.json`).then(res => res.ok ? res.json() : []));
    }

    try {
        const allData = await Promise.all(promises);
        let allQuestions = [];
        allData.forEach((themeQ, idx) => {
            if(Array.isArray(themeQ)) {
                themeQ.forEach(q => {
                    q.temaOrigen = idx + 1;
                    allQuestions.push(q);
                });
            }
        });
        questions = shuffleArray(allQuestions);
        
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('quiz-container').classList.remove('hidden');
        document.getElementById('q-counter').innerText = `${questions.length} Preguntas`;
        renderQuestions();
    } catch (error) {
        alert("Error cargando preguntas: " + error);
    }
}

function renderQuestions() {
    const container = document.getElementById('quiz-container');
    container.innerHTML = '';
    questions.forEach((q, index) => {
        let optionsMap = q.opciones.map((opt, i) => ({ text: opt, originalIndex: i }));
        optionsMap = shuffleArray(optionsMap);
        q.shuffledOptions = optionsMap;

        const div = document.createElement('div');
        div.className = "bg-white rounded-xl p-6 shadow-sm border border-gray-100";
        div.id = `q-${index}`;

        let html = `
            <div class="flex justify-between items-center mb-4">
                <span class="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">#${index + 1}</span>
                <span class="theme-badge text-xs font-mono font-bold text-indigo-500"></span>
            </div>
            <h3 class="text-lg font-bold text-gray-800 mb-4">${q.pregunta}</h3>
            <div class="space-y-3 options-list">`;

        optionsMap.forEach((opt) => {
            html += `
                <div class="option-card border-2 border-gray-100 rounded-lg p-4 cursor-pointer flex items-center group transition-all"
                     onclick="handleOptionClick(${index}, ${opt.originalIndex}, this)">
                    <div class="w-5 h-5 rounded-full border-2 border-gray-300 mr-3 flex items-center justify-center indicator">
                        <div class="w-2.5 h-2.5 bg-blue-500 rounded-full opacity-0 check"></div>
                    </div>
                    <span class="text-gray-700">${opt.text}</span>
                </div>`;
        });

        html += `</div><div class="feedback-area mt-4 pt-4 border-t border-gray-100 hidden"></div>`;
        div.innerHTML = html;
        container.appendChild(div);
    });
}

window.handleOptionClick = function(qIndex, optIndex, card) {
    const qDiv = document.getElementById(`q-${qIndex}`);
    if (qDiv.dataset.answered === "true") return;

    userAnswers[qIndex] = optIndex;
    qDiv.querySelectorAll('.option-card').forEach(el => {
        el.classList.remove('selected-option', 'border-blue-500', 'bg-blue-50');
        el.querySelector('.indicator').classList.remove('border-blue-500');
        el.querySelector('.check').classList.add('opacity-0');
    });

    card.classList.add('selected-option', 'border-blue-500', 'bg-blue-50');
    card.querySelector('.indicator').classList.add('border-blue-500');
    card.querySelector('.check').classList.remove('opacity-0');

    if (currentMode === 'practice') resolveQuestion(qIndex);
}

function resolveQuestion(qIndex) {
    const q = questions[qIndex];
    const userSel = userAnswers[qIndex];
    const qDiv = document.getElementById(`q-${qIndex}`);
    
    qDiv.dataset.answered = "true"; 
    const themeBadge = qDiv.querySelector('.theme-badge');
    if(themeBadge) {
        themeBadge.innerText = `TEMA ${q.temaOrigen}`;
        themeBadge.classList.add('bg-indigo-50', 'px-2', 'py-1', 'rounded');
    }

    const cards = qDiv.querySelectorAll('.option-card');
    const shuffled = q.shuffledOptions;
    
    cards.forEach((card, visualIdx) => {
        card.style.pointerEvents = 'none'; 
        const optOriginalIdx = shuffled[visualIdx].originalIndex;
        if (optOriginalIdx === q.respuesta_correcta) {
            card.classList.remove('selected-option', 'border-blue-500', 'bg-blue-50');
            card.classList.add('correct-answer', 'border-green-500', 'bg-green-50');
        } else if (optOriginalIdx === userSel) {
            card.classList.remove('selected-option', 'border-blue-500', 'bg-blue-50');
            card.classList.add('wrong-answer', 'border-red-500', 'bg-red-50');
        }
    });

    const feedback = qDiv.querySelector('.feedback-area');
    feedback.classList.remove('hidden');
    let html = `<div class="flex justify-between items-center">`;
    html += userSel === q.respuesta_correcta ? `<span class="text-green-600 font-bold">✅ Correcto</span>` : `<span class="text-red-500 font-bold">❌ Incorrecto</span>`;
    
    if(q.pagina) {
        html += `<button onclick="openPdf(${q.temaOrigen}, ${q.pagina}, ${qIndex})" class="flex items-center text-xs font-bold text-indigo-600 border border-indigo-200 px-3 py-1 rounded-full hover:bg-indigo-50">Ver PDF</button>`;
    }
    html += `</div>`;
    feedback.innerHTML = html;
}

window.submitExam = function() {
    const answered = Object.keys(userAnswers).length;
    if(!confirm(`Has respondido ${answered} de ${questions.length}. ¿Entregar?`)) return;
    document.getElementById('exam-submit-bar').classList.add('hidden');
    let correct = 0;
    questions.forEach((q, idx) => {
        resolveQuestion(idx);
        if (userAnswers[idx] === q.respuesta_correcta) correct++;
    });
    const resCard = document.getElementById('results-card');
    resCard.classList.remove('hidden');
    document.getElementById('final-score').innerText = correct;
    document.getElementById('final-total').innerText = questions.length;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- PDF Functions (Igual que en examen.js) ---
window.openPdf = function(tema, pagina, qIndex) {
    const pdfPath = `pdfs/Tema${tema}.pdf`;
    if(pdfModal) pdfModal.classList.remove('hidden');
    if(pdfLoading) pdfLoading.classList.remove('hidden');

    if(modalQuestionContent) {
        const qDiv = document.getElementById(`q-${qIndex}`);
        const qTitle = qDiv.querySelector('h3').innerText;
        const optsHTML = qDiv.querySelector('.options-list').innerHTML;
        modalQuestionContent.innerHTML = `<h3 class="text-sm font-bold text-gray-800 mb-2">${qTitle}</h3><div class="space-y-2 text-xs pointer-events-none opacity-75">${optsHTML}</div>`;
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
        const pixelRatio = window.devicePixelRatio || 1;
        const desiredWidth = container.clientWidth - 20;
        const viewport = page.getViewport({scale: 1});
        const scale = desiredWidth / viewport.width;
        const scaledViewport = page.getViewport({scale: scale});

        canvas.width = Math.floor(scaledViewport.width * pixelRatio);
        canvas.height = Math.floor(scaledViewport.height * pixelRatio);
        canvas.style.width = Math.floor(scaledViewport.width) + "px";
        canvas.style.height = Math.floor(scaledViewport.height) + "px";

        const renderContext = { canvasContext: ctx, viewport: scaledViewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] };
        const renderTask = page.render(renderContext);
        renderTask.promise.then(function() {
            pageRendering = false;
            if (pageNumPending !== null) { renderPage(pageNumPending); pageNumPending = null; }
            if(pdfLoading) pdfLoading.classList.add('hidden');
        });
    });
    document.getElementById('page-num').textContent = num;
}

function queueRenderPage(num) { if (pageRendering) pageNumPending = num; else renderPage(num); }
window.prevPage = function() { if (pageNum > 1) { pageNum--; queueRenderPage(pageNum); } }
window.nextPage = function() { if (pageNum < pdfDoc.numPages) { pageNum++; queueRenderPage(pageNum); } }
window.closePdf = function() { if(pdfModal) pdfModal.classList.add('hidden'); if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }