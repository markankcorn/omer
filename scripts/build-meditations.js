const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'meditations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
function writeIfChanged(file, contents) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (existing === contents) return false;
  fs.writeFileSync(file, contents);
  return true;
}

const meditations = {};

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const match = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+\n([\s\S]*)$/);
  if (!match) continue;

  const dayMatch = match[1].match(/^day\s*=\s*(\d+)/m);
  if (!dayMatch) continue;

  const day = parseInt(dayMatch[1]);
  const body = match[2].trim();
  meditations[day] = body || null;
}

const out = path.join(__dirname, '..', 'public', 'meditations.json');
const moduleOut = path.join(__dirname, '..', 'src', 'generated', 'meditations-data.js');
const jsonContents = JSON.stringify(meditations);
const moduleContents =
  'const MEDITATIONS = ' + JSON.stringify(meditations, null, 2) + ';\n\nexport default MEDITATIONS;\n';

fs.mkdirSync(path.dirname(moduleOut), { recursive: true });
writeIfChanged(out, jsonContents);
writeIfChanged(moduleOut, moduleContents);
console.log(`Built meditations.json (${Object.values(meditations).filter(Boolean).length} of 49 with content)`);
