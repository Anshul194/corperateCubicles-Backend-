import XLSX from 'xlsx';

const filePath = 'd:\\nexprism\\lms_backend\\new_student_entries_all_data.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log('Total rows:', rows.length);
console.log('First 2 rows:', JSON.stringify(rows.slice(0, 2), null, 2));
