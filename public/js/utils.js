/* =========================================================
   UTILITY FUNCTIONS
   ========================================================= */

const Utils = {
    /**
     * Format file size in human-readable format
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * Format date to readable string
     */
    formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Format number with commas
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * Calculate percentage
     */
    calculatePercentage(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100 * 100) / 100;
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Validate file extension
     */
    validateFileExtension(filename, allowedExtensions) {
        const ext = filename.split('.').pop().toLowerCase();
        return allowedExtensions.includes(ext);
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Deep clone object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Check if object is empty
     */
    isEmpty(obj) {
        return Object.keys(obj).length === 0;
    },

    /**
     * Convert camelCase to Title Case
     */
    camelToTitle(str) {
        return str
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    },

    /**
     * Sleep/delay function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Export data to CSV
     */
    exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            console.error('No data to export');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header] || '';
                // Escape quotes and wrap in quotes if contains comma
                return value.toString().includes(',') ? `"${value}"` : value;
            }).join(','))
        ].join('\n');

        this.downloadTextFile(csvContent, filename, 'text/csv');
    },

    /**
     * Download text file
     */
    downloadTextFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    },

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    },

    /**
     * Get query parameter from URL
     */
    getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    /**
     * Set query parameter in URL
     */
    setQueryParam(param, value) {
        const url = new URL(window.location);
        url.searchParams.set(param, value);
        window.history.pushState({}, '', url);
    },

    /**
     * Sanitize HTML to prevent XSS
     */
    sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    /**
     * Truncate string
     */
    truncate(str, length = 50) {
        if (str.length <= length) return str;
        return str.substr(0, length) + '...';
    },

    /**
     * Sort array of objects by key
     */
    sortBy(array, key, ascending = true) {
        return array.sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];

            if (aVal < bVal) return ascending ? -1 : 1;
            if (aVal > bVal) return ascending ? 1 : -1;
            return 0;
        });
    },

    /**
     * Group array by key
     */
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) {
                result[group] = [];
            }
            result[group].push(item);
            return result;
        }, {});
    },

    /**
     * Filter array by search term
     */
    filterBySearch(array, searchTerm, keys) {
        if (!searchTerm) return array;

        const term = searchTerm.toLowerCase();
        return array.filter(item => {
            return keys.some(key => {
                const value = item[key];
                return value && value.toString().toLowerCase().includes(term);
            });
        });
    },

    /**
     * Paginate array
     */
    paginate(array, page, perPage) {
        const start = (page - 1) * perPage;
        const end = start + perPage;
        return array.slice(start, end);
    },

    /**
     * Calculate total pages
     */
    getTotalPages(totalItems, perPage) {
        return Math.ceil(totalItems / perPage);
    }
};