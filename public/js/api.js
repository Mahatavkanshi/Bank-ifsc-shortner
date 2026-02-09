/* =========================================================
   API SERVICE - All Backend Communication
   ========================================================= */

const API = {
    baseURL: 'http://localhost:3000/api',

    headerlessFiles: new Set([
        'valid_records.csv',
        'invalid_records.csv',
        'ifsc_matched.csv',
        'ifsc_unmatched.csv',
        'micr_matched.csv',
        'micr_unmatched.csv',
        'ifsc_missing_micr_present.csv',
        'micr_missing_ifsc_present.csv',
        'ifsc_micr_both_unmatched.csv',
        'ifsc_micr_both_unmatched_sorted.csv'
    ]),

    /**
     * Health check endpoint
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            throw error;
        }
    },

    /**
     * Upload input file (CSV/Excel/JSON)
     */
    async uploadInputFile(file) {
        const formData = new FormData();
        formData.append('inputFile', file);

        try {
            const response = await fetch(`${this.baseURL}/upload/input`, {
                method: 'POST',
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Input file upload failed:', error);
            throw error;
        }
    },

    /**
     * Upload bank mapping file
     */
    async uploadBankMapping(file) {
        const formData = new FormData();
        formData.append('bankMappingFile', file);

        try {
            const response = await fetch(`${this.baseURL}/upload/bank-mapping`, {
                method: 'POST',
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Bank mapping upload failed:', error);
            throw error;
        }
    },

    /**
     * Compare IFSC and MICR codes
     */
    async compareData() {
        try {
            const response = await fetch(`${this.baseURL}/compare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            return await response.json();
        } catch (error) {
            console.error('Comparison failed:', error);
            throw error;
        }
    },

    /**
     * Apply fuzzy matching to bank names
     */
    async fuzzyMatch() {
        try {
            const response = await fetch(`${this.baseURL}/fuzzy-match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            return await response.json();
        } catch (error) {
            console.error('Fuzzy matching failed:', error);
            throw error;
        }
    },

    /**
     * Process complete workflow (all steps at once)
     */
    async processAll(inputFile, bankMappingFile) {
        const formData = new FormData();
        formData.append('inputFile', inputFile);
        formData.append('bankMappingFile', bankMappingFile);

        try {
            const response = await fetch(`${this.baseURL}/process-all`, {
                method: 'POST',
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Complete processing failed:', error);
            throw error;
        }
    },

    /**
     * Get list of all generated files
     */
    async listFiles() {
        try {
            const response = await fetch(`${this.baseURL}/files`);
            return await response.json();
        } catch (error) {
            console.error('Failed to list files:', error);
            throw error;
        }
    },

    /**
     * Download a specific file
     */
    downloadFile(filename) {
        window.location.href = `${this.baseURL}/download/${filename}`;
    },

    /**
     * Clean up all generated files
     */
    async cleanup() {
        try {
            const response = await fetch(`${this.baseURL}/cleanup`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('Cleanup failed:', error);
            throw error;
        }
    },

    /**
     * Read CSV file on client side for dashboard display
     */
    async readCSVFile(filename) {
        try {
            const response = await fetch(`${this.baseURL}/download/${filename}`);
            const text = await response.text();
            return this.parseCSV(text, filename);
        } catch (error) {
            console.error(`Failed to read ${filename}:`, error);
            return [];
        }
    },

    /**
     * Parse CSV text into array of objects
     */
    parseCSV(text, filename = '') {
        const trimmed = text.trim();
        if (!trimmed) return [];

        const lines = trimmed.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];

        const firstLine = lines[0];
        const delimiter = this.detectDelimiter(firstLine);
        const hasHeader = this.detectHeader(filename, firstLine, delimiter);

        const headerLine = hasHeader ? lines[0] : '';
        const headers = hasHeader
            ? this.parseCSVLine(headerLine, delimiter).map(h => h.trim().replace(/"/g, ''))
            : this.generateHeaders(lines[0], delimiter);

        const data = [];
        const startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i], delimiter);
            const row = {};

            for (let colIndex = 0; colIndex < headers.length; colIndex++) {
                row[headers[colIndex]] = values[colIndex] !== undefined ? values[colIndex] : '';
            }

            data.push(row);
        }

        return data;
    },

    detectDelimiter(line) {
        const tildeCount = (line.match(/~/g) || []).length;
        const commaCount = (line.match(/,/g) || []).length;
        if (tildeCount > commaCount) return '~';
        return ',';
    },

    detectHeader(filename, firstLine, delimiter) {
        if (this.headerlessFiles.has(filename)) return false;

        const lower = firstLine.toLowerCase();
        if (lower.includes('ifsc') || lower.includes('micr') || lower.includes('bank')) {
            return true;
        }

        // If the first line looks like a data row starting with a numeric id, treat as no header.
        const firstValue = this.parseCSVLine(firstLine, delimiter)[0] || '';
        return !/^\d+$/.test(firstValue.trim());
    },

    generateHeaders(line, delimiter) {
        const values = this.parseCSVLine(line, delimiter);
        return values.map((_, index) => `Column${index + 1}`);
    },

    /**
     * Parse a single CSV line (handles quoted values)
     */
    parseCSVLine(line, delimiter = ',') {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }
};