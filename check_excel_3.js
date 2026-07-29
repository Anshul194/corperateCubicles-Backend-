import XLSX from 'xlsx';

const filePath = './Final list of ai course students-3.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log('Sample Rows (first 5):');
console.log(JSON.stringify(rows.slice(0, 5), null, 2));

const columnNames = Object.keys(rows[0] || {});
console.log('\nColumn Names:', columnNames);
