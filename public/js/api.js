/* =========================================================
   API SERVICE - All Backend Communication
   ========================================================= */

const API = {
    baseURL: 'http://localhost:3000/api',

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
            return this.parseCSV(text);
        } catch (error) {
            console.error(`Failed to read ${filename}:`, error);
            return [];
        }
    },

    /**
     * Parse CSV text into array of objects
     */
    parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }

        return data;
    },

    /**
     * Parse a single CSV line (handles quoted values)
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
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