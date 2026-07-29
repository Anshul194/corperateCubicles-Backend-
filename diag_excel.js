import XLSX from 'xlsx';

const filePath = './Final list of ai course students-2.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log('Total Rows in Excel:', rows.length);

let noEmail = 0;
let invalidEmail = 0;
const processedEmails = new Set();
let duplicates = 0;
const validEmails = [];

for (const row of rows) {
    const email = (row['email'] || row['Email'] || row['EMAIL'] || '').toString().trim().toLowerCase();
    if (!email) {
        noEmail++;
        continue;
    }
    if (!email.includes('@')) {
        invalidEmail++;
        continue;
    }
    if (processedEmails.has(email)) {
        duplicates++;
        continue;
    }
    processedEmails.add(email);
    validEmails.push(email);
}

console.log('Rows with no email:', noEmail);
console.log('Rows with invalid email:', invalidEmail);
console.log('Duplicate emails:', duplicates);
console.log('Unique valid emails:', validEmails.length);
console.log('Total accounted for:', noEmail + invalidEmail + duplicates + validEmails.length);
