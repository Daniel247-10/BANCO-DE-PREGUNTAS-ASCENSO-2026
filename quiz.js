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

    function renderQuiz() {
        const container = document.getElementById("quiz-container");
        if (!container) return;
        if (!Array.isArray(window.quizData) || window.quizData.length === 0) {
            container.innerHTML = "<p style='color:#fff'>No hay preguntas disponibles.</p>";
            return;
        }

        // Límite gratuito: solo se muestran las primeras 5 preguntas
        const LIMITE_GRATIS = 5;
        const total = Math.min(window.quizData.length, LIMITE_GRATIS);

        for (let index = 0; index < total; index++) {
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
            return;
        }

        // Si hay más preguntas, se bloquea el resto mostrando el mensaje PREMIUM
        if (window.quizData.length > LIMITE_GRATIS) {
            const lock = document.createElement("div");
            lock.className = "premium-lock";
            lock.innerHTML =
                "<h3>SOLICITA TU ACCESO PREMIUN</h3>" +
                "<p>Has explorado tus 5 preguntas gratis de este cuestionario.</p>" +
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
                    // Recargar el cuestionario completo
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
    }

    function responder(list, liSeleccionado, idxElegido, item, index) {
        // Bloquear todas las opciones (solo una respuesta permitida)
        const todas = list.querySelectorAll(".option");
        todas.forEach(function (l) {
            l.classList.add("disabled");
        });

        const fb = document.getElementById("fb-" + index);
        fb.style.display = "block";

        if (idxElegido === item.correct) {
            // Respuesta correcta
            liSeleccionado.classList.add("selected-correct");
            fb.className = "feedback correct";
            fb.innerHTML = "<strong>&iexcl;Correcto!</strong> " + (item.retro || "");
        } else {
            // Respuesta incorrecta: marcar la elegida y REVELAR la correcta
            liSeleccionado.classList.add("selected-incorrect");
            todas[item.correct].classList.add("show-correct");
            fb.className = "feedback incorrect";
            fb.innerHTML =
                "<strong>&iexcl;Incorrecto!</strong> La respuesta correcta es: <em>" +
                item.options[item.correct] +
                "</em>.<br>" +
                (item.retro ? "<br>" + item.retro : "");
        }
    }

    // Muestra un badge fijo indicando que el MODO PREMIUM está activo
    function mostrarBadgePremium() {
        if (document.getElementById("premiumBadge")) return;
        const badge = document.createElement("div");
        badge.id = "premiumBadge";
        badge.className = "premium-badge";
        badge.innerHTML = "★ MODO PREMIUM ACTIVO";
        document.body.appendChild(badge);
    }

    // Ejecutar cuando el DOM esté listo
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            renderQuiz();
            try { if (localStorage.getItem("premiumUnlocked") === "1") mostrarBadgePremium(); } catch (e) {}
        });
    } else {
        renderQuiz();
        try { if (localStorage.getItem("premiumUnlocked") === "1") mostrarBadgePremium(); } catch (e) {}
    }
})();
