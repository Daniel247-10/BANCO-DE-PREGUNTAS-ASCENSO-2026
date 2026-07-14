/* =========================================================
   quiz.js  -  Controlador compartido de cuestionarios
   - Permite seleccionar UNA SOLA respuesta por pregunta.
   - Al responder se bloquea la pregunta.
   - Muestra SIEMPRE la respuesta correcta (aunque falle).
   Depende de una variable global `quizData` definida en
   cada archivo HTML (parte1.html, parte2.html, ...).
   Cada elemento: { q, options:[...], correct, retro }
   ========================================================= */

(function () {
    "use strict";

    var aciertos = {};   // registro de respuestas: index -> true/false

    function renderQuiz() {
        const container = document.getElementById("quiz-container");
        if (!container) return;
        if (!Array.isArray(window.quizData) || window.quizData.length === 0) {
            container.innerHTML = "<p style='color:#fff'>No hay preguntas disponibles.</p>";
            return;
        }

        // Límite gratuito: solo se muestran las primeras 20 preguntas
const LIMITE_GRATIS = 20;
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

            item.options.forEach(function (opt, idx) {
                const li = document.createElement("li");
                li.className = "option";
                li.innerText = opt;
                li.addEventListener("click", function () {
                    responder(list, li, idx, item, index);
                });
                list.appendChild(li);
            });

            card.appendChild(list);

            const fb = document.createElement("div");
            fb.id = "fb-" + index;
            fb.className = "feedback";
            card.appendChild(fb);

            container.appendChild(card);
        }

        // Si el usuario ya desbloqueó PREMIUM, mostramos todo el cuestionario
        const desbloqueado = (function () {
            try { return localStorage.getItem("premiumUnlocked") === "1"; }
            catch (e) { return false; }
        })();

        if (desbloqueado) {
            // Render completo sin límite
            window.quizData.forEach(function (item, index) {
                const card = document.createElement("div");
                card.className = "question-card";
                const qText = document.createElement("div");
                qText.className = "question-text";
                qText.innerHTML = "<strong>" + item.q + "</strong>";
                card.appendChild(qText);
                const list = document.createElement("ul");
                list.className = "options-list";
                item.options.forEach(function (opt, idx) {
                    const li = document.createElement("li");
                    li.className = "option";
                    li.innerText = opt;
                    li.addEventListener("click", function () {
                        responder(list, li, idx, item, index);
                    });
                    list.appendChild(li);
                });
                card.appendChild(list);
                const fb = document.createElement("div");
                fb.id = "fb-" + index;
                fb.className = "feedback";
                card.appendChild(fb);
                container.appendChild(card);
            });
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