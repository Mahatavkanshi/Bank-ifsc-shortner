/* =========================================================
   UI CONTROLLER - DOM Manipulation & Updates
   ========================================================= */

const UI = {
    /**
     * Show alert message
     */
    showAlert(elementId, type, message) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.className = `alert alert-${type} show`;
        element.innerHTML = message;
        element.style.display = 'block';

        // Auto hide after 10 seconds for success messages
        if (type === 'success') {
            setTimeout(() => this.hideAlert(elementId), 10000);
        }
    },

    /**
     * Hide alert message
     */
    hideAlert(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'none';
        }
    },

    /**
     * Show loading spinner
     */
    showLoading(elementId, message = 'Processing...') {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.innerHTML = `
            <div class="spinner"></div>
            <p>${message}</p>
        `;
        element.classList.add('show');
    },

    /**
     * Hide loading spinner
     */
    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('show');
        }
    },

    /**
     * Update workflow step status
     */
    updateWorkflowStep(stepId, status) {
        const step = document.getElementById(stepId);
        if (!step) return;

        step.classList.remove('active', 'completed');
        if (status) {
            step.classList.add(status);
        }
    },

    /**
     * Reset workflow steps
     */
    resetWorkflow() {
        document.querySelectorAll('.workflow-step').forEach(step => {
            step.classList.remove('active', 'completed');
        });
    },

    /**
     * Render statistics cards
     */
    renderStats(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '<div class="stats-grid">';
        
        for (const [key, value] of Object.entries(data)) {
            const title = Utils.camelToTitle(key);
            const colorClass = this.getStatColorClass(key);
            
            html += `
                <div class="stat-card ${colorClass}">
                    <h3>${title}</h3>
                    <p>${Utils.formatNumber(value)}</p>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Get color class for stat cards
     */
    getStatColorClass(key) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('matched') || lowerKey.includes('correct') || lowerKey.includes('success')) {
            return 'success';
        }
        if (lowerKey.includes('unmatched') || lowerKey.includes('incorrect') || lowerKey.includes('missing')) {
            return 'danger';
        }
        if (lowerKey.includes('both')) {
            return 'warning';
        }
        return '';
    },

    /**
     * Render table from data array
     */
    renderTable(containerId, data, options = {}) {
        const container = document.getElementById(containerId);
        if (!container || !data || data.length === 0) {
            if (container) {
                container.innerHTML = '<p class="text-center text-muted">No data available</p>';
            }
            return;
        }

        const headers = options.headers || Object.keys(data[0]);
        const maxRows = options.maxRows || data.length;
        const showActions = options.showActions !== false;

        let html = `
            <div class="table-container">
                <table class="table-striped">
                    <thead>
                        <tr>
                            ${options.showIndex ? '<th>#</th>' : ''}
                            ${headers.map(h => `<th>${Utils.camelToTitle(h)}</th>`).join('')}
                            ${showActions ? '<th>Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.slice(0, maxRows).forEach((row, index) => {
            html += '<tr>';
            if (options.showIndex) {
                html += `<td>${index + 1}</td>`;
            }
            headers.forEach(header => {
                const value = row[header] || '';
                html += `<td>${Utils.sanitizeHTML(value.toString())}</td>`;
            });
            if (showActions && options.onRowAction) {
                html += `<td><button class="btn btn-sm btn-info" onclick="${options.onRowAction}(${index})">View</button></td>`;
            }
            html += '</tr>';
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        if (data.length > maxRows) {
            html += `<p class="text-center text-muted mt-3">Showing ${maxRows} of ${Utils.formatNumber(data.length)} records</p>`;
        }

        container.innerHTML = html;
    },

    /**
     * Render file list
     */
    renderFileList(files) {
        const container = document.getElementById('fileList');
        if (!container) return;

        if (!files || files.length === 0) {
            container.innerHTML = '<li class="file-item">No files available. Process some data first.</li>';
            return;
        }

        container.innerHTML = files.map(file => `
            <li class="file-item">
                <div class="file-info">
                    <span class="file-icon">📄</span>
                    <div>
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">(${Utils.formatFileSize(file.size)})</span>
                    </div>
                </div>
                <div>
                    <button class="btn btn-sm btn-primary" onclick="FileHandler.downloadFile('${file.name}')">
                        Download
                    </button>
                    <button class="btn btn-sm btn-info" onclick="Dashboard.viewFile('${file.name}')">
                        View
                    </button>
                </div>
            </li>
        `).join('');
    },

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Remove active class from all tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab content
        const content = document.getElementById(tabName);
        if (content) {
            content.classList.add('active');
        }

        // Activate selected tab
        const tab = document.querySelector(`[data-tab="${tabName}"]`);
        if (tab) {
            tab.classList.add('active');
        }

        // Store active tab in session storage
        sessionStorage.setItem('activeTab', tabName);
    },

    /**
     * Initialize tab navigation
     */
    initTabs() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Restore last active tab
        const lastTab = sessionStorage.getItem('activeTab');
        if (lastTab) {
            this.switchTab(lastTab);
        }
    },

    /**
     * Show modal
     */
    showModal(title, content) {
        const modalHTML = `
            <div class="modal-overlay show" id="modalOverlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close" onclick="UI.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="UI.closeModal()">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        this.closeModal();

        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Close on overlay click
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') {
                this.closeModal();
            }
        });
    },

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('modalOverlay');
        if (modal) {
            modal.remove();
        }
    },

    /**
     * Show progress bar
     */
    updateProgress(elementId, percentage) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%">
                    ${percentage}%
                </div>
            </div>
        `;
    },

    /**
     * Enable/disable button
     */
    toggleButton(elementId, enabled) {
        const button = document.getElementById(elementId);
        if (button) {
            button.disabled = !enabled;
        }
    },

    /**
     * Show confirmation dialog
     */
    confirm(message) {
        return window.confirm(message);
    },

    /**
     * Show notification
     */
    notify(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} show`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.style.minWidth = '300px';
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};
