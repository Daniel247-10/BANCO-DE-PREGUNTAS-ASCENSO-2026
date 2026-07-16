c// Validación standalone del generador de PDF (offline)
const fs = require('fs');

function escapePDF(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function strToBytes(s) {
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
    return b;
}
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
        const pn = 4 + 2 * i, cn = 5 + 2 * i;
        objStrings[pn] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents " + cn + " 0 R >>";
        let stream = "";
        pagesLines[i].forEach(function (line) {
            stream += "BT\n/F1 " + line.size + " Tf\n" + line.x + " " + line.y + " Td\n(" + escapePDF(line.text) + ") Tj\nET\n";
        });
        const len = strToBytes(stream).length;
        objStrings[cn] = "<< /Length " + len + " >>\nstream\n" + stream + "\nendstream";
    }
    const bytes = [];
    let offset = 0;
    function push(s) { const b = strToBytes(s); for (let i = 0; i < b.length; i++) bytes.push(b[i]); offset += b.length; }
    push("%PDF-1.4\n");
    const offsets = new Array(totalObjs + 1);
    for (let n = 1; n <= totalObjs; n++) { offsets[n] = offset; push(n + " 0 obj\n" + objStrings[n] + "\nendobj\n"); }
    const xrefStart = offset;
    push("xref\n0 " + (totalObjs + 1) + "\n");
    push("0000000000 65535 f \n");
    for (let n = 1; n <= totalObjs; n++) push(("0000000000" + offsets[n]).slice(-10) + " 00000 n \n");
    push("trailer\n<< /Size " + (totalObjs + 1) + " /Root 1 0 R >>\n");
    push("startxref\n" + xrefStart + "\n%%EOF\n");
    return new Uint8Array(bytes);
}

// Construir un PDF de prueba con texto en español y varias páginas
const pages = [
    [ {text:"Banco de Preguntas - PARTE 1", size:14, x:40, y:802},
      {text:"1. ¿Quién fue el primer científico en proponer la plasticidad?", size:11, x:40, y:780},
      {text:"Respuesta correcta: a) Santiago Ramón y Cajal.", size:11, x:40, y:765} ],
    [ {text:"Página 2 - más preguntas ñáéíóú ¿¡", size:11, x:40, y:802} ]
];
const pdf = buildPDFBytes(pages);
fs.writeFileSync('_sample.pdf', Buffer.from(pdf));

// Validar estructura
const buf = fs.readFileSync('_sample.pdf');
const txt = buf.toString('latin1');
let ok = true;
function check(name, cond){ if(!cond){ ok=false; console.log('  FAIL: '+name); } else { console.log('  OK: '+name); } }

check('inicia con %PDF', txt.startsWith('%PDF-1.4'));
check('termina con %%EOF', txt.trimEnd().endsWith('%%EOF'));
check('tiene trailer /Root', /trailer\s*<<[^>]*\/Root 1 0 R/.test(txt));
check('tiene startxref', /startxref/.test(txt));

// Validar que cada offset del xref apunte al inicio de "N 0 obj"
const xrefMatch = txt.match(/xref\n0 (\d+)\n([\s\S]*?)\ntrailer/);
check('sección xref presente', !!xrefMatch);
if (xrefMatch) {
    const count = parseInt(xrefMatch[1], 10);
    const lines = xrefMatch[2].split('\n').filter(l => l.length >= 18);
    check('cantidad de entradas xref = count', lines.length === count);
    let allOffsetsOk = true;
    for (let n = 1; n < count; n++) {
        const off = parseInt(lines[n].substring(0, 10), 10);
        const at = txt.substring(off, off + 20);
        if (!new RegExp('^' + n + ' 0 obj').test(at)) {
            allOffsetsOk = false;
            console.log('   offset malo para obj ' + n + ': "' + at + '"');
        }
    }
    check('todos los offsets xref apuntan a "N 0 obj"', allOffsetsOk);
}

// Validar contenido de texto (acentos presentes como bytes latin1)
check('contiene texto con acentos (ñáéíóú)', txt.indexOf('ñáéíóú') !== -1);
check('contiene Ramón y Cajal', txt.indexOf('Ramón y Cajal') !== -1);

fs.unlinkSync('_sample.pdf');
console.log(ok ? '\nPDF VÁLIDO ✔' : '\nPDF INVÁLIDO ’');
process.exit(ok ? 0 : 1);