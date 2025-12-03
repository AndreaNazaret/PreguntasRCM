document.addEventListener('DOMContentLoaded', () => {
    const loadingState = document.getElementById('loading-state');
    const examContainer = document.getElementById('exam-container');
    const submitBar = document.getElementById('submit-bar');
    const retryBar = document.getElementById('retry-bar');
    const resultsHeader = document.getElementById('results-header');
    const rulesCard = document.getElementById('rules-card');

    // --- Configuración ---
    const TOTAL_QUESTIONS = 15; 
    const PENALTY = 0.33; // Resta 0.33 por fallo
    const TOTAL_THEMES = 6; 
    
    // --- Estado ---
    let examQuestions = [];
    let userAnswers = {}; 

    init();

    async function init() {
        try {
            // 1. Cargar todos los temas
            const promises = [];
            const basePath = 'data/alumnos/'; 

            for (let i = 1; i <= TOTAL_THEMES; i++) {
                const url = `${basePath}tema${i}.json`;
                const p = fetch(url)
                    .then(res => res.ok ? res.json() : [])
                    .catch(err => []);
                promises.push(p);
            }

            const allThemesData = await Promise.all(promises);

            // 2. LÓGICA DE SELECCIÓN: MÍNIMO 1 DE CADA TEMA
            let selectedQuestions = [];
            let reservePool = []; // Aquí metemos las que sobran para rellenar luego

            allThemesData.forEach((themeQuestions, index) => {
                if (Array.isArray(themeQuestions) && themeQuestions.length > 0) {
                    // Etiquetamos el tema antes de nada
                    themeQuestions.forEach(q => q.temaOrigen = index + 1);

                    // Mezclamos las preguntas de este tema específico
                    const shuffledTheme = shuffleArray([...themeQuestions]);

                    // A) Cogemos LA PRIMERA (Obligatoria)
                    const mandatory = shuffledTheme[0];
                    selectedQuestions.push(mandatory);

                    // B) El resto (si hay) van a la reserva global
                    if (shuffledTheme.length > 1) {
                        const extras = shuffledTheme.slice(1);
                        reservePool = reservePool.concat(extras);
                    }
                }
            });

            // 3. RELLENAR HASTA 15 CON EL POOL DE RESERVA
            // Tenemos (idealmente) 6 preguntas obligatorias, faltan 9 para llegar a 15.
            const needed = TOTAL_QUESTIONS - selectedQuestions.length;

            if (needed > 0 && reservePool.length >= needed) {
                // Mezclamos la reserva (que tiene preguntas de todos los temas mezcladas)
                const shuffledReserve = shuffleArray(reservePool);
                // Cogemos las que faltan
                const fillers = shuffledReserve.slice(0, needed);
                // Las añadimos al examen
                selectedQuestions = selectedQuestions.concat(fillers);
            }

            // Si por algún motivo no hay suficientes preguntas en total
            if (selectedQuestions.length === 0) throw new Error("No hay preguntas suficientes.");

            // 4. MEZCLAR EL EXAMEN FINAL
            // Ahora tenemos las 15 preguntas (6 obligatorias + 9 random), pero están en orden.
            // Las barajamos todas para que salgan mezcladas.
            examQuestions = shuffleArray(selectedQuestions);

            // Renderizar
            renderExam();
            
        } catch (error) {
            console.error(error);
            loadingState.innerHTML = `<p class="text-red-500 font-bold">Error al generar el examen. Revisa la consola.</p>`;
        }
    }

    function renderExam() {
        loadingState.classList.add('hidden');
        examContainer.classList.remove('hidden');
        submitBar.classList.remove('hidden');
        submitBar.classList.add('flex');

        examContainer.innerHTML = '';

        examQuestions.forEach((q, index) => {
            // Mapear opciones para no perder el índice original al barajar
            let optionsMap = q.opciones.map((opt, i) => ({ text: opt, originalIndex: i }));
            optionsMap = shuffleArray(optionsMap);
            q.shuffledOptions = optionsMap;

            const qElement = document.createElement('div');
            qElement.className = "bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow";
            qElement.id = `question-${index}`;
            
            // HEADER DE LA PREGUNTA (Tema oculto)
            let html = `
                <div class="flex justify-between items-center mb-4 q-header">
                    <span class="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">PREGUNTA ${index + 1}</span>
                    <span class="q-meta"></span> 
                </div>
                <h3 class="text-lg font-semibold text-gray-800 mb-6 leading-snug">${q.pregunta}</h3>
                <div class="space-y-3">
            `;

            // OPCIONES
            optionsMap.forEach((opt) => {
                html += `
                    <div 
                        class="option-card border border-gray-200 rounded-lg p-4 cursor-pointer flex items-center group select-none"
                        onclick="selectOption(${index}, ${opt.originalIndex}, this)"
                        id="opt-${index}-${opt.originalIndex}"
                    >
                        <div class="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 flex items-center justify-center mr-3 indicator-circle transition-colors">
                            <div class="w-2.5 h-2.5 rounded-full bg-blue-500 opacity-0 transition-opacity check-dot"></div>
                        </div>
                        <span class="text-gray-700 text-sm md:text-base">${opt.text}</span>
                    </div>
                `;
            });

            html += `</div>
                <div class="mt-4 pt-4 border-t border-gray-100 hidden feedback-area text-sm"></div>
            `;
            
            qElement.innerHTML = html;
            examContainer.appendChild(qElement);
        });
    }

    // --- Funciones Globales ---

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
        const total = examQuestions.length;
        
        if (answered < total) {
            if(!confirm(`Faltan ${total - answered} preguntas. ¿Entregar ya?`)) return;
        } else {
            if(!confirm("¿Entregar examen definitivo?")) return;
        }

        submitBar.classList.add('hidden');
        submitBar.classList.remove('flex');
        retryBar.classList.remove('hidden');
        retryBar.classList.add('flex');
        rulesCard.classList.add('hidden'); 

        let correctCount = 0;
        let incorrectCount = 0;
        let blankCount = 0;

        examQuestions.forEach((q, index) => {
            const qDiv = document.getElementById(`question-${index}`);
            const feedback = qDiv.querySelector('.feedback-area');
            const userSel = userAnswers[index];
            const correctIndex = q.respuesta_correcta;

            feedback.classList.remove('hidden');
            
            // MOSTRAR EL TEMA AHORA
            const metaSpan = qDiv.querySelector('.q-meta');
            if(metaSpan) {
                metaSpan.innerHTML = `<span class="text-xs font-mono text-gray-500 bg-gray-100 border border-gray-200 px-2 py-1 rounded">Tema ${q.temaOrigen}</span>`;
            }

            qDiv.querySelectorAll('.option-card').forEach(o => o.style.pointerEvents = 'none');

            if (userSel === undefined) {
                blankCount++;
                feedback.innerHTML = `<span class="text-gray-500 font-bold">⚠️ En blanco (0 pts)</span>`;
                const correctDiv = document.getElementById(`opt-${index}-${correctIndex}`);
                if(correctDiv) highlightCorrect(correctDiv);
            } 
            else if (userSel === correctIndex) {
                correctCount++;
                const userDiv = document.getElementById(`opt-${index}-${userSel}`);
                userDiv.classList.remove('selected-option');
                userDiv.classList.add('correct-answer');
                feedback.innerHTML = `<span class="text-green-600 font-bold">✅ Correcto (+1 pt)</span>`;
            } 
            else {
                incorrectCount++;
                const userDiv = document.getElementById(`opt-${index}-${userSel}`);
                const correctDiv = document.getElementById(`opt-${index}-${correctIndex}`);
                
                userDiv.classList.remove('selected-option');
                userDiv.classList.add('wrong-answer');
                
                if(correctDiv) highlightCorrect(correctDiv); 
                
                feedback.innerHTML = `<span class="text-red-500 font-bold">❌ Fallo (-${PENALTY} pts)</span>`;
            }
        });

        function highlightCorrect(div) {
            div.classList.add('correct-answer');
            div.classList.add('ring-2', 'ring-green-500', 'ring-offset-1');
            const label = document.createElement('span');
            label.className = "ml-auto text-xs font-bold text-green-700 bg-green-200 px-2 py-0.5 rounded";
            label.innerText = "SOLUCIÓN";
            div.appendChild(label);
        }


        

        let rawPoints = correctCount - (incorrectCount * PENALTY);
        if (rawPoints < 0) rawPoints = 0;
        
        const finalScore = (rawPoints / total) * 10;

        document.getElementById('res-correct').innerText = correctCount;
        document.getElementById('res-incorrect').innerText = incorrectCount;
        document.getElementById('res-blank').innerText = blankCount;
        
        const scoreEl = document.getElementById('res-score');
        scoreEl.innerText = finalScore.toFixed(2);
        
        if (finalScore >= 5) {
            scoreEl.className = "text-7xl font-bold my-4 text-green-400";
            resultsHeader.classList.add('border-b-8', 'border-green-500');
        } else {
            scoreEl.className = "text-7xl font-bold my-4 text-red-400";
            resultsHeader.classList.add('border-b-8', 'border-red-500');
        }

        resultsHeader.classList.remove('hidden');
        resultsHeader.classList.add('block');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
});