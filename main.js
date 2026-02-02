const fs = require('fs');
const path = require('path');
const readline = require('readline');
const csv = require('csv-parser');
const xlsx = require('xlsx');

/* =========================================================
   STEP 1 — READ FILE (EXCEL / JSON ONLY)
   ========================================================= */
function readBankFile(filePath) {
    return new Promise((resolve, reject) => {
        const ext = path.extname(filePath).toLowerCase();

        if (!fs.existsSync(filePath)) {
            return reject(new Error('File does not exist'));
        }

        if (ext === '.xlsx' || ext === '.xls') {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            resolve(data);
        } else if (ext === '.json') {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            resolve(data);
        } else {
            reject(new Error('Unsupported file format'));
        }
    });
}

/* =========================================================
   STEP 1 — FILTER CSV + SAVE VALID & INVALID
   ========================================================= */
function filterCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        let totalRecords = 0;
        let correctRecords = 0;
        let incorrectRecords = 0;

        const outputFile = 'invalid_records.csv';
        const validRecordsFile = 'valid_records.csv';

        const writeStream = fs.createWriteStream(outputFile);
        const validStream = fs.createWriteStream(validRecordsFile);

        const rl = readline.createInterface({
            input: fs.createReadStream(filePath),
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            if (!line.trim()) return;
            totalRecords++;

            const fields = line.split(',');
            const micr = (fields[0] || '').trim();
            const ifsc = (fields[1] || '').trim();

            if (/^.{9}$/.test(micr) && /^.{11}$/.test(ifsc)) {
                correctRecords++;
                validStream.write(line + '\n');
            } else {
                incorrectRecords++;
                writeStream.write(line + '\n');
            }
        });

        rl.on('close', () => {
            writeStream.end();
            validStream.end();
            resolve({ totalRecords, correctRecords, incorrectRecords, validRecordsFile, outputFile });
        });

        rl.on('error', reject);
    });
}

/* =========================================================
   STEP 1 — FILTER EXCEL / JSON
   ========================================================= */
function filterArrayData(records) {
    let totalRecords = records.length;
    let correctRecords = 0;
    let incorrectRecords = 0;

    const outputFile = 'invalid_records.csv';
    const validRecordsFile = 'valid_records.csv';

    const invalidStream = fs.createWriteStream(outputFile);
    const validStream = fs.createWriteStream(validRecordsFile);

    records.forEach((row) => {
        const micr = (row[0] || '').toString().trim();
        const ifsc = (row[1] || '').toString().trim();

        if (/^.{9}$/.test(micr) && /^.{11}$/.test(ifsc)) {
            correctRecords++;
            validStream.write(row.join(',') + '\n');
        } else {
            incorrectRecords++;
            invalidStream.write(row.join(',') + '\n');
        }
    });

    invalidStream.end();
    validStream.end();

    return { totalRecords, correctRecords, incorrectRecords, validRecordsFile, outputFile };
}

/* =========================================================
   INPUT
   ========================================================= */
