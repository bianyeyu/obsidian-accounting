import { ItemView, WorkspaceLeaf, moment, TFile } from 'obsidian';
import AccountingPlugin from '../main';
import { Account, Category, Tag, Transaction, TransactionType, flattenHierarchy } from './models';
import { parseTransactionsFromFile, findAccountById, findCategoryById, findTagById, normalizeTransactionDate, getDatePart } from './utils';

export const STATS_VIEW_TYPE = 'accounting-stats-view';

/**
 * Available tabs in the statistics view
 */
export enum StatsTab {
    OVERVIEW = 'overview',
    TRANSACTIONS = 'transactions',
    CALENDAR = 'calendar',
    ACCOUNTS = 'accounts',
    TRENDS = 'trends',
    ANALYSIS = 'analysis',
    REPORTS = 'reports'
}

export enum SecondaryTab {
    DAILY = 'daily',
    MONTHLY = 'monthly',
    YEARLY = 'yearly',
    CUSTOM = 'custom'
}

/**
 * Statistics view for the accounting plugin
 */
export class StatsView extends ItemView {
    private plugin: AccountingPlugin;
    public contentEl: HTMLElement;
    private transactions: Transaction[] = [];
    private dateRange: string = 'this-month';
    private customStartDate: string = '';
    private customEndDate: string = '';
    private selectedAccountId: string = 'all';
    private selectedCategoryId: string = 'all';
    private selectedType: string = 'all';
    private currentTab: StatsTab = StatsTab.OVERVIEW;
    private selectedDate: string = moment().format('YYYY-MM-DD');
    private transactionAddedListener: () => void;
    private currentSecondaryTab: SecondaryTab = SecondaryTab.DAILY;

    constructor(leaf: WorkspaceLeaf, plugin: AccountingPlugin) {
        super(leaf);
        this.plugin = plugin;
        
        // Set up event listener for transaction added
        this.transactionAddedListener = () => {
            this.refreshView();
        };
        
        this.plugin.events.on('transaction-added', this.transactionAddedListener);
    }

    getViewType(): string {
        return STATS_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Accounting Statistics';
    }

    getIcon(): string {
        return 'bar-chart';
    }

    async onOpen(): Promise<void> {
        const containerEl = this.containerEl.children[1] as HTMLElement;
        this.contentEl = containerEl;
        this.contentEl.empty();
        this.contentEl.addClass('accounting-stats-view');
        
        // Load transactions
        await this.loadTransactions();
        
        // Render the view
        this.renderStats();
    }

    async onClose(): Promise<void> {
        // Remove event listener
        this.plugin.events.off('transaction-added', this.transactionAddedListener);
        this.contentEl.empty();
    }

