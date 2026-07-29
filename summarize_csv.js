import fs from 'fs';

const content = fs.readFileSync('enrollment_results.csv', 'utf8');
const lines = content.split('\n').filter(l => l.trim());
const header = lines[0];
const dataLines = lines.slice(1);

console.log('Total Lines (including header):', lines.length);
console.log('Data Rows:', dataLines.length);

const summary = {
    primary: {},
    notes: {}
};

for (const line of dataLines) {
    const parts = line.split('","');
    if (parts.length < 4) continue;
    const primaryStr = parts[2].replace(/"/g, '');
    const notesStr = parts[4].replace(/"/g, '');

    summary.primary[primaryStr] = (summary.primary[primaryStr] || 0) + 1;
    if (notesStr) {
        summary.notes[notesStr] = (summary.notes[notesStr] || 0) + 1;
    }
}

console.log('Primary Course Column Counts:', JSON.stringify(summary.primary, null, 2));
console.log('Notes Column Counts:', JSON.stringify(summary.notes, null, 2));
