const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'meditations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();

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
fs.writeFileSync(out, JSON.stringify(meditations));
console.log(`Built meditations.json (${Object.values(meditations).filter(Boolean).length} of 49 with content)`);
