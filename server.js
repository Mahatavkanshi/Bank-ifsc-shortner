const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const readlineSync = require('readline');
const csv = require('csv-parser');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /csv|xlsx|xls|json|txt|dat|001/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type. Only CSV, Excel, JSON, TXT, DAT, and .001 files are allowed.'));
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Import processing functions from logic/processor.js
const {
    readBankFile,
    loadBankMappingFile,
    filterCsvFile,
    filterArrayData,
    compareIfscAndMicrWithBankMapping,
    sortByIfsc,
    applyFuzzyMatchingToBankNames
} = require('./logic/processor');

/* =========================================================
   BACKUP FUNCTION - Preserve old data before processing
   ========================================================= */

/**
 * Clean up old backups (older than 7 days)
 */
function cleanupOldBackups() {
    const backupDir = path.join(__dirname, 'backups');

    if (!fs.existsSync(backupDir)) {
        return 0;
    }

    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    let deletedCount = 0;

    // Extract unique timestamps from backup files
    const timestamps = new Set();
    files.forEach(file => {
        const match = file.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
        if (match) {
            timestamps.add(match[1]);
        }
    });

    timestamps.forEach(timestamp => {
        try {
            // Parse the timestamp back to Date
            const backupDate = new Date(timestamp.replace(/-/g, ':').replace('T', ' '));
            const age = now - backupDate.getTime();

            // If backup is older than 1 week, delete all files with that timestamp
            if (age > oneWeekInMs) {
                const filesToDelete = files.filter(f => f.includes(timestamp));

                filesToDelete.forEach(file => {
                    const filePath = path.join(backupDir, file);
                    try {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    } catch (error) {
                        console.warn(`⚠️ Failed to delete ${file}:`, error.message);
                    }
                });

                const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
                console.log(`🗑️ Deleted ${filesToDelete.length} files from backup ${timestamp} (${daysOld} days old)`);
            }
        } catch (error) {
            console.warn(`⚠️ Error processing timestamp ${timestamp}:`, error.message);
        }
    });

    if (deletedCount > 0) {
        console.log(`✅ Cleanup complete: Removed ${deletedCount} old backup files`);
    }

    return deletedCount;
}

/**
 * Backup existing CSV files before new processing
 * Automatically cleans up backups older than 1 week
 */
function backupExistingFiles() {
    const backupDir = path.join(__dirname, 'backups');

    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    // First, clean up old backups (older than 7 days)
    console.log('🧹 Checking for old backups to clean up...');
    const deletedCount = cleanupOldBackups();

    // Files to backup
    const filesToBackup = [
        'invalid_records.csv',
        'valid_records.csv',
        'ifsc_matched.csv',
        'ifsc_unmatched.csv',
        'micr_matched.csv',
        'micr_unmatched.csv',
        'ifsc_missing_micr_present.csv',
        'micr_missing_ifsc_present.csv',
        'ifsc_micr_both_unmatched.csv',
        'ifsc_micr_both_unmatched_sorted.csv',
        'bank_names_corrected.csv',
        'only_corrected_bank_names.csv',
        'exact_matches_report.csv',
        'ifsc_matched_records.csv'
    ];

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    let backedUpCount = 0;

    filesToBackup.forEach(filename => {
        const sourcePath = path.join(__dirname, filename);

        // Only backup if file exists and has content
        if (fs.existsSync(sourcePath)) {
            const stats = fs.statSync(sourcePath);
            if (stats.size > 100) { // Only backup files larger than 100 bytes (more than just headers)
                const backupFilename = `${path.parse(filename).name}_${timestamp}${path.parse(filename).ext}`;
                const destPath = path.join(backupDir, backupFilename);

                try {
                    fs.copyFileSync(sourcePath, destPath);
                    backedUpCount++;
                    console.log(`📦 Backed up: ${filename} → backups/${backupFilename}`);
                } catch (error) {
                    console.warn(`⚠️ Failed to backup ${filename}:`, error.message);
                }
            }
        }
    });

    if (backedUpCount > 0) {
        console.log(`✅ Backed up ${backedUpCount} files to backups/ folder`);
    } else {
        console.log('ℹ️ No existing files to backup');
    }

    return { backedUpCount, deletedCount };
}

