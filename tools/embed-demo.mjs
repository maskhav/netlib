// Вбудовує templates/**/*.tpl у docs/app.js як демо-бібліотеку (працює без репо і без мережі).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tpl') ? [p] : []; });
const demo = walk('templates').sort().map(p => ({ path: p.replace(/\\/g, '/'), raw: readFileSync(p, 'utf8') }));
const app = readFileSync('docs/app.js', 'utf8').replace(/const DEMO = \/\*DEMO\*\/.*?;\n/s, `const DEMO = /*DEMO*/${JSON.stringify(demo)};\n`);
writeFileSync('docs/app.js', app);
console.log(`demo: ${demo.length} шаблонів`);
