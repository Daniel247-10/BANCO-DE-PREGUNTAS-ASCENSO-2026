# INFORME TÉCNICO DEL PROYECTO
## BANCO DE PREGUNTAS Y RESPUESTAS — ASCENSO 2026

**Autor del sistema:** "PC DOCTOR"
**Fecha del informe:** 16 de julio de 2026
**Repositorio:** `BANCO-DE-PREGUNTAS-ASCENSO-2026` (GitHub)
**Propósito:** Plataforma de estudio y autoevaluación para la preparación del examen de Ascenso de Categoría 2026, basada en la bibliografía oficial.

---

## 1. ARQUITECTURA DEL SISTEMA

### 1.1 Tipo de aplicación
Es una **aplicación web estática del lado del cliente** (client-side), de arquitectura **multi-página (MPA)** con comportamiento de **SPA por módulo**. No existe servidor de aplicaciones ni base de datos en el backend: todo el procesamiento (lógica de cuestionarios, calificación, generación de PDF y síntesis de voz) ocurre en el navegador del usuario mediante JavaScript puro.

Cada cuestionario es una página HTML independiente que incrusta sus datos (`window.quizData`) y reutiliza los mismos archivos compartidos (`quiz.js`, `styles.css`, `codes.js`).

### 1.2 Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      NAVEGADOR DEL USUARIO                   │
│                                                               │
│  index.html (HUB / Portal de acceso)                          │
│      │  enlaces a 44 cuestionarios                            │
│      ▼                                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Páginas de cuestionario (parte1..25, módulos)         │  │
│  │   ├─ <script> window.quizData = [ ... ] </script>      │  │
│  │   ├─ <div id="quiz-container"></div>                   │  │
│  │   └─ <script src="quiz.js">                            │  │
│  └───────────────────────────────────────────────────────┘  │
│      │                   │                    │               │
│      ▼                   ▼                    ▼               │
│  styles.css          codes.js            quiz.js             │
│  (presentación)   (200 códigos        (controlador:          │
│                     PREMIUM)            render, shuffle,      │
│                                          scoring, TTS, PDF)   │
│      │                   │                    │               │
│      ▼                   ▼                    ▼               │
│  Web Speech API    localStorage         Blob / ObjectURL     │
│  (voz TTS)         (contador +          (descarga PDF        │
│                      premium)            offline)             │
└─────────────────────────────────────────────────────────────┘

  Recursos externos: wa.link (WhatsApp) — solo enlaces de contacto.
  Sin frameworks, sin CDN, sin dependencias de red en tiempo de ejecución.
```

### 1.3 Flujo de información
1. El usuario abre `index.html` y selecciona un cuestionario.
2. `index.html` controla un **límite de 50 accesos gratuitos** (contador en `localStorage`). Al agotarlo, abre un modal que pide un código de la lista `window.PREMIUM_CODES` (`codes.js`).
3. La página del cuestionario carga `quizData` (arreglo de objetos) y `quiz.js`.
4. `quiz.js` renderiza las tarjetas, **randomiza el orden de las opciones** en cada carga y permite una sola respuesta por pregunta.
5. Al responder, se bloquea la pregunta y se muestra **siempre la respuesta correcta** más la *retroalimentación* (referencia bibliográfica).
6. El botón **Finalizar** calcula el porcentaje de aciertos.
7. El botón **Audio** usa la *Web Speech API* para leer preguntas y respuestas en voz alta (con pausa/reanudación).
8. El botón **Descargar PDF** genera un archivo PDF **sin conexión** (sin librerías externas) con preguntas y respuestas.

---

## 2. TECNOLOGÍAS UTILIZADAS

### 2.1 Frontend
| Tecnología | Uso |
|---|---|
| **HTML5** | Estructura de las 45 páginas y del portal. |
| **CSS3** | `styles.css` — diseño responsive (grid), gradientes, modales, tarjetas. |
| **JavaScript (ES5/ES6)** | Toda la lógica del cliente (sin frameworks). |
| **Web Speech API** | Lectura de preguntas/respuestas en voz alta (`speechSynthesis`). |
| **Canvas API** | Medición real de texto para el ajuste de líneas en el PDF. |
| **Blob / ObjectURL / DataView** | Generación y descarga de PDF en el navegador. |
| **localStorage** | Persistencia del contador de accesos y estado PREMIUM. |

### 2.2 Backend
**No existe backend.** Toda la lógica es del lado del cliente. No hay servidor de aplicaciones, autenticación centralizada ni procesamiento en la nube.

### 2.3 Base de datos
**No hay base de datos.** Los datos de las preguntas se almacenan como **arreglos JSON embebidos** en cada archivo HTML (`window.quizData`). El único "almacenamiento" es `localStorage` del navegador para el control de accesos.

### 2.4 Servidor / alojamiento
- Estático, servible por cualquier hosting de archivos (GitHub Pages, Netlify, cualquier servidor web estático).
- El repositorio está publicado en **GitHub** (`origin: https://github.com/Daniel247-10/BANCO-DE-PREGUNTAS-ASCENSO-2026.git`).
- No requiere base de datos ni entorno de ejecución server-side.