function getFilePathFromUser(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

/* =========================================================
   STEP 2 — LOAD BANK MAPPING FILE
   ========================================================= */
async function getAndLoadBankMappingFile() {
    const filePath = await getFilePathFromUser('Enter Bank Mapping file path: ');
    const ext = path.extname(filePath).toLowerCase();

    if (['.csv', '.001', '.txt', '.dat'].includes(ext)) {
        return new Promise((resolve, reject) => {
            const records = [];
            const rl = readline.createInterface({ input: fs.createReadStream(filePath) });
            rl.on('line', line => { if (line.trim()) records.push(line.split('~')); });
            rl.on('close', () => resolve(records));
            rl.on('error', reject);
        });
    }

    if (ext === '.xlsx' || ext === '.xls') {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return xlsx.utils.sheet_to_json(sheet, { header: 1 });
    }

    throw new Error('Unsupported Bank Mapping format');
}

/* =========================================================
   STEP 3 — COMPARE IFSC + MICR
   ========================================================= */
function compareIfscAndMicrWithBankMapping(validFile, bankMappingData) {
    return new Promise((resolve, reject) => {

        const ifscMatched = fs.createWriteStream('ifsc_matched.csv');
        const ifscUnmatched = fs.createWriteStream('ifsc_unmatched.csv');
        const micrMatched = fs.createWriteStream('micr_matched.csv');
        const micrUnmatched = fs.createWriteStream('micr_unmatched.csv');
        const ifscMissingMicrPresent = fs.createWriteStream('ifsc_missing_micr_present.csv');
        const micrMissingIfscPresent = fs.createWriteStream('micr_missing_ifsc_present.csv');
        const bothUnmatched = fs.createWriteStream('ifsc_micr_both_unmatched.csv');

        const ifscSet = new Set();
        const micrSet = new Set();

        console.log(`\n=== BANK MAPPING DEBUG ===`);
        console.log(`Total bank mapping records: ${bankMappingData.length}`);
        
        // Show first 3 records to verify format
        if (bankMappingData.length > 0) {
            console.log(`\nFirst 3 raw records after split:`);
            for (let i = 0; i < Math.min(3, bankMappingData.length); i++) {
                const row = bankMappingData[i];
                console.log(`  Row ${i}: Fields=${row.length}, [0]="${row[0]}" [1]="${row[1]}" [2]="${row[2]}"`);
            }
        }

        bankMappingData.forEach(row => {
            const ifsc = (row[1] || '').toString().trim();
            const micr = (row[2] || '').toString().trim();
            if (ifsc.length === 11) ifscSet.add(ifsc);
            if (micr.length === 9) micrSet.add(micr);
        });
        
        console.log(`\nIFSC codes loaded: ${ifscSet.size}`);
        console.log(`MICR codes loaded: ${micrSet.size}`);
        if (ifscSet.size > 0) {
            console.log(`Sample IFSC codes: ${Array.from(ifscSet).slice(0, 5).join(', ')}`);
        }
        if (micrSet.size > 0) {
            console.log(`Sample MICR codes: ${Array.from(micrSet).slice(0, 5).join(', ')}`);
        }
        
        // Check if specific test codes exist
        console.log(`\nTest lookups:`);
        console.log(`  Does SBIN0005076 exist? ${ifscSet.has('SBIN0005076')}`);
        console.log(`  Does 400002001 exist? ${micrSet.has('400002001')}`);
        console.log(`=========================\n`);

        let iM = 0,
            iU = 0,
            mM = 0,
            mU = 0,
            ifscMissingMicrPresentCount = 0,
            micrMissingIfscPresentCount = 0,
            bothMissingCount = 0;

        const rl = readline.createInterface({ input: fs.createReadStream(validFile) });

        let lineCount = 0;
        rl.on('line', line => {
            lineCount++;
            const f = line.split(',');
            const micr = (f[0] || '').trim();
            const ifsc = (f[1] || '').trim();
            
            // Debug first 3 records
            if (lineCount <= 3) {
                console.log(`\nValid record ${lineCount}:`);
                console.log(`  Raw line: "${line}"`);
                console.log(`  MICR=[0]: "${micr}" (length: ${micr.length})`);
                console.log(`  IFSC=[1]: "${ifsc}" (length: ${ifsc.length})`);
                console.log(`  IFSC exists in mapping: ${ifscSet.has(ifsc)}`);
                console.log(`  MICR exists in mapping: ${micrSet.has(micr)}`);
            }

            const ifscExists = ifscSet.has(ifsc);
            const micrExists = micrSet.has(micr);

            // Count individual matches
            if (ifscExists) iM++;
            else iU++;

            if (micrExists) mM++;
            else mU++;

            // Categorize based on combination
            if (ifscExists && micrExists) {
                // Both matched
                ifscMatched.write(line + '\n');
                micrMatched.write(line + '\n');
            } else if (!ifscExists && micrExists) {
                // IFSC missing but MICR present
                ifscMissingMicrPresentCount++;
                ifscMissingMicrPresent.write(line + '\n');
                ifscUnmatched.write(line + '\n');
                micrMatched.write(line + '\n');
            } else if (ifscExists && !micrExists) {
                // MICR missing but IFSC present
                micrMissingIfscPresentCount++;
                micrMissingIfscPresent.write(line + '\n');
                ifscMatched.write(line + '\n');
                micrUnmatched.write(line + '\n');
            } else {
                // Both missing
                bothMissingCount++;
                bothUnmatched.write(line + '\n');
                ifscUnmatched.write(line + '\n');
                micrUnmatched.write(line + '\n');
            }
        });

        rl.on('close', () => {
            ifscMatched.end();
            ifscUnmatched.end();
            micrMatched.end();
            micrUnmatched.end();
            ifscMissingMicrPresent.end();
            micrMissingIfscPresent.end();
            bothUnmatched.end();
            resolve({
                iM,
                iU,
                mM,
                mU,
                ifscMissingMicrPresentCount,
                micrMissingIfscPresentCount,
                bothMissingCount
            });
        });

        rl.on('error', reject);
    });
}
// ---------------- STEP 4: IFSC + MICR BOTH NOT FOUND ----------------
function findFullyUnmatchedRecords(validRecordsFilePath, bankMappingData) {
    return new Promise((resolve, reject) => {

        const outputFile = 'ifsc_micr_both_unmatched.csv';
        const outputStream = fs.createWriteStream(outputFile);

        // Build lookup sets
        const ifscSet = new Set();
        const micrSet = new Set();

        bankMappingData.forEach(row => {
            const ifsc = (row[1] || '').toString().trim();
            const micr = (row[2] || '').toString().trim();
            if (ifsc.length === 11) ifscSet.add(ifsc);
            if (micr.length === 9) micrSet.add(micr);
        });

        let fullyUnmatched = 0;

        const rl = readline.createInterface({
            input: fs.createReadStream(validRecordsFilePath),
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            if (!line.trim()) return;

            const fields = line.split(',');
            const micr = (fields[0] || '').trim();
            const ifsc = (fields[1] || '').trim();

            const ifscExists = ifscSet.has(ifsc);
            const micrExists = micrSet.has(micr);

            // BOTH must be missing
            if (!ifscExists && !micrExists) {
                fullyUnmatched++;
                outputStream.write(line + '\n');
            }
        });

        rl.on('close', () => {
            outputStream.end();
            resolve({
                fullyUnmatched,
                outputFile
            });
        });

        rl.on('error', reject);
    });
}
// ---------------- STEP 6: IFSC UNMATCHED ∩ BOTH UNMATCHED ----------------
function findWorstIfscFailures(ifscUnmatchedFile, bothUnmatchedFile) {
    return new Promise((resolve, reject) => {

        const outputFile = 'worst_ifsc_failures.csv';
        const outputStream = fs.createWriteStream(outputFile);

        // Load all IFSC from BOTH-unmatched file
        const bothIfscSet = new Set();

        const rlBoth = readline.createInterface({
            input: fs.createReadStream(bothUnmatchedFile),
            crlfDelay: Infinity
        });

        rlBoth.on('line', (line) => {
            if (!line.trim()) return;
            const fields = line.split(',');
            const ifsc = (fields[1] || '').trim();
            bothIfscSet.add(ifsc);
        });

        rlBoth.on('close', () => {

            let worstCount = 0;

            const rlIfsc = readline.createInterface({
                input: fs.createReadStream(ifscUnmatchedFile),
                crlfDelay: Infinity
            });

            rlIfsc.on('line', (line) => {
                if (!line.trim()) return;

                const fields = line.split(',');
                const ifsc = (fields[1] || '').trim();

                if (bothIfscSet.has(ifsc)) {
                    worstCount++;
                    outputStream.write(line + '\n');
                }
            });

            rlIfsc.on('close', () => {
                outputStream.end();
                resolve({
                    worstCount,
                    outputFile
                });
            });

            rlIfsc.on('error', reject);
        });

        rlBoth.on('error', reject);
    });
}
// ---------------- STEP 8: IFSC UNMATCHED BUT NOT IN BOTH-MISSING ----------------
function findIfscMissingButMicrPresent(ifscUnmatchedFile, bothMissingFile) {
    return new Promise((resolve, reject) => {

        const outputFile = 'ifsc_missing_but_micr_present.csv';
        const outputStream = fs.createWriteStream(outputFile);

        const bothMissingIfscSet = new Set();

        // Load IFSCs from IFSC+MICR both missing
        const rlBoth = readline.createInterface({
            input: fs.createReadStream(bothMissingFile),
            crlfDelay: Infinity
        });

        rlBoth.on('line', (line) => {
            if (!line.trim()) return;
            const fields = line.split(',');
            const ifsc = (fields[1] || '').trim();
            if (ifsc) bothMissingIfscSet.add(ifsc);
        });

        rlBoth.on('close', () => {

            let count = 0;

            // Scan IFSC unmatched
            const rlIfsc = readline.createInterface({
                input: fs.createReadStream(ifscUnmatchedFile),
                crlfDelay: Infinity
            });

            rlIfsc.on('line', (line) => {
                if (!line.trim()) return;

                const fields = line.split(',');
                const ifsc = (fields[1] || '').trim();

                // Not in both-missing → MICR exists
                if (!bothMissingIfscSet.has(ifsc)) {
                    count++;
                    outputStream.write(line + '\n');
                }
            });

            rlIfsc.on('close', () => {
                outputStream.end();
                resolve({ count, outputFile });
            });

            rlIfsc.on('error', reject);
        });

        rlBoth.on('error', reject);
    });
}
// ---------------- STEP 9: SORT BOTH-UNMATCHED FILE BY IFSC ----------------
function sortByIfsc(inputFile, outputFile) {
    return new Promise((resolve, reject) => {

        const rows = [];

        const rl = readline.createInterface({
            input: fs.createReadStream(inputFile),
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            if (!line.trim()) return;
            const fields = line.split(',');
            const ifsc = (fields[1] || '').trim(); // IFSC is 2nd column (index 1)
            rows.push({ ifsc, line });
        });

        rl.on('close', () => {
            rows.sort((a, b) => a.ifsc.localeCompare(b.ifsc));

            const out = fs.createWriteStream(outputFile);
            for (const r of rows) out.write(r.line + '\n');
            out.end();

            resolve(rows.length);
        });

        rl.on('error', reject);
    });
}



/* =========================================================
   MAIN
   ========================================================= */
(async() => {
    try {
        const filePath = await getFilePathFromUser('Enter Input File: ');
        const ext = path.extname(filePath).toLowerCase();

        const result = ext === '.csv' ?
            await filterCsvFile(filePath) :
            filterArrayData(await readBankFile(filePath));

        console.log(result);

        const bankMappingData = await getAndLoadBankMappingFile();

        const cmp = await compareIfscAndMicrWithBankMapping(
            result.validRecordsFile,
            bankMappingData
        );
        // ---------------- STEP 9 ----------------
        const sortedCount = await sortByIfsc(
            'ifsc_micr_both_unmatched.csv',
            'ifsc_micr_both_unmatched_sorted.csv'
        );

        console.log('\nIFSC matched:', cmp.iM);
        console.log('IFSC unmatched:', cmp.iU);
        console.log('MICR matched:', cmp.mM);
        console.log('MICR unmatched:', cmp.mU);

        console.log('\n-------------------------------------');
        console.log('IFSC missing but MICR present:', cmp.ifscMissingMicrPresentCount);
        console.log('MICR missing but IFSC present:', cmp.micrMissingIfscPresentCount);
        console.log('Records with IFSC & MICR BOTH missing:', cmp.bothMissingCount);
        console.log('-------------------------------------');
        console.log('Files created:');
        console.log('  - ifsc_missing_micr_present.csv');
        console.log('  - micr_missing_ifsc_present.csv');
        console.log('  - ifsc_micr_both_unmatched.csv');
        console.log('\n-------------------------------------');
        console.log('Sorted IFSC & MICR both-missing records:', sortedCount);
        console.log('-------------------------------------');
        console.log('Sorted file → ifsc_micr_both_unmatched_sorted.csv');

    } catch (e) {
        console.error(e.message);
    }
})();