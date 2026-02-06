/* =========================================================
   DASHBOARD - Data Visualization & Records Display
   ========================================================= */

const Dashboard = {
    currentData: {
        valid: [],
        invalid: [],
        ifscMatched: [],
        micrMatched: [],
        bothUnmatched: [],
        corrected: [],
        exactMatches: [],
        ifscMismatchMicrFound: [],
        micrMismatchIfscFound: [],
        ifscMissingMicrPresent: [],
        micrMissingIfscPresent: [],
        ifscUnmatched: [],
        micrUnmatched: []
    },

    currentView: 'overview',
    currentPage: 1,
    recordsPerPage: 50,

    /**
     * Load all dashboard data - ALL RECORDS INCLUDING EDGE CASES
     */
    async loadDashboard() {
        UI.showLoading('dashboardLoading', 'Loading dashboard data...');

        try {
            console.log('📊 Loading all CSV files from server...');

            // Load ALL CSV files - No records will be missed!
            // Using Promise.allSettled to load even if some files are missing
            const results = await Promise.allSettled([
                API.readCSVFile('valid_records.csv'),
                API.readCSVFile('invalid_records.csv'),
                API.readCSVFile('ifsc_matched.csv'),
                API.readCSVFile('micr_matched.csv'),
                API.readCSVFile('ifsc_micr_both_unmatched_sorted.csv'),
                API.readCSVFile('bank_names_corrected.csv'),
                API.readCSVFile('exact_matches_report.csv'),
                API.readCSVFile('ifsc_mismatch_but_micr_found.csv'),
                API.readCSVFile('micr_mismatch_but_ifsc_found.csv'),
                API.readCSVFile('ifsc_missing_micr_present.csv'),
                API.readCSVFile('micr_missing_ifsc_present.csv'),
                API.readCSVFile('ifsc_unmatched.csv'),
                API.readCSVFile('micr_unmatched.csv')
            ]);

            // Extract data from settled promises
            const [
                valid,
                invalid,
                ifscMatched,
                micrMatched,
                bothUnmatched,
                corrected,
                exactMatches,
                ifscMismatchMicrFound,
                micrMismatchIfscFound,
                ifscMissingMicrPresent,
                micrMissingIfscPresent,
                ifscUnmatched,
                micrUnmatched
            ] = results.map(r => r.status === 'fulfilled' ? (r.value || []) : []);

            this.currentData = {
                valid,
                invalid,
                ifscMatched,
                micrMatched,
                bothUnmatched,
                corrected,
                exactMatches,
                ifscMismatchMicrFound,
                micrMismatchIfscFound,
                ifscMissingMicrPresent,
                micrMissingIfscPresent,
                ifscUnmatched,
                micrUnmatched
            };

            // Log summary
            console.log('✅ Dashboard data loaded:');
            console.log(`  - Valid: ${valid.length}`);
            console.log(`  - Invalid: ${invalid.length}`);
            console.log(`  - IFSC Matched: ${ifscMatched.length}`);
            console.log(`  - MICR Matched: ${micrMatched.length}`);
            console.log(`  - IFSC Unmatched: ${ifscUnmatched.length}`);
            console.log(`  - MICR Unmatched: ${micrUnmatched.length}`);
            console.log(`  - Both Unmatched: ${bothUnmatched.length}`);

            this.renderOverview();
            this.renderDatasetSelector();

        } catch (error) {
            console.error('Error loading dashboard:', error);
            UI.showAlert('dashboardAlert', 'error', '❌ Failed to load dashboard data');
        } finally {
            UI.hideLoading('dashboardLoading');
        }
    },

    /**
     * Render overview statistics - Shows ALL record categories
     */
    renderOverview() {
        const overview = document.getElementById('dashboardOverview');
        if (!overview) return;

        const stats = {
            'Total Valid Records': this.currentData.valid.length,
            'Total Invalid Records': this.currentData.invalid.length,
            'IFSC Matched': this.currentData.ifscMatched.length,
            'MICR Matched': this.currentData.micrMatched.length,
            'IFSC Unmatched': this.currentData.ifscUnmatched.length,
            'MICR Unmatched': this.currentData.micrUnmatched.length,
            'IFSC Mismatch (MICR Found)': this.currentData.ifscMismatchMicrFound.length,
            'MICR Mismatch (IFSC Found)': this.currentData.micrMismatchIfscFound.length,
            'IFSC Missing (MICR Present)': this.currentData.ifscMissingMicrPresent.length,
            'MICR Missing (IFSC Present)': this.currentData.micrMissingIfscPresent.length,
            'Both Unmatched': this.currentData.bothUnmatched.length,
            'Bank Names Corrected': this.currentData.corrected.length,
            'Unique Bank Groups': this.currentData.exactMatches.length
        };

        let html = '<h3>📊 Processing Summary</h3>';
        html += '<div class="stats-grid">';

        for (const [label, value] of Object.entries(stats)) {
            let colorClass = '';
            if (label.includes('Matched')) colorClass = 'success';
            else if (label.includes('Invalid') || label.includes('Unmatched')) colorClass = 'danger';
            else if (label.includes('Corrected')) colorClass = 'warning';

            html += `
                <div class="stat-card ${colorClass}">
                    <h3>${label}</h3>
                    <p>${Utils.formatNumber(value)}</p>
                </div>
            `;
        }

        html += '</div>';

        // Add percentage analysis
        const totalValid = this.currentData.valid.length;
        if (totalValid > 0) {
            html += '<h3 class="mt-4">🎯 Match Analysis</h3>';
            html += '<div class="stats-grid">';

            const ifscMatchRate = Utils.calculatePercentage(this.currentData.ifscMatched.length, totalValid);
            const micrMatchRate = Utils.calculatePercentage(this.currentData.micrMatched.length, totalValid);
            const bothUnmatchedRate = Utils.calculatePercentage(this.currentData.bothUnmatched.length, totalValid);

            html += `
                <div class="stat-card success">
                    <h3>IFSC Match Rate</h3>
                    <p>${ifscMatchRate}%</p>
                </div>
                <div class="stat-card success">
                    <h3>MICR Match Rate</h3>
                    <p>${micrMatchRate}%</p>
                </div>
                <div class="stat-card danger">
                    <h3>Both Unmatched Rate</h3>
                    <p>${bothUnmatchedRate}%</p>
                </div>
            `;

            html += '</div>';
        }

        overview.innerHTML = html;
    },

    /**
     * Render dataset selector - ALL datasets visible
     */
    renderDatasetSelector() {
        const selector = document.getElementById('datasetSelector');
        if (!selector) return;

        const datasets = [
            { id: 'valid', label: '✅ Valid Records', count: this.currentData.valid.length },
            { id: 'invalid', label: '❌ Invalid Records', count: this.currentData.invalid.length },
            { id: 'ifscMatched', label: '🎯 IFSC Matched', count: this.currentData.ifscMatched.length },
            { id: 'micrMatched', label: '🎯 MICR Matched', count: this.currentData.micrMatched.length },
            { id: 'ifscUnmatched', label: '⚠️ IFSC Unmatched', count: this.currentData.ifscUnmatched.length },
            { id: 'micrUnmatched', label: '⚠️ MICR Unmatched', count: this.currentData.micrUnmatched.length },
            { id: 'ifscMismatchMicrFound', label: '🔄 IFSC Mismatch (MICR Found)', count: this.currentData.ifscMismatchMicrFound.length },
            { id: 'micrMismatchIfscFound', label: '🔄 MICR Mismatch (IFSC Found)', count: this.currentData.micrMismatchIfscFound.length },
            { id: 'ifscMissingMicrPresent', label: '🔶 IFSC Missing (MICR Present)', count: this.currentData.ifscMissingMicrPresent.length },
            { id: 'micrMissingIfscPresent', label: '🔶 MICR Missing (IFSC Present)', count: this.currentData.micrMissingIfscPresent.length },
            { id: 'bothUnmatched', label: '🚫 Both Unmatched', count: this.currentData.bothUnmatched.length },
            { id: 'corrected', label: '🔧 Bank Names Corrected', count: this.currentData.corrected.length },
            { id: 'exactMatches', label: '📊 Bank Groups Summary', count: this.currentData.exactMatches.length }
        ];

        let html = '<h3>📋 View Detailed Records</h3>';
        html += '<div class="d-flex flex-wrap gap-2 mt-3">';

        datasets.forEach(dataset => {
            if (dataset.count > 0) {
                html += `
                    <button class="btn btn-primary" onclick="Dashboard.viewDataset('${dataset.id}')">
                        ${dataset.label} (${Utils.formatNumber(dataset.count)})
                    </button>
                `;
            }
        });

        html += '</div>';
        selector.innerHTML = html;
    },

    /**
     * View specific dataset
     */
    viewDataset(datasetId) {
        this.currentView = datasetId;
        this.currentPage = 1;

        const data = this.currentData[datasetId];
        if (!data || data.length === 0) {
            UI.notify('No data available for this dataset', 'warning');
            return;
        }

        // Get dataset info
        const datasetInfo = this.getDatasetInfo(datasetId);

        // Render table with pagination
        this.renderDataTable(data, datasetInfo);
    },

    /**
     * Get dataset information - ALL datasets documented
     */
    getDatasetInfo(datasetId) {
        const info = {
            valid: { title: 'Valid Records', description: 'All records with valid IFSC (11 chars) and MICR (9 chars)' },
            invalid: { title: 'Invalid Records', description: 'Records that failed validation' },
            ifscMatched: { title: 'IFSC Matched Records', description: 'Records where IFSC code was found in bank mapping' },
            micrMatched: { title: 'MICR Matched Records', description: 'Records where MICR code was found in bank mapping' },
            ifscUnmatched: { title: 'IFSC Unmatched Records', description: 'Records where IFSC code was NOT found in bank mapping' },
            micrUnmatched: { title: 'MICR Unmatched Records', description: 'Records where MICR code was NOT found in bank mapping' },
            ifscMismatchMicrFound: { title: 'IFSC Mismatch but MICR Found', description: 'Records where IFSC did not match but MICR was found in bank mapping' },
            micrMismatchIfscFound: { title: 'MICR Mismatch but IFSC Found', description: 'Records where MICR did not match but IFSC was found in bank mapping' },
            ifscMissingMicrPresent: { title: 'IFSC Missing, MICR Present', description: 'Records that are missing IFSC code but have MICR code' },
            micrMissingIfscPresent: { title: 'MICR Missing, IFSC Present', description: 'Records that are missing MICR code but have IFSC code' },
            bothUnmatched: { title: 'Both Unmatched Records', description: 'Records where neither IFSC nor MICR were found in bank mapping' },
            corrected: { title: 'Bank Names Corrected', description: 'All records with fuzzy-matched bank names' },
            exactMatches: { title: 'Bank Groups Summary', description: 'Grouped bank names with statistics' }
        };

        return info[datasetId] || { title: 'Records', description: '' };
    },

    /**
     * Render data table with pagination
     */
    renderDataTable(data, info) {
        const container = document.getElementById('dataTableContainer');
        if (!container) return;

        const totalPages = Utils.getTotalPages(data.length, this.recordsPerPage);
        const paginatedData = Utils.paginate(data, this.currentPage, this.recordsPerPage);

        let html = `
            <div class="card mt-4">
                <div class="card-header">
                    <h3>${info.title}</h3>
                    <p class="text-muted mb-0">${info.description}</p>
                </div>
                <div class="card-body">
                    <div class="d-flex justify-between align-center mb-3">
                        <div>
                            <strong>Total Records:</strong> ${Utils.formatNumber(data.length)}
                        </div>
                        <div>
                            <button class="btn btn-sm btn-success" onclick="Dashboard.exportCurrentView()">
                                📥 Export to CSV
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="Dashboard.printCurrentView()">
                                🖨️ Print
                            </button>
                        </div>
                    </div>
        `;

        // Add search box
        html += `
            <div class="mb-3">
                <input type="text" 
                       class="form-control" 
                       id="searchBox" 
                       placeholder="Search in all columns..." 
                       onkeyup="Dashboard.handleSearch()">
            </div>
        `;

        // Render table
        html += '<div class="table-container"><table class="table-striped"><thead><tr>';

        const headers = Object.keys(paginatedData[0] || {});
        html += '<th>#</th>';
        headers.forEach(header => {
            html += `<th>${Utils.camelToTitle(header)}</th>`;
        });
        html += '</tr></thead><tbody>';

        paginatedData.forEach((row, index) => {
            const rowNumber = (this.currentPage - 1) * this.recordsPerPage + index + 1;
            html += `<tr><td>${rowNumber}</td>`;
            headers.forEach(header => {
                const value = row[header] || '';
                html += `<td>${Utils.sanitizeHTML(value.toString())}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        // Pagination controls
        if (totalPages > 1) {
            html += '<div class="pagination mt-3">';
            html += `<button class="btn btn-sm" onclick="Dashboard.goToPage(1)" ${this.currentPage === 1 ? 'disabled' : ''}>First</button>`;
            html += `<button class="btn btn-sm" onclick="Dashboard.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>`;

            // Page numbers
            for (let i = Math.max(1, this.currentPage - 2); i <= Math.min(totalPages, this.currentPage + 2); i++) {
                html += `<button class="btn btn-sm ${i === this.currentPage ? 'active' : ''}" onclick="Dashboard.goToPage(${i})">${i}</button>`;
            }

            html += `<button class="btn btn-sm" onclick="Dashboard.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
            html += `<button class="btn btn-sm" onclick="Dashboard.goToPage(${totalPages})" ${this.currentPage === totalPages ? 'disabled' : ''}>Last</button>`;
            html += '</div>';

            html += `<p class="text-center text-muted mt-2">Page ${this.currentPage} of ${totalPages}</p>`;
        }

        html += '</div></div>';
        container.innerHTML = html;

        // Scroll to table
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    /**
     * Go to specific page
     */
    goToPage(page) {
        this.currentPage = page;
        this.viewDataset(this.currentView);
    },

    /**
     * Handle search
     */
    handleSearch: Utils.debounce(function() {
        const searchBox = document.getElementById('searchBox');
        const searchTerm = searchBox ? searchBox.value : '';
        const data = Dashboard.currentData[Dashboard.currentView];

        if (!searchTerm) {
            Dashboard.currentPage = 1;
            Dashboard.viewDataset(Dashboard.currentView);
            return;
        }

        const headers = Object.keys(data[0] || {});
        const filtered = Utils.filterBySearch(data, searchTerm, headers);

        Dashboard.currentPage = 1;
        const info = Dashboard.getDatasetInfo(Dashboard.currentView);
        Dashboard.renderDataTable(filtered, {...info, title: `${info.title} (Filtered)` });
    }, 300),

    /**
     * Export current view to CSV
     */
    exportCurrentView() {
        const data = this.currentData[this.currentView];
        if (!data || data.length === 0) {
            UI.notify('No data to export', 'warning');
            return;
        }

        const filename = `${this.currentView}_export_${new Date().getTime()}.csv`;
        Utils.exportToCSV(data, filename);
        UI.notify(`Exported ${data.length} records to ${filename}`, 'success');
    },

    /**
     * Print current view
     */
    printCurrentView() {
        window.print();
    },

    /**
     * View specific file
     */
    async viewFile(filename) {
        try {
            const data = await API.readCSVFile(filename);

            if (data.length === 0) {
                UI.notify('File is empty or could not be read', 'warning');
                return;
            }

            // Render in modal
            const headers = Object.keys(data[0]);
            let tableHTML = '<div class="table-container"><table class="table-striped"><thead><tr>';

            tableHTML += '<th>#</th>';
            headers.forEach(h => tableHTML += `<th>${Utils.camelToTitle(h)}</th>`);
            tableHTML += '</tr></thead><tbody>';

            data.slice(0, 100).forEach((row, i) => {
                tableHTML += `<tr><td>${i + 1}</td>`;
                headers.forEach(h => tableHTML += `<td>${Utils.sanitizeHTML((row[h] || '').toString())}</td>`);
                tableHTML += '</tr>';
            });

            tableHTML += '</tbody></table></div>';

            if (data.length > 100) {
                tableHTML += `<p class="text-center text-muted mt-3">Showing first 100 of ${Utils.formatNumber(data.length)} records</p>`;
            }

            UI.showModal(`📄 ${filename}`, tableHTML);

        } catch (error) {
            UI.notify('Failed to load file', 'error');
        }
    },

    /**
     * Clear dashboard
     */
    clearDashboard() {
        this.currentData = {
            valid: [],
            invalid: [],
            ifscMatched: [],
            micrMatched: [],
            bothUnmatched: [],
            corrected: [],
            exactMatches: []
        };

        const overview = document.getElementById('dashboardOverview');
        const selector = document.getElementById('datasetSelector');
        const container = document.getElementById('dataTableContainer');

        if (overview) overview.innerHTML = '<p class="text-muted">No data available. Process files to see results.</p>';
        if (selector) selector.innerHTML = '';
        if (container) container.innerHTML = '';
    },

    /**
     * Show modal to view old data backups
     */
    async showOldDataModal() {
        const modal = document.getElementById('oldDataModal');
        const backupList = document.getElementById('oldDataBackupList');

        if (!modal || !backupList) return;

        modal.style.display = 'block';
        backupList.innerHTML = '<p>Loading available backups...</p>';

        try {
            const response = await fetch(`${API.baseURL}/backups`);
            const data = await response.json();

            if (!data.backups || data.backups.length === 0) {
                backupList.innerHTML = `
                    <div class="alert alert-info">
                        <strong>No old data found</strong>
                        <p>There are no previous backups available. Old data is created automatically when you upload and process new files.</p>
                    </div>
                `;
                return;
            }

            // Display backup list
            let html = '<h3>Available Backups (Last 7 Days)</h3>';
            html += '<p class="text-muted">Backups older than 7 days are automatically deleted</p>';
            html += '<div class="backup-list">';

            data.backups.forEach(backup => {
                // Calculate age of backup
                const backupDate = new Date(backup.timestamp.replace(/-/g, ':').replace('T', ' '));
                const now = new Date();
                const ageInDays = Math.floor((now - backupDate) / (1000 * 60 * 60 * 24));
                const ageInHours = Math.floor((now - backupDate) / (1000 * 60 * 60));

                let ageDisplay;
                if (ageInDays === 0) {
                    if (ageInHours === 0) {
                        ageDisplay = '<span style="color: #28a745;">Just now</span>';
                    } else if (ageInHours === 1) {
                        ageDisplay = '<span style="color: #28a745;">1 hour ago</span>';
                    } else {
                        ageDisplay = `<span style="color: #28a745;">${ageInHours} hours ago</span>`;
                    }
                } else if (ageInDays === 1) {
                    ageDisplay = '<span style="color: #17a2b8;">1 day ago</span>';
                } else if (ageInDays < 7) {
                    ageDisplay = `<span style="color: #ffc107;">${ageInDays} days ago</span>`;
                } else {
                    ageDisplay = `<span style="color: #dc3545;">${ageInDays} days ago (will be deleted soon)</span>`;
                }

                html += `
                    <div class="backup-item card" style="margin-bottom: 15px;">
                        <div class="card-body">
                            <h4>📅 ${backup.displayTime}</h4>
                            <p style="margin: 5px 0;"><strong>Age:</strong> ${ageDisplay}</p>
                            <p style="margin: 5px 0;"><strong>Files:</strong> ${backup.fileCount} backed up</p>
                            <button class="btn btn-primary" onclick="Dashboard.viewBackup('${backup.timestamp}', ${JSON.stringify(backup.files).replace(/"/g, '&quot;')})">
                                View Backup Data
                            </button>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            backupList.innerHTML = html;

        } catch (error) {
            console.error('Error loading backups:', error);
            backupList.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error loading backups</strong>
                    <p>${error.message}</p>
                </div>
            `;
        }
    },

    /**
     * Close old data modal
     */
    closeOldDataModal() {
        const modal = document.getElementById('oldDataModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.backToBackupList();
    },

    /**
     * Back to backup list from viewer
     */
    backToBackupList() {
        const backupList = document.getElementById('oldDataBackupList');
        const viewer = document.getElementById('oldDataViewer');

        if (backupList) backupList.style.display = 'block';
        if (viewer) viewer.style.display = 'none';
    },

    /**
     * View specific backup data
     */
    async viewBackup(timestamp, files) {
        const backupList = document.getElementById('oldDataBackupList');
        const viewer = document.getElementById('oldDataViewer');
        const content = document.getElementById('oldDataContent');

        if (!viewer || !content) return;

        backupList.style.display = 'none';
        viewer.style.display = 'block';
        content.innerHTML = '<p>Loading backup data...</p>';

        try {
            // Map file types to display names
            const fileMapping = {
                'valid_records': 'Valid Records',
                'invalid_records': 'Invalid Records',
                'ifsc_matched': 'IFSC Matched',
                'micr_matched': 'MICR Matched',
                'ifsc_unmatched': 'IFSC Unmatched',
                'micr_unmatched': 'MICR Unmatched',
                'ifsc_micr_both_unmatched_sorted': 'Both Unmatched (Sorted)',
                'bank_names_corrected': 'Bank Names Corrected',
                'only_corrected_bank_names': 'Only Corrected Names',
                'exact_matches_report': 'Exact Matches Report',
                'ifsc_matched_records': 'IFSC Matched Records'
            };

            let html = `<h3>Backup from ${new Date(timestamp.replace(/-/g, ':').replace('T', ' ')).toLocaleString()}</h3>`;
            html += '<div class="backup-files">';

            // Create buttons for each file type
            for (const file of files) {
                const baseName = file.replace(`_${timestamp}.csv`, '');
                const displayName = fileMapping[baseName] || baseName;

                html += `
                    <button class="btn btn-secondary" style="margin: 5px;" onclick="Dashboard.loadBackupFile('${timestamp}', '${baseName}.csv')">
                        📄 ${displayName}
                    </button>
                `;
            }

            html += '</div>';
            html += '<div id="backupFileContent" style="margin-top: 20px;"></div>';

            content.innerHTML = html;

        } catch (error) {
            console.error('Error viewing backup:', error);
            content.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error viewing backup</strong>
                    <p>${error.message}</p>
                </div>
            `;
        }
    },

    /**
     * Load and display a specific backup file
     */
    async loadBackupFile(timestamp, filename) {
        const fileContent = document.getElementById('backupFileContent');
        if (!fileContent) return;

        fileContent.innerHTML = '<p>Loading file...</p>';

        try {
            const response = await fetch(`${API.baseURL}/backups/${timestamp}/${filename}`);
            const text = await response.text();

            // Parse CSV
            const rows = text.trim().split('\n').map(row => {
                // Simple CSV parsing (handles basic cases)
                return row.split(',').map(cell => cell.trim());
            });

            if (rows.length === 0) {
                fileContent.innerHTML = '<p>File is empty</p>';
                return;
            }

            // Create table
            const headers = rows[0];
            const dataRows = rows.slice(1);

            let html = `
                <h4>${filename}</h4>
                <p><strong>Total records:</strong> ${dataRows.length}</p>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
            `;

            headers.forEach(header => {
                html += `<th>${header}</th>`;
            });

            html += `
                            </tr>
                        </thead>
                        <tbody>
            `;

            // Show first 100 rows
            const displayRows = dataRows.slice(0, 100);
            displayRows.forEach(row => {
                html += '<tr>';
                row.forEach(cell => {
                    html += `<td>${cell}</td>`;
                });
                html += '</tr>';
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            if (dataRows.length > 100) {
                html += `<p class="text-muted">Showing first 100 of ${dataRows.length} records</p>`;
            }

            fileContent.innerHTML = html;

        } catch (error) {
            console.error('Error loading backup file:', error);
            fileContent.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error loading file</strong>
                    <p>${error.message}</p>
                </div>
            `;
        }
    },

    /**
     * Manually trigger cleanup of old backups
     */
    async cleanupOldBackups() {
        if (!confirm('This will delete all backups older than 7 days. Are you sure?')) {
            return;
        }

        try {
            const response = await fetch(`${API.baseURL}/backups/cleanup`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                UI.notify(`${data.message} (${data.deletedCount} files removed)`, 'success');

                // Refresh the old data modal if it's open
                const modal = document.getElementById('oldDataModal');
                if (modal && modal.style.display === 'block') {
                    this.showOldDataModal();
                }
            } else {
                UI.notify('Cleanup failed: ' + data.message, 'error');
            }

        } catch (error) {
            console.error('Error during cleanup:', error);
            UI.notify('Failed to clean up old backups', 'error');
        }
    }
};

/* =========================================================
   APPLICATION INITIALIZATION
   ========================================================= */

class App {
    /**
     * Initialize application
     */
    static async init() {
        console.log('🚀 Initializing Bank IFSC/MICR Processing System...');

        // Initialize UI components
        UI.initTabs();

        // Check server health
        try {
            const health = await API.checkHealth();
            console.log('✅ Server is healthy:', health);
            UI.notify('Connected to server successfully', 'success');
        } catch (error) {
            console.error('❌ Server health check failed:', error);
            UI.notify('Warning: Could not connect to server', 'warning');
        }

        // Load initial file list
        await FileHandler.listFiles();

        // Set up event listeners
        this.setupEventListeners();

        console.log('✅ Application initialized successfully');
    }

    /**
     * Setup event listeners
     */
    static setupEventListeners() {
        // File input change listeners
        const inputFile = document.getElementById('inputFile');
        if (inputFile) {
            inputFile.addEventListener('change', () => {
                UI.hideAlert('inputResult');
            });
        }

        const bankMappingFile = document.getElementById('bankMappingFile');
        if (bankMappingFile) {
            bankMappingFile.addEventListener('change', () => {
                UI.hideAlert('bankMappingResult');
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchBox = document.getElementById('searchBox');
                if (searchBox) {
                    searchBox.focus();
                }
            }
        });

        // Auto-refresh file list every 30 seconds
        setInterval(() => {
            FileHandler.listFiles();
        }, 30000);
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}