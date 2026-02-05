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

// ============================================================
// FUZZY MATCHING LOGIC FOR BANK NAMES
// ============================================================

class MatchResult {
    constructor(scores, finalScore, category) {
        this.scores = scores || {};
        this.finalScore = finalScore || 0;
        this.category = category || "NO_MATCH";
    }

    static noMatch() {
        return new MatchResult({}, 0, "NO_MATCH");
    }

    static strongMatch(score) {
        return new MatchResult({}, score, "STRONG_MATCH");
    }
}

class BestNameMatcher {
    static compare(rawName1, rawName2) {
        if (!rawName1 || !rawName2 || rawName1.trim() === "" || rawName2.trim() === "") {
            return MatchResult.noMatch();
        }

        const name1 = this.normalize(rawName1);
        const name2 = this.normalize(rawName2);

        if (name1 === name2) {
            return MatchResult.strongMatch(100);
        }

        const levenshtein = this.levenshteinScore(name1, name2);
        const jaroWinkler = this.jaroWinklerScore(name1, name2);
        const tokenSort = this.tokenSortScore(name1, name2);
        const tokenSet = this.tokenSetScore(name1, name2);
        const phonetic = this.phoneticScore(name1, name2);

        let finalScore = (
            levenshtein * 0.25 +
            jaroWinkler * 0.30 +
            tokenSort * 0.20 +
            tokenSet * 0.15 +
            phonetic * 0.10
        );

        finalScore = Math.round(finalScore * 100) / 100;

        return new MatchResult({
                LEVENSHTEIN: levenshtein,
                JARO_WINKLER: jaroWinkler,
                TOKEN_SORT: tokenSort,
                TOKEN_SET: tokenSet,
                PHONETIC: phonetic
            },
            finalScore,
            this.categorize(finalScore)
        );
    }

    static normalize(input) {
        input = input.toUpperCase();
        input = input.replace(/[^A-Z ]/g, "");
        input = input.replace(/\s+/g, " ").trim();
        return input;
    }

    static levenshteinScore(s, t) {
        const dp = Array(s.length + 1).fill(null).map(() => Array(t.length + 1).fill(0));

        for (let i = 0; i <= s.length; i++) dp[i][0] = i;
        for (let j = 0; j <= t.length; j++) dp[0][j] = j;

        for (let i = 1; i <= s.length; i++) {
            for (let j = 1; j <= t.length; j++) {
                const cost = s[i - 1] === t[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );
            }
        }

        const distance = dp[s.length][t.length];
        const maxLen = Math.max(s.length, t.length);

        return maxLen === 0 ? 100 : (1.0 - distance / maxLen) * 100;
    }

    static jaroWinklerScore(s1, s2) {
        const jaro = this.jaroSimilarity(s1, s2);

        let prefix = 0;
        const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
        for (let i = 0; i < maxPrefix; i++) {
            if (s1[i] === s2[i]) {
                prefix++;
            } else {
                break;
            }
        }

        return (jaro + prefix * 0.1 * (1 - jaro)) * 100;
    }

    static jaroSimilarity(s1, s2) {
        if (s1 === s2) return 1.0;

        const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;

        const s1Matches = new Array(s1.length).fill(false);
        const s2Matches = new Array(s2.length).fill(false);

        let matches = 0;

        for (let i = 0; i < s1.length; i++) {
            const start = Math.max(0, i - matchDistance);
            const end = Math.min(i + matchDistance + 1, s2.length);

            for (let j = start; j < end; j++) {
                if (s2Matches[j] || s1[i] !== s2[j]) continue;
                s1Matches[i] = true;
                s2Matches[j] = true;
                matches++;
                break;
            }
        }

        if (matches === 0) return 0;

        let transpositions = 0;
        let k = 0;

        for (let i = 0; i < s1.length; i++) {
            if (!s1Matches[i]) continue;
            while (!s2Matches[k]) k++;
            if (s1[i] !== s2[k]) transpositions++;
            k++;
        }

        transpositions /= 2.0;

        return (
            matches / s1.length +
            matches / s2.length +
            (matches - transpositions) / matches
        ) / 3.0;
    }

    static tokenSortScore(s1, s2) {
        const t1 = s1.split(' ').sort().join(' ');
        const t2 = s2.split(' ').sort().join(' ');
        return this.levenshteinScore(t1, t2);
    }