/* =========================================================
   API ROUTES
   ========================================================= */

// API root endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'Bank IFSC/MICR Processing API',
        version: '1.0.0',
        endpoints: {
            health: 'GET /api/health',
            uploadInput: 'POST /api/upload/input',
            uploadBankMapping: 'POST /api/upload/bank-mapping',
            compare: 'POST /api/compare',
            fuzzyMatch: 'POST /api/fuzzy-match',
            processAll: 'POST /api/process-all',
            listFiles: 'GET /api/files',
            download: 'GET /api/download/:filename',
            cleanup: 'DELETE /api/cleanup'
        }
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Upload and process input file
app.post('/api/upload/input', upload.single('inputFile'), async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const ext = path.extname(filePath).toLowerCase();

        let result;
        if (ext === '.csv' || ext === '.txt' || ext === '.dat' || ext === '.001') {
            result = await filterCsvFile(filePath);
        } else {
            const data = await readBankFile(filePath);
            result = filterArrayData(data);
        }

        res.json({
            success: true,
            message: 'File processed successfully',
            data: result,
            uploadedFile: req.file.originalname
        });

    } catch (error) {
        console.error('Error processing input file:', error);
        res.status(500).json({
            error: 'Failed to process file',
            message: error.message
        });
    }
});

// Upload and process bank mapping file
app.post('/api/upload/bank-mapping', upload.single('bankMappingFile'), async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const ext = path.extname(filePath).toLowerCase();

        const bankMappingData = await loadBankMappingFile(filePath);

        // Store in session or temp storage
        // For simplicity, storing in a temp file
        fs.writeFileSync('temp_bank_mapping.json', JSON.stringify(bankMappingData));

        res.json({
            success: true,
            message: 'Bank mapping file uploaded successfully',
            recordCount: bankMappingData.length,
            uploadedFile: req.file.originalname
        });

    } catch (error) {
        console.error('Error processing bank mapping file:', error);
        res.status(500).json({
            error: 'Failed to process bank mapping file',
            message: error.message
        });
    }
});

// Compare IFSC and MICR codes
app.post('/api/compare', async(req, res) => {
    try {
        const validRecordsFile = 'valid_records.csv';
        const bankMappingFile = 'temp_bank_mapping.json';

        if (!fs.existsSync(validRecordsFile)) {
            return res.status(400).json({
                error: 'No valid records found. Please upload and process input file first.'
            });
        }

        if (!fs.existsSync(bankMappingFile)) {
            return res.status(400).json({
                error: 'No bank mapping data found. Please upload bank mapping file first.'
            });
        }

        const bankMappingData = JSON.parse(fs.readFileSync(bankMappingFile, 'utf-8'));

        const comparisonResult = await compareIfscAndMicrWithBankMapping(
            validRecordsFile,
            bankMappingData
        );

        // Sort the both-unmatched file
        const sortedCount = await sortByIfsc(
            'ifsc_micr_both_unmatched.csv',
            'ifsc_micr_both_unmatched_sorted.csv'
        );

        res.json({
            success: true,
            message: 'Comparison completed successfully',
            data: {
                ifscMatched: comparisonResult.iM,
                ifscUnmatched: comparisonResult.iU,
                micrMatched: comparisonResult.mM,
                micrUnmatched: comparisonResult.mU,
                ifscMissingMicrPresent: comparisonResult.ifscMissingMicrPresentCount,
                micrMissingIfscPresent: comparisonResult.micrMissingIfscPresentCount,
                bothMissing: comparisonResult.bothMissingCount,
                sortedRecords: sortedCount
            },
            files: {
                ifscMatched: 'ifsc_matched.csv',
                ifscUnmatched: 'ifsc_unmatched.csv',
                micrMatched: 'micr_matched.csv',
                micrUnmatched: 'micr_unmatched.csv',
                ifscMissingMicrPresent: 'ifsc_missing_micr_present.csv',
                micrMissingIfscPresent: 'micr_missing_ifsc_present.csv',
                bothUnmatched: 'ifsc_micr_both_unmatched.csv',
                bothUnmatchedSorted: 'ifsc_micr_both_unmatched_sorted.csv'
            }
        });

    } catch (error) {
        console.error('Error during comparison:', error);
        res.status(500).json({
            error: 'Comparison failed',
            message: error.message
        });
    }
});

