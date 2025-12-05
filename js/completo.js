// Variables Globales
let currentMode = ''; // 'practice' o 'exam'
let questions = [];
let userAnswers = {}; // { index: optionIndex }

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

// --- INICIO ---
function startMode(mode) {
    currentMode = mode;
    document.getElementById('mode-selector').classList.add('hidden');
    document.getElementById('loading-state').classList.remove('hidden');
    
    // Actualizar UI según modo
    const title = document.getElementById('mode-title');
    if(mode === 'practice') {
        title.innerText = "MODO PRÁCTICA (Feedback)";
        title.classList.add('text-indigo-700');
    } else {
        title.innerText = "MODO SIMULACRO";
        title.classList.add('text-red-700');
        document.getElementById('exam-submit-bar').classList.remove('hidden');
        document.getElementById('exam-submit-bar').classList.add('flex');
    }

    loadAllQuestions();
}

async function loadAllQuestions() {
    const basePath = 'data/alumnos/';
    const promises = [];
    
    // Cargar los 6 temas
    for (let i = 1; i <= 6; i++) {
        promises.push(fetch(`${basePath}tema${i}.json`).then(res => res.ok ? res.json() : []));
    }

    try {
        const allData = await Promise.all(promises);
        let allQuestions = [];

        allData.forEach((themeQ, idx) => {
            if(Array.isArray(themeQ)) {
                // Añadir origen a cada pregunta
                themeQ.forEach(q => {
                    q.temaOrigen = idx + 1;
                    allQuestions.push(q);
                });
            }
        });

        // Mezclar TODO
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
        // Barajar opciones
        let optionsMap = q.opciones.map((opt, i) => ({ text: opt, originalIndex: i }));
        optionsMap = shuffleArray(optionsMap);
        q.shuffledOptions = optionsMap;

        const div = document.createElement('div');
        div.className = "bg-white rounded-xl p-6 shadow-sm border border-gray-100";
        div.id = `q-${index}`;

        // HEADER PREGUNTA
        // En 'practice', el tema se inyecta dinámicamente al responder. 
        // En 'exam', se inyecta al final.
        let html = `
            <div class="flex justify-between items-center mb-4">
                <span class="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">#${index + 1}</span>
                <span class="theme-badge text-xs font-mono font-bold text-indigo-500"></span>
            </div>
            <h3 class="text-lg font-bold text-gray-800 mb-4">${q.pregunta}</h3>
            <div class="space-y-3 options-list">
        `;

        optionsMap.forEach((opt) => {
            html += `
                <div class="option-card border-2 border-gray-100 rounded-lg p-4 cursor-pointer flex items-center group transition-all"
                     onclick="handleOptionClick(${index}, ${opt.originalIndex}, this)">
                    <div class="w-5 h-5 rounded-full border-2 border-gray-300 mr-3 flex items-center justify-center indicator">
                        <div class="w-2.5 h-2.5 bg-blue-500 rounded-full opacity-0 check"></div>
                    </div>
                    <span class="text-gray-700">${opt.text}</span>
                </div>
            `;
        });

        // FEEDBACK AREA (Botón PDF y textos)
        html += `</div>
            <div class="feedback-area mt-4 pt-4 border-t border-gray-100 hidden">
                </div>
        `;

        div.innerHTML = html;
        container.appendChild(div);
    });
}

// --- LÓGICA DE RESPUESTA ---
window.handleOptionClick = function(qIndex, optIndex, card) {
    const qDiv = document.getElementById(`q-${qIndex}`);
    
    // Si ya se respondió en modo práctica o examen entregado, bloquear
    if (qDiv.dataset.answered === "true") return;

    userAnswers[qIndex] = optIndex;

    // Limpiar selección visual previa en esta pregunta
    qDiv.querySelectorAll('.option-card').forEach(el => {
        el.classList.remove('selected-option', 'border-blue-500', 'bg-blue-50');
        el.querySelector('.indicator').classList.remove('border-blue-500');
        el.querySelector('.check').classList.add('opacity-0');
    });

    // Marcar seleccionada (Azul)
    card.classList.add('selected-option', 'border-blue-500', 'bg-blue-50');
    card.querySelector('.indicator').classList.add('border-blue-500');
    card.querySelector('.check').classList.remove('opacity-0');

    // SI ES MODO PRÁCTICA -> CORREGIR AL INSTANTE
    if (currentMode === 'practice') {
        resolveQuestion(qIndex);
    }
}

