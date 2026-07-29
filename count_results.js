import fs from 'fs';

const content = fs.readFileSync('enrollment_results.csv', 'utf8');

const count = (regex) => (content.match(regex) || []).length;

console.log('Already Enrolled (Total matches):', count(/Already Enrolled/g));
console.log('Enrolled (Total matches):', count(/\"Enrolled\"/g));
console.log('Re-activated (Total matches):', count(/Re-activated/g));
console.log('Skipped (Total matches):', count(/skipped/g));

// Unique count per line (naive)
const lines = content.split('\n');
let enrolledCount = 0;
for (const line of lines) {
    if (line.includes('"Enrolled"')) enrolledCount++;
}
console.log('Rows with "Enrolled":', enrolledCount);