// Apply fuzzy matching to bank names
app.post('/api/fuzzy-match', async(req, res) => {
    try {
        const sortedFile = 'ifsc_micr_both_unmatched_sorted.csv';

        if (!fs.existsSync(sortedFile)) {
            return res.status(400).json({
                error: 'Sorted file not found. Please run comparison first.'
            });
        }

        const fuzzyResult = await applyFuzzyMatchingToBankNames(sortedFile);

        res.json({
            success: true,
            message: 'Fuzzy matching completed successfully',
            data: {
                totalRecords: fuzzyResult.totalRecords,
                originalUniqueNames: fuzzyResult.originalUniqueNames,
                uniqueGroups: fuzzyResult.uniqueGroups,
                correctionsMade: fuzzyResult.correctionsMade
            },
            files: {
                bankNamesCorrected: 'bank_names_corrected.csv',
                onlyCorrectedNames: 'only_corrected_bank_names.csv',
                exactMatchesReport: 'exact_matches_report.csv',
                matchedRecords: 'ifsc_matched_records.csv'
            }
        });

    } catch (error) {
        console.error('Error during fuzzy matching:', error);
        res.status(500).json({
            error: 'Fuzzy matching failed',
            message: error.message
        });
    }
});

// Process complete workflow
app.post('/api/process-all', upload.fields([
    { name: 'inputFile', maxCount: 1 },
    { name: 'bankMappingFile', maxCount: 1 }
]), async(req, res) => {
    try {
        if (!req.files || !req.files.inputFile || !req.files.bankMappingFile) {
            return res.status(400).json({
                error: 'Both input file and bank mapping file are required'
            });
        }

        console.log('\n🔄 Starting new processing workflow...');

        // Backup existing files before processing and clean up old backups
        const backupResult = backupExistingFiles();

        const inputFilePath = req.files.inputFile[0].path;
        const bankMappingFilePath = req.files.bankMappingFile[0].path;

        console.log(`📂 Input file: ${path.basename(inputFilePath)}`);
        console.log(`📂 Bank mapping: ${path.basename(bankMappingFilePath)}`);

        // Step 1: Process input file
        const ext = path.extname(inputFilePath).toLowerCase();
        let filterResult;

        if (ext === '.csv' || ext === '.txt' || ext === '.dat' || ext === '.001') {
            filterResult = await filterCsvFile(inputFilePath);
        } else {
            const data = await readBankFile(inputFilePath);
            filterResult = filterArrayData(data);
        }

        // Step 2: Load bank mapping
        const bankMappingData = await loadBankMappingFile(bankMappingFilePath);

        // Step 3: Compare IFSC and MICR
        const comparisonResult = await compareIfscAndMicrWithBankMapping(
            filterResult.validRecordsFile,
            bankMappingData
        );

        // Step 4: Sort results
        const sortedCount = await sortByIfsc(
            'ifsc_micr_both_unmatched.csv',
            'ifsc_micr_both_unmatched_sorted.csv'
        );

        // Step 5: Apply fuzzy matching
        const fuzzyResult = await applyFuzzyMatchingToBankNames(
            'ifsc_micr_both_unmatched_sorted.csv'
        );

        res.json({
            success: true,
            message: 'Complete processing workflow finished successfully',
            data: {
                filtering: filterResult,
                comparison: {
                    ifscMatched: comparisonResult.iM,
                    ifscUnmatched: comparisonResult.iU,
                    micrMatched: comparisonResult.mM,
                    micrUnmatched: comparisonResult.mU,
                    ifscMissingMicrPresent: comparisonResult.ifscMissingMicrPresentCount,
                    micrMissingIfscPresent: comparisonResult.micrMissingIfscPresentCount,
                    bothMissing: comparisonResult.bothMissingCount,
                    sortedRecords: sortedCount
                },
                fuzzyMatching: fuzzyResult,
                backup: {
                    filesBackedUp: backupResult.backedUpCount,
                    oldFilesDeleted: backupResult.deletedCount
                }
            }
        });

    } catch (error) {
        console.error('Error in complete processing:', error);
        res.status(500).json({
            error: 'Processing failed',
            message: error.message
        });
    }
});