---

## 3. DISEÑO DE LA BASE DE DATOS

> El sistema no utiliza base de datos relacional. A continuación se documenta el **modelo de datos lógico** embebido en cada página, que cumple el rol de "tabla" de preguntas.

### 3.1 Modelo entidad-relación (lógico)
```
┌──────────────────────────┐
│      CUESTIONARIO        │   (1 página HTML = 1 módulo)
└────────────┬─────────────┘
             │ 1 ─── *  (contiene)
             ▼
┌──────────────────────────┐
│        PREGUNTA          │
├──────────────────────────┤
│ q        : texto         │  enunciado
│ options  : [3 textos]    │  alternativas a/b/c
│ correct  : entero 0..2   │  índice de la correcta
│ retro    : texto         │  retroalimentación + fuente
└──────────────────────────┘
```
No hay relaciones entre tablas; cada módulo es autónomo.

### 3.2 Diccionario de datos
| Campo | Tipo | Descripción | Restricciones |
|---|---|---|---|
| `q` | string | Enunciado de la pregunta | Obligatorio, no vacío |
| `options` | array[3] de string | Opciones de respuesta (a, b, c) | Exactamente 3, no vacías |
| `correct` | number (int) | Índice de la opción correcta | `0 ≤ correct < 3` |
| `retro` | string | Retroalimentación y referencia bibliográfica | Obligatorio, no vacío |

### 3.3 Relaciones
- **1 Cuestionario (página) → * N Preguntas** (composición, datos embebidos).
- No hay claves foráneas ni relaciones entre módulos.

---

## 4. DISEÑO DEL SISTEMA

### 4.1 Casos de uso
| ID | Actor | Caso de uso | Descripción |
|---|---|---|---|
| CU-01 | Estudiante | Practicar cuestionario | Selecciona un módulo y responde preguntas. |
| CU-02 | Estudiante | Recibir retroalimentación | Ve respuesta correcta + fuente tras responder. |
| CU-03 | Estudiante | Ver puntaje | Botón Finalizar → % de aciertos. |
| CU-04 | Estudiante | Escuchar en voz alta | Botón Audio lee pregunta/respuesta (TTS). |
| CU-05 | Estudiante | Descargar PDF | Genera PDF offline de preguntas+respuestas. |
| CU-06 | Estudiante | Acceder gratis (limitado) | Hasta 50 accesos (contador localStorage). |
| CU-07 | Estudiante | Activar PREMIUM | Ingresa código de `codes.js` para acceso ilimitado. |

### 4.2 Diagrama de casos de uso (textual)
```
Estudiante ──(CU-01)──> Practicar
Estudiante ──(CU-02)──> Retroalimentación
Estudiante ──(CU-03)──> Puntaje
Estudiante ──(CU-04)──> Audio TTS
Estudiante ──(CU-05)──> PDF offline
Estudiante ──(CU-06)──> Acceso gratuito (50)
Estudiante ──(CU-07)──> Activar PREMIUM (código)
```

