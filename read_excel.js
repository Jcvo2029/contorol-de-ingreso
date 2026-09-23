const xlsx = require('xlsx');

const workbook = xlsx.readFile('d:\\EVIM\\Escritorio\\control de ingreso\\docuementos\\INVENTARIO DE COMPUTADORES_HARDWARE.xlsx');
const sheetName = workbook.SheetNames[1]; // second sheet
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

console.log(JSON.stringify(data, null, 2));