// Get list of available backup timestamps
app.get('/api/backups', (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'backups');

        console.log('📦 Fetching backups from:', backupDir);

        if (!fs.existsSync(backupDir)) {
            console.log('⚠️ Backups directory does not exist');
            return res.json({ backups: [] });
        }

        const files = fs.readdirSync(backupDir);
        console.log(`📁 Found ${files.length} files in backups folder`);

        // Extract unique timestamps from backup files
        const timestamps = new Set();
        files.forEach(file => {
            const match = file.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
            if (match) {
                timestamps.add(match[1]);
                console.log(`✅ Extracted timestamp: ${match[1]} from ${file}`);
            } else {
                console.log(`❌ No timestamp match in: ${file}`);
            }
        });

        console.log(`🕒 Total unique timestamps found: ${timestamps.size}`);

        const backupList = Array.from(timestamps).map(timestamp => {
            const filesInBackup = files.filter(f => f.includes(timestamp));
            return {
                timestamp,
                displayTime: new Date(timestamp.replace(/-/g, ':').replace('T', ' ')).toLocaleString(),
                fileCount: filesInBackup.length,
                files: filesInBackup
            };
        }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        console.log(`📋 Returning ${backupList.length} backup sets`);
        res.json({ backups: backupList });

    } catch (error) {
        console.error('Error retrieving backups:', error);
        res.status(500).json({
            error: 'Failed to retrieve backups',
            message: error.message
        });
    }
});

// Manual cleanup of old backups
app.delete('/api/backups/cleanup', (req, res) => {
    try {
        console.log('🧹 Manual cleanup requested...');
        const deletedCount = cleanupOldBackups();

        res.json({
            success: true,
            message: `Cleanup complete. Removed ${deletedCount} old backup files.`,
            deletedCount
        });

    } catch (error) {
        console.error('Error during manual cleanup:', error);
        res.status(500).json({
            error: 'Cleanup failed',
            message: error.message
        });
    }
});

// Get old data from a specific backup
app.get('/api/backups/:timestamp/:filename', (req, res) => {
    try {
        const { timestamp, filename } = req.params;
        const backupDir = path.join(__dirname, 'backups');

        // Reconstruct the backup filename
        const baseName = path.parse(filename).name;
        const ext = path.parse(filename).ext;
        const backupFilename = `${baseName}_${timestamp}${ext}`;
        const backupPath = path.join(backupDir, backupFilename);

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({
                error: 'Backup file not found'
            });
        }

        res.sendFile(backupPath);

    } catch (error) {
        console.error('Error retrieving backup file:', error);
        res.status(500).json({
            error: 'Failed to retrieve backup file',
            message: error.message
        });
    }
});

// Download generated files
app.get('/api/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const allowedFiles = [
            'invalid_records.csv',
            'valid_records.csv',
            'ifsc_matched.csv',
            'ifsc_unmatched.csv',
            'micr_matched.csv',
            'micr_unmatched.csv',
            'ifsc_missing_micr_present.csv',
            'micr_missing_ifsc_present.csv',
            'ifsc_micr_both_unmatched.csv',
            'ifsc_micr_both_unmatched_sorted.csv',
            'ifsc_unmatched_records.csv',
            'ifsc_unmatched_records_sorted.csv',
            'bank_names_corrected.csv',
            'only_corrected_bank_names.csv',
            'exact_matches_report.csv',
            'ifsc_matched_records.csv'
        ];

        if (!allowedFiles.includes(filename)) {
            return res.status(400).json({ error: 'Invalid file requested' });
        }

        const filePath = path.join(__dirname, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                // Don't send response here - headers already sent
                // Just log the error
            }
        });

    } catch (error) {
        console.error('Error in download:', error);
        // Only send error if headers not sent yet
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Download failed',
                message: error.message
            });
        }
    }
});

