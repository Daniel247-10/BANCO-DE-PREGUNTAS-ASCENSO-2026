/* =========================================================
   quiz.js  -  Controlador compartido de cuestionarios
   - Permite seleccionar UNA SOLA respuesta por pregunta.
   - Al responder se bloquea la pregunta.
   - Muestra SIEMPRE la respuesta correcta (aunque falle).
   - Las opciones de respuesta se randomizan en cada carga.
   Depende de una variable global `quizData` definida en
   cada archivo HTML (parte1.html, parte2.html, ...).
   Cada elemento: { q, options:[...], correct, retro }
   ========================================================= */

(function () {
    "use strict";

    var aciertos = {};   // registro de respuestas: index -> true/false

    // Función de texto a voz
    function speakText(text, callback) {
        if ('speechSynthesis' in window) {
            // Cancelar cualquier speech en curso
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 1.3; // Velocidad más rápida
            utterance.pitch = 1;
            utterance.volume = 1;
            
            if (callback) {
                utterance.onend = callback;
            }
            
            window.speechSynthesis.speak(utterance);
        } else {
            console.warn('Web Speech API no soportada en este navegador');
            if (callback) callback();
        }
    }
    window.speakText = speakText;

    // Detener la síntesis de voz al cambiar de página, recargar o cerrar la pestaña/sesión.
    // Sin esto, el audio sigue reproduciéndose aunque el usuario navegue a otra página
    // o cierre la sesión, hasta que lo pause/detenga explícitamente.
    function detenerVozAlSalir() {
        if ('speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch (e) {}
        }
    }
    window.addEventListener('beforeunload', detenerVozAlSalir);
    window.addEventListener('pagehide', detenerVozAlSalir);
    window.addEventListener('unload', detenerVozAlSalir);

    function shuffleArray(array) {
        const shuffled = array.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    function renderQuiz() {
        const container = document.getElementById("quiz-container");
        if (!container) return;
        if (!Array.isArray(window.quizData) || window.quizData.length === 0) {
            container.innerHTML = "<p style='color:#fff'>No hay preguntas disponibles.</p>";
            return;
        }

        // Límite gratuito: solo se muestran las primeras 25 preguntas
        const LIMITE_GRATIS = 25;
        const visibleCount = Math.min(window.quizData.length, LIMITE_GRATIS);

        for (let index = 0; index < visibleCount; index++) {
            const item = window.quizData[index];
            const card = document.createElement("div");
            card.className = "question-card";

            const qText = document.createElement("div");
            qText.className = "question-text";
            qText.innerHTML = "<strong>" + item.q + "</strong>";
            card.appendChild(qText);

            const list = document.createElement("ul");
            list.className = "options-list";

            // Randomizar opciones y rastrear la nueva posición de la respuesta correcta
            const originalOptions = item.options.slice();
            const correctAnswer = originalOptions[item.correct];
            const shuffledOptions = shuffleArray(originalOptions);
            const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
            
            // Crear una copia del item con las opciones randomizadas y nuevos incisos
            const incisos = ["a", "b", "c"];
            const randomizedOptions = shuffledOptions.map(function(opt, idx) {
                // Remover el inciso original si existe (a), b), c), A), B), C))
                const textoSinInciso = opt.replace(/^[a-cA-C]\)\s*/, '');
                return incisos[idx] + ") " + textoSinInciso;
            });
            
            const randomizedItem = {
                q: item.q,
                options: randomizedOptions,
                correct: newCorrectIndex,
                retro: item.retro
            };

            randomizedOptions.forEach(function (opt, idx) {
                const li = document.createElement("li");
                li.className = "option";
                li.innerText = opt;
                li.addEventListener("click", function () {
                    responder(list, li, idx, randomizedItem, index);
                });
                list.appendChild(li);
            });

            card.appendChild(list);

            const fb = document.createElement("div");
            fb.id = "fb-" + index;
            fb.className = "feedback";
            card.appendChild(fb);

            card.dataset.correctIndex = newCorrectIndex;
            container.appendChild(card);
        }

        // Si el usuario ya desbloqueó PREMIUM, mostramos todo el cuestionario
        const desbloqueado = (function () {
            try { return localStorage.getItem("premiumUnlocked") === "1"; }
            catch (e) { return false; }
        })();

        if (desbloqueado) {
            // Render completo sin límite, continuando desde la pregunta 11
            for (let index = LIMITE_GRATIS; index < window.quizData.length; index++) {
                const item = window.quizData[index];
                const card = document.createElement("div");
                card.className = "question-card";
                const qText = document.createElement("div");
                qText.className = "question-text";
                qText.innerHTML = "<strong>" + item.q + "</strong>";
                card.appendChild(qText);
                const list = document.createElement("ul");
                list.className = "options-list";
                
                // Randomizar opciones y rastrear la nueva posición de la respuesta correcta
                const originalOptions = item.options.slice();
                const correctAnswer = originalOptions[item.correct];
                const shuffledOptions = shuffleArray(originalOptions);
                const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
                
                // Crear una copia del item con las opciones randomizadas y nuevos incisos
                const incisos = ["a", "b", "c"];
                const randomizedOptions = shuffledOptions.map(function(opt, idx) {
                    // Remover el inciso original si existe (a), b), c), A), B), C))
                    const textoSinInciso = opt.replace(/^[a-cA-C]\)\s*/, '');
                    return incisos[idx] + ") " + textoSinInciso;
                });
                
                const randomizedItem = {
                    q: item.q,
                    options: randomizedOptions,
                    correct: newCorrectIndex,
                    retro: item.retro
                };

                randomizedOptions.forEach(function (opt, idx) {
                    const li = document.createElement("li");
                    li.className = "option";
                    li.innerText = opt;
                    li.addEventListener("click", function () {
                        responder(list, li, idx, randomizedItem, index);
                    });
                    list.appendChild(li);
                });
                card.appendChild(list);
                const fb = document.createElement("div");
                fb.id = "fb-" + index;
                fb.className = "feedback";
                card.appendChild(fb);
                card.dataset.correctIndex = newCorrectIndex;
                container.appendChild(card);
            }
        } else if (window.quizData.length > LIMITE_GRATIS) {
            const lock = document.createElement("div");
            lock.className = "premium-lock";
            lock.innerHTML =
                "<h3>SOLICITA TU ACCESO PREMIUN</h3>" +
                "<p>Has explorado tus " + LIMITE_GRATIS + " preguntas gratis de este cuestionario.</p>" +
                "<div class='code-box'>" +
                "<input type='text' id='codeInput' maxlength='4' placeholder='Código (4 caracteres)' autocomplete='off'>" +
                "<button type='button' id='codeBtn'>Desbloquear</button>" +
                "<div id='codeMsg' class='code-msg'></div>" +
                "</div>" +
                "<a class=\"modal-wa\" href=\"https://wa.link/kmeemk\" target=\"_blank\" rel=\"noopener\">Solicitar código por WhatsApp</a>";
            container.appendChild(lock);

            const input = document.getElementById("codeInput");
            const btn = document.getElementById("codeBtn");
            const msg = document.getElementById("codeMsg");

            function intentar() {
                const val = (input.value || "").trim().toUpperCase();
                const lista = window.PREMIUM_CODES || [];
                if (val.length === 4 && lista.indexOf(val) !== -1) {
                    try { localStorage.setItem("premiumUnlocked", "1"); } catch (e) {}
                    location.reload();
                } else {
                    msg.textContent = "Código no válido. Solicítalo por WhatsApp.";
                    msg.style.color = "#dc3545";
                }
            }
            btn.addEventListener("click", intentar);
            input.addEventListener("keydown", function (e) {
                if (e.key === "Enter") intentar();
            });
        }

        // Pie de cuestionario: botón Finalizar (muestra % de aciertos) e Inicio
        const footer = document.createElement("div");
        footer.className = "quiz-footer flotante";
        footer.innerHTML =
            "<button type='button' id='finalizarBtn'>Finalizar</button>" +
            "<button type='button' id='audioControlBtn'>&#128266; Audio</button>" +
            "<a href='index.html' class='inicio-btn'>&larr; Inicio</a>" +
            "<div id='resultadoFinal' class='resultado-final'></div>";
        container.appendChild(footer);

        document.body.style.paddingBottom = "80px";

        const fBtn = document.getElementById("finalizarBtn");
        const rFinal = document.getElementById("resultadoFinal");
        fBtn.addEventListener("click", function () {
            let respondidas = 0, correctas = 0;
            for (const k in aciertos) {
                respondidas++;
                if (aciertos[k]) correctas++;
            }
            const pct = respondidas ? Math.round((correctas / respondidas) * 100) : 0;
            rFinal.style.display = "block";
            rFinal.innerHTML = "Acertaste " + correctas + " de " + respondidas +
                " pregunta(s) respondida(s) &mdash; " + pct + "% de aciertos";
            rFinal.scrollIntoView({ behavior: "smooth", block: "center" });
        });

        // Botón de audio: lee preguntas, señala la respuesta correcta
        // y permite pausar y continuar desde donde quedó.
        const audioBtn = document.getElementById("audioControlBtn");
        let audioActivo = false;   // sesión de audio en curso
        let audioPausado = false;  // pausado a la espera de reanudar
        let audioIndex = 0;        // pregunta actual
        let audioPaso = 0;         // 0 = pregunta, 1 = respuesta correcta

        function decir(texto, alTerminar) {
            if (!('speechSynthesis' in window)) {
                if (alTerminar) alTerminar();
                return;
            }
            const u = new SpeechSynthesisUtterance(texto);
            u.lang = 'es-ES';
            u.rate = 1.3;
            u.pitch = 1;
            u.volume = 1;
            u.onend = function () {
                if (!audioPausado && alTerminar) alTerminar();
            };
            window.speechSynthesis.speak(u);
        }

        function resaltarCorrecta(card) {
            const idx = parseInt(card.dataset.correctIndex, 10);
            const opciones = card.querySelectorAll(".option");
            opciones.forEach(function (o) { o.classList.remove("audio-correct"); });
            if (!isNaN(idx) && opciones[idx]) {
                opciones[idx].classList.add("audio-correct");
                opciones[idx].scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }

        function procesarPaso() {
            const cards = container.querySelectorAll(".question-card");
            if (audioIndex >= cards.length) {
                cards.forEach(function (c) { c.classList.remove("audio-active"); });
                audioActivo = false;
                audioPausado = false;
                audioBtn.innerHTML = "&#128266; Audio";
                return;
            }
            // Saltar las preguntas que el usuario ya respondió
            if (Object.prototype.hasOwnProperty.call(aciertos, audioIndex)) {
                audioIndex++;
                procesarPaso();
                return;
            }
            const card = cards[audioIndex];
            if (audioPaso === 0) {
                cards.forEach(function (c) { c.classList.remove("audio-active"); });
                card.classList.add("audio-active");
                card.scrollIntoView({ behavior: "smooth", block: "center" });
                const qText = card.querySelector(".question-text");
                decir(qText ? qText.innerText : "", function () {
                    audioPaso = 1;
                    procesarPaso();
                });
            } else {
                resaltarCorrecta(card);
                const idx = parseInt(card.dataset.correctIndex, 10);
                const opciones = card.querySelectorAll(".option");
                const textoResp = opciones[idx] ? opciones[idx].innerText : "";
                const retro = (window.quizData[audioIndex] && window.quizData[audioIndex].retro)
                    ? window.quizData[audioIndex].retro
                    : "";

                // Mostrar la retroalimentación de la pregunta
                const fb = card.querySelector(".feedback");
                if (fb) {
                    if (retro) {
                        fb.className = "feedback correct";
                        fb.innerHTML = "<strong>Retroalimentación:</strong> " + retro;
                        fb.style.display = "block";
                    } else {
                        fb.style.display = "none";
                    }
                }

                decir("La respuesta correcta es: " + textoResp, function () {
                    audioIndex++;
                    audioPaso = 0;
                    procesarPaso();
                });
            }
        }

        audioBtn.addEventListener("click", function () {
            if (!audioActivo) {
                // Iniciar (o reiniciar si ya terminó la lectura previa)
                if (audioIndex >= container.querySelectorAll(".question-card").length) {
                    audioIndex = 0;
                    audioPaso = 0;
                }
                window.speechSynthesis.cancel();
                audioActivo = true;
                audioPausado = false;
                audioBtn.innerHTML = "&#9208; Pausar";
                procesarPaso();
            } else if (audioPausado) {
                // Reanudar desde donde quedó
                audioPausado = false;
                audioBtn.innerHTML = "&#9208; Pausar";
                window.speechSynthesis.resume();
            } else {
                // Pausar
                audioPausado = true;
                audioBtn.innerHTML = "&#9654; Continuar";
                window.speechSynthesis.pause();
            }
        });

    }

    function responder(list, liSeleccionado, idxElegido, item, index) {
        const todas = list.querySelectorAll(".option");
        todas.forEach(function (l) {
            l.classList.add("disabled");
        });

        const fb = document.getElementById("fb-" + index);
        fb.style.display = "block";

        if (idxElegido === item.correct) {
            liSeleccionado.classList.add("selected-correct");
            fb.className = "feedback correct";
            fb.innerHTML = "<strong>&iexcl;Correcto!</strong> " + (item.retro || "");
        } else {
            liSeleccionado.classList.add("selected-incorrect");
            todas[item.correct].classList.add("show-correct");
            fb.className = "feedback incorrect";
            fb.innerHTML =
                "<strong>&iexcl;Incorrecto!</strong> La respuesta correcta es: <em>" +
                item.options[item.correct] +
                "</em>.<br>" +
                (item.retro ? "<br>" + item.retro : "");
        }

        aciertos[index] = (idxElegido === item.correct);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            renderQuiz();
        });
    } else {
        renderQuiz();
    }
})();