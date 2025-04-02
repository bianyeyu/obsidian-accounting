import { ItemView, WorkspaceLeaf, moment, TFile } from 'obsidian';
import AccountingPlugin from '../main';
import { Account, Category, Tag, Transaction, TransactionType, flattenHierarchy } from './models';
import { Translation } from './locales'; // Corrected import path
import { parseTransactionsFromFile, findAccountById, findCategoryById, findTagById, normalizeTransactionDate, getDatePart, calculateBudgetSpending, getScopeName, getPeriodDateRange } from './utils';

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
                
                // Reset secondary tab when switching main tabs
                if (this.currentTab !== StatsTab.OVERVIEW) {
                    this.currentSecondaryTab = SecondaryTab.MONTHLY; // Default to monthly or relevant default
                }
                
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
    }

    /**
     * Add secondary tab navigation for more detailed views (used in Overview tab)
     */
    private addSecondaryTabNavigation(containerEl: HTMLElement): void {
        const secondaryTabsEl = containerEl.createDiv('secondary-stats-tabs');
        
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
                
                // Re-render the current tab content (which should respect the secondary tab)
                this.renderStats(); // Re-render the whole view might be needed depending on structure
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
     * Get filtered transactions based on current filters AND the current secondary tab's scope (daily, monthly, yearly, custom)
     */
    private getFilteredTransactionsForCurrentScope(): Transaction[] {
        let startDate: moment.Moment | null = null;
        let endDate: moment.Moment | null = null;
        const now = moment();

        switch (this.currentSecondaryTab) {
            case SecondaryTab.DAILY:
                startDate = now.clone().startOf('day');
                endDate = now.clone().endOf('day');
                break;
            case SecondaryTab.MONTHLY:
                startDate = now.clone().startOf('month');
                endDate = now.clone().endOf('month');
                break;
            case SecondaryTab.YEARLY:
                startDate = now.clone().startOf('year');
                endDate = now.clone().endOf('year');
                break;
            case SecondaryTab.CUSTOM:
                // Use the main date range filter for custom
                break;
        }

        return this.transactions.filter(transaction => {
            // Filter by main date range first
            if (!this.isTransactionInDateRange(transaction)) {
                return false;
            }

            // Apply secondary tab date filtering if applicable (and not 'custom')
            if (this.currentSecondaryTab !== SecondaryTab.CUSTOM && startDate && endDate) {
                // Ensure we compare moment objects
                const transactionMoment = moment(normalizeTransactionDate(transaction.date));
                if (!transactionMoment.isBetween(startDate, endDate, undefined, '[]')) {
                    return false;
                }
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
     * Check if a transaction is within the selected date range (main filter)
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
        
        // RENDER SUMMARY (Based on secondary tab scope)
        this.addSummarySection(containerEl); // This correctly calculates and renders the summary
        
        // RENDER SECONDARY TABS
        this.addSecondaryTabNavigation(containerEl);

        // Render content based on the secondary tab
        const overviewContentEl = containerEl.createDiv('overview-content');
        switch (this.currentSecondaryTab) {
            case SecondaryTab.DAILY:
                this.renderDailyOverview(overviewContentEl);
                break;
            case SecondaryTab.MONTHLY:
                this.renderMonthlyOverview(overviewContentEl);
                break;
            case SecondaryTab.YEARLY:
                this.renderYearlyOverview(overviewContentEl);
                break;
            case SecondaryTab.CUSTOM:
                this.renderCustomOverview(overviewContentEl);
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
        
        // Get filtered transactions based on the current scope (e.g., daily, monthly)
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
        
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
        // Summary section is already added by renderOverviewTab
        containerEl.createEl('h3', { text: 'Daily Details' });
        
        const scopedTransactions = this.getScopedTransactionsForOverview();

        // Create container for daily charts
        const chartsContainer = containerEl.createDiv('daily-charts-container');
        
        // Render recent transactions chart (Adjust to show only the selected day's data?)
        // Maybe rename renderRecentTransactionsChart or make it more flexible
        this.renderRecentTransactionsChart(chartsContainer, scopedTransactions); // Pass scoped transactions
        
        // Render asset summary (shows current total balances - uses ALL transactions)
        this.renderAssetSummary(chartsContainer);
        
        // Render budget progress (uses ALL transactions up to now)
        this.renderBudgetProgress(chartsContainer);
    }
    
    /**
     * Render monthly overview with transactions chart, asset trend, and expense breakdown
     */
    private renderMonthlyOverview(containerEl: HTMLElement): void {
        // Summary section is already added by renderOverviewTab
        containerEl.createEl('h3', { text: 'Monthly Details' });
        
        // Create month selector
        this.createMonthSelector(containerEl);
        
        const scopedTransactions = this.getScopedTransactionsForOverview(); // Transactions for the selected month
        
        // Create container for monthly charts
        const chartsContainer = containerEl.createDiv('monthly-charts-container');
        
        // Render monthly transactions chart
        this.renderMonthlyTransactionsChart(chartsContainer, scopedTransactions);
        
        // Render asset trend (can be adapted for monthly view - might need more data than just scoped)
        this.renderAssetTrendChart(chartsContainer, scopedTransactions); // Pass scoped transactions
        
        // Render expense breakdown for the month
        this.renderExpenseBreakdownChart(chartsContainer, scopedTransactions);
        
        // Render expense data table for the month
        this.renderExpenseData(chartsContainer, scopedTransactions);
    }
    
    /**
     * Render yearly overview with yearly transactions, heatmap, and asset trend
     */
    private renderYearlyOverview(containerEl: HTMLElement): void {
         // Summary section is already added by renderOverviewTab
        containerEl.createEl('h3', { text: 'Yearly Details' });
        
        // Create year selector
        this.createYearSelector(containerEl);
        
        const scopedTransactions = this.getScopedTransactionsForOverview(); // Transactions for the selected year

        // Create container for yearly charts
        const chartsContainer = containerEl.createDiv('yearly-charts-container');
        
        // Render yearly transactions chart
        this.renderYearlyTransactionsChart(chartsContainer, scopedTransactions);
        
        // Render yearly heatmap (needs data for the whole year)
        this.renderYearlyHeatmap(chartsContainer, scopedTransactions);
        
        // Render yearly asset trend (needs data beyond just the year?)
        this.renderYearlyAssetTrend(chartsContainer, scopedTransactions);
        
        // Render expense breakdown for the year
        this.renderExpenseBreakdownChart(chartsContainer, scopedTransactions);
        
        // Render expense data table for the year
        this.renderExpenseData(chartsContainer, scopedTransactions);
    }
    
    /**
     * Render custom period overview with custom date range selector
     */
    private renderCustomOverview(containerEl: HTMLElement): void {
        // Summary section is already added by renderOverviewTab
        containerEl.createEl('h3', { text: 'Custom Period Details' });
        
        // Note: Custom date range is already handled by the main filter via getFilteredTransactions
        const scopedTransactions = this.getScopedTransactionsForOverview(); // Should just be getFilteredTransactions result
        
        // Create container for custom charts
        const chartsContainer = containerEl.createDiv('custom-charts-container');
        
        // Render custom transactions chart
        this.renderCustomTransactionsChart(chartsContainer, scopedTransactions);
        
        // Render asset trend for the custom period
        this.renderAssetTrendChart(chartsContainer, scopedTransactions);
        
        // Render expense breakdown for the custom period
        this.renderExpenseBreakdownChart(chartsContainer, scopedTransactions);
        
        // Render expense data table for the custom period
        this.renderExpenseData(chartsContainer, scopedTransactions);
    }

    /**
     * Render recent transactions chart
     */
    private renderRecentTransactionsChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Recent Transactions (Last 7 Days)' });
        
        // Get filtered transactions based on current view scope
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
        
        if (filteredTransactions.length === 0) {
            chartContainer.createEl('p', { text: 'No transactions found for the selected filters.' });
            return;
        }
        
        // Get the last 7 days (or adjust based on scope?)
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
        
        // Calculate totals for each day (using filtered transactions)
        filteredTransactions.forEach(transaction => {
            const dateString = getDatePart(transaction.date); // Use utility function
                
            if (days.includes(dateString)) { 
                if (transaction.type === 'income') {
                    transactionsByDay[dateString].income += transaction.amount;
                } else {
                    transactionsByDay[dateString].expense += transaction.amount;
                }
            }
        });
        
        // Create chart
        const chartEl = chartContainer.createDiv({cls: 'recent-transactions-chart'});
        
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
            const dayContainer = chartEl.createDiv({cls: 'day-container'});
            
            // Create bars container
            const barsContainer = dayContainer.createDiv({cls: 'day-bars'});
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const incomeBar = incomeBarWrapper.createDiv({cls: 'income-bar'});
            const incomeHeight = (dayData.income / maxValue) * 100;
            incomeBar.style.height = `${incomeHeight}%`;
            
            // Add value label
            if (dayData.income > 0) {
                const valueLabel = incomeBar.createDiv({cls: 'bar-value'});
                valueLabel.setText(`¥${dayData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const expenseBar = expenseBarWrapper.createDiv({cls: 'expense-bar'});
            const expenseHeight = (dayData.expense / maxValue) * 100;
            expenseBar.style.height = `${expenseHeight}%`;
            
            // Add value label
            if (dayData.expense > 0) {
                const valueLabel = expenseBar.createDiv({cls: 'bar-value'});
                valueLabel.setText(`¥${dayData.expense.toFixed(0)}`);
            }
            
            // Day label
            const dayLabel = dayContainer.createDiv({cls: 'day-label'});
            dayLabel.setText(moment(day).format('MM/DD'));
        });
        
        // Add legend
        const legend = chartContainer.createDiv({cls: 'chart-legend'});
        
        const incomeLegend = legend.createDiv({cls: 'legend-item'});
        const incomeColor = incomeLegend.createDiv({cls: 'legend-color income-color'});
        incomeLegend.createEl('span', { text: 'Income' });
        
        const expenseLegend = legend.createDiv({cls: 'legend-item'});
        const expenseColor = expenseLegend.createDiv({cls: 'legend-color expense-color'});
        expenseLegend.createEl('span', { text: 'Expenses' });
    }
    
    private renderAssetSummary(containerEl: HTMLElement): void {
        const summaryContainer = containerEl.createDiv('summary-container');
        summaryContainer.createEl('h4', { text: 'Asset Summary' });
        
        // Get all accounts (flattened)
        const accounts = flattenHierarchy(this.plugin.settings.accounts);
        
        if (accounts.length === 0) {
            summaryContainer.createEl('p', { text: 'No accounts found.' });
            return;
        }
        
        // Calculate account balances using ALL transactions (not just filtered ones for summary)
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
        
        // Calculate balances from ALL transactions
        this.transactions.forEach(transaction => {
            if (!transaction.accountId) return;
            
            // Find the top-level account if using hierarchy?
            // For now, calculate based on direct account ID
            const accountData = accountBalances[transaction.accountId];
            
            if (!accountData) return; // Account might not exist in flattened list if settings changed
            
            if (transaction.type === 'income') {
                accountData.income += transaction.amount;
                accountData.balance += transaction.amount;
            } else {
                accountData.expense += transaction.amount;
                accountData.balance -= transaction.amount;
            }
            
            accountData.transactions++;
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
            const balanceData = accountBalances[account.id];
            
            const row = tbody.createEl('tr');
            
            // Account name
            row.createEl('td', { text: account.name });
            
            // Balance
            const balanceCell = row.createEl('td');
            balanceCell.setText(`¥${balanceData.balance.toFixed(2)}`);
            if (balanceData.balance >= 0) {
                balanceCell.addClass('positive');
            } else {
                balanceCell.addClass('negative');
            }
            
            // Income
            const incomeCell = row.createEl('td');
            incomeCell.setText(`¥${balanceData.income.toFixed(2)}`);
            incomeCell.addClass('income-value');
            
            // Expenses
            const expenseCell = row.createEl('td');
            expenseCell.setText(`¥${balanceData.expense.toFixed(2)}`);
            expenseCell.addClass('expense-value');
            
            // Transactions
            row.createEl('td', { text: balanceData.transactions.toString() });
            
            // Add to totals
            totalBalance += balanceData.balance;
            totalIncome += balanceData.income;
            totalExpense += balanceData.expense;
            totalTransactions += balanceData.transactions;
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
        const i18n = this.plugin.i18n;
        const budgets = this.plugin.settings.budgets;
        const budgetSection = containerEl.createDiv('budget-progress-section');
        budgetSection.createEl('h3', { text: i18n.t('BUDGETS') });

        if (!budgets || budgets.length === 0) {
            budgetSection.createEl('p', { text: i18n.t('NO_BUDGETS_DEFINED') });
            return;
        }
        
        budgets.forEach(budget => {
            // Calculate spending based on ALL transactions up to now for the budget's period
            const { start, end } = getPeriodDateRange(budget.period); // Get range for current period
            const relevantTransactions = this.transactions.filter(t => {
                const transactionMoment = moment(normalizeTransactionDate(t.date));
                return transactionMoment.isBetween(start, end, undefined, '[]');
            });
            
            const spending = calculateBudgetSpending(
                budget,
                relevantTransactions, 
                this.plugin.settings.categories,
                this.plugin.settings.tags
            );
            const percentage = budget.amount > 0 ? (spending / budget.amount) * 100 : 0;
            const scopeName = getScopeName(
                budget.scope,
                budget.scopeId,
                this.plugin.settings.accounts,
                this.plugin.settings.categories,
                this.plugin.settings.tags,
                i18n
            );

            const budgetItemEl = budgetSection.createDiv('budget-item');
            // Try using keys directly after uppercasing
            const periodKey = budget.period.toUpperCase();
            const scopeKey = budget.scope.toUpperCase();
            const titleText = `${budget.name || i18n.t('UNNAMED_BUDGET')} (${i18n.t(periodKey as any)} - ${i18n.t(scopeKey as any)}: ${scopeName})`; // Use 'as any' to bypass strict type check for now
            budgetItemEl.createEl('div', { text: titleText, cls: 'budget-item-title' });

            const detailsEl = budgetItemEl.createDiv({ cls: 'budget-item-details' });
            detailsEl.createSpan({ text: `${i18n.t('AMOUNT')}: ${spending.toFixed(2)} / ${budget.amount.toFixed(2)} (${percentage.toFixed(1)}%)` });

            const progressBarContainer = budgetItemEl.createDiv({ cls: 'progress-bar-container' });
            const progressBar = progressBarContainer.createDiv({ cls: 'progress-bar' });
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
            
            if (percentage > 100) {
                progressBar.addClass('over-budget');
            } else if (percentage > 80) {
                progressBar.addClass('near-budget');
            } else {
                progressBar.addClass('under-budget');
            }
        });
    }
    
    private createMonthSelector(containerEl: HTMLElement): void {
        const selectorContainer = containerEl.createDiv('month-selector-container');
        
        const currentMonthMoment = moment(this.selectedDate); // Use selectedDate as the base

        // Previous month button
        const prevMonthBtn = selectorContainer.createEl('button', {
            cls: 'calendar-nav-btn',
            text: '← Prev Month'
        });
        prevMonthBtn.addEventListener('click', () => {
            const newDate = currentMonthMoment.clone().subtract(1, 'month');
            this.selectedDate = newDate.format('YYYY-MM-DD');
            // Re-render the overview tab content only
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });

        // Month/year display
        selectorContainer.createEl('span', {
            cls: 'month-year-display',
            text: currentMonthMoment.format('MMMM YYYY')
        });

        // Next month button
        const nextMonthBtn = selectorContainer.createEl('button', {
            cls: 'calendar-nav-btn',
            text: 'Next Month →'
        });
        nextMonthBtn.addEventListener('click', () => {
            const newDate = currentMonthMoment.clone().add(1, 'month');
            this.selectedDate = newDate.format('YYYY-MM-DD');
            // Re-render the overview tab content only
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });

        // Optional: Add a "This Month" button?
        const thisMonthBtn = selectorContainer.createEl('button', {
            cls: 'calendar-today-button',
            text: 'This Month'
        });
        thisMonthBtn.addEventListener('click', () => {
            this.selectedDate = moment().format('YYYY-MM-DD');
            // Re-render the overview tab content only
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });
    }
    
    private renderMonthlyTransactionsChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Daily Activity This Month' });
        
        if (transactions.length === 0) {
            chartContainer.createEl('p', { text: 'No transactions found for this month.' });
            return;
        }
        
        // Determine the days in the selected month
        const selectedMonthMoment = moment(this.selectedDate);
        const daysInMonth = selectedMonthMoment.daysInMonth();
        const monthDays: string[] = [];
        for (let day = 1; day <= daysInMonth; day++) {
            monthDays.push(selectedMonthMoment.clone().date(day).format('YYYY-MM-DD'));
        }
        
        // Group transactions by day
        const transactionsByDay: Record<string, { income: number, expense: number }> = {};
        monthDays.forEach(day => {
            transactionsByDay[day] = { income: 0, expense: 0 };
        });
        
        transactions.forEach(transaction => {
            const dateString = getDatePart(transaction.date);
            if (transactionsByDay[dateString]) {
                if (transaction.type === 'income') {
                    transactionsByDay[dateString].income += transaction.amount;
                } else {
                    transactionsByDay[dateString].expense += transaction.amount;
                }
            }
        });
        
        // Create chart grid (similar to renderRecentTransactionsChart)
        const chartEl = chartContainer.createDiv({cls: 'recent-transactions-chart monthly-chart'}); // Add specific class
        
        // Find the maximum value for scaling
        let maxValue = 0;
        monthDays.forEach(day => {
            const dayData = transactionsByDay[day];
            maxValue = Math.max(maxValue, dayData.income, dayData.expense);
        });
        maxValue = maxValue * 1.1 || 100; // Add padding, default 100
        
        // Create bars for each day
        monthDays.forEach(day => {
            const dayData = transactionsByDay[day];
            const dayMoment = moment(day);
            
            const dayContainer = chartEl.createDiv({cls: 'day-container'});
            const barsContainer = dayContainer.createDiv({cls: 'day-bars'});
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const incomeBar = incomeBarWrapper.createDiv({cls: 'income-bar'});
            const incomeHeight = (dayData.income / maxValue) * 100;
            incomeBar.style.height = `${incomeHeight}%`;
            if (dayData.income > 0) {
                incomeBar.createDiv({cls: 'bar-value'}).setText(`¥${dayData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const expenseBar = expenseBarWrapper.createDiv({cls: 'expense-bar'});
            const expenseHeight = (dayData.expense / maxValue) * 100;
            expenseBar.style.height = `${expenseHeight}%`;
            if (dayData.expense > 0) {
                expenseBar.createDiv({cls: 'bar-value'}).setText(`¥${dayData.expense.toFixed(0)}`);
            }
            
            // Day label (e.g., "1", "2", ...)
            const dayLabel = dayContainer.createDiv({cls: 'day-label'});
            dayLabel.setText(dayMoment.format('D'));
        });
        
        // Add legend (reuse logic or create helper?)
        const legend = chartContainer.createDiv({cls: 'chart-legend'});
        const incomeLegend = legend.createDiv({cls: 'legend-item'});
        incomeLegend.createDiv({cls: 'legend-color income-color'});
        incomeLegend.createEl('span', { text: 'Income' });
        const expenseLegend = legend.createDiv({cls: 'legend-item'});
        expenseLegend.createDiv({cls: 'legend-color expense-color'});
        expenseLegend.createEl('span', { text: 'Expenses' });
    }
    
    private renderAssetTrendChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Net Change Trend' }); // Changed title to reflect content
        
        if (transactions.length === 0) {
            chartContainer.createEl('p', { text: 'No transactions found for this period.' });
            return;
        }

        // Group transactions by day (simplification for now)
        const transactionsByDay: Record<string, { income: number, expense: number, net: number }> = {};
        
        // Get the unique sorted dates from the transactions
        const uniqueDates = [...new Set(transactions.map(t => getDatePart(t.date)))].sort();

        uniqueDates.forEach(dateString => {
            transactionsByDay[dateString] = { income: 0, expense: 0, net: 0 };
        });
        
        transactions.forEach(transaction => {
            const dateString = getDatePart(transaction.date);
            if (transactionsByDay[dateString]) {
                if (transaction.type === 'income') {
                    transactionsByDay[dateString].income += transaction.amount;
                } else {
                    transactionsByDay[dateString].expense += transaction.amount;
                }
                transactionsByDay[dateString].net = transactionsByDay[dateString].income - transactionsByDay[dateString].expense;
            }
        });
        
        // Create chart grid (using similar bar chart style for now)
        const chartEl = chartContainer.createDiv({cls: 'recent-transactions-chart asset-trend-chart'}); 
        
        // Find the max absolute net value for scaling
        let maxAbsNetValue = 0;
        uniqueDates.forEach(date => {
            maxAbsNetValue = Math.max(maxAbsNetValue, Math.abs(transactionsByDay[date].net));
        });
        maxAbsNetValue = maxAbsNetValue * 1.1 || 100; // Add padding, default 100
        
        // Create bars for each day
        uniqueDates.forEach(date => {
            const dayData = transactionsByDay[date];
            
            const dayContainer = chartEl.createDiv({cls: 'day-container'}); // Reuse day container
            const barsContainer = dayContainer.createDiv({cls: 'day-bars'}); // Single bar container
            
            // Net change bar (positive or negative)
            const netBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper net-bar-wrapper'});
            const netBar = netBarWrapper.createDiv({cls: `net-bar ${dayData.net >= 0 ? 'positive' : 'negative'}`});
            const barHeight = (Math.abs(dayData.net) / maxAbsNetValue) * 100;
            netBar.style.height = `${barHeight}%`;
            // Position bar correctly for negative values (e.g. using translateY or adjusting container)
            // Simple approach: let CSS handle coloring based on positive/negative class
            
            if (dayData.net !== 0) { // Add value label if not zero
                 const valueLabel = netBar.createDiv({cls: 'bar-value'});
                 valueLabel.setText(`¥${dayData.net.toFixed(0)}`);
            }

            // Day label (e.g., MM/DD)
            const dayLabel = dayContainer.createDiv({cls: 'day-label'});
            dayLabel.setText(moment(date).format('MM/DD'));
        });
        
         // Add legend for Net Change
         const legend = chartContainer.createDiv({cls: 'chart-legend'});
         const positiveLegend = legend.createDiv({cls: 'legend-item'});
         positiveLegend.createDiv({cls: 'legend-color net-positive-color'}); // Need corresponding CSS class
         positiveLegend.createEl('span', { text: 'Positive Net Change' });
         const negativeLegend = legend.createDiv({cls: 'legend-item'});
         negativeLegend.createDiv({cls: 'legend-color net-negative-color'}); // Need corresponding CSS class
         negativeLegend.createEl('span', { text: 'Negative Net Change' });
    }
    
    private renderExpenseBreakdownChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Expense Breakdown' });
        
        // Use filtered transactions for the current scope (e.g., month)
        this.renderExpensePieChart(chartContainer, transactions);
    }
    
    private renderExpenseData(containerEl: HTMLElement, transactions: Transaction[]): void {
        const dataContainer = containerEl.createDiv('data-container');
        dataContainer.createEl('h4', { text: 'Expense Data' });
        
        // Get filtered transactions for the current scope
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope().filter(t => t.type === 'expense');

        if (filteredTransactions.length === 0) {
            dataContainer.createEl('p', { text: 'No expense data found for this period.' });
            return;
        }
        
        // Group by category
        const expensesByCategory: Record<string, number> = {};
        const categories = flattenHierarchy(this.plugin.settings.categories);
        let totalExpenses = 0;

        filteredTransactions.forEach(transaction => {
            let categoryName = 'Uncategorized';
            if (transaction.categoryId) {
                const category = categories.find(c => c.id === transaction.categoryId);
                if (category) categoryName = category.name;
            }
            expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + transaction.amount;
            totalExpenses += transaction.amount;
        });

        // Sort categories by amount
        const sortedCategories = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a);

        // Create table
        const table = dataContainer.createEl('table', { cls: 'expense-data-table' });
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        headerRow.createEl('th', { text: 'Category' });
        headerRow.createEl('th', { text: 'Amount' });
        headerRow.createEl('th', { text: '%' });

        const tbody = table.createEl('tbody');
        sortedCategories.forEach(([name, amount]) => {
            const row = tbody.createEl('tr');
            row.createEl('td', { text: name });
            row.createEl('td', { text: `¥${amount.toFixed(2)}` });
            const percentage = totalExpenses > 0 ? (amount / totalExpenses * 100).toFixed(1) : '0.0';
            row.createEl('td', { text: `${percentage}%` });
        });

        // Total Row
        const tfoot = table.createEl('tfoot');
        const totalRow = tfoot.createEl('tr');
        totalRow.createEl('th', { text: 'Total' });
        totalRow.createEl('th', { text: `¥${totalExpenses.toFixed(2)}` });
        totalRow.createEl('th', { text: '100.0%' });
    }
    
    private createYearSelector(containerEl: HTMLElement): void {
        const selectorContainer = containerEl.createDiv('year-selector-container');
        
        const currentYearMoment = moment(this.selectedDate); // Use selectedDate as the base

        // Previous year button
        const prevYearBtn = selectorContainer.createEl('button', {
            cls: 'calendar-nav-btn',
            text: '← Prev Year'
        });
        prevYearBtn.addEventListener('click', () => {
            const newDate = currentYearMoment.clone().subtract(1, 'year');
            this.selectedDate = newDate.format('YYYY-MM-DD');
            // Re-render the overview tab content only
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });

        // Year display
        selectorContainer.createEl('span', {
            cls: 'year-display', // Use a specific class for year
            text: currentYearMoment.format('YYYY')
        });

        // Next year button
        const nextYearBtn = selectorContainer.createEl('button', {
            cls: 'calendar-nav-btn',
            text: 'Next Year →'
        });
        nextYearBtn.addEventListener('click', () => {
            const newDate = currentYearMoment.clone().add(1, 'year');
            this.selectedDate = newDate.format('YYYY-MM-DD');
            // Re-render the overview tab content only
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });

        // "This Year" button
        const thisYearBtn = selectorContainer.createEl('button', {
            cls: 'calendar-today-button', // Re-use class if style is similar
            text: 'This Year'
        });
        thisYearBtn.addEventListener('click', () => {
            const currentYearDate = moment().format('YYYY');
            this.selectedDate = moment(this.selectedDate).year(parseInt(currentYearDate)).format('YYYY-MM-DD'); // Keep month/day, just set year
            // Alternatively, just set to today's date
            // this.selectedDate = moment().format('YYYY-MM-DD');
            // Re-render the overview tab content only
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });
    }
    
    private renderYearlyTransactionsChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Monthly Activity This Year' });
        
        if (transactions.length === 0) {
            chartContainer.createEl('p', { text: 'No transactions found for this year.' });
            return;
        }
        
        // Define the months of the selected year
        const selectedYearMoment = moment(this.selectedDate);
        const yearMonths: string[] = [];
        const monthLabels: string[] = [];
        for (let month = 0; month < 12; month++) {
            const monthMoment = selectedYearMoment.clone().month(month);
            yearMonths.push(monthMoment.format('YYYY-MM'));
            monthLabels.push(monthMoment.format('MMM')); // e.g., "Jan", "Feb"
        }
        
        // Group transactions by month
        const transactionsByMonth: Record<string, { income: number, expense: number }> = {};
        yearMonths.forEach(monthKey => {
            transactionsByMonth[monthKey] = { income: 0, expense: 0 };
        });
        
        transactions.forEach(transaction => {
            const monthKey = moment(normalizeTransactionDate(transaction.date)).format('YYYY-MM');
            if (transactionsByMonth[monthKey]) {
                if (transaction.type === 'income') {
                    transactionsByMonth[monthKey].income += transaction.amount;
                } else {
                    transactionsByMonth[monthKey].expense += transaction.amount;
                }
            }
        });
        
        // Create chart grid (similar to monthly/daily charts)
        const chartEl = chartContainer.createDiv({cls: 'recent-transactions-chart yearly-chart'}); // Add specific class
        
        // Find the maximum value for scaling
        let maxValue = 0;
        yearMonths.forEach(monthKey => {
            const monthData = transactionsByMonth[monthKey];
            maxValue = Math.max(maxValue, monthData.income, monthData.expense);
        });
        maxValue = maxValue * 1.1 || 100; // Add padding, default 100
        
        // Create bars for each month
        yearMonths.forEach((monthKey, index) => {
            const monthData = transactionsByMonth[monthKey];
            
            const monthContainer = chartEl.createDiv({cls: 'day-container month-container'}); // Reuse class?
            const barsContainer = monthContainer.createDiv({cls: 'day-bars month-bars'});
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const incomeBar = incomeBarWrapper.createDiv({cls: 'income-bar'});
            const incomeHeight = (monthData.income / maxValue) * 100;
            incomeBar.style.height = `${incomeHeight}%`;
            if (monthData.income > 0) {
                incomeBar.createDiv({cls: 'bar-value'}).setText(`¥${monthData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const expenseBar = expenseBarWrapper.createDiv({cls: 'expense-bar'});
            const expenseHeight = (monthData.expense / maxValue) * 100;
            expenseBar.style.height = `${expenseHeight}%`;
            if (monthData.expense > 0) {
                expenseBar.createDiv({cls: 'bar-value'}).setText(`¥${monthData.expense.toFixed(0)}`);
            }
            
            // Month label (e.g., "Jan", "Feb", ...)
            const monthLabelDiv = monthContainer.createDiv({cls: 'day-label month-label'});
            monthLabelDiv.setText(monthLabels[index]);
        });
        
        // Add legend
        const legend = chartContainer.createDiv({cls: 'chart-legend'});
        const incomeLegend = legend.createDiv({cls: 'legend-item'});
        incomeLegend.createDiv({cls: 'legend-color income-color'});
        incomeLegend.createEl('span', { text: 'Income' });
        const expenseLegend = legend.createDiv({cls: 'legend-item'});
        expenseLegend.createDiv({cls: 'legend-color expense-color'});
        expenseLegend.createEl('span', { text: 'Expenses' });
    }
    
    private renderYearlyHeatmap(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Yearly Heatmap' });
        
        // Implementation will be added later
        chartContainer.createEl('p', { text: 'Yearly heatmap will be displayed here.' });
    }
    
    private renderYearlyAssetTrend(containerEl: HTMLElement, transactions: Transaction[]): void {
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
    
    private renderCustomTransactionsChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Custom Period Transactions' });
        
        // Implementation will be added later
        chartContainer.createEl('p', { text: 'Custom period transactions chart will be displayed here.' });
    }

    /**
     * Render the Transactions tab
     */
    private renderTransactionsTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'All Transactions' });

        // Use the main filter controls (already added)
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope(); // Use the scoped filter

        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found matching the selected filters.' });
            return;
        }

        // Create table
        const table = containerEl.createEl('table', { cls: 'transactions-table full-transactions-table' });
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        const headers = ['Date', 'Description', 'Category', 'Account', 'Tags', 'Amount', 'Type'];
        headers.forEach(header => headerRow.createEl('th', { text: header }));

        const tbody = table.createEl('tbody');
        const categories = flattenHierarchy(this.plugin.settings.categories);
        const accounts = flattenHierarchy(this.plugin.settings.accounts);
        const tags = flattenHierarchy(this.plugin.settings.tags);

        // Sort transactions by date (most recent first)
        const sortedTransactions = [...filteredTransactions].sort((a, b) => 
            moment(normalizeTransactionDate(b.date)).diff(moment(normalizeTransactionDate(a.date)))
        );

        sortedTransactions.forEach(transaction => {
            const row = tbody.createEl('tr');
            const transactionMoment = moment(normalizeTransactionDate(transaction.date));
            row.createEl('td', { text: transactionMoment.format('YYYY-MM-DD HH:mm') }); // Include time
            row.createEl('td', { text: transaction.description || '' });

            // Category
            const category = categories.find(c => c.id === transaction.categoryId);
            row.createEl('td', { text: category ? category.name : '?' });

            // Account
            const account = accounts.find(a => a.id === transaction.accountId);
            row.createEl('td', { text: account ? account.name : '?' });

            // Tags
            const tagNames = (transaction.tagIds || [])
                .map(tagId => tags.find(t => t.id === tagId)?.name)
                .filter(Boolean)
                .join(', ');
            row.createEl('td', { text: tagNames });

            // Amount
            const amountCell = row.createEl('td');
            amountCell.setText(`¥${transaction.amount.toFixed(2)}`);
            amountCell.addClass(transaction.type === 'income' ? 'income-value' : 'expense-value');

            // Type
            const typeCell = row.createEl('td');
            typeCell.setText(transaction.type);
            typeCell.addClass(transaction.type === 'income' ? 'income-type' : 'expense-type');
        });
    }

    /**
     * Render the Calendar tab
     */
    private renderCalendarTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Transaction Calendar' });
        
        // Create month selector
        const selectorContainer = containerEl.createDiv('calendar-selector-container');
        
        // Get current month and year from selectedDate
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
            // Re-render the calendar tab content only
            this.rerenderCurrentTabContent(containerEl);
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
             // Re-render the calendar tab content only
             this.rerenderCurrentTabContent(containerEl);
        });
        
        // Today button
        const todayBtn = selectorContainer.createEl('button', {
            cls: 'calendar-today-button',
            text: 'Today'
        });
        
        todayBtn.addEventListener('click', () => {
            this.selectedDate = moment().format('YYYY-MM-DD');
            // Re-render the calendar tab content only
            this.rerenderCurrentTabContent(containerEl);
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
            calendarGrid.createDiv({cls: 'calendar-day empty'});
        }
        
        // Get filtered transactions for the month (using the main filters as well)
        const monthStart = moment([currentYear, currentMonth, 1]).format('YYYY-MM-DD');
        const monthEnd = moment([currentYear, currentMonth, daysInMonth]).format('YYYY-MM-DD');
        
        // Use the main filtered transactions, then filter by month
        const monthTransactions = this.getFilteredTransactionsForCurrentScope().filter(transaction => {
            const dateString = getDatePart(transaction.date); // Use utility function
            return dateString >= monthStart && dateString <= monthEnd;
        });
        
        // Group transactions by day
        const transactionsByDay: Record<string, Transaction[]> = {};
        
        monthTransactions.forEach(transaction => {
            const dateString = getDatePart(transaction.date); // Use utility function
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
                transactionCountEl.setText(`${dayTransactions.length} txn${dayTransactions.length > 1 ? 's' : ''}`);
                
                // Income
                if (dayIncome > 0) {
                    const dayIncomeEl = transactionSummary.createDiv('day-income');
                    dayIncomeEl.setText(`+¥${dayIncome.toFixed(0)}`); // Use toFixed(0) for brevity
                }
                
                // Expense
                if (dayExpense > 0) {
                    const dayExpenseEl = transactionSummary.createDiv('day-expense');
                    dayExpenseEl.setText(`-¥${dayExpense.toFixed(0)}`); // Use toFixed(0) for brevity
                }
                
                // Balance (Optional, can make it cluttered)
                // const balanceEl = transactionSummary.createDiv(`day-balance ${dayBalance >= 0 ? 'positive' : 'negative'}`);
                // balanceEl.setText(`¥${dayBalance.toFixed(2)}`);
                
                // Make the day clickable to show transactions
                dayCell.addClass('has-transactions');
                dayCell.addEventListener('click', () => {
                    // Remove any existing day-details container first
                    const existingDetails = containerEl.querySelector('.day-transactions-container');
                    if (existingDetails) existingDetails.remove();
                    this.showDayTransactions(containerEl, dateString, dayTransactions);
                });
            }
        }
        
        // Add empty cells for days after the last day of month to complete the grid
        const totalCells = firstDayWeekday + daysInMonth;
        const remainingCells = Math.ceil(totalCells / 7) * 7 - totalCells; // Calculate remaining cells for full weeks
        
        for (let i = 0; i < remainingCells; i++) {
            calendarGrid.createDiv({cls: 'calendar-day empty'});
        }
    }
    
    /**
     * Show transactions for a specific day (appends to the calendar view)
     */
    private showDayTransactions(calendarContainerEl: HTMLElement, dateString: string, transactions: Transaction[]): void {
        // Create transactions container that floats or appears below
        const transactionsContainer = calendarContainerEl.createDiv('day-transactions-container');
        transactionsContainer.style.marginTop = '10px'; // Add some space
        
        // Add header
        transactionsContainer.createEl('h4', { 
            text: `Transactions for ${moment(dateString).format('MMMM D, YYYY')}` 
        });
        
        // Create table
        const table = transactionsContainer.createEl('table', { cls: 'transactions-table compact-transactions-table' });
        
        // Table header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        
        const headers = ['Time', 'Desc', 'Cat', 'Acc', 'Tags', 'Amount', 'Type']; // Use shorter headers
        
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
        
        const categories = flattenHierarchy(this.plugin.settings.categories);
        const accounts = flattenHierarchy(this.plugin.settings.accounts);
        const tags = flattenHierarchy(this.plugin.settings.tags);

        // Add rows for each transaction
        sortedTransactions.forEach(transaction => {
            const row = tbody.createEl('tr');
            
            // Time
            const time = transaction.date.includes(' ') ? transaction.date.split(' ')[1] : '--:--';
            row.createEl('td', { text: time });
            
            // Description (truncated maybe?)
            row.createEl('td', { text: transaction.description || '' });
            
            // Category
            const category = categories.find(c => c.id === transaction.categoryId);
            row.createEl('td', { text: category ? category.name : '?' });
            
            // Account
            const account = accounts.find(a => a.id === transaction.accountId);
            row.createEl('td', { text: account ? account.name : '?' });
            
            // Tags
            const tagNames = (transaction.tagIds || [])
                .map(tagId => tags.find(t => t.id === tagId)?.name)
                .filter(Boolean)
                .join(', ');
            row.createEl('td', { text: tagNames });
            
            // Amount
            const amountCell = row.createEl('td');
            amountCell.setText(`¥${transaction.amount.toFixed(2)}`);
            amountCell.addClass(transaction.type === 'income' ? 'income-value' : 'expense-value');
            
            // Type
            const typeCell = row.createEl('td');
            typeCell.setText(transaction.type.substring(0,3)); // Shorten type
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
        // Create the root UL element first and pass it
        const rootListElement = accountsTreeContainer.createEl('ul', { cls: 'accounts-list root-level' });
        this.renderAccountsHierarchy(rootListElement, accounts);
        
        // Right column - account details
        const accountDetailsContainer = accountsLayout.createDiv('account-details-container');
        accountDetailsContainer.createEl('h4', { text: 'Account Details' });
        accountDetailsContainer.createEl('p', { text: 'Select an account to view details.' });
    }
    
    /**
     * Render accounts hierarchy
     */
    private renderAccountsHierarchy(parentListEl: HTMLUListElement, accounts: Account[], level = 0): void {
        // Get accounts for the current level (top-level or children of parentId)
        // Add type assertion for closest result
        const parentLiElement = parentListEl.closest('li.account-item') as HTMLLIElement | null;
        const parentId = level === 0 ? undefined : parentLiElement?.dataset.accountId;
        
        const currentLevelAccounts = accounts.filter(account => {
            // Normalize undefined/null/empty string parentId checks
            const accParentId = account.parentId || undefined;
            return accParentId === parentId;
        });
        
        // Sort accounts by name
        currentLevelAccounts.sort((a, b) => a.name.localeCompare(b.name));
        
        // Render each account at this level
        currentLevelAccounts.forEach(account => {
            this.renderAccountItem(parentListEl, account, accounts, level);
        });
    }
    
    /**
     * Render a single account item with its children
     */
    private renderAccountItem(parentListEl: HTMLUListElement, account: Account, allAccounts: Account[], level: number): void {
        const accountItem = parentListEl.createEl('li', { cls: `account-item level-${level}` });
        accountItem.dataset.accountId = account.id;
        
        // Create account row
        const accountRow = accountItem.createDiv('account-row');
        accountRow.style.paddingLeft = `${level * 15}px`; // Indentation based on level
        
        // Calculate account balance (consider including children?)
        // For now, show balance of the account itself
        let balance = 0;
        this.transactions.forEach(transaction => {
            if (transaction.accountId === account.id) {
                balance += (transaction.type === 'income' ? transaction.amount : -transaction.amount);
            }
        });
        
        // Add expand/collapse toggle if children exist
        const childAccounts = allAccounts.filter(a => a.parentId === account.id);
        if (childAccounts.length > 0) {
            const toggle = accountRow.createSpan({ cls: 'account-toggle collapsed' });
            toggle.setText('► '); // Right-pointing triangle for collapsed
            toggle.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent row click
                const childrenList = accountItem.querySelector('ul.account-children');
                if (childrenList) {
                    if (childrenList.hasClass('hidden')) {
                        childrenList.removeClass('hidden');
                        toggle.setText('▼ '); // Down-pointing triangle for expanded
                        toggle.removeClass('collapsed');
                    } else {
                        childrenList.addClass('hidden');
                        toggle.setText('► ');
                        toggle.addClass('collapsed');
                    }
                }
            });
        }
        
        // Account name and balance
        accountRow.createEl('span', { cls: 'account-name', text: account.name });
        accountRow.createEl('span', { 
            cls: `account-balance ${balance >= 0 ? 'positive' : 'negative'}`, 
            text: `¥${balance.toFixed(2)}` 
        });
        
        // Make account row clickable to show details
        accountRow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setActiveAccountRow(accountRow);
            this.showAccountDetails(account);
        });
        
        // Render children recursively if they exist
        if (childAccounts.length > 0) {
            const childrenList = accountItem.createEl('ul', { cls: 'account-children hidden' }); // Start hidden
            // Explicitly cast childrenList to HTMLUListElement for the recursive call
            this.renderAccountsHierarchy(childrenList as HTMLUListElement, allAccounts, level + 1);
        }
    }

    /** Helper to manage active state for account rows */
    private setActiveAccountRow(rowElement: HTMLElement): void {
        this.contentEl.querySelectorAll('.account-row.active').forEach(el => el.removeClass('active'));
        rowElement.addClass('active');
    }
    
    /**
     * Show account details
     */
    private showAccountDetails(account: Account): void {
        // Get account details container
        const detailsContainer = this.contentEl.querySelector('.account-details-container') as HTMLElement;
        
        if (!detailsContainer) return;
        
        // Clear container
        detailsContainer.empty();
        
        // Add header
        detailsContainer.createEl('h4', { text: `Account: ${account.name}` });
        
        // Filter transactions for this account (and potentially its children?)
        // For now, just this account.
        const accountTransactions = this.transactions.filter(transaction => 
            transaction.accountId === account.id
        );
        
        // Calculate totals
        const totals = this.calculateTotals(accountTransactions);
        const balance = totals.balance;
        
        // Create summary section
        const summarySection = detailsContainer.createDiv('account-summary');
        const summaryGrid = summarySection.createDiv('summary-grid');
        
        // Income card
        const incomeCard = summaryGrid.createDiv('summary-card income-card');
        incomeCard.createEl('h5', { text: 'Income' });
        incomeCard.createDiv('summary-value').setText(`¥${totals.income.toFixed(2)}`);
        
        // Expense card
        const expenseCard = summaryGrid.createDiv('summary-card expense-card');
        expenseCard.createEl('h5', { text: 'Expenses' });
        expenseCard.createDiv('summary-value').setText(`¥${totals.expenses.toFixed(2)}`);
        
        // Balance card
        const balanceCard = summaryGrid.createDiv('summary-card balance-card');
        balanceCard.createEl('h5', { text: 'Balance' });
        const balanceValue = balanceCard.createDiv('summary-value');
        balanceValue.setText(`¥${balance.toFixed(2)}`);
        balanceValue.addClass(balance >= 0 ? 'positive' : 'negative');
        
        // Transaction count card
        const countCard = summaryGrid.createDiv('summary-card count-card');
        countCard.createEl('h5', { text: 'Transactions' });
        countCard.createDiv('summary-value').setText(accountTransactions.length.toString());
        
        // If no transactions, show message
        if (accountTransactions.length === 0) {
            detailsContainer.createEl('p', { text: 'No transactions found for this account.' });
            return;
        }
        
        // Create transactions section
        const transactionsSection = detailsContainer.createDiv('account-transactions');
        transactionsSection.createEl('h5', { text: 'Recent Transactions' });
        
        // Create table
        const table = transactionsSection.createEl('table', { cls: 'transactions-table compact-transactions-table' });
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        const headers = ['Date', 'Desc', 'Cat', 'Amount', 'Type']; // Compact view
        headers.forEach(header => headerRow.createEl('th', { text: header }));
        
        const tbody = table.createEl('tbody');
        const categories = flattenHierarchy(this.plugin.settings.categories);

        // Sort transactions by date (newest first)
        const sortedTransactions = [...accountTransactions].sort((a, b) => 
            moment(normalizeTransactionDate(b.date)).diff(moment(normalizeTransactionDate(a.date)))
        );
        
        // Show only the 10 most recent transactions
        const recentTransactions = sortedTransactions.slice(0, 10);
        
        // Add rows for each transaction
        recentTransactions.forEach(transaction => {
            const row = tbody.createEl('tr');
            
            // Date
            const dateString = getDatePart(transaction.date); // Use utility function
            row.createEl('td', { text: moment(dateString).format('YYYY-MM-DD') });
            
            // Description
            row.createEl('td', { text: transaction.description || '' });
            
            // Category
            const category = categories.find(c => c.id === transaction.categoryId);
            row.createEl('td', { text: category ? category.name : '?' });
            
            // Amount
            const amountCell = row.createEl('td');
            amountCell.setText(`¥${transaction.amount.toFixed(2)}`);
            amountCell.addClass(transaction.type === 'income' ? 'income-value' : 'expense-value');
            
            // Type
            const typeCell = row.createEl('td');
            typeCell.setText(transaction.type.substring(0,3)); // Shorten
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
        const detailsContainer = this.contentEl.querySelector('.account-details-container') as HTMLElement;
        
        if (!detailsContainer) return;
        
        // Clear container
        detailsContainer.empty();
        
        // Add header
        detailsContainer.createEl('h4', { text: `All Transactions: ${account.name}` });
        
        // Add back button
        const backButton = detailsContainer.createEl('button', {
            cls: 'back-button',
            text: '← Back to Account Details'
        });
        
        backButton.addEventListener('click', () => {
            // Reselect the row and show details again
            const accountRow = this.contentEl.querySelector(`.account-item[data-account-id="${account.id}"] .account-row`) as HTMLElement;
            if (accountRow) this.setActiveAccountRow(accountRow);
            this.showAccountDetails(account);
        });
        
        // Create transactions section
        const transactionsSection = detailsContainer.createDiv('account-transactions-all');
        
        // Create table
        const table = transactionsSection.createEl('table', { cls: 'transactions-table full-transactions-table' });
        
        // Table header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        
        const headers = ['Date', 'Description', 'Category', 'Tags', 'Amount', 'Type'];
        headers.forEach(header => headerRow.createEl('th', { text: header }));
        
        // Table body
        const tbody = table.createEl('tbody');
        const categories = flattenHierarchy(this.plugin.settings.categories);
        const tags = flattenHierarchy(this.plugin.settings.tags);
        
        // Sort transactions by date (newest first)
        const sortedTransactions = [...transactions].sort((a, b) => 
             moment(normalizeTransactionDate(b.date)).diff(moment(normalizeTransactionDate(a.date)))
        );
        
        // Add rows for each transaction
        sortedTransactions.forEach(transaction => {
            const row = tbody.createEl('tr');
            
            // Date
            const dateString = getDatePart(transaction.date); // Use utility function
            row.createEl('td', { text: moment(dateString).format('YYYY-MM-DD HH:mm') }); // Show time too
            
            // Description
            row.createEl('td', { text: transaction.description || '' });
            
            // Category
            const category = categories.find(c => c.id === transaction.categoryId);
            row.createEl('td', { text: category ? category.name : '?' });
            
            // Tags
             const tagNames = (transaction.tagIds || [])
                 .map(tagId => tags.find(t => t.id === tagId)?.name)
                 .filter(Boolean)
                 .join(', ');
             row.createEl('td', { text: tagNames });
            
            // Amount
            const amountCell = row.createEl('td');
            amountCell.setText(`¥${transaction.amount.toFixed(2)}`);
            amountCell.addClass(transaction.type === 'income' ? 'income-value' : 'expense-value');
            
            // Type
            const typeCell = row.createEl('td');
            typeCell.setText(transaction.type);
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
        // Get filtered transactions based on the main filters
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope(); // Use scope filter
        
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found for the selected filters.' });
            return;
        }
        
        // Group transactions by month
        const transactionsByMonth: Record<string, { income: number, expenses: number, balance: number }> = {};
        
        // Determine relevant months based on filtered data, not just last 12
        const uniqueMonths = [...new Set(filteredTransactions.map(t => moment(normalizeTransactionDate(t.date)).format('YYYY-MM')))].sort();

        // Initialize months found in data
        uniqueMonths.forEach(monthKey => {
            transactionsByMonth[monthKey] = { income: 0, expenses: 0, balance: 0 };
        });
        
        // Calculate totals for each month
        filteredTransactions.forEach(transaction => {
            const monthKey = moment(normalizeTransactionDate(transaction.date)).format('YYYY-MM');
            
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
        chartSection.createEl('h4', { text: 'Monthly Income & Expenses' });
        
        // Create chart
        const chartGrid = chartSection.createDiv('trends-chart-grid');
        
        // Find max values across all displayed months for consistent scaling
        const allIncomes = Object.values(transactionsByMonth).map(d => d.income);
        const allExpenses = Object.values(transactionsByMonth).map(d => d.expenses);
        const allBalances = Object.values(transactionsByMonth).map(d => Math.abs(d.balance));
        const maxIncomeExpense = Math.max(1, ...allIncomes, ...allExpenses); // Ensure at least 1
        const maxAbsBalance = Math.max(1, ...allBalances); // Ensure at least 1

        // Add bars for each month
        uniqueMonths.forEach(monthKey => {
            const monthData = transactionsByMonth[monthKey];
            const monthLabel = moment(monthKey).format('MMM YYYY');
            
            // Create month container
            const monthContainer = chartGrid.createDiv('trend-period-container');
            
            // Create bars container
            const barsContainer = monthContainer.createDiv('trend-bars-container');
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
            const incomeBar = incomeBarWrapper.createDiv('trend-bar income-bar');
            const incomeHeightPercentage = (monthData.income / maxIncomeExpense) * 100;
            incomeBar.style.height = `${incomeHeightPercentage}%`;
            if (monthData.income > 0) {
                const incomeValueDiv = incomeBar.createDiv('trend-bar-value');
                incomeValueDiv.setText(`¥${monthData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
            const expenseBar = expenseBarWrapper.createDiv('trend-bar expense-bar');
            const expenseHeightPercentage = (monthData.expenses / maxIncomeExpense) * 100;
            expenseBar.style.height = `${expenseHeightPercentage}%`;
            if (monthData.expenses > 0) {
                const expenseValueDiv = expenseBar.createDiv('trend-bar-value');
                expenseValueDiv.setText(`¥${monthData.expenses.toFixed(0)}`);
            }
            
            // Balance bar
            const balanceBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
            const balanceBar = balanceBarWrapper.createDiv(`trend-bar balance-bar ${monthData.balance >= 0 ? 'positive' : 'negative'}`);
            const balanceHeightPercentage = (Math.abs(monthData.balance) / maxAbsBalance) * 100;
            balanceBar.style.height = `${balanceHeightPercentage}%`;
            const balanceValueDiv = balanceBar.createDiv('trend-bar-value');
            balanceValueDiv.setText(`¥${monthData.balance.toFixed(0)}`);
            
            // Month label
            const monthLabelDiv = monthContainer.createDiv('trend-period-label');
            monthLabelDiv.setText(monthLabel);
        });
        
        // Create legend
        const legendContainer = chartSection.createDiv('trends-legend');
        const incomeLegend = legendContainer.createDiv('legend-item');
        incomeLegend.createDiv('legend-color income-color');
        incomeLegend.createEl('span', { text: 'Income' });
        const expenseLegend = legendContainer.createDiv('legend-item');
        expenseLegend.createDiv('legend-color expense-color');
        expenseLegend.createEl('span', { text: 'Expenses' });
        const balanceLegend = legendContainer.createDiv('legend-item');
        balanceLegend.createDiv('legend-color balance-color');
        balanceLegend.createEl('span', { text: 'Balance' });
        
        // Create trend analysis section
        const analysisSection = containerEl.createDiv('trend-analysis-section');
        analysisSection.createEl('h4', { text: 'Trend Analysis' });
        
        // Calculate averages over the displayed period
        const totalMonths = uniqueMonths.length;
        if (totalMonths > 0) {
            const totalIncome = allIncomes.reduce((sum, val) => sum + val, 0);
            const totalExpenses = allExpenses.reduce((sum, val) => sum + val, 0);
            const totalBalance = totalIncome - totalExpenses;
            
            const avgIncome = totalIncome / totalMonths;
            const avgExpenses = totalExpenses / totalMonths;
            const avgBalance = totalBalance / totalMonths;
            
            // Find highest income and expense months within the displayed period
            let highestIncomeMonth = '';
            let highestIncomeValue = -Infinity;
            let highestExpenseMonth = '';
            let highestExpenseValue = -Infinity;
            
            uniqueMonths.forEach(monthKey => {
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
            const analysisData = [
                { label: 'Avg Monthly Income', value: `¥${avgIncome.toFixed(2)}` },
                { label: 'Avg Monthly Expenses', value: `¥${avgExpenses.toFixed(2)}` },
                { label: 'Avg Monthly Balance', value: `¥${avgBalance.toFixed(2)}` },
                { label: 'Highest Income Month', value: `${moment(highestIncomeMonth).format('MMM YYYY')} (¥${highestIncomeValue.toFixed(2)})` },
                { label: 'Highest Expense Month', value: `${moment(highestExpenseMonth).format('MMM YYYY')} (¥${highestExpenseValue.toFixed(2)})` },
                { label: `Total Income (${totalMonths} mo)`, value: `¥${totalIncome.toFixed(2)}` },
                { label: `Total Expenses (${totalMonths} mo)`, value: `¥${totalExpenses.toFixed(2)}` },
                { label: `Total Balance (${totalMonths} mo)`, value: `¥${totalBalance.toFixed(2)}` }
            ];
            analysisData.forEach(item => {
                const row = analysisTable.createEl('tr');
                row.createEl('td', { text: item.label });
                row.createEl('td', { text: item.value });
            });
        } else {
             analysisSection.createEl('p', { text: 'Not enough data for trend analysis.' });
        }
    }
    
    /**
     * Render yearly trends
     */
    private renderYearlyTrends(containerEl: HTMLElement): void {
        // Get filtered transactions
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
        
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found for the selected filters.' });
            return;
        }
        
        // Group transactions by year
        const transactionsByYear: Record<string, { income: number, expenses: number, balance: number }> = {};
        
        // Determine relevant years based on filtered data
        const uniqueYears = [...new Set(filteredTransactions.map(t => moment(normalizeTransactionDate(t.date)).format('YYYY')))].sort();

        // Initialize years found in data
        uniqueYears.forEach(yearKey => {
            transactionsByYear[yearKey] = { income: 0, expenses: 0, balance: 0 };
        });
        
        // Calculate totals for each year
        filteredTransactions.forEach(transaction => {
            const yearKey = moment(normalizeTransactionDate(transaction.date)).format('YYYY');
            
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
        chartSection.createEl('h4', { text: 'Yearly Income & Expenses' });
        
        // Create chart
        const chartGrid = chartSection.createDiv('trends-chart-grid');

        // Find max values across all displayed years
        const allIncomes = Object.values(transactionsByYear).map(d => d.income);
        const allExpenses = Object.values(transactionsByYear).map(d => d.expenses);
        const allBalances = Object.values(transactionsByYear).map(d => Math.abs(d.balance));
        const maxIncomeExpense = Math.max(1, ...allIncomes, ...allExpenses);
        const maxAbsBalance = Math.max(1, ...allBalances);
        
        // Add bars for each year
        uniqueYears.forEach(yearKey => {
            const yearData = transactionsByYear[yearKey];
            
            // Create year container
            const yearContainer = chartGrid.createDiv('trend-period-container');
            
            // Create bars container
            const barsContainer = yearContainer.createDiv('trend-bars-container');
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
            const incomeBar = incomeBarWrapper.createDiv('trend-bar income-bar');
            const incomeHeightPercentage = (yearData.income / maxIncomeExpense) * 100;
            incomeBar.style.height = `${incomeHeightPercentage}%`;
            if (yearData.income > 0) {
                const incomeValueDiv = incomeBar.createDiv('trend-bar-value');
                incomeValueDiv.setText(`¥${yearData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
            const expenseBar = expenseBarWrapper.createDiv('trend-bar expense-bar');
            const expenseHeightPercentage = (yearData.expenses / maxIncomeExpense) * 100;
            expenseBar.style.height = `${expenseHeightPercentage}%`;
            if (yearData.expenses > 0) {
                const expenseValueDiv = expenseBar.createDiv('trend-bar-value');
                expenseValueDiv.setText(`¥${yearData.expenses.toFixed(0)}`);
            }
            
            // Balance bar
            const balanceBarWrapper = barsContainer.createDiv('trend-bar-wrapper');
            const balanceBar = balanceBarWrapper.createDiv(`trend-bar balance-bar ${yearData.balance >= 0 ? 'positive' : 'negative'}`);
            const balanceHeightPercentage = (Math.abs(yearData.balance) / maxAbsBalance) * 100;
            balanceBar.style.height = `${balanceHeightPercentage}%`;
            const balanceValueDiv = balanceBar.createDiv('trend-bar-value');
            balanceValueDiv.setText(`¥${yearData.balance.toFixed(0)}`);
            
            // Year label
            const yearLabelDiv = yearContainer.createDiv('trend-period-label');
            yearLabelDiv.setText(yearKey);
        });
        
        // Create legend
        const legendContainer = chartSection.createDiv('trends-legend');
        const incomeLegend = legendContainer.createDiv('legend-item');
        incomeLegend.createDiv('legend-color income-color');
        incomeLegend.createEl('span', { text: 'Income' });
        const expenseLegend = legendContainer.createDiv('legend-item');
        expenseLegend.createDiv('legend-color expense-color');
        expenseLegend.createEl('span', { text: 'Expenses' });
        const balanceLegend = legendContainer.createDiv('legend-item');
        balanceLegend.createDiv('legend-color balance-color');
        balanceLegend.createEl('span', { text: 'Balance' });
        
        // Create trend analysis section
        const analysisSection = containerEl.createDiv('trend-analysis-section');
        analysisSection.createEl('h4', { text: 'Yearly Analysis' });
        
        // Calculate growth rates
        const growthRates: Record<string, { income: number | null, expenses: number | null }> = {};
        
        for (let i = 1; i < uniqueYears.length; i++) {
            const currentYear = uniqueYears[i];
            const previousYear = uniqueYears[i - 1];
            
            const currentData = transactionsByYear[currentYear];
            const previousData = transactionsByYear[previousYear];
            
            const incomeGrowth = previousData.income !== 0 
                ? ((currentData.income - previousData.income) / Math.abs(previousData.income)) * 100 
                : (currentData.income !== 0 ? null : 0); // Indicate infinite growth or zero growth
                
            const expensesGrowth = previousData.expenses !== 0 
                ? ((currentData.expenses - previousData.expenses) / Math.abs(previousData.expenses)) * 100 
                : (currentData.expenses !== 0 ? null : 0);
                
            growthRates[currentYear] = {
                income: incomeGrowth,
                expenses: expensesGrowth,
            };
        }
        
        // Create analysis table
        const analysisTable = analysisSection.createEl('table', { cls: 'analysis-table' });
        const headerRow = analysisTable.createEl('tr');
        headerRow.createEl('th', { text: 'Year' });
        headerRow.createEl('th', { text: 'Income' });
        headerRow.createEl('th', { text: 'Expenses' });
        headerRow.createEl('th', { text: 'Balance' });
        headerRow.createEl('th', { text: 'Income Growth' });
        headerRow.createEl('th', { text: 'Expense Growth' });
        
        // Add rows for each year
        uniqueYears.forEach(yearKey => {
            const yearData = transactionsByYear[yearKey];
            const growthData = growthRates[yearKey];
            
            const row = analysisTable.createEl('tr');
            row.createEl('td', { text: yearKey });
            row.createEl('td', { text: `¥${yearData.income.toFixed(2)}` });
            row.createEl('td', { text: `¥${yearData.expenses.toFixed(2)}` });
            row.createEl('td', { text: `¥${yearData.balance.toFixed(2)}` });
            
            if (growthData) {
                const formatGrowth = (value: number | null) => {
                    if (value === null) return '∞'; // Infinite growth
                    if (value === 0) return '-';
                    return `${value.toFixed(1)}%`;
                };
                const addGrowthClass = (cell: HTMLTableCellElement, value: number | null) => {
                    if (value === null || value > 0) cell.addClass('positive');
                    if (value !== null && value < 0) cell.addClass('negative');
                };
                const addExpenseGrowthClass = (cell: HTMLTableCellElement, value: number | null) => {
                     if (value === null || value > 0) cell.addClass('negative'); // Higher expense is negative
                     if (value !== null && value < 0) cell.addClass('positive');
                }

                const incomeGrowthCell = row.createEl('td');
                incomeGrowthCell.setText(formatGrowth(growthData.income));
                addGrowthClass(incomeGrowthCell, growthData.income);
                
                const expenseGrowthCell = row.createEl('td');
                expenseGrowthCell.setText(formatGrowth(growthData.expenses));
                addExpenseGrowthClass(expenseGrowthCell, growthData.expenses);
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
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
        
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
            const categories = flattenHierarchy(this.plugin.settings.categories);
            
            typeTransactions.forEach(transaction => {
                let categoryName = 'Uncategorized';
                if (transaction.categoryId) {
                    const category = categories.find(c => c.id === transaction.categoryId);
                    if (category) categoryName = category.name;
                }
                transactionsByCategory[categoryName] = (transactionsByCategory[categoryName] || 0) + transaction.amount;
            });
            
            // Sort categories by amount (descending)
            const sortedCategories = Object.entries(transactionsByCategory)
                .sort((a, b) => b[1] - a[1]);
            
            // Calculate total amount
            const totalAmount = sortedCategories.reduce((sum, [_, amount]) => sum + amount, 0);
            
            // Create chart section (e.g., bar chart)
            const chartSection = categoryDataContainer.createDiv('category-chart-section');
            chartSection.createEl('h4', { text: `${type === 'income' ? 'Income' : 'Expense'} by Category` });
            const chartContainer = chartSection.createDiv('category-bar-chart-container');

            if (totalAmount > 0) {
                sortedCategories.forEach(([categoryName, amount]) => {
                    const categoryContainer = chartContainer.createDiv('category-bar-item');
                    const barLabel = categoryContainer.createDiv('category-bar-label');
                    barLabel.setText(categoryName);
                    
                    const barWrapper = categoryContainer.createDiv('category-bar-wrapper');
                    const bar = barWrapper.createDiv('category-bar');
                    const widthPercentage = (amount / totalAmount) * 100;
                    bar.style.width = `${widthPercentage}%`;
                    
                    const barValue = categoryContainer.createDiv('category-bar-value');
                    barValue.setText(`¥${amount.toFixed(2)} (${widthPercentage.toFixed(1)}%)`);
                });
            }
            
            // Create trend analysis section (Table)
            const analysisSection = categoryDataContainer.createDiv('trend-analysis-section');
            analysisSection.createEl('h4', { text: 'Category Analysis Table' });
            const analysisTable = analysisSection.createEl('table', { cls: 'analysis-table' });
            const headerRow = analysisTable.createEl('tr');
            headerRow.createEl('th', { text: 'Category' });
            headerRow.createEl('th', { text: 'Amount' });
            headerRow.createEl('th', { text: 'Percentage' });
            
            // Add rows for each category
            sortedCategories.forEach(([categoryName, amount]) => {
                const row = analysisTable.createEl('tr');
                row.createEl('td', { text: categoryName });
                row.createEl('td', { text: `¥${amount.toFixed(2)}` });
                const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
                row.createEl('td', { text: `${percentage.toFixed(1)}%` });
            });
            
            // Add total row
            const totalRow = analysisTable.createEl('tr', { cls: 'total-row' });
            totalRow.createEl('td', { text: 'Total' });
            totalRow.createEl('td', { text: `¥${totalAmount.toFixed(2)}` });
            totalRow.createEl('td', { text: totalAmount > 0 ? '100.0%' : '0.0%' });
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
        overviewSection.createEl('h4', { text: 'Financial Overview (Filtered)' });
        
        // Get filtered transactions based on scope
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
        
        if (filteredTransactions.length === 0) {
            overviewSection.createEl('p', { text: 'No transactions found for the selected filters.' });
            // Optionally render other analysis sections even if filtered is empty?
            return; 
        }
        
        // Calculate totals for the filtered period
        const totals = this.calculateTotals(filteredTransactions);
        
        // Create summary grid
        const summaryGrid = overviewSection.createDiv('summary-grid');
        
        // Income card
        const incomeCard = summaryGrid.createDiv('summary-card income-card');
        incomeCard.createEl('h5', { text: 'Total Income' });
        incomeCard.createDiv('summary-value').setText(`¥${totals.income.toFixed(2)}`);
        
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

    // Dummy renderExpensePieChart for structure - replace with actual implementation if needed
    private renderExpensePieChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('expense-pie-chart-container');
        
        // Filter for expense transactions
        const expenseTransactions = transactions.filter(t => t.type === 'expense');
        if (expenseTransactions.length === 0) {
            chartContainer.createEl('p', { text: 'No expense data for pie chart.' });
            return;
        }

        // Group expenses by category
        const expensesByCategory: Record<string, number> = {};
        const categories = flattenHierarchy(this.plugin.settings.categories);
        let totalExpenses = 0;

        expenseTransactions.forEach(transaction => {
            let categoryName = 'Uncategorized';
            if (transaction.categoryId) {
                const category = categories.find(c => c.id === transaction.categoryId);
                if (category) categoryName = category.name;
            }
            expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + transaction.amount;
            totalExpenses += transaction.amount;
        });

        if (totalExpenses <= 0) {
             chartContainer.createEl('p', { text: 'No expense value for pie chart.' });
            return;
        }

        // Sort categories by amount, descending
        const sortedCategories = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a);

        // Generate CSS conic gradient string
        let gradientString = 'conic-gradient(';
        let currentPercentage = 0;
        const colors = this.generateCategoryColors(sortedCategories.length); // Helper to get distinct colors
        
        sortedCategories.forEach(([_, amount], index) => {
            const percentage = (amount / totalExpenses) * 100;
            const color = colors[index];
            gradientString += `${color} ${currentPercentage}% ${currentPercentage + percentage}%, `;
            currentPercentage += percentage;
        });
        
        // Remove trailing comma and space, add closing parenthesis
        gradientString = gradientString.slice(0, -2) + ')';

        // Create pie element
        const pieElement = chartContainer.createDiv({ cls: 'pie-chart' });
        pieElement.style.background = gradientString;
        
        // Create legend
        const legendContainer = chartContainer.createDiv({ cls: 'pie-chart-legend' });
        sortedCategories.forEach(([categoryName, amount], index) => {
            const percentage = (amount / totalExpenses) * 100;
            const legendItem = legendContainer.createDiv({ cls: 'legend-item' });
            const colorBox = legendItem.createDiv({ cls: 'legend-color' });
            colorBox.style.backgroundColor = colors[index];
            legendItem.createEl('span', { text: `${categoryName}: ¥${amount.toFixed(2)} (${percentage.toFixed(1)}%)` });
        });
    }
    
    /**
     * Helper function to generate distinct colors for categories.
     * Simple HSL based color generation.
     */
    private generateCategoryColors(count: number): string[] {
        const colors: string[] = [];
        const hueStep = 360 / count;
        for (let i = 0; i < count; i++) {
            const hue = i * hueStep;
            // Use fixed saturation and lightness for consistency, adjust as needed
            colors.push(`hsl(${hue}, 70%, 60%)`); 
        }
        return colors;
    }

    // --- Placeholder Report Rendering Methods (Now accept transactions) ---
    private renderDailyReport(containerEl: HTMLElement): void {
        containerEl.createEl('p', { text: 'Daily report rendering is not yet implemented.' });
    }

    private renderMonthlyReport(containerEl: HTMLElement): void {
        containerEl.createEl('p', { text: 'Monthly report rendering is not yet implemented.' });
    }

    private renderYearlyReport(containerEl: HTMLElement): void {
        containerEl.createEl('p', { text: 'Yearly report rendering is not yet implemented.' });
    }

    private renderCategoryReport(containerEl: HTMLElement): void {
        containerEl.createEl('p', { text: 'Category report rendering is not yet implemented.' });
    }

    /**
     * Re-renders the content of the currently active tab.
     */
    private rerenderCurrentTabContent(containerEl: HTMLElement): void {
        // Find the main content container for tabs (assuming it exists)
        const tabContentEl = containerEl.querySelector('.tab-content');
        if (tabContentEl) {
            tabContentEl.empty(); // Clear only the tab content area
            
            // Re-render the appropriate tab based on the currentTab state
            switch (this.currentTab) {
                case StatsTab.OVERVIEW:
                    this.renderOverviewTab(tabContentEl as HTMLElement);
                    break;
                case StatsTab.TRANSACTIONS:
                    this.renderTransactionsTab(tabContentEl as HTMLElement);
                    break;
                case StatsTab.CALENDAR:
                    this.renderCalendarTab(tabContentEl as HTMLElement);
                    break;
                case StatsTab.ACCOUNTS:
                    this.renderAccountsTab(tabContentEl as HTMLElement);
                    break;
                case StatsTab.TRENDS:
                    this.renderTrendsTab(tabContentEl as HTMLElement);
                    break;
                case StatsTab.ANALYSIS:
                    this.renderAnalysisTab(tabContentEl as HTMLElement);
                    break;
                case StatsTab.REPORTS:
                    this.renderReportsTab(tabContentEl as HTMLElement);
                    break;
            }
        } else {
            // Fallback if the structure is different: re-render the whole view
            console.warn("Could not find .tab-content, re-rendering entire StatsView");
            this.renderStats();
        }
    }

    private getScopedTransactionsForOverview(): Transaction[] {
        return this.getFilteredTransactionsForCurrentScope();
    }
}