    /**
     * Load transactions from files
     */
    private async loadTransactions(): Promise<void> {
        this.transactions = [];
        
        try {
            if (this.plugin.settings.useDailyNotes) {
                // Load from daily notes
                await this.loadTransactionsFromDailyNotes();
            } else {
                // Load from the configured output file
                await this.loadTransactionsFromFile(this.plugin.settings.outputFile);
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    }

    /**
     * Load transactions from daily notes
     */
    private async loadTransactionsFromDailyNotes(): Promise<void> {
        const files = this.app.vault.getMarkdownFiles();
        
        // Try to get the format from the core Daily Notes plugin
        let dailyNoteFormat = this.plugin.settings.dailyNotesFormat;
        
        // Check if the Daily Notes plugin is enabled and get its format
        // @ts-ignore - Accessing internal API
        const dailyNotesPlugin = this.app.internalPlugins.plugins['daily-notes'];
        // @ts-ignore - Accessing internal API
        const calendarPlugin = this.app.plugins.plugins['calendar'];
        
        if (dailyNotesPlugin && dailyNotesPlugin.enabled) {
            // @ts-ignore - Accessing internal API
            const dailyNotesSettings = dailyNotesPlugin.instance.options;
            if (dailyNotesSettings && dailyNotesSettings.format) {
                dailyNoteFormat = dailyNotesSettings.format;
                console.log('Using Daily Notes plugin format:', dailyNoteFormat);
            }
        } else if (calendarPlugin) {
            // Try to get format from Calendar plugin as fallback
            // @ts-ignore - Accessing internal API
            const calendarSettings = calendarPlugin.options;
            if (calendarSettings && calendarSettings.dateFormat) {
                dailyNoteFormat = calendarSettings.dateFormat;
                console.log('Using Calendar plugin format:', dailyNoteFormat);
            }
        }
        
        for (const file of files) {
            // Check if the file is a daily note
            if (moment(file.basename, dailyNoteFormat, true).isValid()) {
                await this.loadTransactionsFromFile(file.path);
            }
        }
    }

    /**
     * Load transactions from a specific file
     */
    private async loadTransactionsFromFile(filePath: string): Promise<void> {
        const transactions = await parseTransactionsFromFile(this.app, filePath, this.plugin.settings);
        this.transactions = [...this.transactions, ...transactions];
    }

    /**
     * Render the statistics view
     */
    private renderStats(): void {
        const { contentEl } = this;
        contentEl.empty();
        
        // Add tab navigation
        this.addTabNavigation();
        
        // Add filter controls
        this.addFilterControls();
        
        // Create container for the current tab
        const tabContentEl = contentEl.createDiv('tab-content');
        
        // Render the appropriate tab
        switch (this.currentTab) {
            case StatsTab.OVERVIEW:
                this.renderOverviewTab(tabContentEl);
                break;
            case StatsTab.TRANSACTIONS:
                this.renderTransactionsTab(tabContentEl);
                break;
            case StatsTab.CALENDAR:
                this.renderCalendarTab(tabContentEl);
                break;
            case StatsTab.ACCOUNTS:
                this.renderAccountsTab(tabContentEl);
                break;
            case StatsTab.TRENDS:
                this.renderTrendsTab(tabContentEl);
                break;
            case StatsTab.ANALYSIS:
                this.renderAnalysisTab(tabContentEl);
                break;
            case StatsTab.REPORTS:
                this.renderReportsTab(tabContentEl);
                break;
        }
    }

    /**
     * Add tab navigation to the view
     */
    private addTabNavigation(): void {
        const tabsEl = this.contentEl.createDiv('stats-tabs');
        
        // Create tabs
        const tabs = [
            { id: StatsTab.OVERVIEW, label: 'Overview' },
            { id: StatsTab.TRANSACTIONS, label: 'Transactions' },
            { id: StatsTab.CALENDAR, label: 'Calendar' },
            { id: StatsTab.ACCOUNTS, label: 'Accounts' },
            { id: StatsTab.TRENDS, label: 'Trends' },
            { id: StatsTab.ANALYSIS, label: 'Analysis' },
            { id: StatsTab.REPORTS, label: 'Reports' }
        ];
        
        tabs.forEach(tab => {
            const tabEl = tabsEl.createEl('button', { 
                text: tab.label, 
                cls: ['stats-tab', tab.id === this.currentTab ? 'active' : ''] 
            });
            
            tabEl.addEventListener('click', () => {
                // Update current tab
                this.currentTab = tab.id as StatsTab;
                
                // Remove active class from all tabs
                tabsEl.querySelectorAll('.stats-tab').forEach(el => {
                    el.removeClass('active');
                });
                
                // Add active class to clicked tab
                tabEl.addClass('active');
                
                // Re-render stats
                this.renderStats();
            });
        });
        
        // Add secondary tabs if needed
        if (this.currentTab === StatsTab.OVERVIEW) {
            this.addSecondaryTabNavigation();
        }
    }

    /**
     * Add secondary tab navigation for more detailed views
     */
    private addSecondaryTabNavigation(): void {
        const secondaryTabsEl = this.contentEl.createDiv('secondary-stats-tabs');
        
        // Create tabs
        const tabs = [
            { id: SecondaryTab.DAILY, label: 'Daily' },
            { id: SecondaryTab.MONTHLY, label: 'Monthly' },
            { id: SecondaryTab.YEARLY, label: 'Yearly' },
            { id: SecondaryTab.CUSTOM, label: 'Custom' }
        ];
        
        tabs.forEach(tab => {
            const tabEl = secondaryTabsEl.createEl('button', { 
                text: tab.label, 
                cls: ['secondary-stats-tab', tab.id === this.currentSecondaryTab ? 'active' : ''] 
            });
            
            tabEl.addEventListener('click', () => {
                // Update current secondary tab
                this.currentSecondaryTab = tab.id as SecondaryTab;
                
                // Remove active class from all tabs
                secondaryTabsEl.querySelectorAll('.secondary-stats-tab').forEach(el => {
                    el.removeClass('active');
                });
                
                // Add active class to clicked tab
                tabEl.addClass('active');
                
                // Re-render stats
                this.renderStats();
            });
        });
    }

    /**
     * Add filter controls to the view
     */
    private addFilterControls(): void {
        const filterSection = this.contentEl.createDiv('stats-filters');
        filterSection.createEl('h3', { text: 'Filters' });
        
        // Date range filter
        const dateRangeEl = filterSection.createDiv('date-range-filter');
        dateRangeEl.createEl('label', { text: 'Date Range:' });
        
        const dateRangeSelect = dateRangeEl.createEl('select');
        
        const dateRangeOptions = [
            { value: 'this-month', label: 'This Month' },
            { value: 'last-month', label: 'Last Month' },
            { value: 'this-year', label: 'This Year' },
            { value: 'last-year', label: 'Last Year' },
            { value: 'all-time', label: 'All Time' },
            { value: 'custom', label: 'Custom Range' }
        ];
        
        dateRangeOptions.forEach(option => {
            const optionEl = dateRangeSelect.createEl('option');
            optionEl.value = option.value;
            optionEl.text = option.label;
        });
        
        dateRangeSelect.value = this.dateRange;
        dateRangeSelect.addEventListener('change', () => {
            this.dateRange = dateRangeSelect.value;
            
            // Show/hide custom date inputs
            if (this.dateRange === 'custom') {
                customDateContainer.style.display = 'block';
            } else {
                customDateContainer.style.display = 'none';
            }
        });
        
        // Custom date range container
        const customDateContainer = dateRangeEl.createDiv('custom-date-container');
        customDateContainer.style.display = this.dateRange === 'custom' ? 'block' : 'none';
        customDateContainer.style.marginTop = '10px';
        
        // Start date
        const startDateContainer = customDateContainer.createDiv();
        startDateContainer.createEl('label', { text: 'Start Date:' });
        startDateContainer.style.marginBottom = '5px';
        
        const startDateInput = startDateContainer.createEl('input', {
            type: 'date',
            value: this.customStartDate
        });
        
        startDateInput.addEventListener('change', () => {
            this.customStartDate = startDateInput.value;
        });
        
        // End date
        const endDateContainer = customDateContainer.createDiv();
        endDateContainer.createEl('label', { text: 'End Date:' });
        endDateContainer.style.marginBottom = '5px';
        
        const endDateInput = endDateContainer.createEl('input', {
            type: 'date',
            value: this.customEndDate
        });
        
        endDateInput.addEventListener('change', () => {
            this.customEndDate = endDateInput.value;
        });
        
        // Transaction type filter
        const typeFilterEl = filterSection.createDiv('type-filter');
        typeFilterEl.createEl('label', { text: 'Type:' });
        
        const typeSelect = typeFilterEl.createEl('select');
        
        // Add "All Types" option
        const allTypesOption = typeSelect.createEl('option');
        allTypesOption.value = 'all';
        allTypesOption.text = 'All Types';
        
        // Add type options
        const incomeOption = typeSelect.createEl('option');
        incomeOption.value = 'income';
        incomeOption.text = 'Income';
        
        const expenseOption = typeSelect.createEl('option');
        expenseOption.value = 'expense';
        expenseOption.text = 'Expense';
        
        typeSelect.value = this.selectedType;
        typeSelect.addEventListener('change', () => {
            this.selectedType = typeSelect.value;
        });
        
        // Account filter
        const accountFilterEl = filterSection.createDiv('account-filter');
        accountFilterEl.createEl('label', { text: 'Account:' });
        
        const accountSelect = accountFilterEl.createEl('select');
        
        // Add "All Accounts" option
        const allAccountsOption = accountSelect.createEl('option');
        allAccountsOption.value = 'all';
        allAccountsOption.text = 'All Accounts';
        
        // Add account options
        const accounts = flattenHierarchy(this.plugin.settings.accounts);
        accounts.forEach(account => {
            const accountOption = accountSelect.createEl('option');
            accountOption.value = account.id;
            accountOption.text = account.name;
        });
        
        accountSelect.value = this.selectedAccountId;
        accountSelect.addEventListener('change', () => {
            this.selectedAccountId = accountSelect.value;
        });
        
        // Category filter
        const categoryFilterEl = filterSection.createDiv('category-filter');
        categoryFilterEl.createEl('label', { text: 'Category:' });
        
        const categorySelect = categoryFilterEl.createEl('select');
        
        // Add "All Categories" option
        const allCategoriesOption = categorySelect.createEl('option');
        allCategoriesOption.value = 'all';
        allCategoriesOption.text = 'All Categories';
        
        // Add category options
        const categories = flattenHierarchy(this.plugin.settings.categories);
        categories.forEach(category => {
            const categoryOption = categorySelect.createEl('option');
            categoryOption.value = category.id;
            categoryOption.text = category.name;
        });
        
        categorySelect.value = this.selectedCategoryId;
        categorySelect.addEventListener('change', () => {
            this.selectedCategoryId = categorySelect.value;
        });
        
        // Apply button
        const applyButton = filterSection.createEl('button', { text: 'Apply Filters' });
        applyButton.addEventListener('click', () => {
            this.applyFilters();
        });
    }

    /**
     * Apply filters and update the view
     */
    private applyFilters(): void {
        this.renderStats();
    }

    /**
     * Get filtered transactions based on current filters
     */
    private getFilteredTransactions(): Transaction[] {
        return this.transactions.filter(transaction => {
            // Filter by date range
            if (!this.isTransactionInDateRange(transaction)) {
                return false;
            }
            
            // Filter by type
            if (this.selectedType !== 'all' && transaction.type !== this.selectedType) {
                return false;
            }
            
            // Filter by account
            if (this.selectedAccountId !== 'all' && transaction.accountId !== this.selectedAccountId) {
                return false;
            }
            
            // Filter by category
            if (this.selectedCategoryId !== 'all' && transaction.categoryId !== this.selectedCategoryId) {
                return false;
            }
            
            return true;
        });
    }

    /**
     * Check if a transaction is within the selected date range
     */
    private isTransactionInDateRange(transaction: Transaction): boolean {
        // Extract just the date part and parse it
        const dateString = transaction.date.includes(' ') 
            ? transaction.date.split(' ')[0] 
            : transaction.date;
            
        const transactionDate = moment(dateString, 'YYYY-MM-DD');
        const now = moment();
        
        switch (this.dateRange) {
            case 'this-month':
                return transactionDate.isSame(now, 'month');
            
            case 'last-month':
                const lastMonth = moment().subtract(1, 'month');
                return transactionDate.isSame(lastMonth, 'month');
            
            case 'this-year':
                return transactionDate.isSame(now, 'year');
            
            case 'last-year':
                const lastYear = moment().subtract(1, 'year');
                return transactionDate.isSame(lastYear, 'year');
            
            case 'all-time':
                return true;
            
            case 'custom':
                if (!this.customStartDate && !this.customEndDate) {
                    return true;
                }
                
                let isAfterStart = true;
                let isBeforeEnd = true;
                
                if (this.customStartDate) {
                    const startDate = moment(this.customStartDate);
                    isAfterStart = transactionDate.isSameOrAfter(startDate, 'day');
                }
                
                if (this.customEndDate) {
                    const endDate = moment(this.customEndDate);
                    isBeforeEnd = transactionDate.isSameOrBefore(endDate, 'day');
                }
                
                return isAfterStart && isBeforeEnd;
            
            default:
                return true;
        }
    }

    /**
     * Calculate total income, expenses, and balance from transactions
     */
    private calculateTotals(transactions: Transaction[]): { income: number, expenses: number, balance: number } {
        let income = 0;
        let expenses = 0;
        
        transactions.forEach(transaction => {
            if (transaction.type === 'income') {
                income += transaction.amount;
            } else {
                expenses += transaction.amount;
            }
        });
        
        return {
            income,
            expenses,
            balance: income - expenses
        };
    }

    /**
     * Render the Overview tab
     */
    private renderOverviewTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Overview' });
        
        // Add summary section
        this.addSummarySection(containerEl);
        
        // Render the appropriate secondary tab
        switch (this.currentSecondaryTab) {
            case SecondaryTab.DAILY:
                this.renderDailyOverview(containerEl);
                break;
            case SecondaryTab.MONTHLY:
                this.renderMonthlyOverview(containerEl);
                break;
            case SecondaryTab.YEARLY:
                this.renderYearlyOverview(containerEl);
                break;
            case SecondaryTab.CUSTOM:
                this.renderCustomOverview(containerEl);
                break;
        }
    }
    
    /**
     * Add summary section with income, expense, and balance cards
     */
    private addSummarySection(containerEl: HTMLElement): void {
        const summarySection = containerEl.createDiv('stats-summary');
        summarySection.createEl('h3', { text: 'Summary' });
        
        const summaryGrid = summarySection.createDiv('summary-grid');
        
        // Get filtered transactions
        const filteredTransactions = this.getFilteredTransactions();
        
        // Calculate totals
        const totals = this.calculateTotals(filteredTransactions);
        
        // Income card
        const incomeCard = summaryGrid.createDiv('summary-card income-card');
        incomeCard.createEl('h4', { text: 'Income' });
        const incomeValue = incomeCard.createDiv('summary-value');
        incomeValue.setText(`¥${totals.income.toFixed(2)}`);
        
        // Expense card
        const expenseCard = summaryGrid.createDiv('summary-card expense-card');
        expenseCard.createEl('h4', { text: 'Expenses' });
        const expenseValue = expenseCard.createDiv('summary-value');
        expenseValue.setText(`¥${totals.expenses.toFixed(2)}`);
        
        // Balance card
        const balanceCard = summaryGrid.createDiv('summary-card balance-card');
        balanceCard.createEl('h4', { text: 'Balance' });
        const balanceValue = balanceCard.createDiv('summary-value');
        balanceValue.setText(`¥${totals.balance.toFixed(2)}`);
        if (totals.balance >= 0) {
            balanceValue.addClass('positive');
        } else {
            balanceValue.addClass('negative');
        }
        
        // Transaction count card
        const countCard = summaryGrid.createDiv('summary-card count-card');
        countCard.createEl('h4', { text: 'Transactions' });
        const countValue = countCard.createDiv('summary-value');
        countValue.setText(filteredTransactions.length.toString());
    }
    
    /**
     * Render daily overview with recent transactions, asset summary, and budget progress
     */
    private renderDailyOverview(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Daily Overview' });
        
        // Create container for daily charts
        const chartsContainer = containerEl.createDiv('daily-charts-container');
        
        // Render recent transactions chart (last 7 days)
        this.renderRecentTransactionsChart(chartsContainer);
        
        // Render asset summary
        this.renderAssetSummary(chartsContainer);
        
        // Render budget progress
        this.renderBudgetProgress(chartsContainer);
    }
    
    /**
     * Render monthly overview with transactions chart, asset trend, and expense breakdown
     */
    private renderMonthlyOverview(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Monthly Overview' });
        
        // Create month selector
        this.createMonthSelector(containerEl);
        
        // Create container for monthly charts
        const chartsContainer = containerEl.createDiv('monthly-charts-container');
        
        // Render monthly transactions chart
        this.renderMonthlyTransactionsChart(chartsContainer);
        
        // Render asset trend
        this.renderAssetTrendChart(chartsContainer);
        
        // Render expense breakdown
        this.renderExpenseBreakdownChart(chartsContainer);
        
        // Render expense data
        this.renderExpenseData(chartsContainer);
    }
    
    /**
     * Render yearly overview with yearly transactions, heatmap, and asset trend
     */
    private renderYearlyOverview(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Yearly Overview' });
        
        // Create year selector
        this.createYearSelector(containerEl);
        
        // Create container for yearly charts
        const chartsContainer = containerEl.createDiv('yearly-charts-container');
        
        // Render yearly transactions chart
        this.renderYearlyTransactionsChart(chartsContainer);
        
        // Render yearly heatmap
        this.renderYearlyHeatmap(chartsContainer);
        
        // Render yearly asset trend
        this.renderYearlyAssetTrend(chartsContainer);
        
        // Render expense breakdown
        this.renderExpenseBreakdownChart(chartsContainer);
        
        // Render expense data
        this.renderExpenseData(chartsContainer);
    }
    
    /**
     * Render custom period overview with custom date range selector
     */
    private renderCustomOverview(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Custom Period Overview' });
        
        // Create custom date range selector
        this.createCustomDateRangeSelector(containerEl);
        
        // Create container for custom charts
        const chartsContainer = containerEl.createDiv('custom-charts-container');
        
        // Render custom transactions chart
        this.renderCustomTransactionsChart(chartsContainer);
        
        // Render asset trend
        this.renderAssetTrendChart(chartsContainer);
        
        // Render expense breakdown
        this.renderExpenseBreakdownChart(chartsContainer);
        
        // Render expense data
        this.renderExpenseData(chartsContainer);
    }

    /**
     * Render recent transactions chart
     */
    private renderRecentTransactionsChart(containerEl: HTMLElement): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Recent Transactions (Last 7 Days)' });
        
        // Get filtered transactions
        const filteredTransactions = this.getFilteredTransactions();
        
        if (filteredTransactions.length === 0) {
            chartContainer.createEl('p', { text: 'No transactions found for the selected filters.' });
            return;
        }
        
        // Get the last 7 days
        const today = moment();
        const days: string[] = [];
        for (let i = 6; i >= 0; i--) {
            days.push(today.clone().subtract(i, 'days').format('YYYY-MM-DD'));
        }
        
        // Group transactions by day
        const transactionsByDay: Record<string, { income: number, expense: number }> = {};
        
        // Initialize all days with zero values
        days.forEach(day => {
            transactionsByDay[day] = { income: 0, expense: 0 };
        });
        
        // Calculate totals for each day
        filteredTransactions.forEach(transaction => {
            const dateString = transaction.date.includes(' ') 
                ? transaction.date.split(' ')[0] 
                : transaction.date;
                
            if (days.includes(dateString)) {
                if (transaction.type === 'income') {
                    transactionsByDay[dateString].income += transaction.amount;
                } else {
                    transactionsByDay[dateString].expense += transaction.amount;
                }
            }
        });
        
        // Create chart
        const chartEl = chartContainer.createDiv('recent-transactions-chart');
        
        // Find the maximum value for scaling
        let maxValue = 0;
        days.forEach(day => {
            const dayData = transactionsByDay[day];
            maxValue = Math.max(maxValue, dayData.income, dayData.expense);
        });
        
        // Add some padding to the max value
        maxValue = maxValue * 1.1 || 100; // Default to 100 if all values are 0
        
        // Create bars for each day
        days.forEach(day => {
            const dayData = transactionsByDay[day];
            
            // Create day container
            const dayContainer = chartEl.createDiv('day-container');
            
            // Create bars container
            const barsContainer = dayContainer.createDiv('day-bars');
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv('bar-wrapper');
            const incomeBar = incomeBarWrapper.createDiv('income-bar');
            const incomeHeight = (dayData.income / maxValue) * 100;
            incomeBar.style.height = `${incomeHeight}%`;
            
            // Add value label
            if (dayData.income > 0) {
                const valueLabel = incomeBar.createDiv('bar-value');
                valueLabel.setText(`¥${dayData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv('bar-wrapper');
            const expenseBar = expenseBarWrapper.createDiv('expense-bar');
            const expenseHeight = (dayData.expense / maxValue) * 100;
            expenseBar.style.height = `${expenseHeight}%`;
            
            // Add value label
            if (dayData.expense > 0) {
                const valueLabel = expenseBar.createDiv('bar-value');
                valueLabel.setText(`¥${dayData.expense.toFixed(0)}`);
            }
            
            // Day label
            const dayLabel = dayContainer.createDiv('day-label');
            dayLabel.setText(moment(day).format('MM/DD'));
        });
        
        // Add legend
        const legend = chartContainer.createDiv('chart-legend');
        
        const incomeLegend = legend.createDiv('legend-item');
        const incomeColor = incomeLegend.createDiv('legend-color income-color');
        incomeLegend.createEl('span', { text: 'Income' });
        
        const expenseLegend = legend.createDiv('legend-item');
        const expenseColor = expenseLegend.createDiv('legend-color expense-color');
        expenseLegend.createEl('span', { text: 'Expenses' });
    }
    
    private renderAssetSummary(containerEl: HTMLElement): void {
        const summaryContainer = containerEl.createDiv('summary-container');
        summaryContainer.createEl('h4', { text: 'Asset Summary' });
        
        // Get all accounts
        const accounts = this.plugin.settings.accounts;
        
        if (accounts.length === 0) {
            summaryContainer.createEl('p', { text: 'No accounts found.' });
            return;
        }
        
        // Calculate account balances
        const accountBalances: Record<string, { 
            income: number, 
            expense: number, 
            balance: number,
            transactions: number
        }> = {};
        
        // Initialize account balances
        accounts.forEach(account => {
            accountBalances[account.id] = {
                income: 0,
                expense: 0,
                balance: 0,
                transactions: 0
            };
        });
        
        // Calculate balances from transactions
        this.transactions.forEach(transaction => {
            if (!transaction.accountId) return;
            
            const account = accountBalances[transaction.accountId];
            
            if (!account) return;
            
            if (transaction.type === 'income') {
                account.income += transaction.amount;
                account.balance += transaction.amount;
            } else {
                account.expense += transaction.amount;
                account.balance -= transaction.amount;
            }
            
            account.transactions++;
        });
        
        // Create table
        const table = summaryContainer.createEl('table', { cls: 'asset-summary-table' });
        
        // Table header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        
        const headers = ['Account', 'Balance', 'Income', 'Expenses', 'Transactions'];
        
        headers.forEach(header => {
            headerRow.createEl('th', { text: header });
        });
        
        // Table body
        const tbody = table.createEl('tbody');
        
        // Total values
        let totalBalance = 0;
        let totalIncome = 0;
        let totalExpense = 0;
        let totalTransactions = 0;
        
        // Add rows for each account
        accounts.forEach(account => {
            const balance = accountBalances[account.id];
            
            const row = tbody.createEl('tr');
            
            // Account name
            row.createEl('td', { text: account.name });
            
            // Balance
            const balanceCell = row.createEl('td');
            balanceCell.setText(`¥${balance.balance.toFixed(2)}`);
            if (balance.balance >= 0) {
                balanceCell.addClass('positive');
            } else {
                balanceCell.addClass('negative');
            }
            
            // Income
            const incomeCell = row.createEl('td');
            incomeCell.setText(`¥${balance.income.toFixed(2)}`);
            incomeCell.addClass('income-value');
            
            // Expenses
            const expenseCell = row.createEl('td');
            expenseCell.setText(`¥${balance.expense.toFixed(2)}`);
            expenseCell.addClass('expense-value');
            
            // Transactions
            row.createEl('td', { text: balance.transactions.toString() });
            
            // Add to totals
            totalBalance += balance.balance;
            totalIncome += balance.income;
            totalExpense += balance.expense;
            totalTransactions += balance.transactions;
        });
        
        // Add total row
        const totalRow = tbody.createEl('tr', { cls: 'total-row' });
        
        totalRow.createEl('td', { text: 'Total', cls: 'total-label' });
        
        const totalBalanceCell = totalRow.createEl('td');
        totalBalanceCell.setText(`¥${totalBalance.toFixed(2)}`);
        if (totalBalance >= 0) {
            totalBalanceCell.addClass('positive');
        } else {
            totalBalanceCell.addClass('negative');
        }
        
        const totalIncomeCell = totalRow.createEl('td');
        totalIncomeCell.setText(`¥${totalIncome.toFixed(2)}`);
        totalIncomeCell.addClass('income-value');
        
        const totalExpenseCell = totalRow.createEl('td');
        totalExpenseCell.setText(`¥${totalExpense.toFixed(2)}`);
        totalExpenseCell.addClass('expense-value');
        
        totalRow.createEl('td', { text: totalTransactions.toString() });
    }
    
    private renderBudgetProgress(containerEl: HTMLElement): void {
        const budgetContainer = containerEl.createDiv('budget-container');
        budgetContainer.createEl('h4', { text: 'Budget Progress' });
        
        // Get filtered transactions
        const filteredTransactions = this.getFilteredTransactions();
        
        if (filteredTransactions.length === 0) {
            budgetContainer.createEl('p', { text: 'No transactions found for the selected filters.' });
            return;
        }
        
        // Get current month and year
        const currentMonth = moment().month() + 1; // moment months are 0-indexed
        const currentYear = moment().year();
        
        // Get relevant budgets (for current month/year)
        const relevantBudgets = this.plugin.settings.budgets.filter(budget => {
            // Monthly budgets for current month
            if (budget.period === 'monthly' && budget.month === currentMonth && budget.year === currentYear) {
                return true;
            }
            
            // Yearly budgets for current year
            if (budget.period === 'yearly' && budget.year === currentYear) {
                return true;
            }
            
            return false;
        });
        
        if (relevantBudgets.length === 0) {
            budgetContainer.createEl('p', { text: 'No budgets set for the current period.' });
            return;
        }
        
        // Create progress container
        const progressContainer = budgetContainer.createDiv('budget-progress-container');
        
        // Process each budget
        relevantBudgets.forEach(budget => {
            // Calculate spent amount based on budget scope
            let spentAmount = 0;
            
            // Filter transactions based on budget scope
            const scopedTransactions = filteredTransactions.filter(transaction => {
                // Only count expenses
                if (transaction.type !== 'expense') {
                    return false;
                }
                
                // Check if transaction is within budget period
                const transactionDate = moment(transaction.date.split(' ')[0]);
                const isInPeriod = budget.period === 'monthly' 
                    ? transactionDate.month() + 1 === budget.month && transactionDate.year() === budget.year
                    : transactionDate.year() === budget.year;
                
                if (!isInPeriod) {
                    return false;
                }
                
                // Check budget scope
                if (budget.categoryId && transaction.categoryId !== budget.categoryId) {
                    return false;
                }
                
                if (budget.accountId && transaction.accountId !== budget.accountId) {
                    return false;
                }
                
                if (budget.tagId && !transaction.tagIds?.includes(budget.tagId)) {
                    return false;
                }
                
                return true;
            });
            
            // Calculate total spent
            scopedTransactions.forEach(transaction => {
                spentAmount += transaction.amount;
            });
            
            // Create progress item
            const progressItem = progressContainer.createDiv('budget-progress-item');
            
            // Create label
            const progressLabel = progressItem.createDiv('budget-progress-label');
            
            // Budget name and scope
            let scopeText = '';
            if (budget.categoryId) {
                const category = findCategoryById(this.plugin.settings.categories, budget.categoryId);
                if (category) {
                    scopeText = ` (${category.name})`;
                }
            } else if (budget.tagId) {
                const tag = findTagById(this.plugin.settings.tags, budget.tagId);
                if (tag) {
                    scopeText = ` (${tag.name})`;
                }
            } else if (budget.accountId) {
                const account = findAccountById(this.plugin.settings.accounts, budget.accountId);
                if (account) {
                    scopeText = ` (${account.name})`;
                }
            }
            
            const nameSpan = progressLabel.createSpan();
            nameSpan.setText(`${budget.name}${scopeText}`);
            
            // Amount spent vs budget
            const amountSpan = progressLabel.createSpan();
            amountSpan.setText(`¥${spentAmount.toFixed(2)} / ¥${budget.amount.toFixed(2)}`);
            
            // Create progress bar
            const progressBarContainer = progressItem.createDiv('budget-progress-bar-container');
            const progressBar = progressBarContainer.createDiv('budget-progress-bar');
            
            // Calculate percentage
            const percentage = (spentAmount / budget.amount) * 100;
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
            
            // Add warning/danger classes
            if (percentage >= 90) {
                progressBar.addClass('danger');
            } else if (percentage >= 75) {
                progressBar.addClass('warning');
            }
        });
    }
    
    private createMonthSelector(containerEl: HTMLElement): void {
        const selectorContainer = containerEl.createDiv('month-selector-container');
        
        // Implementation will be added later
        selectorContainer.createEl('p', { text: 'Month selector will be displayed here.' });
    }
    
    private renderMonthlyTransactionsChart(containerEl: HTMLElement): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Monthly Transactions' });
        
        // Implementation will be added later
        chartContainer.createEl('p', { text: 'Monthly transactions chart will be displayed here.' });
    }
    
    private renderAssetTrendChart(containerEl: HTMLElement): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Asset Trend' });
        
        // Implementation will be added later
        chartContainer.createEl('p', { text: 'Asset trend chart will be displayed here.' });
    }
    
    private renderExpenseBreakdownChart(containerEl: HTMLElement): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Expense Breakdown' });
        
        // Implementation will be added later
        chartContainer.createEl('p', { text: 'Expense breakdown chart will be displayed here.' });
    }
    
    private renderExpenseData(containerEl: HTMLElement): void {
        const dataContainer = containerEl.createDiv('data-container');
        dataContainer.createEl('h4', { text: 'Expense Data' });
        
        // Implementation will be added later
        dataContainer.createEl('p', { text: 'Expense data will be displayed here.' });
    }
    
    private createYearSelector(containerEl: HTMLElement): void {
        const selectorContainer = containerEl.createDiv('year-selector-container');
        
        // Implementation will be added later
        selectorContainer.createEl('p', { text: 'Year selector will be displayed here.' });
    }
    
    private renderYearlyTransactionsChart(containerEl: HTMLElement): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Yearly Transactions' });
        
        // Implementation will be added later
        chartContainer.createEl('p', { text: 'Yearly transactions chart will be displayed here.' });
    }
    
    private renderYearlyHeatmap(containerEl: HTMLElement): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Yearly Heatmap' });
        
        // Implementation will be added later
        chartContainer.createEl('p', { text: 'Yearly heatmap will be displayed here.' });
    }
    
    private renderYearlyAssetTrend(containerEl: HTMLElement): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Yearly Asset Trend' });
        
        // Implementation will be added later
        chartContainer.createEl('p', { text: 'Yearly asset trend chart will be displayed here.' });
    }
    
    private createCustomDateRangeSelector(containerEl: HTMLElement): void {
        const selectorContainer = containerEl.createDiv('custom-date-range-selector-container');
        
        // Implementation will be added later
        selectorContainer.createEl('p', { text: 'Custom date range selector will be displayed here.' });
    }
    
    private renderCustomTransactionsChart(containerEl: HTMLElement): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Custom Period Transactions' });
        
        // Implementation will be added later
        chartContainer.createEl('p', { text: 'Custom period transactions chart will be displayed here.' });
    }

    /**
     * Render the Transactions tab
     */
    private renderTransactionsTab(containerEl: HTMLElement): void {
        // Implementation will be added later
    }

    /**
     * Render the Calendar tab
     */
    private renderCalendarTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Transaction Calendar' });
        
        // Create month selector
        const selectorContainer = containerEl.createDiv('calendar-selector-container');
        
        // Get current month and year
        const currentDate = moment(this.selectedDate);
        const currentMonth = currentDate.month();
        const currentYear = currentDate.year();
        
        // Create month/year selector
        const monthYearSelector = selectorContainer.createDiv('month-year-selector');
        
        // Previous month button
        const prevMonthBtn = monthYearSelector.createEl('button', { 
            cls: 'calendar-nav-btn',
            text: '←'
        });
        
        prevMonthBtn.addEventListener('click', () => {
            const newDate = moment(this.selectedDate).subtract(1, 'month');
            this.selectedDate = newDate.format('YYYY-MM-DD');
            containerEl.empty();
            this.renderCalendarTab(containerEl);
        });
        
        // Month/year display
        const monthYearDisplay = monthYearSelector.createEl('span', {
            cls: 'month-year-display',
            text: currentDate.format('MMMM YYYY')
        });
        
        // Next month button
        const nextMonthBtn = monthYearSelector.createEl('button', { 
            cls: 'calendar-nav-btn',
            text: '→'
        });
        
        nextMonthBtn.addEventListener('click', () => {
            const newDate = moment(this.selectedDate).add(1, 'month');
            this.selectedDate = newDate.format('YYYY-MM-DD');
            containerEl.empty();
            this.renderCalendarTab(containerEl);
        });
        
        // Today button
        const todayBtn = selectorContainer.createEl('button', {
            cls: 'calendar-today-button',
            text: 'Today'
        });
        
        todayBtn.addEventListener('click', () => {
            this.selectedDate = moment().format('YYYY-MM-DD');
            containerEl.empty();
            this.renderCalendarTab(containerEl);
        });
        
        // Create calendar container
        const calendarContainer = containerEl.createDiv('calendar-container');
        
        // Create weekday headers
        const weekdaysContainer = calendarContainer.createDiv('calendar-weekdays');
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        weekdays.forEach(day => {
            const weekdayEl = weekdaysContainer.createDiv('calendar-weekday');
            weekdayEl.setText(day);
        });
        
        // Create calendar grid
        const calendarGrid = calendarContainer.createDiv('calendar-grid');
        
        // Get first day of month and total days
        const firstDayOfMonth = moment([currentYear, currentMonth, 1]);
        const daysInMonth = firstDayOfMonth.daysInMonth();
        const firstDayWeekday = firstDayOfMonth.day(); // 0 = Sunday, 6 = Saturday
        
        // Add empty cells for days before the first day of month
        for (let i = 0; i < firstDayWeekday; i++) {
            calendarGrid.createDiv('calendar-day empty');
        }
        
        // Get filtered transactions for the month
        const monthStart = moment([currentYear, currentMonth, 1]).format('YYYY-MM-DD');
        const monthEnd = moment([currentYear, currentMonth, daysInMonth]).format('YYYY-MM-DD');
        
        const monthTransactions = this.transactions.filter(transaction => {
            const dateString = transaction.date.includes(' ') 
                ? transaction.date.split(' ')[0] 
                : transaction.date;
                
            return dateString >= monthStart && dateString <= monthEnd;
        });
        
        // Group transactions by day
        const transactionsByDay: Record<string, Transaction[]> = {};
        
        monthTransactions.forEach(transaction => {
            const dateString = transaction.date.includes(' ') 
                ? transaction.date.split(' ')[0] 
                : transaction.date;
                
            if (!transactionsByDay[dateString]) {
                transactionsByDay[dateString] = [];
            }
            
            transactionsByDay[dateString].push(transaction);
        });
        
        // Add calendar days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = moment([currentYear, currentMonth, day]);
            const dateString = date.format('YYYY-MM-DD');
            const isToday = date.isSame(moment(), 'day');
            
            const dayCell = calendarGrid.createDiv({
                cls: `calendar-day ${isToday ? 'today' : ''}`
            });
            
            // Day number
            const dayNumberEl = dayCell.createDiv('day-number');
            dayNumberEl.setText(day.toString());
            
            // Check if there are transactions for this day
            const dayTransactions = transactionsByDay[dateString] || [];
            
            if (dayTransactions.length > 0) {
                // Calculate totals for the day
                let dayIncome = 0;
                let dayExpense = 0;
                
                dayTransactions.forEach(transaction => {
                    if (transaction.type === 'income') {
                        dayIncome += transaction.amount;
                    } else {
                        dayExpense += transaction.amount;
                    }
                });
                
                const dayBalance = dayIncome - dayExpense;
                
                // Create transaction summary
                const transactionSummary = dayCell.createDiv('day-transaction-summary');
                
                // Transaction count
                const transactionCountEl = transactionSummary.createDiv('transaction-count');
                transactionCountEl.setText(`${dayTransactions.length} transaction${dayTransactions.length > 1 ? 's' : ''}`);
                
                // Income
                if (dayIncome > 0) {
                    const dayIncomeEl = transactionSummary.createDiv('day-income');
                    dayIncomeEl.setText(`+¥${dayIncome.toFixed(2)}`);
                }
                
                // Expense
                if (dayExpense > 0) {
                    const dayExpenseEl = transactionSummary.createDiv('day-expense');
                    dayExpenseEl.setText(`-¥${dayExpense.toFixed(2)}`);
                }
                
                // Balance
                const balanceEl = transactionSummary.createDiv(`day-balance ${dayBalance >= 0 ? 'positive' : 'negative'}`);
                balanceEl.setText(`¥${dayBalance.toFixed(2)}`);
                
                // Make the day clickable to show transactions
                dayCell.addClass('has-transactions');
                dayCell.addEventListener('click', () => {
                    this.showDayTransactions(containerEl, dateString, dayTransactions);
                });
            }
        }
        
        // Add empty cells for days after the last day of month to complete the grid
        const totalCells = firstDayWeekday + daysInMonth;
        const remainingCells = 42 - totalCells; // 6 rows of 7 days
        
        for (let i = 0; i < remainingCells; i++) {
            if (i < 7) { // Only add cells to complete the row
                calendarGrid.createDiv('calendar-day empty');
            }
        }
    }
    
    /**
     * Show transactions for a specific day
     */
    private showDayTransactions(containerEl: HTMLElement, dateString: string, transactions: Transaction[]): void {
        // Clear the container and re-render the calendar
        containerEl.empty();
        this.renderCalendarTab(containerEl);
        
        // Create transactions container
        const transactionsContainer = containerEl.createDiv('day-transactions-container');
        
        // Add header
        transactionsContainer.createEl('h4', { 
            text: `Transactions for ${moment(dateString).format('MMMM D, YYYY')}` 
        });
        
        // Create table
        const table = transactionsContainer.createEl('table', { cls: 'transactions-table' });
        
        // Table header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        
        const headers = ['Time', 'Description', 'Category', 'Account', 'Tags', 'Amount', 'Type'];
        
        headers.forEach(header => {
            headerRow.createEl('th', { text: header });
        });
        
        // Table body
        const tbody = table.createEl('tbody');
        
        // Sort transactions by time
        const sortedTransactions = [...transactions].sort((a, b) => {
            const timeA = a.date.includes(' ') ? a.date.split(' ')[1] : '00:00';
            const timeB = b.date.includes(' ') ? b.date.split(' ')[1] : '00:00';
            return timeA.localeCompare(timeB);
        });
        
        // Add rows for each transaction
        sortedTransactions.forEach(transaction => {
            const row = tbody.createEl('tr');
            
            // Time
            const time = transaction.date.includes(' ') ? transaction.date.split(' ')[1] : '00:00';
            row.createEl('td', { text: time });
            
            // Description
            row.createEl('td', { text: transaction.description || '' });
            
            // Category
            const categoryCell = row.createEl('td');
            if (transaction.categoryId) {
                const category = findCategoryById(this.plugin.settings.categories, transaction.categoryId);
                categoryCell.setText(category ? category.name : '');
            }
            
            // Account
            const accountCell = row.createEl('td');
            if (transaction.accountId) {
                const account = findAccountById(this.plugin.settings.accounts, transaction.accountId);
                accountCell.setText(account ? account.name : '');
            }
            
            // Tags
            const tagsCell = row.createEl('td');
            if (transaction.tagIds && transaction.tagIds.length > 0) {
                const tagNames = transaction.tagIds.map(tagId => {
                    const tag = findTagById(this.plugin.settings.tags, tagId);
                    return tag ? tag.name : '';
                }).filter(name => name !== '');
                
                tagsCell.setText(tagNames.join(', '));
            }
            
            // Amount
            const amountCell = row.createEl('td');
            amountCell.setText(`¥${transaction.amount.toFixed(2)}`);
            
            // Type
            const typeCell = row.createEl('td');
            typeCell.setText(transaction.type === 'income' ? 'Income' : 'Expense');
            typeCell.addClass(transaction.type === 'income' ? 'income-type' : 'expense-type');
        });
        
        // Add close button
        const closeButton = transactionsContainer.createEl('button', {
            cls: 'close-day-transactions',
            text: 'Close'
        });
        
        closeButton.addEventListener('click', () => {
            transactionsContainer.remove();
        });
    }

    /**
     * Render the Accounts tab
     */
    private renderAccountsTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Accounts' });
        
        // Get all accounts
        const accounts = this.plugin.settings.accounts;
        
        if (accounts.length === 0) {
            containerEl.createEl('p', { text: 'No accounts found. Add accounts in the plugin settings.' });
            return;
        }
        
        // Create accounts container with two columns
        const accountsLayout = containerEl.createDiv('accounts-layout');
        
        // Left column - accounts tree
        const accountsTreeContainer = accountsLayout.createDiv('accounts-tree-container');
        accountsTreeContainer.createEl('h4', { text: 'Account Hierarchy' });
        
        // Create accounts tree
        this.renderAccountsHierarchy(accountsTreeContainer, accounts);
        
        // Right column - account details
        const accountDetailsContainer = accountsLayout.createDiv('account-details-container');
        accountDetailsContainer.createEl('h4', { text: 'Account Details' });
        accountDetailsContainer.createEl('p', { text: 'Select an account to view details.' });
    }
    
    /**
     * Render accounts hierarchy
     */
    private renderAccountsHierarchy(containerEl: HTMLElement, accounts: Account[]): void {
        // Create list for top-level accounts
        const accountsList = containerEl.createEl('ul', { cls: 'accounts-list' });
        
        // Get top-level accounts (no parent)
        const topLevelAccounts = accounts.filter(account => !account.parentId);
        
        // Sort accounts by name
        topLevelAccounts.sort((a, b) => a.name.localeCompare(b.name));
        
        // Render each top-level account
        topLevelAccounts.forEach(account => {
            this.renderAccountItem(accountsList, account, accounts);
        });
    }
    
    /**
     * Render a single account item with its children
     */
    private renderAccountItem(parentEl: HTMLElement, account: Account, allAccounts: Account[]): void {
        const accountItem = parentEl.createEl('li', { cls: 'account-item' });
        
        // Create account row
        const accountRow = accountItem.createDiv('account-row');
        
        // Calculate account balance
        let balance = 0;
        
        this.transactions.forEach(transaction => {
            if (transaction.accountId === account.id) {
                if (transaction.type === 'income') {
                    balance += transaction.amount;
                } else {
                    balance -= transaction.amount;
                }
            }
        });
        
        // Account name and balance
        accountRow.createEl('span', { cls: 'account-name', text: account.name });
        accountRow.createEl('span', { 
            cls: `account-balance ${balance >= 0 ? 'positive' : 'negative'}`,
            text: `¥${balance.toFixed(2)}`
        });
        
        // Make account row clickable to show details
        accountRow.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Remove active class from all account rows
            this.contentEl.querySelectorAll('.account-row').forEach(el => {
                el.removeClass('active');
            });
            
            // Add active class to clicked account row
            accountRow.addClass('active');
            
            // Show account details
            this.showAccountDetails(account);
        });
        
        // Check if account has children
        const childAccounts = allAccounts.filter(a => a.parentId === account.id);
        
        if (childAccounts.length > 0) {
            // Sort child accounts by name
            childAccounts.sort((a, b) => a.name.localeCompare(b.name));
            
            // Create container for child accounts
            const childrenList = accountItem.createEl('ul', { cls: 'account-children' });
            
            // Render each child account
            childAccounts.forEach(childAccount => {
                this.renderAccountItem(childrenList, childAccount, allAccounts);
            });
        }
    }
    
    /**
     * Show account details
     */
    private showAccountDetails(account: Account): void {
        // Get account details container
        const detailsContainer = this.contentEl.querySelector('.account-details-container');
        
        if (!detailsContainer) {
            return;
        }
        
        // Clear container
        detailsContainer.empty();
        
        // Add header
        detailsContainer.createEl('h4', { text: `Account: ${account.name}` });
        
        // Filter transactions for this account
        const accountTransactions = this.transactions.filter(transaction => 
            transaction.accountId === account.id
        );
        
        // Calculate totals
        let totalIncome = 0;
        let totalExpense = 0;
        
        accountTransactions.forEach(transaction => {
            if (transaction.type === 'income') {
                totalIncome += transaction.amount;
            } else {
                totalExpense += transaction.amount;
            }
        });
        
        const balance = totalIncome - totalExpense;
        
        // Create summary section
        const summarySection = detailsContainer.createDiv('account-summary');
        
        // Create summary grid
        const summaryGrid = summarySection.createDiv('summary-grid');
        
        // Income card
        const incomeCard = summaryGrid.createDiv('summary-card income-card');
        incomeCard.createEl('h5', { text: 'Income' });
        const incomeValue = incomeCard.createDiv('summary-value');
        incomeValue.setText(`¥${totalIncome.toFixed(2)}`);
        
        // Expense card
        const expenseCard = summaryGrid.createDiv('summary-card expense-card');
        expenseCard.createEl('h5', { text: 'Expenses' });
        const expenseValue = expenseCard.createDiv('summary-value');
        expenseValue.setText(`¥${totalExpense.toFixed(2)}`);
        
        // Balance card
        const balanceCard = summaryGrid.createDiv('summary-card balance-card');
        balanceCard.createEl('h5', { text: 'Balance' });
        const balanceValue = balanceCard.createDiv('summary-value');
        balanceValue.setText(`¥${balance.toFixed(2)}`);
        if (balance >= 0) {
            balanceValue.addClass('positive');
        } else {
            balanceValue.addClass('negative');
        }
        
        // Transaction count card
        const countCard = summaryGrid.createDiv('summary-card count-card');
        countCard.createEl('h5', { text: 'Transactions' });
        const countValue = countCard.createDiv('summary-value');
        countValue.setText(accountTransactions.length.toString());
        
        // If no transactions, show message
        if (accountTransactions.length === 0) {
            detailsContainer.createEl('p', { text: 'No transactions found for this account.' });
            return;
        }
        
        // Create transactions section
        const transactionsSection = detailsContainer.createDiv('account-transactions');
        transactionsSection.createEl('h5', { text: 'Recent Transactions' });
        
        // Create table
        const table = transactionsSection.createEl('table', { cls: 'transactions-table' });
        
        // Table header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        
        const headers = ['Date', 'Description', 'Category', 'Amount', 'Type'];
        
        headers.forEach(header => {
            headerRow.createEl('th', { text: header });
        });
        
        // Table body
        const tbody = table.createEl('tbody');
        
        // Sort transactions by date (newest first)
        const sortedTransactions = [...accountTransactions].sort((a, b) => {
            return b.date.localeCompare(a.date);
        });
        
        // Show only the 10 most recent transactions
        const recentTransactions = sortedTransactions.slice(0, 10);
        
        // Add rows for each transaction
        recentTransactions.forEach(transaction => {
            const row = tbody.createEl('tr');
            
            // Date
            const dateString = transaction.date.includes(' ') 
                ? transaction.date.split(' ')[0] 
                : transaction.date;
            row.createEl('td', { text: moment(dateString).format('YYYY-MM-DD') });
            
            // Description
            row.createEl('td', { text: transaction.description || '' });
            
            // Category
            const categoryCell = row.createEl('td');
            if (transaction.categoryId) {
                const category = findCategoryById(this.plugin.settings.categories, transaction.categoryId);
                categoryCell.setText(category ? category.name : '');
            }
            
            // Amount
            const amountCell = row.createEl('td');
            amountCell.setText(`¥${transaction.amount.toFixed(2)}`);
            
            // Type
            const typeCell = row.createEl('td');
            typeCell.setText(transaction.type === 'income' ? 'Income' : 'Expense');
            typeCell.addClass(transaction.type === 'income' ? 'income-type' : 'expense-type');
        });
        
        // Add "View All" button if there are more than 10 transactions
        if (accountTransactions.length > 10) {
            const viewAllButton = transactionsSection.createEl('button', {
                cls: 'view-all-button',
                text: `View All (${accountTransactions.length})`
            });
            
            viewAllButton.addEventListener('click', () => {
                this.showAllAccountTransactions(account, accountTransactions);
            });
        }
    }
    
    /**
     * Show all transactions for an account
     */
    private showAllAccountTransactions(account: Account, transactions: Transaction[]): void {
        // Get account details container
        const detailsContainer = this.contentEl.querySelector('.account-details-container');
        
        if (!detailsContainer) {
            return;
        }
        
        // Clear container
        detailsContainer.empty();
        
        // Add header
        detailsContainer.createEl('h4', { text: `All Transactions: ${account.name}` });
        
        // Add back button
        const backButton = detailsContainer.createEl('button', {
            cls: 'back-button',
            text: 'Back to Account Details'
        });
        
        backButton.addEventListener('click', () => {
            this.showAccountDetails(account);
        });
        
        // Create transactions section
        const transactionsSection = detailsContainer.createDiv('account-transactions');
        
        // Create table
        const table = transactionsSection.createEl('table', { cls: 'transactions-table' });
        
        // Table header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        
        const headers = ['Date', 'Description', 'Category', 'Tags', 'Amount', 'Type'];
        
        headers.forEach(header => {
            headerRow.createEl('th', { text: header });
        });
        
        // Table body
        const tbody = table.createEl('tbody');
        
        // Sort transactions by date (newest first)
        const sortedTransactions = [...transactions].sort((a, b) => {
            return b.date.localeCompare(a.date);
        });
        
        // Add rows for each transaction
        sortedTransactions.forEach(transaction => {
            const row = tbody.createEl('tr');
            
            // Date
            const dateString = transaction.date.includes(' ') 
                ? transaction.date.split(' ')[0] 
                : transaction.date;
            row.createEl('td', { text: moment(dateString).format('YYYY-MM-DD') });
            
            // Description
            row.createEl('td', { text: transaction.description || '' });
            
            // Category
            const categoryCell = row.createEl('td');
            if (transaction.categoryId) {
                const category = findCategoryById(this.plugin.settings.categories, transaction.categoryId);
                categoryCell.setText(category ? category.name : '');
            }
            
            // Tags
            const tagsCell = row.createEl('td');
            if (transaction.tagIds && transaction.tagIds.length > 0) {
                const tagNames = transaction.tagIds.map(tagId => {
                    const tag = findTagById(this.plugin.settings.tags, tagId);
                    return tag ? tag.name : '';
                }).filter(name => name !== '');
                
                tagsCell.setText(tagNames.join(', '));
            }
            
            // Amount
            const amountCell = row.createEl('td');
            amountCell.setText(`¥${transaction.amount.toFixed(2)}`);
            
            // Type
            const typeCell = row.createEl('td');
            typeCell.setText(transaction.type === 'income' ? 'Income' : 'Expense');
            typeCell.addClass(transaction.type === 'income' ? 'income-type' : 'expense-type');
        });
    }

    /**
     * Render the Trends tab
     */
    private renderTrendsTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Financial Trends' });
        
        // Create period selector
        const periodSelector = containerEl.createDiv('trends-period-selector');
        
        // Create period tabs
        const periodTabs = [
            { id: 'monthly', label: 'Monthly Trends' },
            { id: 'yearly', label: 'Yearly Trends' },
            { id: 'category', label: 'Category Trends' }
        ];
        
        // Current period
        let currentPeriod = 'monthly';
        
        // Create tabs
        periodTabs.forEach(tab => {
            const tabEl = periodSelector.createEl('button', {
                cls: ['trends-period-tab', tab.id === currentPeriod ? 'active' : ''],
                text: tab.label
            });
            
            tabEl.addEventListener('click', () => {
                // Update current period
                currentPeriod = tab.id;
                
                // Remove active class from all tabs
                periodSelector.querySelectorAll('.trends-period-tab').forEach(el => {
                    el.removeClass('active');
                });
                
                // Add active class to clicked tab
                tabEl.addClass('active');
                
                // Clear trends container
                trendsContainer.empty();
                
                // Render appropriate trend
                if (currentPeriod === 'monthly') {
                    this.renderMonthlyTrends(trendsContainer);
                } else if (currentPeriod === 'yearly') {
                    this.renderYearlyTrends(trendsContainer);
                } else if (currentPeriod === 'category') {
                    this.renderCategoryTrends(trendsContainer);
                }
            });
        });
        
        // Create trends container
        const trendsContainer = containerEl.createDiv('trends-container');
        
        // Render monthly trends by default
        this.renderMonthlyTrends(trendsContainer);
    }
    
    /**
     * Render monthly trends
     */
    private renderMonthlyTrends(containerEl: HTMLElement): void {
        // Get filtered transactions
        const filteredTransactions = this.getFilteredTransactions();
        
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found for the selected filters.' });
            return;
        }
        
        // Group transactions by month
        const transactionsByMonth: Record<string, { income: number, expenses: number, balance: number }> = {};
        
        // Get last 12 months
        const today = moment();
        const months: string[] = [];
        
        for (let i = 11; i >= 0; i--) {
            const month = moment().subtract(i, 'months');
            const monthKey = month.format('YYYY-MM');
            months.push(monthKey);
            
            transactionsByMonth[monthKey] = {
                income: 0,
                expenses: 0,
                balance: 0
            };
        }
        
        // Calculate totals for each month
        filteredTransactions.forEach(transaction => {
            const dateString = transaction.date.includes(' ') 
                ? transaction.date.split(' ')[0] 
                : transaction.date;
                
            const monthKey = moment(dateString).format('YYYY-MM');
            
            if (transactionsByMonth[monthKey]) {
                if (transaction.type === 'income') {
                    transactionsByMonth[monthKey].income += transaction.amount;
                } else {
                    transactionsByMonth[monthKey].expenses += transaction.amount;
                }
                
                transactionsByMonth[monthKey].balance = 
                    transactionsByMonth[monthKey].income - transactionsByMonth[monthKey].expenses;
            }
        });
        
        // Create chart section
        const chartSection = containerEl.createDiv('trends-chart-section');
        chartSection.createEl('h4', { text: 'Monthly Income & Expenses (Last 12 Months)' });
        
        // Create chart
        const chartGrid = chartSection.createDiv('trends-chart-grid');
        
        // Add bars for each month
        months.forEach(monthKey => {
            const monthData = transactionsByMonth[monthKey];
            const monthLabel = moment(monthKey).format('MMM YYYY');
            
            // Create month container
            const monthContainer = chartGrid.createDiv('trend-period-container');
            
            // Create bars container
            const barsContainer = monthContainer.createDiv('trend-bars-container');
            
            // Income bar
            if (monthData.income > 0) {
                const incomeBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
                const incomeBar = incomeBarWrapper.createDiv('trend-bar income-bar');
                
                // Calculate height percentage (max 100%)
                const maxValue = Math.max(
                    ...Object.values(transactionsByMonth).map(data => Math.max(data.income, data.expenses))
                );
                
                const heightPercentage = (monthData.income / maxValue) * 100;
                incomeBar.style.height = `${heightPercentage}%`;
                
                // Add value label
                incomeBar.createDiv('trend-bar-value', { text: `¥${monthData.income.toFixed(0)}` });
            }
            
            // Expense bar
            if (monthData.expenses > 0) {
                const expenseBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
                const expenseBar = expenseBarWrapper.createDiv('trend-bar expense-bar');
                
                // Calculate height percentage (max 100%)
                const maxValue = Math.max(
                    ...Object.values(transactionsByMonth).map(data => Math.max(data.income, data.expenses))
                );
                
                const heightPercentage = (monthData.expenses / maxValue) * 100;
                expenseBar.style.height = `${heightPercentage}%`;
                
                // Add value label
                expenseBar.createDiv('trend-bar-value', { text: `¥${monthData.expenses.toFixed(0)}` });
            }
            
            // Balance bar
            const balanceBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
            const balanceBar = balanceBarWrapper.createDiv(`trend-bar balance-bar ${monthData.balance >= 0 ? 'positive' : 'negative'}`);
            
            // Calculate height percentage (max 100%)
            const maxBalanceValue = Math.max(
                ...Object.values(transactionsByMonth).map(data => Math.abs(data.balance))
            );
            
            const balanceHeightPercentage = (Math.abs(monthData.balance) / maxBalanceValue) * 100;
            balanceBar.style.height = `${balanceHeightPercentage}%`;
            
            // Add value label
            balanceBar.createDiv('trend-bar-value', { text: `¥${monthData.balance.toFixed(0)}` });
            
            // Month label
            monthContainer.createDiv('trend-period-label', { text: monthLabel });
        });
        
        // Create legend
        const legendContainer = chartSection.createDiv('trends-legend');
        
        // Income legend item
        const incomeLegend = legendContainer.createDiv('legend-item');
        incomeLegend.createDiv('legend-color income-color');
        incomeLegend.createEl('span', { text: 'Income' });
        
        // Expense legend item
        const expenseLegend = legendContainer.createDiv('legend-item');
        expenseLegend.createDiv('legend-color expense-color');
        expenseLegend.createEl('span', { text: 'Expenses' });
        
        // Balance legend item
        const balanceLegend = legendContainer.createDiv('legend-item');
        balanceLegend.createDiv('legend-color balance-color');
        balanceLegend.createEl('span', { text: 'Balance' });
        
        // Create trend analysis section
        const analysisSection = containerEl.createDiv('trend-analysis-section');
        analysisSection.createEl('h4', { text: 'Trend Analysis' });
        
        // Calculate averages
        const totalMonths = months.length;
        const totalIncome = Object.values(transactionsByMonth).reduce((sum, data) => sum + data.income, 0);
        const totalExpenses = Object.values(transactionsByMonth).reduce((sum, data) => sum + data.expenses, 0);
        const totalBalance = totalIncome - totalExpenses;
        
        const avgIncome = totalIncome / totalMonths;
        const avgExpenses = totalExpenses / totalMonths;
        const avgBalance = totalBalance / totalMonths;
        
        // Find highest income and expense months
        let highestIncomeMonth = '';
        let highestIncomeValue = 0;
        let highestExpenseMonth = '';
        let highestExpenseValue = 0;
        
        months.forEach(monthKey => {
            const monthData = transactionsByMonth[monthKey];
            
            if (monthData.income > highestIncomeValue) {
                highestIncomeValue = monthData.income;
                highestIncomeMonth = monthKey;
            }
            
            if (monthData.expenses > highestExpenseValue) {
                highestExpenseValue = monthData.expenses;
                highestExpenseMonth = monthKey;
            }
        });
        
        // Create analysis table
        const analysisTable = analysisSection.createEl('table', { cls: 'analysis-table' });
        
        // Add rows for analysis data
        const analysisData = [
            { label: 'Average Monthly Income', value: `¥${avgIncome.toFixed(2)}` },
            { label: 'Average Monthly Expenses', value: `¥${avgExpenses.toFixed(2)}` },
            { label: 'Average Monthly Balance', value: `¥${avgBalance.toFixed(2)}` },
            { label: 'Highest Income Month', value: `${moment(highestIncomeMonth).format('MMMM YYYY')} (¥${highestIncomeValue.toFixed(2)})` },
            { label: 'Highest Expense Month', value: `${moment(highestExpenseMonth).format('MMMM YYYY')} (¥${highestExpenseValue.toFixed(2)})` },
            { label: 'Total Income (12 Months)', value: `¥${totalIncome.toFixed(2)}` },
            { label: 'Total Expenses (12 Months)', value: `¥${totalExpenses.toFixed(2)}` },
            { label: 'Total Balance (12 Months)', value: `¥${totalBalance.toFixed(2)}` }
        ];
        
        analysisData.forEach(item => {
            const row = analysisTable.createEl('tr');
            row.createEl('td', { text: item.label });
            row.createEl('td', { text: item.value });
        });
    }
    
    /**
     * Render yearly trends
     */
    private renderYearlyTrends(containerEl: HTMLElement): void {
        // Get filtered transactions
        const filteredTransactions = this.getFilteredTransactions();
        
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found for the selected filters.' });
            return;
        }
        
        // Group transactions by year
        const transactionsByYear: Record<string, { income: number, expenses: number, balance: number }> = {};
        
        // Get last 5 years
        const today = moment();
        const years: string[] = [];
        
        for (let i = 4; i >= 0; i--) {
            const year = moment().subtract(i, 'years');
            const yearKey = year.format('YYYY');
            years.push(yearKey);
            
            transactionsByYear[yearKey] = {
                income: 0,
                expenses: 0,
                balance: 0
            };
        }
        
        // Calculate totals for each year
        filteredTransactions.forEach(transaction => {
            const dateString = transaction.date.includes(' ') 
                ? transaction.date.split(' ')[0] 
                : transaction.date;
                
            const yearKey = moment(dateString).format('YYYY');
            
            if (transactionsByYear[yearKey]) {
                if (transaction.type === 'income') {
                    transactionsByYear[yearKey].income += transaction.amount;
                } else {
                    transactionsByYear[yearKey].expenses += transaction.amount;
                }
                
                transactionsByYear[yearKey].balance = 
                    transactionsByYear[yearKey].income - transactionsByYear[yearKey].expenses;
            }
        });
        
        // Create chart section
        const chartSection = containerEl.createDiv('trends-chart-section');
        chartSection.createEl('h4', { text: 'Yearly Income & Expenses (Last 5 Years)' });
        
        // Create chart
        const chartGrid = chartSection.createDiv('trends-chart-grid');
        
        // Add bars for each year
        years.forEach(yearKey => {
            const yearData = transactionsByYear[yearKey];
            
            // Create year container
            const yearContainer = chartGrid.createDiv('trend-period-container');
            
            // Create bars container
            const barsContainer = yearContainer.createDiv('trend-bars-container');
            
            // Income bar
            if (yearData.income > 0) {
                const incomeBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
                const incomeBar = incomeBarWrapper.createDiv('trend-bar income-bar');
                
                // Calculate height percentage (max 100%)
                const maxValue = Math.max(
                    ...Object.values(transactionsByYear).map(data => Math.max(data.income, data.expenses))
                );
                
                const heightPercentage = (yearData.income / maxValue) * 100;
                incomeBar.style.height = `${heightPercentage}%`;
                
                // Add value label
                incomeBar.createDiv('trend-bar-value', { text: `¥${yearData.income.toFixed(0)}` });
            }
            
            // Expense bar
            if (yearData.expenses > 0) {
                const expenseBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
                const expenseBar = expenseBarWrapper.createDiv('trend-bar expense-bar');
                
                // Calculate height percentage (max 100%)
                const maxValue = Math.max(
                    ...Object.values(transactionsByYear).map(data => Math.max(data.income, data.expenses))
                );
                
                const heightPercentage = (yearData.expenses / maxValue) * 100;
                expenseBar.style.height = `${heightPercentage}%`;
                
                // Add value label
                expenseBar.createDiv('trend-bar-value', { text: `¥${yearData.expenses.toFixed(0)}` });
            }
            
            // Balance bar
            const balanceBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
            const balanceBar = balanceBarWrapper.createDiv(`trend-bar balance-bar ${yearData.balance >= 0 ? 'positive' : 'negative'}`);
            
            // Calculate height percentage (max 100%)
            const maxBalanceValue = Math.max(
                ...Object.values(transactionsByYear).map(data => Math.abs(data.balance))
            );
            
            const balanceHeightPercentage = (Math.abs(yearData.balance) / maxBalanceValue) * 100;
            balanceBar.style.height = `${balanceHeightPercentage}%`;
            
            // Add value label
            balanceBar.createDiv('trend-bar-value', { text: `¥${yearData.balance.toFixed(0)}` });
            
            // Year label
            yearContainer.createDiv('trend-period-label', { text: yearKey });
        });
        
        // Create legend
        const legendContainer = chartSection.createDiv('trends-legend');
        
        // Income legend item
        const incomeLegend = legendContainer.createDiv('legend-item');
        incomeLegend.createDiv('legend-color income-color');
        incomeLegend.createEl('span', { text: 'Income' });
        
        // Expense legend item
        const expenseLegend = legendContainer.createDiv('legend-item');
        expenseLegend.createDiv('legend-color expense-color');
        expenseLegend.createEl('span', { text: 'Expenses' });
        
        // Balance legend item
        const balanceLegend = legendContainer.createDiv('legend-item');
        balanceLegend.createDiv('legend-color balance-color');
        balanceLegend.createEl('span', { text: 'Balance' });
        
        // Create trend analysis section
        const analysisSection = containerEl.createDiv('trend-analysis-section');
        analysisSection.createEl('h4', { text: 'Yearly Analysis' });
        
        // Calculate growth rates
        const growthRates: Record<string, { income: number, expenses: number, balance: number }> = {};
        
        for (let i = 1; i < years.length; i++) {
            const currentYear = years[i];
            const previousYear = years[i - 1];
            
            const currentData = transactionsByYear[currentYear];
            const previousData = transactionsByYear[previousYear];
            
            const incomeGrowth = previousData.income > 0 
                ? ((currentData.income - previousData.income) / previousData.income) * 100 
                : 0;
                
            const expensesGrowth = previousData.expenses > 0 
                ? ((currentData.expenses - previousData.expenses) / previousData.expenses) * 100 
                : 0;
                
            const balanceGrowth = previousData.balance !== 0 
                ? ((currentData.balance - previousData.balance) / Math.abs(previousData.balance)) * 100 
                : 0;
                
            growthRates[currentYear] = {
                income: incomeGrowth,
                expenses: expensesGrowth,
                balance: balanceGrowth
            };
        }
        
        // Create analysis table
        const analysisTable = analysisSection.createEl('table', { cls: 'analysis-table' });
        
        // Add header row
        const headerRow = analysisTable.createEl('tr');
        headerRow.createEl('th', { text: 'Year' });
        headerRow.createEl('th', { text: 'Income' });
        headerRow.createEl('th', { text: 'Expenses' });
        headerRow.createEl('th', { text: 'Balance' });
        headerRow.createEl('th', { text: 'Income Growth' });
        headerRow.createEl('th', { text: 'Expense Growth' });
        
        // Add rows for each year
        years.forEach(yearKey => {
            const yearData = transactionsByYear[yearKey];
            const growthData = growthRates[yearKey];
            
            const row = analysisTable.createEl('tr');
            row.createEl('td', { text: yearKey });
            row.createEl('td', { text: `¥${yearData.income.toFixed(2)}` });
            row.createEl('td', { text: `¥${yearData.expenses.toFixed(2)}` });
            row.createEl('td', { text: `¥${yearData.balance.toFixed(2)}` });
            
            if (growthData) {
                const incomeGrowthCell = row.createEl('td');
                incomeGrowthCell.setText(`${growthData.income.toFixed(1)}%`);
                if (growthData.income > 0) incomeGrowthCell.addClass('positive');
                if (growthData.income < 0) incomeGrowthCell.addClass('negative');
                
                const expenseGrowthCell = row.createEl('td');
                expenseGrowthCell.setText(`${growthData.expenses.toFixed(1)}%`);
                if (growthData.expenses > 0) expenseGrowthCell.addClass('negative');
                if (growthData.expenses < 0) expenseGrowthCell.addClass('positive');
            } else {
                row.createEl('td', { text: '-' });
                row.createEl('td', { text: '-' });
            }
        });
    }
    
    /**
     * Render category trends
     */
    private renderCategoryTrends(containerEl: HTMLElement): void {
        // Get filtered transactions
        const filteredTransactions = this.getFilteredTransactions();
        
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found for the selected filters.' });
            return;
        }
        
        // Create tabs for income and expense categories
        const categoryTypeTabs = containerEl.createDiv('category-type-tabs');
        
        const incomeTab = categoryTypeTabs.createEl('button', {
            cls: ['category-type-tab', 'active'],
            text: 'Income Categories'
        });
        
        const expenseTab = categoryTypeTabs.createEl('button', {
            cls: ['category-type-tab'],
            text: 'Expense Categories'
        });
        
        // Create container for category data
        const categoryDataContainer = containerEl.createDiv('category-data-container');
        
        // Function to render category data
        const renderCategoryData = (type: 'income' | 'expense') => {
            // Clear container
            categoryDataContainer.empty();
            
            // Filter transactions by type
            const typeTransactions = filteredTransactions.filter(t => t.type === type);
            
            if (typeTransactions.length === 0) {
                categoryDataContainer.createEl('p', { 
                    text: `No ${type} transactions found for the selected filters.` 
                });
                return;
            }
            
            // Group transactions by category
            const transactionsByCategory: Record<string, number> = {};
            
            typeTransactions.forEach(transaction => {
                if (transaction.categoryId) {
                    const category = findCategoryById(this.plugin.settings.categories, transaction.categoryId);
                    const categoryName = category ? category.name : 'Uncategorized';
                    
                    if (!transactionsByCategory[categoryName]) {
                        transactionsByCategory[categoryName] = 0;
                    }
                    
                    transactionsByCategory[categoryName] += transaction.amount;
                } else {
                    if (!transactionsByCategory['Uncategorized']) {
                        transactionsByCategory['Uncategorized'] = 0;
                    }
                    
                    transactionsByCategory['Uncategorized'] += transaction.amount;
                }
            });
            
            // Sort categories by amount (descending)
            const sortedCategories = Object.entries(transactionsByCategory)
                .sort((a, b) => b[1] - a[1]);
            
            // Calculate total amount
            const totalAmount = sortedCategories.reduce((sum, [_, amount]) => sum + amount, 0);
            
            // Create chart section
            const chartSection = categoryDataContainer.createDiv('category-chart-section');
            chartSection.createEl('h4', { text: `${type === 'income' ? 'Income' : 'Expense'} by Category` });
            
            // Create chart
            const chartContainer = chartSection.createDiv('category-chart-container');
            
            // Add bars for each category
            sortedCategories.forEach(([categoryName, amount]) => {
                // Create category container
                const categoryContainer = chartContainer.createDiv('category-container');
                
                // Category label
                categoryContainer.createDiv('category-label', { text: categoryName });
                
                // Category bar container
                const barContainer = categoryContainer.createDiv('category-bar-container');
                
                // Category bar
                const bar = barContainer.createDiv('category-bar');
                
                // Calculate width percentage
                const widthPercentage = (amount / totalAmount) * 100;
                bar.style.width = `${widthPercentage}%`;
                
                // Category amount and percentage
                categoryContainer.createDiv('category-value', { 
                    text: `¥${amount.toFixed(2)} (${widthPercentage.toFixed(1)}%)` 
                });
            });
            
            // Create trend analysis section
            const analysisSection = categoryDataContainer.createDiv('trend-analysis-section');
            analysisSection.createEl('h4', { text: 'Category Analysis' });
            
            // Create analysis table
            const analysisTable = analysisSection.createEl('table', { cls: 'analysis-table' });
            
            // Add header row
            const headerRow = analysisTable.createEl('tr');
            headerRow.createEl('th', { text: 'Category' });
            headerRow.createEl('th', { text: 'Amount' });
            headerRow.createEl('th', { text: 'Percentage' });
            
            // Add rows for each category
            sortedCategories.forEach(([categoryName, amount]) => {
                const row = analysisTable.createEl('tr');
                row.createEl('td', { text: categoryName });
                row.createEl('td', { text: `¥${amount.toFixed(2)}` });
                
                const percentage = (amount / totalAmount) * 100;
                row.createEl('td', { text: `${percentage.toFixed(1)}%` });
            });
            
            // Add total row
            const totalRow = analysisTable.createEl('tr', { cls: 'total-row' });
            totalRow.createEl('td', { text: 'Total' });
            totalRow.createEl('td', { text: `¥${totalAmount.toFixed(2)}` });
            totalRow.createEl('td', { text: '100%' });
        };
        
        // Render income categories by default
        renderCategoryData('income');
        
        // Add event listeners to tabs
        incomeTab.addEventListener('click', () => {
            incomeTab.addClass('active');
            expenseTab.removeClass('active');
            renderCategoryData('income');
        });
        
        expenseTab.addEventListener('click', () => {
            expenseTab.addClass('active');
            incomeTab.removeClass('active');
            renderCategoryData('expense');
        });
    }

    /**
     * Render the Analysis tab
     */
    private renderAnalysisTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Financial Analysis' });
        
        // Create analysis sections
        const overviewSection = containerEl.createDiv('analysis-section');
        overviewSection.createEl('h4', { text: 'Financial Overview' });
        
        // Get filtered transactions
        const filteredTransactions = this.getFilteredTransactions();
        
        if (filteredTransactions.length === 0) {
            overviewSection.createEl('p', { text: 'No transactions found for the selected filters.' });
            return;
        }
        
        // Calculate totals
        const totals = this.calculateTotals(filteredTransactions);
        
        // Create summary grid
        const summaryGrid = overviewSection.createDiv('summary-grid');
        
        // Income card
        const incomeCard = summaryGrid.createDiv('summary-card income-card');
        incomeCard.createEl('h5', { text: 'Total Income' });
        const incomeValue = incomeCard.createDiv('summary-value');
        incomeValue.setText(`¥${totals.income.toFixed(2)}`);
        
        // Expense card
        const expenseCard = summaryGrid.createDiv('summary-card expense-card');
        expenseCard.createEl('h5', { text: 'Total Expenses' });
        const expenseValue = expenseCard.createDiv('summary-value');
        expenseValue.setText(`¥${totals.expenses.toFixed(2)}`);
        
        // Balance card
        const balanceCard = summaryGrid.createDiv('summary-card balance-card');
        balanceCard.createEl('h5', { text: 'Balance' });
        const balanceValue = balanceCard.createDiv('summary-value');
        balanceValue.setText(`¥${totals.balance.toFixed(2)}`);
        if (totals.balance >= 0) {
            balanceValue.addClass('positive');
        } else {
            balanceValue.addClass('negative');
        }
    }

    /**
     * Render the Reports tab
     */
    private renderReportsTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Financial Reports' });
        
        // Create period selector
        const periodSelector = containerEl.createDiv('report-period-selector');
        
        // Create period tabs
        const periodTabs = [
            { id: 'daily', label: 'Daily Report' },
            { id: 'monthly', label: 'Monthly Report' },
            { id: 'yearly', label: 'Yearly Report' },
            { id: 'category', label: 'Category Report' }
        ];
        
        // Current period
        let currentPeriod = 'monthly';
        
        // Create tabs
        periodTabs.forEach(tab => {
            const tabEl = periodSelector.createEl('button', {
                cls: ['report-period-tab', tab.id === currentPeriod ? 'active' : ''],
                text: tab.label
            });
            
            tabEl.addEventListener('click', () => {
                // Update current period
                currentPeriod = tab.id;
                
                // Remove active class from all tabs
                periodSelector.querySelectorAll('.report-period-tab').forEach(el => {
                    el.removeClass('active');
                });
                
                // Add active class to clicked tab
                tabEl.addClass('active');
                
                // Clear report container
                reportContainer.empty();
                
                // Render appropriate report
                if (currentPeriod === 'daily') {
                    this.renderDailyReport(reportContainer);
                } else if (currentPeriod === 'monthly') {
                    this.renderMonthlyReport(reportContainer);
                } else if (currentPeriod === 'yearly') {
                    this.renderYearlyReport(reportContainer);
                } else if (currentPeriod === 'category') {
                    this.renderCategoryReport(reportContainer);
                }
            });
        });
        
        // Create report container
        const reportContainer = containerEl.createDiv('report-container');
        
        // Render monthly report by default
        this.renderMonthlyReport(reportContainer);
    }

    /**
     * Refresh the view with updated data
     */
    public async refreshView(): Promise<void> {
        await this.loadTransactions();
        this.renderStats();
    }
}