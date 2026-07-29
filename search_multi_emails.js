import XLSX from 'xlsx';

const filePath = './Final list of ai course students-3.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log('Searching for rows with multiple emails...');

for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const emailStr = (row['email'] || row['Email'] || row['EMAIL'] || '').toString();
    if (emailStr.includes(',') || emailStr.includes(';') || emailStr.includes(' ')) {
        console.log(`Row ${i + 2}: ${emailStr}`);
    }
}