// List all generated files
app.get('/api/files', (req, res) => {
    try {
        const outputFiles = [
            'invalid_records.csv',
            'valid_records.csv',
            'ifsc_matched.csv',
            'ifsc_unmatched.csv',
            'micr_matched.csv',
            'micr_unmatched.csv',
            'ifsc_missing_micr_present.csv',
            'micr_missing_ifsc_present.csv',
            'ifsc_micr_both_unmatched.csv',
            'ifsc_micr_both_unmatched_sorted.csv',
            'bank_names_corrected.csv',
            'only_corrected_bank_names.csv',
            'exact_matches_report.csv',
            'ifsc_matched_records.csv'
        ];

        const availableFiles = outputFiles
            .filter(file => fs.existsSync(path.join(__dirname, file)))
            .map(file => {
                const stats = fs.statSync(path.join(__dirname, file));
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime
                };
            });

        res.json({
            success: true,
            files: availableFiles
        });

    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({
            error: 'Failed to list files',
            message: error.message
        });
    }
});

// Clean up generated files
app.delete('/api/cleanup', (req, res) => {
    try {
        const filesToDelete = [
            'invalid_records.csv',
            'valid_records.csv',
            'ifsc_matched.csv',
            'ifsc_unmatched.csv',
            'micr_matched.csv',
            'micr_unmatched.csv',
            'ifsc_missing_micr_present.csv',
            'micr_missing_ifsc_present.csv',
            'ifsc_micr_both_unmatched.csv',
            'ifsc_micr_both_unmatched_sorted.csv',
            'bank_names_corrected.csv',
            'only_corrected_bank_names.csv',
            'exact_matches_report.csv',
            'ifsc_matched_records.csv',
            'temp_bank_mapping.json'
        ];

        let deletedCount = 0;
        filesToDelete.forEach(file => {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        });

        // Clean uploads directory
        const uploadFiles = fs.readdirSync(uploadsDir);
        uploadFiles.forEach(file => {
            fs.unlinkSync(path.join(uploadsDir, file));
            deletedCount++;
        });

        res.json({
            success: true,
            message: `Cleaned up ${deletedCount} files`
        });

    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({
            error: 'Cleanup failed',
            message: error.message
        });
    }
});

// Serve static files from public directory
app.use(express.static('public'));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'The requested endpoint does not exist'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n=================================`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`API Base URL: http://localhost:${PORT}/api`);
    console.log(`=================================\n`);
    console.log(`Available endpoints:`);
    console.log(`  GET  /api/health - Health check`);
    console.log(`  POST /api/upload/input - Upload input file`);
    console.log(`  POST /api/upload/bank-mapping - Upload bank mapping file`);
    console.log(`  POST /api/compare - Compare IFSC and MICR codes`);
    console.log(`  POST /api/fuzzy-match - Apply fuzzy matching`);
    console.log(`  POST /api/process-all - Complete workflow`);
    console.log(`  GET  /api/files - List generated files`);
    console.log(`  GET  /api/download/:filename - Download a file`);
    console.log(`  DELETE /api/cleanup - Clean up all generated files`);
    console.log(`  GET  /api/backups - List available backups`);
    console.log(`  DELETE /api/backups/cleanup - Clean old backups`);
    console.log(`=================================\n`);

    // Run initial cleanup of old backups on startup
    console.log('🧹 Running initial backup cleanup...');
    cleanupOldBackups();

    // Schedule automatic cleanup every 24 hours
    setInterval(() => {
        console.log('🕐 Running scheduled backup cleanup (every 24 hours)...');
        cleanupOldBackups();
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

    console.log('✅ Automatic backup cleanup scheduled (runs every 24 hours)\n');
});

module.exports = app;