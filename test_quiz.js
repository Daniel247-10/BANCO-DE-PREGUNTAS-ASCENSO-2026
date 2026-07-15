const fs = require('fs');
const vm = require('vm');

// ---- Load real quizData from parte1.html ----
const html = fs.readFileSync('parte1.html', 'utf8');
const m = html.match(/window\.quizData\s*=\s*(\[[\s\S]*\])\s*;/);
const quizData = vm.runInNewContext('(' + m[1] + ')');

// ---- Minimal DOM mock (className <-> classList synced like real DOM) ----
function makeEl(tag) {
    const el = {
        tagName: tag,
        children: [],
        _className: '',
        _id: '',
        style: {},
        innerHTML: '',
        innerText: '',
        _listeners: {},
        classList: {
            _s: new Set(),
            add(c){ this._s.add(c); },
            remove(c){ this._s.delete(c); },
            contains(c){ return this._s.has(c); }
        },
        appendChild(c){ this.children.push(c); return c; },
        addEventListener(ev, fn){ this._listeners[ev] = fn; },
        scrollIntoView(){},
        querySelectorAll(sel){
            const cls = sel.replace('.', '');
            const out = [];
            const walk = (node) => {
                node.children.forEach(ch => {
                    if (ch.classList && ch.classList.contains(cls)) out.push(ch);
                    walk(ch);
                });
            };
            walk(this);
            return out;
        }
    };
    Object.defineProperty(el, 'className', {
        get(){ return this._className; },
        set(v){
            this._className = v;
            this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean));
        }
    });
    Object.defineProperty(el, 'id', {
        get(){ return this._id; },
        set(v){ this._id = v; }
    });
    return el;
}

function runQuiz(premium) {
    const byId = {};
    const container = makeEl('div');
    container._id = 'quiz-container';
    const documentMock = {
        readyState: 'complete',
        getElementById(id){
            if (id === 'quiz-container') return container;
            if (!byId[id]) byId[id] = makeEl('div');
            return byId[id];
        },
        createElement(tag){ return makeEl(tag); },
        body: { style: {} },
        addEventListener(){}
    };
    const windowMock = { quizData: quizData, PREMIUM_CODES: ["TEST"] };
    const localStorageMock = {
        _d: premium ? { premiumUnlocked: "1" } : {},
        getItem(k){ return this._d[k] || null; },
        setItem(k,v){ this._d[k]=v; }
    };
    const locationMock = { reload(){ this.reloaded = true; } };
    const sandbox = {
        document: documentMock,
        window: windowMock,
        localStorage: localStorageMock,
        location: locationMock,
        Math: Math,
        console: console
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync('quiz.js', 'utf8'), sandbox);
    return { byId, container, documentMock, locationMock };
}

let pass = 0, fail = 0;
function check(name, cond){ if(cond){ pass++; } else { fail++; console.log('  FAIL: ' + name); } }

// ===== TEST 1: Free mode (no premium) =====
console.log('TEST 1: Free mode');
let r = runQuiz(false);
let cards = r.container.children.filter(c => c.className === 'question-card');
check('renders exactly 10 free cards', cards.length === 10);
check('each card has 3 options', cards.every(c => c.querySelectorAll('.option').length === 3));
check('each card has a feedback div', cards.every(c => c.querySelectorAll('.feedback').length === 1));
check('finalizar button created', !!r.byId['finalizarBtn']);

// Answer first question by clicking option 0
let opts = cards[0].querySelectorAll('.option');
opts[0]._listeners['click']();
let markedCorrect = opts[0].classList.contains('selected-correct');
let markedIncorrect = opts[0].classList.contains('selected-incorrect');
check('clicking marks option correct OR incorrect', markedCorrect || markedIncorrect);
check('exactly one state (correct xor incorrect)', markedCorrect !== markedIncorrect);
check('all options disabled after answer', opts.every(o => o.classList.contains('disabled')));

// If incorrect, the correct option must be highlighted
if (markedIncorrect) {
    let correctHighlighted = opts.some(o => o.classList.contains('show-correct'));
    check('when incorrect, correct answer is shown', correctHighlighted);
}

// Finalizar computes percentage
r.byId['finalizarBtn']._listeners['click']();
check('resultadoFinal display=block', r.byId['resultadoFinal'].style.display === 'block');
check('resultadoFinal contains %', /%/.test(r.byId['resultadoFinal'].innerHTML));

// Premium lock should appear (quizData has 100 questions > 10)
check('premium lock present', !!r.byId['codeInput'] && !!r.byId['codeBtn']);

// ===== TEST 2: Premium unlock with valid code =====
console.log('TEST 2: Premium unlock flow');
r = runQuiz(false);
r.byId['codeInput'].value = 'TEST';
r.byId['codeBtn']._listeners['click']();
check('location.reload invoked on valid code', r.locationMock.reloaded === true);

// ===== TEST 3: Premium mode (already unlocked) =====
console.log('TEST 3: Premium mode (unlocked)');
r = runQuiz(true);
cards = r.container.children.filter(c => c.className === 'question-card');
check('premium renders ALL questions (100)', cards.length === 100);
check('no premium lock in premium mode', !r.byId['codeInput']);

console.log('\n==== RESULT: PASS=' + pass + '  FAIL=' + fail + ' ====');
process.exit(fail === 0 ? 0 : 1);