### 4.3 Módulos del sistema
1. **Portal (`index.html`)** — Hub de navegación y control de accesos/PREMIUM.
2. **Controlador de cuestionarios (`quiz.js`)** — Render, aleatorización, scoring, TTS, PDF.
3. **Gestor de códigos (`codes.js`)** — Lista de 200 códigos PREMIUM de 4 caracteres.
4. **Banco de preguntas (44 archivos HTML)** — Datos embebidos `quizData`.
5. **Estilos (`styles.css`)** — Presentación responsive y modal PREMIUM.
6. **Validación/Pruebas (Node.js)** — `validate.js`, `test_quiz.js`, `_pdfcheck.js`.

---

## 5. IMPLEMENTACIÓN / PROGRAMACIÓN

### 5.1 Estructura de carpetas (raíz del proyecto)
```
BANCO DE PREGUNTAS -ME/
├── index.html                 # Portal / hub principal
├── styles.css                 # Hoja de estilos compartida
├── quiz.js                    # Controlador de cuestionarios (núcleo)
├── codes.js                   # 200 códigos PREMIUM
├── validate.js                # Validador de integridad (Node)
├── test_quiz.js               # Pruebas automatizadas (Node)
├── _pdfcheck.js               # Validador del generador PDF (Node)
├── parte1.html ... parte25.html   # 25 módulos principales (~100 preg c/u)
├── Neurociencia1.html / 2.html
├── Estilos_Aprendizaje.html / 2 / 3
├── Innovación_UNESCO.html / 2
├── diseño_innovacion.html ... 6
├── escalafon.html
├── faltas_sanciones.html
├── identificacion_violencia.html
├── Ley_discapacidad.html
├── protocolo_prevencion.html
└── reglamento inclusión.html
```

### 5.2 Explicación de los principales módulos

**`index.html` (Portal)**
- Muestra 25 enlaces a "Partes" y 19 a "Cuestionarios separados".
- Controla el límite de **50 accesos gratuitos** con `localStorage` (`separatedFreeCount`).
- Al agotarlos, abre `#premiumModal` y valida el código contra `window.PREMIUM_CODES`.
- Al activar, marca `premiumUnlocked = "1"` en `localStorage`.

**`quiz.js` (Controlador)**
- `renderQuiz()`: construye dinámicamente las tarjetas de pregunta en `#quiz-container`.
- `shuffleArray()`: aleatoriza el orden de las opciones en cada carga y recalcula el índice correcto.
- `responder()`: permite **una sola respuesta**, bloquea las opciones y muestra feedback (correcto/incorrecto). En **ambos casos** se despliega la **fuente/referencia bibliográfica** etiquetada como `📚 Fuente: …` (p. ej. *"Libro: Diseño, desarrollo e innovación del currículum. Capítulo I, páginas 16-17…"*), mediante la clase `.feedback-source`.
- `generarPDF()`: construye un PDF válido A4 **sin librerías**, usando `DataView`/`Blob` y tabla `xref` manual.
- `speakText()` / `procesarPaso()`: motor de lectura TTS con pausa/reanudación y *keep-alive* de audio para móviles.

**`codes.js`**
- Expone `window.PREMIUM_CODES`, arreglo de 200 códigos alfanuméricos de 4 caracteres.

### 5.3 Funciones más importantes
| Función | Archivo | Responsabilidad |
|---|---|---|
| `renderQuiz()` | quiz.js | Renderiza tarjetas y controles. |
| `shuffleArray(arr)` | quiz.js | Aleatoriza opciones preservando la correcta. |
| `responder(list, li, idx, item, index)` | quiz.js | Califica y bloquea la pregunta. |
| `buildPDFBytes(pagesLines)` | quiz.js | Ensambla bytes de un PDF A4 válido. |
| `generarPDF(btn, container)` | quiz.js | Genera y descarga el PDF offline. |
| `procesarPaso()` | quiz.js | Coordina la lectura TTS pregunta→respuesta. |
| `validCode(code)` | index.html | Valida el código PREMIUM. |
| `isPremium()` / `getCount()` | index.html | Lee estado de acceso en localStorage. |

### 5.4 Fragmentos de código relevantes