// Función que revela la solución de una pregunta individual
function resolveQuestion(qIndex) {
    const q = questions[qIndex];
    const userSel = userAnswers[qIndex];
    const qDiv = document.getElementById(`q-${qIndex}`);
    
    qDiv.dataset.answered = "true"; // Bloquear cambios

    // 1. REVELAR EL TEMA AHORA
    const themeBadge = qDiv.querySelector('.theme-badge');
    if(themeBadge) {
        themeBadge.innerText = `TEMA ${q.temaOrigen}`;
        themeBadge.classList.add('bg-indigo-50', 'px-2', 'py-1', 'rounded');
    }

    // 2. COLORES EN OPCIONES
    const cards = qDiv.querySelectorAll('.option-card');
    // Buscar la tarjeta que corresponde a la selección y la correcta
    // No podemos usar indices directos porque están barajadas, usamos el onclick attribute o id si tuvieran
    // Aquí iteramos el DOM para encontrar por la función onclick
    
    // Recuperar el orden visual para machear
    const shuffled = q.shuffledOptions;
    
    cards.forEach((card, visualIdx) => {
        card.style.pointerEvents = 'none'; // Deshabilitar clicks
        
        const optOriginalIdx = shuffled[visualIdx].originalIndex;

        if (optOriginalIdx === q.respuesta_correcta) {
            card.classList.remove('selected-option', 'border-blue-500', 'bg-blue-50');
            card.classList.add('correct-answer', 'border-green-500', 'bg-green-50');
        } else if (optOriginalIdx === userSel) {
            // Si el usuario marcó esta y era incorrecta
            card.classList.remove('selected-option', 'border-blue-500', 'bg-blue-50');
            card.classList.add('wrong-answer', 'border-red-500', 'bg-red-50');
        }
    });

    // 3. MOSTRAR FEEDBACK (Botón PDF)
    const feedback = qDiv.querySelector('.feedback-area');
    feedback.classList.remove('hidden');
    
    let feedbackHTML = `<div class="flex justify-between items-center">`;
    
    if (userSel === q.respuesta_correcta) {
        feedbackHTML += `<span class="text-green-600 font-bold">✅ Correcto</span>`;
    } else {
        feedbackHTML += `<span class="text-red-500 font-bold">❌ Incorrecto</span>`;
    }

    // Botón PDF
    if(q.pagina) {
        feedbackHTML += `
            <button onclick="openPdf(${q.temaOrigen}, ${q.pagina}, ${qIndex})" 
                    class="flex items-center text-xs font-bold text-indigo-600 border border-indigo-200 px-3 py-1 rounded-full hover:bg-indigo-50">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                Ver PDF (Pág ${q.pagina})
            </button>
        `;
    }
    feedbackHTML += `</div>`;
    feedback.innerHTML = feedbackHTML;
}

// --- LÓGICA DE EXAMEN (FIN) ---
window.submitExam = function() {
    const answered = Object.keys(userAnswers).length;
    if(!confirm(`Has respondido ${answered} de ${questions.length}. ¿Entregar?`)) return;

    // Ocultar barra inferior
    document.getElementById('exam-submit-bar').classList.add('hidden');

    // Calcular nota y revelar todo
    let correct = 0;
    questions.forEach((q, idx) => {
        resolveQuestion(idx); // Reutilizamos la función que pinta colores y temas
        if (userAnswers[idx] === q.respuesta_correcta) correct++;
    });

    // Mostrar Card Resultados
    const resCard = document.getElementById('results-card');
    resCard.classList.remove('hidden');
    document.getElementById('final-score').innerText = correct;
    document.getElementById('final-total').innerText = questions.length;
    
    // Scroll arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


// --- UTILS ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- PDF FUNCTIONS (PDF.JS) ---
window.openPdf = function(tema, pagina, qIndex) {
    const pdfPath = `pdfs/Tema${tema}.pdf`;
    
    if(pdfModal) pdfModal.classList.remove('hidden');
    if(pdfLoading) pdfLoading.classList.remove('hidden');

    // Rellenar contexto (izquierda)
    if(modalQuestionContent) {
        const qDiv = document.getElementById(`q-${qIndex}`);
        const qTitle = qDiv.querySelector('h3').innerText;
        const optsHTML = qDiv.querySelector('.options-list').innerHTML;
        
        modalQuestionContent.innerHTML = `
            <div class="bg-indigo-50 p-2 rounded mb-2 text-xs font-bold text-indigo-800">Tema ${tema} - Pág ${pagina}</div>
            <h3 class="text-lg font-bold text-gray-800 mb-4">${qTitle}</h3>
            <div class="space-y-2 pointer-events-none">${optsHTML}</div>
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
        alert("Error al cargar el PDF. Asegúrate de que existen los archivos en /pdfs/");
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

window.prevPage = function() { if (pageNum > 1) { pageNum--; queueRenderPage(pageNum); } }
window.nextPage = function() { if (pageNum < pdfDoc.numPages) { pageNum++; queueRenderPage(pageNum); } }
window.closePdf = function() { 
    if(pdfModal) pdfModal.classList.add('hidden'); 
    if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}