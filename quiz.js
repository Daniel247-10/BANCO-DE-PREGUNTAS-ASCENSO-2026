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
        detenerKeepAlive();
    }
    window.addEventListener('beforeunload', detenerVozAlSalir);
    window.addEventListener('pagehide', detenerVozAlSalir);
    window.addEventListener('unload', detenerVozAlSalir);

    // ---- Mantener el audio (TTS) activo cuando se apaga/bloquea la pantalla del celular ----
    // En móviles, al apagarse la pantalla el navegador pausa speechSynthesis y el audio se detiene.
    // Reproducimos un audio silencioso en bucle para conservar la sesión de audio del sistema y
    // reanudamos automáticamente la voz si el navegador la pausa sin que el usuario lo haya pedido.
    var keepAliveAudio = null;
    var vozManualPausada = false;
    var ultimoReanude = 0;

    function crearAudioSilencio() {
        try {
            var sampleRate = 8000, duration = 1, numSamples = sampleRate * duration;
            var buffer = new ArrayBuffer(44 + numSamples * 2);
            var view = new DataView(buffer);
            function writeString(offset, str) {
                for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
            }
            writeString(0, 'RIFF');
            view.setUint32(4, 36 + numSamples * 2, true);
            writeString(8, 'WAVE');
            writeString(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            writeString(36, 'data');
            view.setUint32(40, numSamples * 2, true);
            return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
        } catch (e) {
            return null;
        }
    }

    function iniciarKeepAlive() {
        if (keepAliveAudio) return;
        try {
            var src = crearAudioSilencio();
            if (!src) return;
            keepAliveAudio = new Audio();
            keepAliveAudio.src = src;
            keepAliveAudio.loop = true;
            keepAliveAudio.setAttribute('playsinline', '');
            keepAliveAudio.setAttribute('webkit-playsinline', '');
            keepAliveAudio.volume = 0;
            var p = keepAliveAudio.play();
            if (p && typeof p.catch === 'function') p.catch(function () {});
        } catch (e) {}
    }

    function detenerKeepAlive() {
        if (keepAliveAudio) {
            try { keepAliveAudio.pause(); } catch (e) {}
            try { if (keepAliveAudio.src) URL.revokeObjectURL(keepAliveAudio.src); } catch (e) {}
            keepAliveAudio = null;
        }
    }

    if ('speechSynthesis' in window) {
        window.speechSynthesis.onpause = function () {
            // Pausa automática del navegador (p. ej. pantalla apagada): reanudar la voz.
            if (vozManualPausada) return;
            var ahora = Date.now();
            if (ahora - ultimoReanude < 500) return; // evitar bucle de pausa/reanudación
            ultimoReanude = ahora;
            try { window.speechSynthesis.resume(); } catch (e) {}
        };
    }

    function shuffleArray(array) {
        const shuffled = array.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // ---- Descarga de PDF (OFFLINE, sin dependencias externas) ----
    function sanitizarNombre(texto) {
        return (texto || "cuestionario")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .substring(0, 60) || "cuestionario";
    }

    function escapePDF(s) {
        return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    }

    function strToBytes(s) {
        const b = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
        return b;
    }

    // Envuelve el texto en líneas que caben en maxW usando canvas (medición real)
    function envolverTexto(texto, size, maxW) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.font = size + "pt Helvetica";
        const words = texto.split(/\s+/);
        const lines = [];
        let cur = "";
        words.forEach(function (w) {
            const test = cur ? cur + " " + w : w;
            if (!cur || ctx.measureText(test).width <= maxW) {
                cur = test;
            } else {
                lines.push(cur);
                cur = w;
            }
        });
        if (cur) lines.push(cur);
        return lines.length ? lines : [""];
    }

    // Construye un PDF válido (A4) a partir de páginas de líneas {text,size,x,y}
    function buildPDFBytes(pagesLines) {
        const N = pagesLines.length;
        const totalObjs = 3 + 2 * N;
        const objStrings = new Array(totalObjs + 1);
        objStrings[1] = "<< /Type /Catalog /Pages 2 0 R >>";
        const kids = [];
        for (let i = 0; i < N; i++) kids.push((4 + 2 * i) + " 0 R");
        objStrings[2] = "<< /Type /Pages /Kids [ " + kids.join(" ") + " ] /Count " + N + " >>";
        objStrings[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

        for (let i = 0; i < N; i++) {
            const pn = 4 + 2 * i;
            const cn = 5 + 2 * i;
            objStrings[pn] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
                "/Resources << /Font << /F1 3 0 R >> >> /Contents " + cn + " 0 R >>";
            let stream = "";
            pagesLines[i].forEach(function (line) {
                stream += "BT\n/F1 " + line.size + " Tf\n" + line.x + " " + line.y + " Td\n(" +
                    escapePDF(line.text) + ") Tj\nET\n";
            });
            const len = strToBytes(stream).length;
            objStrings[cn] = "<< /Length " + len + " >>\nstream\n" + stream + "\nendstream";
        }

        const bytes = [];
        let offset = 0;
        function push(s) {
            const b = strToBytes(s);
            for (let i = 0; i < b.length; i++) bytes.push(b[i]);
            offset += b.length;
        }
        push("%PDF-1.4\n");
        const offsets = new Array(totalObjs + 1);
        for (let n = 1; n <= totalObjs; n++) {
            offsets[n] = offset;
            push(n + " 0 obj\n" + objStrings[n] + "\nendobj\n");
        }
        const xrefStart = offset;
        push("xref\n0 " + (totalObjs + 1) + "\n");
        push("0000000000 65535 f \n");
        for (let n = 1; n <= totalObjs; n++) {
            push(("0000000000" + offsets[n]).slice(-10) + " 00000 n \n");
        }
        push("trailer\n<< /Size " + (totalObjs + 1) + " /Root 1 0 R >>\n");
        push("startxref\n" + xrefStart + "\n%%EOF\n");
        return new Uint8Array(bytes);
    }

    function generarPDF(btn, container) {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = "Generando PDF...";
        }
        try {
            const pageW = 612, pageH = 792, margin = 40;
            const maxW = pageW - margin * 2;
            const h1 = document.querySelector("header h1");
            const titulo = h1 ? h1.innerText : "Cuestionario";

            const rawLines = [];
            envolverTexto(titulo, 14, maxW).forEach(function (t) {
                rawLines.push({ text: t, size: 14 });
            });
            rawLines.push({ text: "", size: 11 });

            const cards = container.querySelectorAll(".question-card");
            cards.forEach(function (card) {
                const qEl = card.querySelector(".question-text");
                const qText = qEl ? qEl.innerText : "";
                const idx = parseInt(card.dataset.correctIndex, 10);
                const opciones = card.querySelectorAll(".option");
                const respRaw = opciones[idx] ? opciones[idx].innerText : "";
                const resp = respRaw.replace(/^[a-cA-C]\)\s*/, "");
                const bloque = qText + "\nRespuesta: " + resp;
                bloque.split("\n").forEach(function (parrafo) {
                    envolverTexto(parrafo, 11, maxW).forEach(function (t) {
                        rawLines.push({ text: t, size: 11 });
                    });
                });
                rawLines.push({ text: "", size: 11 });
            });

            const leading = { 14: 20, 11: 15 };
            const pagesLines = [];
            let curPage = [];
            let y = pageH - margin;
            rawLines.forEach(function (line) {
                const lh = leading[line.size] || 15;
                if (y - lh < margin) {
                    pagesLines.push(curPage);
                    curPage = [];
                    y = pageH - margin;
                }
                curPage.push({ text: line.text, size: line.size, x: margin, y: y });
                y -= lh;
            });
            if (curPage.length) pagesLines.push(curPage);

            const pdfBytes = buildPDFBytes(pagesLines);
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = sanitizarNombre(titulo) + ".pdf";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = "&#11015; Descargar PDF (preguntas y respuestas)";
            }
        } catch (err) {
            console.error("Error al generar PDF:", err);
            alert("No se pudo generar el PDF.");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = "&#11015; Descargar PDF (preguntas y respuestas)";
            }
        }
    }

    function agregarBotonPDF(container) {
        const bar = document.createElement("div");
        bar.className = "pdf-download-bar";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "download-pdf-btn";
        btn.innerHTML = "&#11015; Descargar PDF (preguntas y respuestas)";
        btn.addEventListener("click", function () {
            generarPDF(btn, container);
        });
        bar.appendChild(btn);
        container.insertBefore(bar, container.firstChild);
    }

    function renderQuiz() {
        const container = document.getElementById("quiz-container");
        if (!container) return;
        if (!Array.isArray(window.quizData) || window.quizData.length === 0) {
            container.innerHTML = "<p style='color:#fff'>No hay preguntas disponibles.</p>";
            return;
        }

        // Barra superior con el botón de descarga de PDF (preguntas + respuestas)
        agregarBotonPDF(container);

        // Modo libre: se muestran TODAS las preguntas sin límite ni restricción de acceso.
        const visibleCount = window.quizData.length;

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
                vozManualPausada = false;
                detenerKeepAlive();
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
                vozManualPausada = false;
                iniciarKeepAlive();
                audioBtn.innerHTML = "&#9208; Pausar";
                procesarPaso();
            } else if (audioPausado) {
                // Reanudar desde donde quedó
                audioPausado = false;
                vozManualPausada = false;
                audioBtn.innerHTML = "&#9208; Pausar";
                window.speechSynthesis.resume();
            } else {
                // Pausar (pausa manual: no debe reanudarse solo)
                audioPausado = true;
                vozManualPausada = true;
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