    static tokenSetScore(s1, s2) {
        const set1 = new Set(s1.split(' '));
        const set2 = new Set(s2.split(' '));

        const intersection = [...set1].filter(x => set2.has(x));
        const diff1 = [...set1].filter(x => !set2.has(x));
        const diff2 = [...set2].filter(x => !set1.has(x));

        const a = [...intersection, ...diff1].join(' ');
        const b = [...intersection, ...diff2].join(' ');

        return this.levenshteinScore(a, b);
    }

    static phoneticScore(s1, s2) {
        return this.soundex(s1) === this.soundex(s2) ? 100 : 0;
    }

    static soundex(s) {
        if (!s || s.trim() === "") return "";

        s = s.toUpperCase().replace(/[^A-Z]/g, "");
        if (s.length === 0) return "";

        const first = s[0];

        // Map characters to soundex digits
        let encoded = s;
        // Replace vowels and similar sounding letters
        encoded = encoded.replace(/[AEIOUYHW]/g, "0");
        encoded = encoded.replace(/[BFPV]/g, "1");
        encoded = encoded.replace(/[CGJKQSXZ]/g, "2");
        encoded = encoded.replace(/[DT]/g, "3");
        encoded = encoded.replace(/[L]/g, "4");
        encoded = encoded.replace(/[MN]/g, "5");
        encoded = encoded.replace(/[R]/g, "6");

        // Remove consecutive duplicates
        encoded = encoded.replace(/(.)\1+/g, "$1");

        // Remove zeros
        encoded = encoded.replace(/0/g, "");

        // Get the rest after first character
        const rest = encoded.substring(1);

        // Combine first letter with encoded part and pad
        const result = (first + rest + "000").substring(0, 4);
        return result;
    }

    static categorize(score) {
        if (score >= 85) return "STRONG_MATCH";
        if (score >= 70) return "POSSIBLE_MATCH";
        if (score >= 60) return "WEAK_MATCH";
        return "NO_MATCH";
    }
}