*Modelo de datos de cada pregunta (embebido en los HTML):*
```js
window.quizData = [
  {
    "q": "1. ¿Quién fue el primer científico en proponer la plasticidad...?",
    "options": ["a) Santiago Ramón y Cajal.", "b) Iván Pávlov.", "c) Jean Piaget."],
    "correct": 0,
    "retro": "Libro: 3. NEUROCIENCIA..., pág. 10. ..."
  },
  // ...
];
```

*Control de acceso gratuito (index.html):*
```js
var FREE_LIMIT = 50;
var KEY_PREMIUM = "premiumUnlocked";
var KEY_COUNT = "separatedFreeCount";
// Al hacer clic: si count < 50 → count++ y navega; si no → muestra modal.
```

*Generación de PDF offline (quiz.js):*
```js
function buildPDFBytes(pagesLines) {
  // Construye catálogo, páginas, fuente Helvetica y tabla xref manual.
  // Sin dependencias externas; usa Blob para la descarga.
}
```

---

## 6. INTERFAZ DE USUARIO

### 6.1 Descripción de cada módulo
- **Portal (`index.html`)**: Encabezado con título, aviso de autoría, botón de contacto (WhatsApp), subtítulo, contador de accesos gratuitos, dos bloques de navegación (25 Partes y 19 Cuestionarios separados), consejo de estudio y modal PREMIUM.
- **Cuestionarios**: Encabezado con título del módulo, contenedor `#quiz-container` con tarjetas de pregunta, barra superior de descarga PDF, y pie flotante con botones **Finalizar**, **Audio** e **Inicio**, más el resultado final.
- **Modal PREMIUM**: Caja central con input de 4 caracteres, botón Activar, mensaje de validación y enlace a WhatsApp.

### 6.2 Características de UI
- Diseño **responsive** con CSS Grid (`repeat(auto-fit, minmax(110px, 1fr))`).
- Paleta de gradiente azul (`#1e3c72 → #2a5298`), tarjetas blancas con sombra.
- Resaltado de aciertos (verde) y errores (rojo) + respuesta correcta resaltada.
- Botón de audio con estados (▶ / ⏸ / ⏯) e iconos.
- Pie de cuestionario flotante para acceso rápido a Finalizar/Audio/Inicio.

> Nota: Las capturas de pantalla no se incluyen en este informe (el entorno es de línea de comandos); la descripción anterior documenta fielmente la interfaz a partir del código fuente.

---

## 7. PRUEBAS DEL SISTEMA

### 7.1 Casos de prueba
| Prueba | Descripción | Herramienta |
|---|---|---|
| Validación de datos | Cada `quizData` tiene `q`, 3 `options`, `correct` en rango, `retro`. | `validate.js` (Node) |
| Render y scoring | Renderiza tarjetas, marca correcto/incorrecto, calcula %. | `test_quiz.js` (Node + DOM mock) |
| Integridad PDF | El PDF generado inicia con `%PDF`, tiene `xref` y `trailer` válidos. | `_pdfcheck.js` (Node) |

### 7.2 Resultados obtenidos
- **`validate.js`**: recorre todos los `.html`, verifica inclusión de `codes.js`/`quiz.js` y valida la estructura de `quizData` (q/options/correct/retro). Diseñado para ejecutarse en el CI/local.
- **`test_quiz.js`**: simula el DOM y verifica renderizado, bloqueo de opciones, resaltado de correcta, cálculo de porcentaje y flujo de activación PREMIUM.
- **`_pdfcheck.js`**: genera un PDF de muestra, escribe `_sample.pdf`, valida estructura (`%PDF-1.4`, `xref`, `trailer`, offsets) y lo elimina.

### 7.3 Corrección de errores
- Se implementó **escape de paréntesis** en el PDF (`escapePDF`) para evitar corrupción del archivo con textos que contienen `(` `)` `\\`.
- Se agregó **keep-alive de audio** (WAV silencioso en bucle) para que la voz TTS no se detenga al apagar la pantalla del móvil, con reanudación automática controlada por `vozManualPausada`.
- Se detiene la síntesis de voz en `beforeunload`/`pagehide`/`unload` para evitar audio fantasma al navegar.

