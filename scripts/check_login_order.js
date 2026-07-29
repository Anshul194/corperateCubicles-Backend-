import XLSX from 'xlsx';
import path from 'path';

/**
 * Script to check who logged in first from an Excel file.
 * Usage: node check_login_order.js <path_to_excel_file>
 */

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Please provide the path to the Excel file.');
    console.error('Usage: node check_login_order.js <path_to_excel_file>');
    process.exit(1);
}

const excelPath = path.resolve(args[0]);

try {
    const workbook = XLSX.readFile(excelPath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
        console.log('The Excel file is empty.');
        process.exit(0);
    }

    // Identify all possible headers across all rows
    const allHeaders = new Set();
    rows.forEach(row => {
        Object.keys(row).forEach(key => allHeaders.add(key));
    });
    const headersList = Array.from(allHeaders);

    // Try to find a column that looks like a date or login time
    const timeColumn = headersList.find(h => 
        h.toLowerCase().includes('login') || 
        h.toLowerCase().includes('time') || 
        h.toLowerCase().includes('date') ||
        h.toLowerCase().includes('created')
    );

    if (!timeColumn) {
        console.error('Could not find a column related to login time or date.');
        console.log('Available columns:', headersList.join(', '));
        process.exit(1);
    }

    console.log(`Using column "${timeColumn}" for sorting.`);

    // Filter rows that have the time column
    const rowsWithTime = rows.filter(row => row[timeColumn]);
    const skippedRows = rows.length - rowsWithTime.length;

    // Sort rows by the identified time column
    const sortedRows = rowsWithTime.sort((a, b) => {
        const timeA = new Date(a[timeColumn]);
        const timeB = new Date(b[timeColumn]);
        return timeA - timeB;
    });

    console.log('\n--- Login Order Details ---');
    sortedRows.forEach((row, index) => {
        const dateVal = row[timeColumn];
        const formattedDate = dateVal instanceof Date ? dateVal.toLocaleString() : dateVal;
        
        console.log(`${index + 1}. ${row.Email || row.email || row.Name || row.name || 'Unknown'}`);
        console.log(`   Time: ${formattedDate}`);
        // Print other details if they exist
        const otherKeys = Object.keys(row).filter(k => k !== timeColumn && !['Email', 'email', 'Name', 'name'].includes(k));
        otherKeys.forEach(k => {
            console.log(`   ${k}: ${row[k]}`);
        });
        console.log('---------------------------');
    });

    console.log(`\nTotal users processed: ${sortedRows.length}`);
    if (skippedRows > 0) {
        console.log(`Note: ${skippedRows} rows were skipped because they lacked login/time data.`);
    }

} catch (err) {
    console.error('Error processing Excel file:', err.message);
}
