const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = process.cwd();
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.html'));

let totalErrors = 0;
const report = [];

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const hasCodes = content.includes('codes.js');
    const hasQuiz = content.includes('quiz.js');
    if (!hasCodes) { report.push(`${file}: MISSING codes.js include`); totalErrors++; }
    if (!hasQuiz) { report.push(`${file}: MISSING quiz.js include`); totalErrors++; }

    const m = content.match(/window\.quizData\s*=\s*(\[[\s\S]*\])\s*;/);
    if (!m) {
        // Not a quiz page (e.g. index.html) - skip data validation
        continue;
    }
    const code = m[1];
    const sandbox = { window: {} };
    try {
        vm.runInNewContext('window.quizData = ' + code, sandbox);
    } catch (e) {
        report.push(`${file}: SYNTAX ERROR in quizData -> ${e.message}`);
        totalErrors++;
        continue;
    }
    const data = sandbox.window.quizData;
    if (!Array.isArray(data)) {
        report.push(`${file}: quizData is not an array`);
        totalErrors++;
        continue;
    }
    data.forEach((item, i) => {
        if (typeof item !== 'object' || item === null) {
            report.push(`${file}[${i}]: not an object`); totalErrors++; return;
        }
        if (typeof item.q !== 'string' || !item.q.trim()) {
            report.push(`${file}[${i}]: missing/empty q`); totalErrors++;
        }
        if (!Array.isArray(item.options)) {
            report.push(`${file}[${i}]: options not an array`); totalErrors++;
        } else {
            if (item.options.length !== 3) {
                report.push(`${file}[${i}]: options length ${item.options.length} (expected 3)`); totalErrors++;
            }
            item.options.forEach((o, oi) => {
                if (typeof o !== 'string' || !o.trim()) {
                    report.push(`${file}[${i}].options[${oi}]: empty option`); totalErrors++;
                }
            });
            if (typeof item.correct !== 'number') {
                report.push(`${file}[${i}]: correct is not a number (${JSON.stringify(item.correct)})`); totalErrors++;
            } else if (item.correct < 0 || item.correct >= item.options.length) {
                report.push(`${file}[${i}]: correct index ${item.correct} out of bounds (len ${item.options.length})`); totalErrors++;
            }
        }
        if (typeof item.retro !== 'string' || !item.retro.trim()) {
            report.push(`${file}[${i}]: missing/empty retro`); totalErrors++;
        }
    });
}

console.log('Files checked: ' + files.length);
console.log('Total errors: ' + totalErrors);
if (report.length) {
    console.log('--- REPORT ---');
    console.log(report.join('\n'));
} else {
    console.log('No errors found.');
}