// ---------------- STEP 10: APPLY FUZZY MATCHING TO BANK NAMES ----------------
function applyFuzzyMatchingToBankNames(sortedFile) {
    return new Promise((resolve, reject) => {
        const rows = [];

        const rl = readline.createInterface({
            input: fs.createReadStream(sortedFile),
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            if (!line.trim()) return;
            const fields = line.split(',');

            const micr = (fields[0] || '').trim();
            const ifsc = (fields[1] || '').trim();
            const bankName = (fields[2] || '').trim();
            const micrLen = (fields[3] || '').trim();
            const ifscLen = (fields[4] || '').trim();

            rows.push({ micr, ifsc, bankName, micrLen, ifscLen, originalLine: line });
        });

        rl.on('close', () => {
            console.log(`\n=== FUZZY MATCHING PROCESS ===`);
            console.log(`Total records to process: ${rows.length}`);

            // Group similar bank names
            const bankGroups = new Map();
            const correctedBankNames = new Map(); // Maps original -> corrected

            rows.forEach((row, index) => {
                const currentBankName = row.bankName;

                // Check if this bank name has already been assigned to a group
                if (correctedBankNames.has(currentBankName)) {
                    return;
                }

                let bestMatch = null;
                let bestScore = 0;

                // Compare with all existing group representatives
                for (const [groupName, members] of bankGroups.entries()) {
                    const matchResult = BestNameMatcher.compare(currentBankName, groupName);

                    if (matchResult.finalScore > bestScore && matchResult.finalScore >= 70) {
                        bestScore = matchResult.finalScore;
                        bestMatch = groupName;
                    }
                }

                if (bestMatch) {
                    // Add to existing group
                    bankGroups.get(bestMatch).push(row);
                    correctedBankNames.set(currentBankName, bestMatch);
                } else {
                    // Create new group
                    bankGroups.set(currentBankName, [row]);
                    correctedBankNames.set(currentBankName, currentBankName);
                }
            });

            console.log(`Unique bank name groups identified: ${bankGroups.size}`);
            console.log(`Original unique bank names: ${new Set(rows.map(r => r.bankName)).size}`);

            // Generate corrected bank names CSV
            const correctedStream = fs.createWriteStream('bank_names_corrected.csv');
            correctedStream.write('MICR,IFSC,OriginalBankName,CorrectedBankName,MatchScore,MICR_Length,IFSC_Length\n');

            rows.forEach(row => {
                const correctedName = correctedBankNames.get(row.bankName);
                const matchScore = row.bankName === correctedName ? 100 :
                    BestNameMatcher.compare(row.bankName, correctedName).finalScore;

                correctedStream.write(
                    `${row.micr},${row.ifsc},"${row.bankName}","${correctedName}",${matchScore},${row.micrLen},${row.ifscLen}\n`
                );
            });
            correctedStream.end();

            // Generate only corrected bank names mapping
            const onlyCorrectedStream = fs.createWriteStream('only_corrected_bank_names.csv');
            onlyCorrectedStream.write('OriginalBankName,CorrectedBankName,RecordCount\n');

            const nameCounts = new Map();
            rows.forEach(row => {
                const original = row.bankName;
                nameCounts.set(original, (nameCounts.get(original) || 0) + 1);
            });

            const uniqueOriginals = new Set(correctedBankNames.keys());
            for (const original of uniqueOriginals) {
                const corrected = correctedBankNames.get(original);
                const count = nameCounts.get(original) || 0;
                onlyCorrectedStream.write(`"${original}","${corrected}",${count}\n`);
            }
            onlyCorrectedStream.end();

            // Generate exact matches report
            const exactMatchesStream = fs.createWriteStream('exact_matches_report.csv');
            exactMatchesStream.write('BankName,RecordCount,UniqueIFSCCodes,UniqueMICRCodes\n');

            for (const [groupName, members] of bankGroups.entries()) {
                const uniqueIFSC = new Set(members.map(m => m.ifsc));
                const uniqueMICR = new Set(members.map(m => m.micr));
                exactMatchesStream.write(`"${groupName}",${members.length},${uniqueIFSC.size},${uniqueMICR.size}\n`);
            }
            exactMatchesStream.end();

            // Generate detailed matching records with original sorted data
            const matchedRecordsStream = fs.createWriteStream('ifsc_matched_records.csv');
            matchedRecordsStream.write('MICR,IFSC,OriginalBankName,CorrectedBankName,MICR_Length,IFSC_Length\n');

            rows.forEach(row => {
                const correctedName = correctedBankNames.get(row.bankName);
                matchedRecordsStream.write(
                    `${row.micr},${row.ifsc},"${row.bankName}","${correctedName}",${row.micrLen},${row.ifscLen}\n`
                );
            });
            matchedRecordsStream.end();

            // Show sample corrections
            console.log('\n=== SAMPLE BANK NAME CORRECTIONS ===');
            let sampleCount = 0;
            for (const [original, corrected] of correctedBankNames.entries()) {
                if (original !== corrected && sampleCount < 10) {
                    const score = BestNameMatcher.compare(original, corrected).finalScore;
                    console.log(`"${original}" → "${corrected}" (Score: ${score.toFixed(2)})`);
                    sampleCount++;
                }
            }

            resolve({
                totalRecords: rows.length,
                uniqueGroups: bankGroups.size,
                originalUniqueNames: new Set(rows.map(r => r.bankName)).size,
                correctionsMade: Array.from(correctedBankNames.entries()).filter(([k, v]) => k !== v).length
            });
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

        // ---------------- STEP 10: FUZZY MATCHING ----------------
        const fuzzyResult = await applyFuzzyMatchingToBankNames('ifsc_micr_both_unmatched_sorted.csv');

        console.log('\n=====================================');
        console.log('FUZZY MATCHING RESULTS');
        console.log('=====================================');
        console.log('Total records processed:', fuzzyResult.totalRecords);
        console.log('Original unique bank names:', fuzzyResult.originalUniqueNames);
        console.log('After fuzzy matching - unique groups:', fuzzyResult.uniqueGroups);
        console.log('Bank names corrected:', fuzzyResult.correctionsMade);
        console.log('-------------------------------------');
        console.log('Files created:');
        console.log('  - bank_names_corrected.csv (Full details with corrections)');
        console.log('  - only_corrected_bank_names.csv (Mapping of corrections)');
        console.log('  - exact_matches_report.csv (Grouped bank summary)');
        console.log('  - ifsc_matched_records.csv (All matched records)');
        console.log('=====================================');

    } catch (e) {
        console.error(e.message);
    }
})();