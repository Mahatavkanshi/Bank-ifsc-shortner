/* =========================================================
   FILE HANDLER - File Upload & Download Management
   ========================================================= */

const FileHandler = {
    allowedExtensions: ['csv', 'xlsx', 'xls', 'json', 'txt', 'dat', '001'],

    /**
     * Validate file before upload
     */
    validateFile(file) {
        if (!file) {
            return { valid: false, error: 'No file selected' };
        }

        const fileName = file.name;
        const fileSize = file.size;
        const maxSize = 50 * 1024 * 1024; // 50MB

        // Check file size
        if (fileSize > maxSize) {
            return { valid: false, error: 'File size exceeds 50MB limit' };
        }

        // Check file extension
        if (!Utils.validateFileExtension(fileName, this.allowedExtensions)) {
            return {
                valid: false,
                error: `Invalid file type. Allowed: ${this.allowedExtensions.join(', ')}`
            };
        }

        return { valid: true };
    },

    /**
     * Upload input file
     */
    async uploadInputFile() {
        const fileInput = document.getElementById('inputFile');
        const file = fileInput.files[0];

        const validation = this.validateFile(file);
        if (!validation.valid) {
            UI.showAlert('inputResult', 'error', '❌ ' + validation.error);
            return;
        }

        UI.hideAlert('inputResult');
        UI.showLoading('inputLoading', 'Uploading and processing input file...');

        try {
            const result = await API.uploadInputFile(file);

            UI.hideLoading('inputLoading');

            if (result.success) {
                UI.updateWorkflowStep('step1', 'completed');
                UI.showAlert('inputResult', 'success',
                    `✅ File processed successfully!<br>
                    <strong>Total Records:</strong> ${Utils.formatNumber(result.data.totalRecords)}<br>
                    <strong>Valid Records:</strong> ${Utils.formatNumber(result.data.correctRecords)}<br>
                    <strong>Invalid Records:</strong> ${Utils.formatNumber(result.data.incorrectRecords)}`
                );
            } else {
                UI.showAlert('inputResult', 'error', `❌ ${result.error}: ${result.message}`);
            }
        } catch (error) {
            UI.hideLoading('inputLoading');
            UI.showAlert('inputResult', 'error', `❌ Error: ${error.message}`);
        }
    },

    /**
     * Upload bank mapping file
     */
    async uploadBankMapping() {
        const fileInput = document.getElementById('bankMappingFile');
        const file = fileInput.files[0];

        const validation = this.validateFile(file);
        if (!validation.valid) {
            UI.showAlert('bankMappingResult', 'error', '❌ ' + validation.error);
            return;
        }

        UI.hideAlert('bankMappingResult');
        UI.showLoading('bankMappingLoading', 'Uploading bank mapping file...');

        try {
            const result = await API.uploadBankMapping(file);

            UI.hideLoading('bankMappingLoading');

            if (result.success) {
                UI.updateWorkflowStep('step2', 'completed');
                UI.showAlert('bankMappingResult', 'success',
                    `✅ Bank mapping loaded successfully!<br>
                    <strong>Records Loaded:</strong> ${Utils.formatNumber(result.recordCount)}`
                );
            } else {
                UI.showAlert('bankMappingResult', 'error', `❌ ${result.error}: ${result.message}`);
            }
        } catch (error) {
            UI.hideLoading('bankMappingLoading');
            UI.showAlert('bankMappingResult', 'error', `❌ Error: ${error.message}`);
        }
    },

    /**
     * Process all files at once
     */
    async processAll() {
        console.log('🚀 ProcessAll called');

        const inputFileElement = document.getElementById('quickInputFile');
        const bankMappingElement = document.getElementById('quickBankMapping');

        console.log('Input file element:', inputFileElement);
        console.log('Bank mapping element:', bankMappingElement);

        if (!inputFileElement || !bankMappingElement) {
            console.error('❌ File input elements not found!');
            UI.showAlert('quickResult', 'error', '❌ Error: File input elements not found');
            return;
        }

        const inputFile = inputFileElement.files[0];
        const bankMappingFile = bankMappingElement.files[0];

        console.log('Input file:', inputFile);
        console.log('Bank mapping file:', bankMappingFile);

        // Validate both files
        const inputValidation = this.validateFile(inputFile);
        const mappingValidation = this.validateFile(bankMappingFile);

        console.log('Input validation:', inputValidation);
        console.log('Mapping validation:', mappingValidation);

        if (!inputValidation.valid) {
            UI.showAlert('quickResult', 'error', '❌ Input file: ' + inputValidation.error);
            return;
        }

        if (!mappingValidation.valid) {
            UI.showAlert('quickResult', 'error', '❌ Bank mapping file: ' + mappingValidation.error);
            return;
        }

        UI.hideAlert('quickResult');
        UI.showLoading('quickLoading', 'Processing complete workflow... This may take a few moments.');

        // Switch to Step-by-Step tab
        UI.switchTab('stepByStep');

        console.log('📤 Sending files to server...');

        try {
            const result = await API.processAll(inputFile, bankMappingFile);

            console.log('✅ Server response:', result);

            UI.hideLoading('quickLoading');

            if (result.success) {
                // Mark all workflow steps as completed
                ['step1', 'step2', 'step3', 'step4'].forEach(step => {
                    UI.updateWorkflowStep(step, 'completed');
                });

                // Refresh file list
                await this.listFiles();

                // Show success message on Quick Start tab
                UI.showAlert('quickResult', 'success', '✅ All processing completed successfully! Check the Dashboard or Downloads tab.');

                // Show completion modal with option to go to dashboard
                this.showProcessingCompleteModal(result);
                
                // Auto-load dashboard data in background
                setTimeout(() => {
                    Dashboard.loadDashboard();
                }, 500);

            } else {
                UI.switchTab('quickStart');
                UI.showAlert('quickResult', 'error', `❌ ${result.error}: ${result.message}`);
            }
        } catch (error) {
            UI.hideLoading('quickLoading');
            UI.showAlert('quickResult', 'error', `❌ Error: ${error.message}`);
        }
    },

    /**
     * Show processing complete modal with dashboard option
     */
    showProcessingCompleteModal(result) {
        // Build detailed success message
        let message = '<div style="text-align: left;">';

        message += '<h3 style="color: #28a745; margin-bottom: 20px;">✅ Processing Complete!</h3>';

        message += '<strong>📊 Filtering Results:</strong><br>';
        message += `<ul style="margin: 10px 0;">`;
        message += `<li>Total Records: ${Utils.formatNumber(result.data.filtering.totalRecords)}</li>`;
        message += `<li>Valid: ${Utils.formatNumber(result.data.filtering.correctRecords)}</li>`;
        message += `<li>Invalid: ${Utils.formatNumber(result.data.filtering.incorrectRecords)}</li>`;
        message += '</ul>';

        message += '<strong>🔍 Comparison Results:</strong><br>';
        message += `<ul style="margin: 10px 0;">`;
        message += `<li>IFSC Matched: ${Utils.formatNumber(result.data.comparison.ifscMatched)}</li>`;
        message += `<li>MICR Matched: ${Utils.formatNumber(result.data.comparison.micrMatched)}</li>`;
        message += `<li>Both Missing: ${Utils.formatNumber(result.data.comparison.bothMissing)}</li>`;
        message += '</ul>';

        message += '<strong>🎯 Fuzzy Matching Results:</strong><br>';
        message += `<ul style="margin: 10px 0;">`;
        message += `<li>Total Records: ${Utils.formatNumber(result.data.fuzzyMatching.totalRecords)}</li>`;
        message += `<li>Bank Groups: ${Utils.formatNumber(result.data.fuzzyMatching.uniqueGroups)}</li>`;
        message += `<li>Corrections Made: ${Utils.formatNumber(result.data.fuzzyMatching.correctionsMade)}</li>`;
        message += '</ul>';

        if (result.data.backup) {
            message += '<strong>💾 Backup:</strong><br>';
            message += `<ul style="margin: 10px 0;">`;
            message += `<li>Files Backed Up: ${result.data.backup.filesBackedUp}</li>`;
            if (result.data.backup.oldFilesDeleted > 0) {
                message += `<li>Old Files Deleted: ${result.data.backup.oldFilesDeleted}</li>`;
            }
            message += '</ul>';
        }

        message += '<div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">';
        message += '<p style="font-size: 18px; margin-bottom: 15px;">All processing steps completed successfully!</p>';
        message += '<button class="btn btn-success btn-lg" onclick="FileHandler.goToDashboard()" style="margin-right: 10px;">📊 Go to Dashboard</button>';
        message += '<button class="btn btn-info btn-lg" onclick="FileHandler.goToDownloads()" style="margin-right: 10px;">📥 Go to Downloads</button>';
        message += '<button class="btn btn-secondary" onclick="UI.closeModal()">Close</button>';
        message += '</div>';

        message += '</div>';

        UI.showModal('Processing Complete', message);
    },

    /**
     * Navigate to dashboard and load data
     */
    goToDashboard() {
        UI.closeModal();
        setTimeout(() => {
            UI.switchTab('dashboard');
            Dashboard.loadDashboard();
        }, 100);
    },

    /**
     * Navigate to downloads tab
     */
    goToDownloads() {
        UI.closeModal();
        setTimeout(() => {
            UI.switchTab('downloads');
        }, 100);
    },

    /**
     * Compare IFSC and MICR
     */
    async compareData() {
        UI.hideAlert('compareResult');
        UI.showLoading('compareLoading', 'Comparing IFSC and MICR codes...');

        try {
            const result = await API.compareData();

            UI.hideLoading('compareLoading');

            if (result.success) {
                UI.updateWorkflowStep('step3', 'completed');
                UI.renderStats('compareStats', result.data);
                UI.showAlert('compareResult', 'success', '✅ Comparison completed successfully!');
                await this.listFiles();
            } else {
                UI.showAlert('compareResult', 'error', `❌ ${result.error}: ${result.message}`);
            }
        } catch (error) {
            UI.hideLoading('compareLoading');
            UI.showAlert('compareResult', 'error', `❌ Error: ${error.message}`);
        }
    },

    /**
     * Apply fuzzy matching
     */
    async fuzzyMatch() {
        UI.hideAlert('fuzzyResult');
        UI.showLoading('fuzzyLoading', 'Applying fuzzy matching to bank names...');

        try {
            const result = await API.fuzzyMatch();

            UI.hideLoading('fuzzyLoading');

            if (result.success) {
                UI.updateWorkflowStep('step4', 'completed');
                UI.renderStats('fuzzyStats', result.data);
                UI.showAlert('fuzzyResult', 'success', '✅ Fuzzy matching completed successfully!');
                await this.listFiles();
                UI.switchTab('dashboard');
                Dashboard.loadDashboard();
            } else {
                UI.showAlert('fuzzyResult', 'error', `❌ ${result.error}: ${result.message}`);
            }
        } catch (error) {
            UI.hideLoading('fuzzyLoading');
            UI.showAlert('fuzzyResult', 'error', `❌ Error: ${error.message}`);
        }
    },

    /**
     * List all generated files
     */
    async listFiles() {
        try {
            const result = await API.listFiles();

            if (result.success) {
                UI.renderFileList(result.files);
                return result.files;
            }
        } catch (error) {
            console.error('Error listing files:', error);
        }
        return [];
    },

    /**
     * Download a file
     */
    downloadFile(filename) {
        API.downloadFile(filename);
        UI.notify(`Downloading ${filename}...`, 'info');
    },

    /**
     * Clean up all files
     */
    async cleanupFiles() {
        if (!UI.confirm('Are you sure you want to delete all generated files? This action cannot be undone.')) {
            return;
        }

        try {
            const result = await API.cleanup();

            if (result.success) {
                UI.notify(result.message, 'success');
                await this.listFiles();
                UI.resetWorkflow();
                Dashboard.clearDashboard();
            } else {
                UI.notify(`Error: ${result.message}`, 'error');
            }
        } catch (error) {
            UI.notify(`Error: ${error.message}`, 'error');
        }
    }
};