> ⚠️ **Observación de mantenimiento**: `test_quiz.js` y `_pdfcheck.js` fueron escritos para versiones previas del controlador (asumen 10 tarjetas gratis y formato A4 `595×842` en `_pdfcheck.js` vs `612×792` en `quiz.js`). Conviene actualizarlos para que coincidan con el código actual (renderizado en "modo libre" de **todas** las preguntas y tamaño A4 `612×792`).

---

## 8. SEGURIDAD

### 8.1 Validación de formularios
- El modal PREMIUM valida el código contra `window.PREMIUM_CODES` (mayúsculas, `trim`, `maxlength=4`).
- `validate.js` valida la integridad de los datos de cada cuestionario antes de publicar.

### 8.2 Autenticación de usuarios
- **No hay autenticación real de usuario.** El "acceso PREMIUM" es un simple flag en `localStorage` (`premiumUnlocked="1"`) y un código estático en `codes.js` (visible en el código fuente).
- Cualquier usuario con conocimientos básicos puede activar PREMIUM inspeccionando `codes.js` o fijando `localStorage`. **No es un control de seguridad**, es una medida de monetización ligera.

### 8.3 Protección de datos
- No se recopilan ni transmiten datos personales. No hay formularios de registro ni envío a servidores.
- El único dato persistido es local (`localStorage`): contador de accesos y estado PREMIUM, ambos en el dispositivo del usuario.
- El enlace a WhatsApp (`wa.link/kmeemk`) es solo para contacto/venta de códigos; no envía datos automáticos.

---

## 9. DESPLIEGUE

### 9.1 Cómo se publicó el sistema
- Proyecto de archivos estáticos versionado en **Git** y alojado en **GitHub** (`BANCO-DE-PREGUNTAS-ASCENSO-2026`).
- Por su naturaleza estática, puede publicarse en **GitHub Pages**, Netlify, Vercel o cualquier servidor web sin configuración adicional. No requiere build ni dependencias.

### 9.2 Requisitos de instalación
- **Navegador moderno** con soporte de `localStorage`, `Blob`, `Canvas` y (opcional) *Web Speech API*.
- Para ejecutar las **pruebas/validación**: **Node.js** instalado.
  ```bash
  node validate.js     # valida integridad de todos los cuestionarios
  node test_quiz.js    # pruebas de render/scoring/premium
  node _pdfcheck.js    # valida el generador de PDF
  ```
- Para uso final: simplemente abrir `index.html` en el navegador (o servir la carpeta con cualquier servidor estático, p. ej. `python -m http.server`).

### 9.3 Manual básico de uso
1. Abrir `index.html` en el navegador.
2. Elegir un cuestionario ("PARTE 1–25" o "Cuestionarios separados").
3. Responder haciendo clic en una opción; se bloqueará y mostrará la correcta + retroalimentación.
4. Usar **Audio** para escuchar las preguntas/respuestas (pausar/reanudar con el mismo botón).
5. Pulsar **Finalizar** para ver el porcentaje de aciertos.
6. Pulsar **Descargar PDF** para guardar preguntas y respuestas en un archivo PDF offline.
7. Tras 50 accesos gratuitos, introducir un código PREMIUM (obtenible por WhatsApp) en el modal para acceso ilimitado.

---

## 10. RESUMEN DE MÉTRICAS

| Métrica | Valor |
|---|---|
| Archivos HTML totales | 45 (1 portal + 44 cuestionarios) |
| Archivos con banco de preguntas (`quizData`) | 44 |
| **Total de preguntas** | **3.297** |
| Módulos "Parte" (parte1–25) | 25 (~100 preguntas c/u) |
| Módulos "Separados" (libros de referencia) | 19 |
| Códigos PREMIUM definidos | 200 |
| Límite de accesos gratuitos | 50 |
| Tecnologías de ejecución | HTML5, CSS3, JS vanilla, Web Speech API, Canvas, Blob |
| Backend / Base de datos | Ninguno (100% cliente) |

---

*Informe generado a partir del análisis directo del código fuente del repositorio.*