import XLSX from 'xlsx';

const excelPath = 'd:/nexprism/lms_backend/new_entries_only(2) (1).xlsx';

try {
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    rows.forEach((row, i) => {
        console.log(`${i + 1}: ${JSON.stringify(row)}`);
    });
} catch (err) {
    console.error('Error reading Excel:', err.message);
}
