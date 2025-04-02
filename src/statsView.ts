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
        // Make the tab container flexible and allow wrapping
        tabsEl.style.display = 'flex'; 
        tabsEl.style.flexWrap = 'wrap'; 
        tabsEl.style.gap = '5px'; // Add some gap between buttons
        
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
         // Style secondary tabs similar to main tabs for consistency
        secondaryTabsEl.style.display = 'flex';
        secondaryTabsEl.style.flexWrap = 'wrap';
        secondaryTabsEl.style.gap = '5px'; 
        secondaryTabsEl.style.marginTop = '10px'; // Add some space above secondary tabs
        
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
                this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
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
        let periodDefinedBySecondaryTab = true; // Flag to check if secondary tab sets the date

        switch (this.currentSecondaryTab) {
            case SecondaryTab.DAILY:
                startDate = moment(this.selectedDate).startOf('day'); // Use selectedDate
                endDate = moment(this.selectedDate).endOf('day');
                break;
            case SecondaryTab.MONTHLY:
                 startDate = moment(this.selectedDate).startOf('month'); // Use selectedDate
                 endDate = moment(this.selectedDate).endOf('month');
                break;
            case SecondaryTab.YEARLY:
                 startDate = moment(this.selectedDate).startOf('year'); // Use selectedDate
                 endDate = moment(this.selectedDate).endOf('year');
                break;
            case SecondaryTab.CUSTOM:
                periodDefinedBySecondaryTab = false; // Custom uses the main filter
                break;
        }

        return this.transactions.filter(transaction => {
            const transactionMoment = moment(normalizeTransactionDate(transaction.date));
            
            // Filter by main date range (only if secondary tab is Custom OR if Overview tab is not selected)
             if (!periodDefinedBySecondaryTab || this.currentTab !== StatsTab.OVERVIEW) {
                 if (!this.isTransactionInMainDateRange(transaction)) {
                     return false;
                 }
             }
             
            // Apply secondary tab date filtering if applicable (and not 'custom')
            // This applies ONLY when the Overview tab is selected
            if (this.currentTab === StatsTab.OVERVIEW && periodDefinedBySecondaryTab && startDate && endDate) {
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
    private isTransactionInMainDateRange(transaction: Transaction): boolean {
        // Use normalized date for comparison
        const transactionMoment = moment(normalizeTransactionDate(transaction.date));
        const now = moment();
        
        switch (this.dateRange) {
            case 'this-month':
                return transactionMoment.isSame(now, 'month');
            
            case 'last-month':
                const lastMonth = moment().subtract(1, 'month');
                return transactionMoment.isSame(lastMonth, 'month');
            
            case 'this-year':
                return transactionMoment.isSame(now, 'year');
            
            case 'last-year':
                const lastYear = moment().subtract(1, 'year');
                return transactionMoment.isSame(lastYear, 'year');
            
            case 'all-time':
                return true;
            
            case 'custom':
                if (!this.customStartDate && !this.customEndDate) {
                    return true; // No custom dates set, include everything
                }
                
                let isAfterStart = true;
                let isBeforeEnd = true;
                
                if (this.customStartDate) {
                    // Parse custom start date assuming local time and compare at day level
                    const startDate = moment(this.customStartDate).startOf('day');
                    isAfterStart = transactionMoment.isSameOrAfter(startDate); 
                }
                
                if (this.customEndDate) {
                    // Parse custom end date assuming local time and compare at day level
                    const endDate = moment(this.customEndDate).endOf('day');
                    isBeforeEnd = transactionMoment.isSameOrBefore(endDate);
                }
                
                return isAfterStart && isBeforeEnd;
            
            default:
                return true; // Should not happen, but default to true
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
        // containerEl.createEl('h3', { text: 'Overview' }); // Title removed as tabs are above
        
        // RENDER SECONDARY TABS FIRST
        this.addSecondaryTabNavigation(containerEl);
        
        // RENDER SUMMARY (Based on secondary tab scope)
        this.addSummarySection(containerEl); // This correctly calculates and renders the summary
        

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
        // Determine the title based on the secondary tab
        let summaryTitle = 'Summary';
        const now = moment();
        switch (this.currentSecondaryTab) {
            case SecondaryTab.DAILY:
                 summaryTitle = `Summary for ${moment(this.selectedDate).format('YYYY-MM-DD')}`;
                break;
            case SecondaryTab.MONTHLY:
                 summaryTitle = `Summary for ${moment(this.selectedDate).format('MMMM YYYY')}`;
                break;
            case SecondaryTab.YEARLY:
                 summaryTitle = `Summary for ${moment(this.selectedDate).format('YYYY')}`;
                break;
            case SecondaryTab.CUSTOM:
                 // Use the main date range description for custom
                 const rangeDesc = this.dateRange === 'custom' 
                    ? `${this.customStartDate || 'Start'} to ${this.customEndDate || 'End'}`
                    : (this.dateRange.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())); // Simple capitalization
                 summaryTitle = `Summary for ${rangeDesc}`;
                 if (this.dateRange === 'all-time') summaryTitle = 'Summary for All Time';
                break;
        }
        summarySection.createEl('h3', { text: summaryTitle });
        
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
        // containerEl.createEl('h3', { text: 'Daily Details' }); // Title redundant with summary
         this.createDaySelector(containerEl); // Add day navigation
        
        const scopedTransactions = this.getFilteredTransactionsForCurrentScope(); // Use current scope

        // Create container for daily charts
        const chartsContainer = containerEl.createDiv('daily-charts-container');
        
        // Render recent transactions chart (shows only the selected day's data)
        this.renderSelectedDayChart(chartsContainer, scopedTransactions); // Pass scoped transactions
        
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
        // containerEl.createEl('h3', { text: 'Monthly Details' }); // Title redundant with summary
        
        // Create month selector
        this.createMonthSelector(containerEl);
        
        const scopedTransactions = this.getFilteredTransactionsForCurrentScope(); // Transactions for the selected month
        
        // Create container for monthly charts
        const chartsContainer = containerEl.createDiv('monthly-charts-container');
        
        // Render monthly transactions chart
        this.renderMonthlyTransactionsChart(chartsContainer, scopedTransactions);
        
        // Render asset trend for the month
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
        // containerEl.createEl('h3', { text: 'Yearly Details' }); // Title redundant with summary
        
        // Create year selector
        this.createYearSelector(containerEl);
        
        const scopedTransactions = this.getFilteredTransactionsForCurrentScope(); // Transactions for the selected year

        // Create container for yearly charts
        const chartsContainer = containerEl.createDiv('yearly-charts-container');
        
        // Render yearly transactions chart
        this.renderYearlyTransactionsChart(chartsContainer, scopedTransactions);
        
        // Render yearly heatmap (needs data for the whole year)
        this.renderYearlyHeatmap(chartsContainer, scopedTransactions);
        
        // Render yearly asset trend 
        this.renderAssetTrendChart(chartsContainer, scopedTransactions); // Use same trend chart, now scoped to year
        
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
        // containerEl.createEl('h3', { text: 'Custom Period Details' }); // Title redundant with summary
        
        // Note: Custom date range is already handled by the main filter via getFilteredTransactions
        const scopedTransactions = this.getFilteredTransactionsForCurrentScope(); // Should just be getFilteredTransactions result
        
        // Create container for custom charts
        const chartsContainer = containerEl.createDiv('custom-charts-container');
        
        // Render custom transactions chart (e.g., daily breakdown over the custom range)
        this.renderCustomTransactionsChart(chartsContainer, scopedTransactions);
        
        // Render asset trend for the custom period
        this.renderAssetTrendChart(chartsContainer, scopedTransactions);
        
        // Render expense breakdown for the custom period
        this.renderExpenseBreakdownChart(chartsContainer, scopedTransactions);
        
        // Render expense data table for the custom period
        this.renderExpenseData(chartsContainer, scopedTransactions);
    }

    /**
     * Renders a chart showing income/expense for the specifically selected day.
     */
    private renderSelectedDayChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: `Activity for ${moment(this.selectedDate).format('MMM D, YYYY')}` });

        if (transactions.length === 0) {
            chartContainer.createEl('p', { text: 'No transactions found for this day.' });
            return;
        }

        // Calculate totals for the selected day
        let dayIncome = 0;
        let dayExpense = 0;
        transactions.forEach(transaction => {
             // Double check date match (although filtering should handle this)
            if (moment(normalizeTransactionDate(transaction.date)).isSame(this.selectedDate, 'day')) {
                if (transaction.type === 'income') {
                    dayIncome += transaction.amount;
                } else {
                    dayExpense += transaction.amount;
                }
            }
        });

        // Basic display of totals for the day
        const totalsEl = chartContainer.createDiv('day-totals-simple');
        totalsEl.createEl('p', { text: `Income: ¥${dayIncome.toFixed(2)}` });
        totalsEl.createEl('p', { text: `Expense: ¥${dayExpense.toFixed(2)}` });
        totalsEl.createEl('p', { text: `Net: ¥${(dayIncome - dayExpense).toFixed(2)}` });
        
        // Optionally, list the transactions for the day below the totals
        this.renderTransactionListForDay(chartContainer, transactions);
    }

    /** Helper to list transactions for the selected day in the Daily Overview */
    private renderTransactionListForDay(containerEl: HTMLElement, transactions: Transaction[]): void {
         const listContainer = containerEl.createDiv('day-transaction-list');
         listContainer.createEl('h5', { text: 'Transactions on this Day' });

         if (transactions.length === 0) {
             listContainer.createEl('p', { text: 'None.' });
             return;
         }

         const table = listContainer.createEl('table', { cls: 'transactions-table compact-transactions-table' });
         const thead = table.createEl('thead');
         const headerRow = thead.createEl('tr');
         const headers = ['Time', 'Desc', 'Cat', 'Acc', 'Amount', 'Type'];
         headers.forEach(header => headerRow.createEl('th', { text: header }));

         const tbody = table.createEl('tbody');
         const categories = flattenHierarchy(this.plugin.settings.categories);
         const accounts = flattenHierarchy(this.plugin.settings.accounts);

         transactions.sort((a, b) => moment(normalizeTransactionDate(a.date)).diff(moment(normalizeTransactionDate(b.date))))
             .forEach(transaction => {
                 const row = tbody.createEl('tr');
                 row.createEl('td', { text: moment(normalizeTransactionDate(transaction.date)).format('HH:mm') });
                 row.createEl('td', { text: transaction.description || '' });
                 const category = categories.find(c => c.id === transaction.categoryId);
                 row.createEl('td', { text: category ? category.name : '?' });
                 const account = accounts.find(a => a.id === transaction.accountId);
                 row.createEl('td', { text: account ? account.name : '?' });
                 const amountCell = row.createEl('td');
                 amountCell.setText(`¥${transaction.amount.toFixed(2)}`);
                 amountCell.addClass(transaction.type === 'income' ? 'income-value' : 'expense-value');
                 const typeCell = row.createEl('td');
                 typeCell.setText(transaction.type.substring(0, 3));
                 typeCell.addClass(transaction.type === 'income' ? 'income-type' : 'expense-type');
             });
    }
    
    private renderAssetSummary(containerEl: HTMLElement): void {
        const summaryContainer = containerEl.createDiv('summary-container');
        summaryContainer.createEl('h4', { text: 'Asset Summary (Current Balances)' });
        
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
        
        // Calculate balances from ALL transactions up to the current moment (or end of selected period?)
        // Using all transactions gives the *current* snapshot balance.
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
        
        const headers = ['Account', 'Balance', 'Total Income', 'Total Expenses', 'Txns']; // Shorten headers
        
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
            const { start, end } = getPeriodDateRange(budget.period); // Get range for *current* period
            const relevantTransactions = this.transactions.filter(t => {
                const transactionMoment = moment(normalizeTransactionDate(t.date));
                // Filter transactions within the budget's current period AND matching the budget's scope
                 return transactionMoment.isBetween(start, end, undefined, '[]') && 
                        this.isTransactionInBudgetScope(t, budget);
            });
            
            const spending = relevantTransactions.reduce((sum, t) => sum + t.amount, 0); // Assuming budget tracks expenses

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
            // Make title shorter if possible
            const budgetDisplayName = budget.name || i18n.t('UNNAMED_BUDGET');
            const scopeInfo = `${i18n.t(scopeKey as any)}: ${scopeName}`;
            const titleText = `${budgetDisplayName} (${i18n.t(periodKey as any)}, ${scopeInfo})`; 
            budgetItemEl.createEl('div', { text: titleText, cls: 'budget-item-title' });

            const detailsEl = budgetItemEl.createDiv({ cls: 'budget-item-details' });
            detailsEl.createSpan({ text: `${i18n.t('AMOUNT')}: ¥${spending.toFixed(2)} / ¥${budget.amount.toFixed(2)} (${percentage.toFixed(1)}%)` });

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

     /** Helper to check if a transaction matches a budget's scope */
    private isTransactionInBudgetScope(transaction: Transaction, budget: any): boolean {
        if (budget.scope === 'all') return true;
        if (budget.scope === 'account' && transaction.accountId === budget.scopeId) return true;
        if (budget.scope === 'category' && transaction.categoryId === budget.scopeId) return true;
        if (budget.scope === 'tag' && transaction.tagIds?.includes(budget.scopeId)) return true;
        // Add checks for hierarchical scopes if needed later
        return false;
    }

    private createDaySelector(containerEl: HTMLElement): void {
        const selectorContainer = containerEl.createDiv('day-selector-container', el => {
            el.style.display = 'flex';
            el.style.justifyContent = 'center';
            el.style.alignItems = 'center';
            el.style.margin = '10px 0';
            el.style.gap = '10px';
        });

        const currentDayMoment = moment(this.selectedDate);

        // Previous day button
        const prevDayBtn = selectorContainer.createEl('button', {
            cls: 'calendar-nav-btn', // Reuse class if style is similar
            text: '← Prev Day'
        });
        prevDayBtn.addEventListener('click', () => {
            const newDate = currentDayMoment.clone().subtract(1, 'day');
            this.selectedDate = newDate.format('YYYY-MM-DD');
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });

        // Day display
        selectorContainer.createEl('span', {
            cls: 'day-display',
            text: currentDayMoment.format('ddd, MMM D, YYYY') // Format like "Mon, Jan 1, 2024"
        });

        // Next day button
        const nextDayBtn = selectorContainer.createEl('button', {
            cls: 'calendar-nav-btn',
            text: 'Next Day →'
        });
        nextDayBtn.addEventListener('click', () => {
            const newDate = currentDayMoment.clone().add(1, 'day');
            this.selectedDate = newDate.format('YYYY-MM-DD');
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });

        // "Today" button
        const todayBtn = selectorContainer.createEl('button', {
            cls: 'calendar-today-button', // Reuse class
            text: 'Today'
        });
        todayBtn.addEventListener('click', () => {
            this.selectedDate = moment().format('YYYY-MM-DD');
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });
    }
    
    private createMonthSelector(containerEl: HTMLElement): void {
        const selectorContainer = containerEl.createDiv('month-selector-container', el => {
             el.style.display = 'flex';
             el.style.justifyContent = 'center';
             el.style.alignItems = 'center';
             el.style.margin = '10px 0';
             el.style.gap = '10px';
        });
        
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
             // Set day to the 1st of the current month to avoid date issues
            this.selectedDate = moment().startOf('month').format('YYYY-MM-DD');
            // Re-render the overview tab content only
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });
    }
    
    private renderMonthlyTransactionsChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: `Daily Activity - ${moment(this.selectedDate).format('MMMM YYYY')}` });
        
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
        const chartEl = chartContainer.createDiv({cls: 'bar-chart-grid monthly-chart'}); // Use a generic class
        
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
            
            const dayContainer = chartEl.createDiv({cls: 'bar-item-container'}); // Generic class
            const barsContainer = dayContainer.createDiv({cls: 'bar-group'}); // Group income/expense
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const incomeBar = incomeBarWrapper.createDiv({cls: 'bar income-bar'});
            const incomeHeight = maxValue > 0 ? (dayData.income / maxValue) * 100 : 0;
            incomeBar.style.height = `${incomeHeight}%`;
            if (dayData.income > 0) {
                incomeBar.createDiv({cls: 'bar-value'}).setText(`¥${dayData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const expenseBar = expenseBarWrapper.createDiv({cls: 'bar expense-bar'});
            const expenseHeight = maxValue > 0 ? (dayData.expense / maxValue) * 100 : 0;
            expenseBar.style.height = `${expenseHeight}%`;
            if (dayData.expense > 0) {
                expenseBar.createDiv({cls: 'bar-value'}).setText(`¥${dayData.expense.toFixed(0)}`);
            }
            
            // Day label (e.g., "1", "2", ...)
            const dayLabel = dayContainer.createDiv({cls: 'bar-label'});
            dayLabel.setText(dayMoment.format('D'));
        });
        
        // Add legend 
        this.addIncomeExpenseLegend(chartContainer);
    }
    
    private renderAssetTrendChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Net Change Trend' }); 
        
        if (transactions.length === 0) {
            chartContainer.createEl('p', { text: 'No transactions found for this period.' });
            return;
        }

        // Determine grouping unit based on period duration
        const startDate = moment.min(transactions.map(t => moment(normalizeTransactionDate(t.date))));
        const endDate = moment.max(transactions.map(t => moment(normalizeTransactionDate(t.date))));
        const durationDays = endDate.diff(startDate, 'days');

        let groupUnit: moment.unitOfTime.Base = 'day';
        let timeFormat = 'MM/DD';
        if (durationDays > 90) { // Rough estimate for yearly+ views
            groupUnit = 'month';
            timeFormat = 'MMM YYYY';
        } else if (durationDays > 31) { // Rough estimate for multi-month views
             groupUnit = 'week'; // Could also use 'week'
             timeFormat = 'YYYY [W]WW'; // Format like 2024 W23
        }

        // Group transactions by the determined unit
        const transactionsByPeriod: Record<string, { income: number, expense: number, net: number }> = {};
        
        // Get the unique sorted periods from the transactions
        const uniquePeriods = [...new Set(transactions.map(t => 
            moment(normalizeTransactionDate(t.date)).startOf(groupUnit).format() // Use ISO format as key
        ))].sort();

        uniquePeriods.forEach(periodKey => {
            transactionsByPeriod[periodKey] = { income: 0, expense: 0, net: 0 };
        });
        
        transactions.forEach(transaction => {
            const periodKey = moment(normalizeTransactionDate(transaction.date)).startOf(groupUnit).format();
            if (transactionsByPeriod[periodKey]) {
                if (transaction.type === 'income') {
                    transactionsByPeriod[periodKey].income += transaction.amount;
                } else {
                    transactionsByPeriod[periodKey].expense += transaction.amount;
                }
                transactionsByPeriod[periodKey].net = transactionsByPeriod[periodKey].income - transactionsByPeriod[periodKey].expense;
            }
        });
        
        // Create chart grid (using similar bar chart style for now)
        const chartEl = chartContainer.createDiv({cls: 'bar-chart-grid asset-trend-chart'}); 
        
        // Find the max absolute net value for scaling
        let maxAbsNetValue = 0;
        uniquePeriods.forEach(periodKey => {
            maxAbsNetValue = Math.max(maxAbsNetValue, Math.abs(transactionsByPeriod[periodKey].net));
        });
        maxAbsNetValue = maxAbsNetValue * 1.1 || 100; // Add padding, default 100
        
        // Create bars for each period
        uniquePeriods.forEach(periodKey => {
            const periodData = transactionsByPeriod[periodKey];
            
            const periodContainer = chartEl.createDiv({cls: 'bar-item-container'}); 
            const barsContainer = periodContainer.createDiv({cls: 'bar-group'}); // Single bar container needed here?
            
            // Net change bar (positive or negative)
            const netBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper net-bar-wrapper'});
            // Set height relative to a baseline (e.g., 50% height for zero) or use absolute positioning.
            // Simple approach: single bar colored by sign.
            const netBar = netBarWrapper.createDiv({cls: `bar net-bar ${periodData.net >= 0 ? 'positive' : 'negative'}`});
            const barHeight = maxAbsNetValue > 0 ? (Math.abs(periodData.net) / maxAbsNetValue) * 100 : 0;
            netBar.style.height = `${barHeight}%`;
            
            if (periodData.net !== 0) { // Add value label if not zero
                 const valueLabel = netBar.createDiv({cls: 'bar-value'});
                 valueLabel.setText(`¥${periodData.net.toFixed(0)}`);
            }

            // Period label 
            const periodLabel = periodContainer.createDiv({cls: 'bar-label'});
            periodLabel.setText(moment(periodKey).format(timeFormat));
        });
        
         // Add legend for Net Change
         const legend = chartContainer.createDiv({cls: 'chart-legend'});
         const positiveLegend = legend.createDiv({cls: 'legend-item'});
         positiveLegend.createDiv({cls: 'legend-color net-positive-color'}); // Need corresponding CSS class
         positiveLegend.createEl('span', { text: 'Positive Net' });
         const negativeLegend = legend.createDiv({cls: 'legend-item'});
         negativeLegend.createDiv({cls: 'legend-color net-negative-color'}); // Need corresponding CSS class
         negativeLegend.createEl('span', { text: 'Negative Net' });
    }
    
    private renderExpenseBreakdownChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Expense Breakdown' });
        
        // Use filtered transactions for the current scope (e.g., month)
        this.renderExpensePieChart(chartContainer, transactions);
    }
    
    private renderExpenseData(containerEl: HTMLElement, transactions: Transaction[]): void {
        const dataContainer = containerEl.createDiv('data-container expense-data-container'); // Add specific class
        // dataContainer.createEl('h4', { text: 'Expense Data' }); // Title redundant with breakdown chart

        // Get filtered transactions for the current scope, ensure they are expenses
        const filteredTransactions = transactions.filter(t => t.type === 'expense');

        if (filteredTransactions.length === 0) {
            // dataContainer.createEl('p', { text: 'No expense data found for this period.' }); // Don't show if breakdown chart is also empty
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
        totalRow.createEl('th', { text: totalExpenses > 0 ? '100.0%' : '0.0%' });
    }
    
    private createYearSelector(containerEl: HTMLElement): void {
         const selectorContainer = containerEl.createDiv('year-selector-container', el => {
             el.style.display = 'flex';
             el.style.justifyContent = 'center';
             el.style.alignItems = 'center';
             el.style.margin = '10px 0';
             el.style.gap = '10px';
        });
        
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
            // Set date to the start of the current year
            this.selectedDate = moment().startOf('year').format('YYYY-MM-DD');
            // Re-render the overview tab content only
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });
    }
    
    private renderYearlyTransactionsChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
         chartContainer.createEl('h4', { text: `Monthly Activity - ${moment(this.selectedDate).format('YYYY')}` });
        
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
        const chartEl = chartContainer.createDiv({cls: 'bar-chart-grid yearly-chart'}); // Add specific class
        
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
            
            const monthContainer = chartEl.createDiv({cls: 'bar-item-container month-container'}); 
            const barsContainer = monthContainer.createDiv({cls: 'bar-group month-bars'});
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const incomeBar = incomeBarWrapper.createDiv({cls: 'bar income-bar'});
            const incomeHeight = maxValue > 0 ? (monthData.income / maxValue) * 100 : 0;
            incomeBar.style.height = `${incomeHeight}%`;
            if (monthData.income > 0) {
                incomeBar.createDiv({cls: 'bar-value'}).setText(`¥${monthData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const expenseBar = expenseBarWrapper.createDiv({cls: 'bar expense-bar'});
            const expenseHeight = maxValue > 0 ? (monthData.expense / maxValue) * 100 : 0;
            expenseBar.style.height = `${expenseHeight}%`;
            if (monthData.expense > 0) {
                expenseBar.createDiv({cls: 'bar-value'}).setText(`¥${monthData.expense.toFixed(0)}`);
            }
            
            // Month label (e.g., "Jan", "Feb", ...)
            const monthLabelDiv = monthContainer.createDiv({cls: 'bar-label month-label'});
            monthLabelDiv.setText(monthLabels[index]);
        });
        
        // Add legend
        this.addIncomeExpenseLegend(chartContainer);
    }
    
    private renderYearlyHeatmap(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container yearly-heatmap-container');
        chartContainer.createEl('h4', { text: 'Yearly Activity Heatmap' });

        if (transactions.length === 0) {
            chartContainer.createEl('p', { text: 'No data for heatmap.' });
            return;
        }

        const selectedYearMoment = moment(this.selectedDate);
        const year = selectedYearMoment.year();

        // Aggregate data by day
        const dataByDay: Record<string, { income: number, expense: number, net: number }> = {};
        const yearStart = selectedYearMoment.clone().startOf('year');
        const yearEnd = selectedYearMoment.clone().endOf('year');

        // Initialize all days of the year
        let currentDay = yearStart.clone();
        while (currentDay.isSameOrBefore(yearEnd, 'day')) {
            dataByDay[currentDay.format('YYYY-MM-DD')] = { income: 0, expense: 0, net: 0 };
            currentDay.add(1, 'day');
        }
        
        // Fill data from transactions
        transactions.forEach(t => {
            const dateStr = getDatePart(t.date);
            if (dataByDay[dateStr]) {
                 if (t.type === 'income') {
                    dataByDay[dateStr].income += t.amount;
                 } else {
                    dataByDay[dateStr].expense += t.amount;
                 }
                 dataByDay[dateStr].net = dataByDay[dateStr].income - dataByDay[dateStr].expense;
            }
        });

        // Find min/max net values for color scaling
         const netValues = Object.values(dataByDay).map(d => d.net).filter(n => n !== 0); // Exclude zero days for scaling
         const maxNet = Math.max(0, ...netValues.filter(n => n > 0)); // Max positive net
         const minNet = Math.min(0, ...netValues.filter(n => n < 0)); // Min negative net (most negative)

        // Create heatmap structure (e.g., using a grid or SVG)
        // Simple Grid approach:
        const heatmapGrid = chartContainer.createDiv('heatmap-grid');
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthLabels = moment.monthsShort();

        // Add weekday labels
        const weekdayLabelsContainer = heatmapGrid.createDiv('heatmap-weekdays');
        weekdayLabelsContainer.createDiv('heatmap-label-spacer'); // Spacer for month column
        weekdays.forEach(day => weekdayLabelsContainer.createDiv('heatmap-weekday-label', el => el.setText(day.substring(0,1)))); // Single letter

        // Add month columns
        const heatmapMonthsContainer = heatmapGrid.createDiv('heatmap-months');
        
        currentDay = yearStart.clone();
        let currentMonth = -1;
        let monthContainer: HTMLElement | null = null;

        while (currentDay.isSameOrBefore(yearEnd, 'day')) {
            const dayOfWeek = currentDay.day(); // 0 = Sun, 6 = Sat
            const month = currentDay.month(); // 0 = Jan, 11 = Dec

             // Start new month column if needed
             if (month !== currentMonth) {
                currentMonth = month;
                monthContainer = heatmapMonthsContainer.createDiv('heatmap-month-column');
                monthContainer.createDiv('heatmap-month-label', el => el.setText(monthLabels[month]));
                // Add spacer cells for the first week if month doesn't start on Sunday
                for (let i = 0; i < currentDay.weekday(); i++) {
                   monthContainer.createDiv('heatmap-day empty');
                }
            }

            if (monthContainer) {
                const dateStr = currentDay.format('YYYY-MM-DD');
                const dayData = dataByDay[dateStr];
                const dayCell = monthContainer.createDiv('heatmap-day');
                dayCell.dataset.date = dateStr;
                dayCell.dataset.tooltip = `${dateStr}\nIncome: ¥${dayData.income.toFixed(2)}\nExpense: ¥${dayData.expense.toFixed(2)}\nNet: ¥${dayData.net.toFixed(2)}`;

                 // Apply color based on net value
                 let intensity = 0; // 0 = white/gray (no activity)
                 if (dayData.net > 0 && maxNet > 0) {
                     intensity = Math.min(1, dayData.net / maxNet); // Scale from 0 to 1
                     dayCell.addClass('positive');
                     // Use HSL: green, lightness based on intensity
                     dayCell.style.backgroundColor = `hsl(120, 60%, ${90 - intensity * 40}%)`; // Light green to dark green
                 } else if (dayData.net < 0 && minNet < 0) {
                     intensity = Math.min(1, dayData.net / minNet); // Scale from 0 to 1 (division by negative minNet)
                     dayCell.addClass('negative');
                     // Use HSL: red, lightness based on intensity
                      dayCell.style.backgroundColor = `hsl(0, 70%, ${90 - intensity * 40}%)`; // Light red to dark red
                 } else {
                     dayCell.addClass('zero'); // Style for zero net or no transactions
                 }
                 
                 // Add click listener? Maybe later.
            }

            currentDay.add(1, 'day');
        }

        // Add Legend for heatmap
        const legendContainer = chartContainer.createDiv('heatmap-legend');
        legendContainer.createSpan({ text: 'Less' });
        // Negative scale
        const negScale = legendContainer.createDiv('heatmap-scale negative-scale');
        for(let i=0; i<=4; i++) negScale.createDiv('heatmap-legend-color', el => el.style.backgroundColor = `hsl(0, 70%, ${90 - (i/4)*40}%)`);
        // Zero
         legendContainer.createDiv('heatmap-legend-color zero');
         // Positive scale
         const posScale = legendContainer.createDiv('heatmap-scale positive-scale');
         for(let i=0; i<=4; i++) posScale.createDiv('heatmap-legend-color', el => el.style.backgroundColor = `hsl(120, 60%, ${90 - (i/4)*40}%)`);
         legendContainer.createSpan({ text: 'More' });
    }
    
    // Note: Yearly Asset Trend might be identical to renderAssetTrendChart if using 'month' grouping
    // private renderYearlyAssetTrend(containerEl: HTMLElement, transactions: Transaction[]): void {
    //     this.renderAssetTrendChart(containerEl, transactions); // Re-use the existing trend chart
    // }
    
    private createCustomDateRangeSelector(containerEl: HTMLElement): void {
        // This is now handled by the main filter controls when 'Custom Range' is selected.
        // No need for a separate selector here within the Custom Overview tab itself.
        // We can potentially display the selected custom range here for clarity.
        const rangeDisplay = containerEl.createDiv('custom-range-display');
         if (this.dateRange === 'custom' && (this.customStartDate || this.customEndDate)) {
             rangeDisplay.setText(`Displaying data from ${this.customStartDate || 'start'} to ${this.customEndDate || 'end'}.`);
             rangeDisplay.style.textAlign = 'center';
             rangeDisplay.style.margin = '10px 0';
             rangeDisplay.style.fontStyle = 'italic';
         } else if (this.dateRange !== 'custom') {
             // If user somehow got here without custom selected, indicate the active range
             const rangeDesc = this.dateRange.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
             rangeDisplay.setText(`Displaying data for: ${rangeDesc}`);
             rangeDisplay.style.textAlign = 'center';
             rangeDisplay.style.margin = '10px 0';
             rangeDisplay.style.fontStyle = 'italic';
         }
    }
    
    private renderCustomTransactionsChart(containerEl: HTMLElement, transactions: Transaction[]): void {
        const chartContainer = containerEl.createDiv('chart-container');
        chartContainer.createEl('h4', { text: 'Activity Over Custom Period' });
        
        this.createCustomDateRangeSelector(containerEl); // Display the selected range

        if (transactions.length === 0) {
            chartContainer.createEl('p', { text: 'No transactions found for this period.' });
            return;
        }
        
        // Determine grouping unit based on period duration
        const startDate = moment.min(transactions.map(t => moment(normalizeTransactionDate(t.date))));
        const endDate = moment.max(transactions.map(t => moment(normalizeTransactionDate(t.date))));
        const durationDays = endDate.diff(startDate, 'days');

        let groupUnit: moment.unitOfTime.Base = 'day';
        let timeFormat = 'YYYY-MM-DD';
        if (durationDays > 366) { // Very long range
            groupUnit = 'month';
            timeFormat = 'MMM YYYY';
        } else if (durationDays > 60) { // Multi-month
             groupUnit = 'week'; 
             timeFormat = 'YYYY [W]WW'; 
        } // Default is 'day'

        // Group transactions by the determined unit
        const transactionsByPeriod: Record<string, { income: number, expense: number }> = {};
        const uniquePeriods = [...new Set(transactions.map(t => 
            moment(normalizeTransactionDate(t.date)).startOf(groupUnit).format() 
        ))].sort();

        uniquePeriods.forEach(periodKey => {
            transactionsByPeriod[periodKey] = { income: 0, expense: 0 };
        });
        
        transactions.forEach(transaction => {
            const periodKey = moment(normalizeTransactionDate(transaction.date)).startOf(groupUnit).format();
            if (transactionsByPeriod[periodKey]) {
                if (transaction.type === 'income') {
                    transactionsByPeriod[periodKey].income += transaction.amount;
                } else {
                    transactionsByPeriod[periodKey].expense += transaction.amount;
                }
            }
        });
        
        // Create chart grid
        const chartEl = chartContainer.createDiv({cls: 'bar-chart-grid custom-period-chart'});
        
        // Find the maximum value for scaling
        let maxValue = 0;
        uniquePeriods.forEach(periodKey => {
            const periodData = transactionsByPeriod[periodKey];
            maxValue = Math.max(maxValue, periodData.income, periodData.expense);
        });
        maxValue = maxValue * 1.1 || 100; 
        
        // Create bars for each period
        uniquePeriods.forEach(periodKey => {
            const periodData = transactionsByPeriod[periodKey];
            
            const periodContainer = chartEl.createDiv({cls: 'bar-item-container'});
            const barsContainer = periodContainer.createDiv({cls: 'bar-group'});
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const incomeBar = incomeBarWrapper.createDiv({cls: 'bar income-bar'});
            const incomeHeight = maxValue > 0 ? (periodData.income / maxValue) * 100 : 0;
            incomeBar.style.height = `${incomeHeight}%`;
            if (periodData.income > 0) {
                incomeBar.createDiv({cls: 'bar-value'}).setText(`¥${periodData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv({cls: 'bar-wrapper'});
            const expenseBar = expenseBarWrapper.createDiv({cls: 'bar expense-bar'});
            const expenseHeight = maxValue > 0 ? (periodData.expense / maxValue) * 100 : 0;
            expenseBar.style.height = `${expenseHeight}%`;
            if (periodData.expense > 0) {
                expenseBar.createDiv({cls: 'bar-value'}).setText(`¥${periodData.expense.toFixed(0)}`);
            }
            
            // Period label
            const periodLabelDiv = periodContainer.createDiv({cls: 'bar-label'});
            periodLabelDiv.setText(moment(periodKey).format(timeFormat));
        });
        
        // Add legend
         this.addIncomeExpenseLegend(chartContainer);
    }

    /**
     * Render the Transactions tab
     */
    private renderTransactionsTab(containerEl: HTMLElement): void {
        // containerEl.createEl('h3', { text: 'Transactions' }); // Title redundant

        // Use the main filter controls (already added)
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope(); // Use the scoped filter

         // Add Summary for the filtered transactions
         this.addSummarySection(containerEl); // Show summary based on applied filters

        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found matching the selected filters.' });
            return;
        }

        // Create table container for scrolling if needed
         const tableContainer = containerEl.createDiv('transactions-table-container');

        // Create table
        const table = tableContainer.createEl('table', { cls: 'transactions-table full-transactions-table' });
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
        // containerEl.createEl('h3', { text: 'Transaction Calendar' }); // Title redundant
        
        // Create month selector
        const selectorContainer = containerEl.createDiv('calendar-selector-container', el => {
             el.style.display = 'flex';
             el.style.justifyContent = 'center';
             el.style.alignItems = 'center';
             el.style.margin = '10px 0';
             el.style.gap = '10px';
        });
        
        // Get current month and year from selectedDate
        const currentDate = moment(this.selectedDate);
        const currentMonth = currentDate.month();
        const currentYear = currentDate.year();
        
        // Create month/year selector
        const monthYearSelector = selectorContainer.createDiv('month-year-selector', el => {
             el.style.display = 'flex';
             el.style.alignItems = 'center';
             el.style.gap = '5px';
        });
        
        // Previous month button
        const prevMonthBtn = monthYearSelector.createEl('button', { 
            cls: 'calendar-nav-btn',
            text: '←'
        });
        
        prevMonthBtn.addEventListener('click', () => {
            const newDate = moment(this.selectedDate).subtract(1, 'month');
            this.selectedDate = newDate.format('YYYY-MM-DD');
            // Re-render the calendar tab content only
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
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
             this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
        });
        
        // Today button
        const todayBtn = selectorContainer.createEl('button', {
            cls: 'calendar-today-button',
            text: 'Today'
        });
        
        todayBtn.addEventListener('click', () => {
            this.selectedDate = moment().format('YYYY-MM-DD');
            // Re-render the calendar tab content only
            this.rerenderCurrentTabContent(this.contentEl.querySelector('.tab-content') as HTMLElement);
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
        
        // Get ALL transactions for the selected month, respecting main filters (Type, Account, Category)
        const monthStart = moment([currentYear, currentMonth, 1]).startOf('day');
        const monthEnd = moment([currentYear, currentMonth, daysInMonth]).endOf('day');
        
        const monthTransactions = this.transactions.filter(transaction => {
            const transactionMoment = moment(normalizeTransactionDate(transaction.date));
            
             // Check if within the month
             if (!transactionMoment.isBetween(monthStart, monthEnd, undefined, '[]')) {
                 return false;
             }
            
            // Filter by type (respect main filter)
            if (this.selectedType !== 'all' && transaction.type !== this.selectedType) {
                return false;
            }

            // Filter by account (respect main filter)
            if (this.selectedAccountId !== 'all' && transaction.accountId !== this.selectedAccountId) {
                return false;
            }

            // Filter by category (respect main filter)
            if (this.selectedCategoryId !== 'all' && transaction.categoryId !== this.selectedCategoryId) {
                return false;
            }
            
            return true;
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
                // const transactionCountEl = transactionSummary.createDiv('transaction-count');
                // transactionCountEl.setText(`${dayTransactions.length} txn${dayTransactions.length > 1 ? 's' : ''}`);
                
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
                 // balanceEl.setText(`Net: ¥${dayBalance.toFixed(0)}`);
                
                // Make the day clickable to show transactions
                dayCell.addClass('has-transactions');
                dayCell.addEventListener('click', () => {
                    // Remove any existing day-details container first
                    const existingDetails = containerEl.querySelector('.day-transactions-popup'); // Changed selector
                    if (existingDetails) existingDetails.remove();
                    this.showDayTransactionsPopup(containerEl, dateString, dayTransactions); // Use popup function
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
     * Show transactions for a specific day in a popup/modal style relative to the calendar.
     */
    private showDayTransactionsPopup(calendarTabEl: HTMLElement, dateString: string, transactions: Transaction[]): void {
        // Create popup container
        const popupContainer = calendarTabEl.createDiv('day-transactions-popup');
        // Basic styling for popup effect (can be enhanced with CSS)
        popupContainer.style.position = 'absolute'; // Position relative to calendarTabEl or viewport
        popupContainer.style.border = '1px solid var(--background-modifier-border)';
        popupContainer.style.padding = '15px';
        popupContainer.style.backgroundColor = 'var(--background-secondary)';
        popupContainer.style.borderRadius = '8px';
        popupContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        popupContainer.style.zIndex = '10'; // Ensure it's above the calendar grid
        popupContainer.style.maxHeight = '300px'; // Limit height
        popupContainer.style.overflowY = 'auto'; // Make content scrollable
        popupContainer.style.minWidth = '350px'; // Minimum width

        // Position the popup (simple example: center or near the clicked element)
        // Centering requires knowing viewport size; positioning near element is complex.
        // Let's position it fixed top-center for simplicity.
        popupContainer.style.left = '50%';
        popupContainer.style.top = '15%'; // Adjust as needed
        popupContainer.style.transform = 'translateX(-50%)';
        
        // Add header
        const header = popupContainer.createDiv('popup-header');
        header.createEl('h4', { 
            text: `Transactions for ${moment(dateString).format('MMMM D, YYYY')}` 
        });
        
         // Add close button to header
         const closeButton = header.createEl('button', {
             cls: 'popup-close-button',
             text: '✕' // Simple 'X' close symbol
         });
         closeButton.style.position = 'absolute';
         closeButton.style.top = '5px';
         closeButton.style.right = '10px';
         closeButton.style.background = 'none';
         closeButton.style.border = 'none';
         closeButton.style.fontSize = '1.2em';
         closeButton.style.cursor = 'pointer';
         
         closeButton.addEventListener('click', (e) => {
             e.stopPropagation(); // Prevent triggering day click again
             popupContainer.remove();
         });

        // Create table
        const table = popupContainer.createEl('table', { cls: 'transactions-table compact-transactions-table' });
        
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
             return moment(normalizeTransactionDate(a.date)).diff(moment(normalizeTransactionDate(b.date)));
        });
        
        const categories = flattenHierarchy(this.plugin.settings.categories);
        const accounts = flattenHierarchy(this.plugin.settings.accounts);
        const tags = flattenHierarchy(this.plugin.settings.tags);

        // Add rows for each transaction
        sortedTransactions.forEach(transaction => {
            const row = tbody.createEl('tr');
            
            // Time
             const time = moment(normalizeTransactionDate(transaction.date)).format('HH:mm');
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
        
        // Optional: Add click outside to close
         // This requires a global listener, might be complex to manage correctly here.
         // Sticking with explicit close button for now.
    }


    /**
     * Render the Accounts tab
     */
    private renderAccountsTab(containerEl: HTMLElement): void {
        // containerEl.createEl('h3', { text: 'Accounts' }); // Title redundant
        
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
        
        // Calculate account balance (only for this specific account)
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
        } else {
             // Add spacer if no children, for alignment
             accountRow.createSpan({ cls: 'account-toggle-spacer' });
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
            this.showAccountDetails(account, allAccounts); // Pass allAccounts for calculating total balance
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
         // Find the closest ancestor that holds the account list to scope the query
         const treeContainer = rowElement.closest('.accounts-tree-container');
         if (treeContainer) {
             treeContainer.querySelectorAll('.account-row.active').forEach(el => el.removeClass('active'));
         } else {
             // Fallback if container not found (shouldn't happen often)
             this.contentEl.querySelectorAll('.account-row.active').forEach(el => el.removeClass('active'));
         }
        rowElement.addClass('active');
    }
    
    /**
     * Show account details, including balance rollup from children.
     */
    private showAccountDetails(account: Account, allAccounts: Account[]): void {
        // Get account details container
        const detailsContainer = this.contentEl.querySelector('.account-details-container') as HTMLElement;
        
        if (!detailsContainer) return;
        
        // Clear container
        detailsContainer.empty();
        
        // Add header
        detailsContainer.createEl('h4', { text: `Account: ${account.name}` });
        
        // Find all child account IDs recursively
         const childAccountIds = this.getChildAccountIds(account.id, allAccounts);
         const allRelevantAccountIds = [account.id, ...childAccountIds];

        // Filter transactions for this account AND its children
        const accountAndChildrenTransactions = this.transactions.filter(transaction => 
            transaction.accountId && allRelevantAccountIds.includes(transaction.accountId)
        );

        // Filter transactions only for this specific account (for recent list)
        const accountOnlyTransactions = this.transactions.filter(transaction => 
             transaction.accountId === account.id
        );
        
        // Calculate totals (rollup)
        const totalsRollup = this.calculateTotals(accountAndChildrenTransactions);
        const balanceRollup = totalsRollup.balance;
        
        // Calculate balance for only this account
        const balanceDirect = this.calculateTotals(accountOnlyTransactions).balance;

        // Create summary section
        const summarySection = detailsContainer.createDiv('account-summary');
        const summaryGrid = summarySection.createDiv('summary-grid'); // Reuse grid styling
        
        // Direct Balance card
         const directBalanceCard = summaryGrid.createDiv('summary-card balance-card');
         directBalanceCard.createEl('h5', { text: 'Direct Balance' });
         const directBalanceValue = directBalanceCard.createDiv('summary-value');
         directBalanceValue.setText(`¥${balanceDirect.toFixed(2)}`);
         directBalanceValue.addClass(balanceDirect >= 0 ? 'positive' : 'negative');
         
        // Total Rollup Balance card
        const rollupBalanceCard = summaryGrid.createDiv('summary-card balance-card');
        rollupBalanceCard.createEl('h5', { text: 'Total Balance (with Children)' });
        const rollupBalanceValue = rollupBalanceCard.createDiv('summary-value');
        rollupBalanceValue.setText(`¥${balanceRollup.toFixed(2)}`);
        rollupBalanceValue.addClass(balanceRollup >= 0 ? 'positive' : 'negative');
        
        // Transaction count card (Direct)
        const countCardDirect = summaryGrid.createDiv('summary-card count-card');
        countCardDirect.createEl('h5', { text: 'Direct Transactions' });
        countCardDirect.createDiv('summary-value').setText(accountOnlyTransactions.length.toString());

        // Transaction count card (Rollup)
        const countCardRollup = summaryGrid.createDiv('summary-card count-card');
        countCardRollup.createEl('h5', { text: 'Total Transactions (with Children)' });
        countCardRollup.createDiv('summary-value').setText(accountAndChildrenTransactions.length.toString());
        
        
        // If no direct transactions, show message
        if (accountOnlyTransactions.length === 0) {
            detailsContainer.createEl('p', { text: 'No direct transactions found for this account.' });
            // Still show children transactions if they exist
        } else {
             // Create transactions section for DIRECT transactions
             const transactionsSection = detailsContainer.createDiv('account-transactions');
             transactionsSection.createEl('h5', { text: 'Recent Direct Transactions' });
             
             // Create table
             const table = transactionsSection.createEl('table', { cls: 'transactions-table compact-transactions-table' });
             const thead = table.createEl('thead');
             const headerRow = thead.createEl('tr');
             const headers = ['Date', 'Desc', 'Cat', 'Amount', 'Type']; // Compact view
             headers.forEach(header => headerRow.createEl('th', { text: header }));
             
             const tbody = table.createEl('tbody');
             const categories = flattenHierarchy(this.plugin.settings.categories);
     
             // Sort transactions by date (newest first)
             const sortedTransactions = [...accountOnlyTransactions].sort((a, b) => 
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
             if (accountOnlyTransactions.length > 10) {
                 const viewAllButton = transactionsSection.createEl('button', {
                     cls: 'view-all-button',
                     text: `View All Direct (${accountOnlyTransactions.length})`
                 });
                 
                 viewAllButton.addEventListener('click', () => {
                      // Pass only direct transactions to the "show all" view
                     this.showAllAccountTransactions(account, accountOnlyTransactions, allAccounts);
                 });
             }
        }

         // Add button to view Rollup transactions if children exist and have transactions
         if (childAccountIds.length > 0 && accountAndChildrenTransactions.length > accountOnlyTransactions.length) {
             const viewRollupButton = detailsContainer.createEl('button', {
                 cls: 'view-rollup-button',
                  text: `View All Total Transactions (${accountAndChildrenTransactions.length})`
             });
             viewRollupButton.addEventListener('click', () => {
                  // Pass rollup transactions to the "show all" view
                 this.showAllAccountTransactions(account, accountAndChildrenTransactions, allAccounts, true); // Add flag indicating rollup view
             });
         }
    }

    /** Helper to recursively get all child account IDs */
     private getChildAccountIds(parentId: string, allAccounts: Account[]): string[] {
        const children = allAccounts.filter(a => a.parentId === parentId);
        let childIds: string[] = children.map(a => a.id);
        children.forEach(child => {
            childIds = childIds.concat(this.getChildAccountIds(child.id, allAccounts));
        });
        return childIds;
    }
    
    /**
     * Show all transactions for an account (either direct or rollup).
     */
    private showAllAccountTransactions(account: Account, transactions: Transaction[], allAccounts: Account[], isRollupView: boolean = false): void {
        // Get account details container
        const detailsContainer = this.contentEl.querySelector('.account-details-container') as HTMLElement;
        
        if (!detailsContainer) return;
        
        // Clear container
        detailsContainer.empty();
        
        // Add header
         const headerText = isRollupView 
             ? `All Transactions (Includes Children): ${account.name}`
             : `All Direct Transactions: ${account.name}`;
        detailsContainer.createEl('h4', { text: headerText });
        
        // Add back button
        const backButton = detailsContainer.createEl('button', {
            cls: 'back-button',
            text: '← Back to Account Details'
        });
        
        backButton.addEventListener('click', () => {
            // Reselect the row and show details again
            const accountRow = this.contentEl.querySelector(`.account-item[data-account-id="${account.id}"] .account-row`) as HTMLElement;
            if (accountRow) this.setActiveAccountRow(accountRow);
            this.showAccountDetails(account, allAccounts); // Pass allAccounts back
        });
        
        // Create transactions section
        const transactionsSection = detailsContainer.createDiv('account-transactions-all');
        
        // Create table
        const table = transactionsSection.createEl('table', { cls: 'transactions-table full-transactions-table' });
        
        // Table header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        
         // Add 'Account' column only if it's a rollup view
         const headers = isRollupView 
             ? ['Date', 'Description', 'Category', 'Account', 'Tags', 'Amount', 'Type'] 
             : ['Date', 'Description', 'Category', 'Tags', 'Amount', 'Type'];
        headers.forEach(header => headerRow.createEl('th', { text: header }));
        
        // Table body
        const tbody = table.createEl('tbody');
        const categories = flattenHierarchy(this.plugin.settings.categories);
        const tags = flattenHierarchy(this.plugin.settings.tags);
         const accountsMap = new Map(flattenHierarchy(allAccounts).map(a => [a.id, a.name])); // Map for quick lookup if needed
        
        // Sort transactions by date (newest first)
        const sortedTransactions = [...transactions].sort((a, b) => 
             moment(normalizeTransactionDate(b.date)).diff(moment(normalizeTransactionDate(a.date)))
        );
        
        // Add rows for each transaction
        sortedTransactions.forEach(transaction => {
            const row = tbody.createEl('tr');
            
            // Date
             const dateString = normalizeTransactionDate(transaction.date);
             row.createEl('td', { text: moment(dateString).format('YYYY-MM-DD HH:mm') }); // Show time too
            
            // Description
            row.createEl('td', { text: transaction.description || '' });
            
            // Category
            const category = categories.find(c => c.id === transaction.categoryId);
            row.createEl('td', { text: category ? category.name : '?' });

             // Account (only if rollup view)
             if (isRollupView) {
                 const accountName = transaction.accountId ? accountsMap.get(transaction.accountId) : '?';
                 row.createEl('td', { text: accountName });
             }
            
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
        // containerEl.createEl('h3', { text: 'Financial Trends' }); // Title redundant
        
        // Create period selector
        const periodSelector = containerEl.createDiv('trends-period-selector', el => {
             // Style similar to main tabs
             el.style.display = 'flex';
             el.style.flexWrap = 'wrap';
             el.style.gap = '5px';
             el.style.marginBottom = '15px'; // Space below tabs
        });
        
        // Create period tabs
        const periodTabs = [
            { id: 'monthly', label: 'Monthly Trends' },
            { id: 'yearly', label: 'Yearly Trends' },
            { id: 'category', label: 'Category Trends' }
        ];
        
        // Current period (consider storing this as a class property if needed elsewhere)
        let currentTrendPeriod = 'monthly'; // Default
        
        // Create tabs
        periodTabs.forEach(tab => {
            const tabEl = periodSelector.createEl('button', {
                cls: ['trends-period-tab', tab.id === currentTrendPeriod ? 'active' : ''],
                text: tab.label
            });
            
            tabEl.addEventListener('click', () => {
                // Update current period
                currentTrendPeriod = tab.id;
                
                // Remove active class from all tabs
                periodSelector.querySelectorAll('.trends-period-tab').forEach(el => {
                    el.removeClass('active');
                });
                
                // Add active class to clicked tab
                tabEl.addClass('active');
                
                // Clear trends container
                trendsContainer.empty();
                
                // Render appropriate trend
                if (currentTrendPeriod === 'monthly') {
                    this.renderMonthlyTrends(trendsContainer);
                } else if (currentTrendPeriod === 'yearly') {
                    this.renderYearlyTrends(trendsContainer);
                } else if (currentTrendPeriod === 'category') {
                    this.renderCategoryTrends(trendsContainer);
                }
            });
        });
        
        // Create trends container
        const trendsContainer = containerEl.createDiv('trends-content-container');
        
        // Render monthly trends by default
        this.renderMonthlyTrends(trendsContainer);
    }
    
    /**
     * Render monthly trends
     */
    private renderMonthlyTrends(containerEl: HTMLElement): void {
        // Get filtered transactions based on the main filters (Date Range, Type, Account, Category)
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope(); 
        
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found for the selected filters to analyze monthly trends.' });
            return;
        }
        
        // Group transactions by month
        const transactionsByMonth: Record<string, { income: number, expenses: number, balance: number }> = {};
        
        // Determine relevant months based on filtered data
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
        chartSection.createEl('h4', { text: 'Monthly Income, Expenses & Balance' });
        
        // Create chart
        const chartGrid = chartSection.createDiv('bar-chart-grid trends-chart-grid'); // Use generic class
        
        // Find max values across all displayed months for consistent scaling
        const allIncomes = uniqueMonths.map(m => transactionsByMonth[m].income);
        const allExpenses = uniqueMonths.map(m => transactionsByMonth[m].expenses);
        const allBalancesAbs = uniqueMonths.map(m => Math.abs(transactionsByMonth[m].balance));
         // Use Math.max(1, ...) to prevent division by zero and handle cases with no data
        const maxIncomeExpense = Math.max(1, ...allIncomes, ...allExpenses); 
        const maxAbsBalance = Math.max(1, ...allBalancesAbs); 

        // Add bars for each month
        uniqueMonths.forEach(monthKey => {
            const monthData = transactionsByMonth[monthKey];
            const monthLabel = moment(monthKey).format('MMM YYYY');
            
            // Create month container
            const monthContainer = chartGrid.createDiv('bar-item-container trend-period-container');
            
            // Create bars container (grouping income, expense, balance)
            const barsContainer = monthContainer.createDiv('bar-group trend-bars-container');
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv('bar-wrapper trend-bar-wrapper');
            const incomeBar = incomeBarWrapper.createDiv('bar trend-bar income-bar');
            const incomeHeightPercentage = maxIncomeExpense > 0 ? (monthData.income / maxIncomeExpense) * 100 : 0;
            incomeBar.style.height = `${incomeHeightPercentage}%`;
            if (monthData.income > 0) {
                incomeBar.createDiv({cls: 'bar-value trend-bar-value'}).setText(`¥${monthData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv('bar-wrapper trend-bar-wrapper');
            const expenseBar = expenseBarWrapper.createDiv('bar trend-bar expense-bar');
            const expenseHeightPercentage = maxIncomeExpense > 0 ? (monthData.expenses / maxIncomeExpense) * 100 : 0;
            expenseBar.style.height = `${expenseHeightPercentage}%`;
            if (monthData.expenses > 0) {
                expenseBar.createDiv({cls: 'bar-value trend-bar-value'}).setText(`¥${monthData.expenses.toFixed(0)}`);
            }
            
            // Balance bar
            const balanceBarWrapper = barsContainer.createDiv('bar-wrapper trend-bar-wrapper');
            const balanceBar = balanceBarWrapper.createDiv(`bar trend-bar balance-bar ${monthData.balance >= 0 ? 'positive' : 'negative'}`);
             // Scale balance relative to its own max, could potentially use same scale as income/expense if desired
            const balanceHeightPercentage = maxAbsBalance > 0 ? (Math.abs(monthData.balance) / maxAbsBalance) * 100 : 0;
            balanceBar.style.height = `${balanceHeightPercentage}%`;
            const balanceValueDiv = balanceBar.createDiv({cls: 'bar-value trend-bar-value'});
            balanceValueDiv.setText(`¥${monthData.balance.toFixed(0)}`);
            
            // Month label
            const monthLabelDiv = monthContainer.createDiv('bar-label trend-period-label');
            monthLabelDiv.setText(monthLabel);
        });
        
        // Create legend
        const legendContainer = chartSection.createDiv('chart-legend trends-legend');
        const incomeLegend = legendContainer.createDiv('legend-item');
        incomeLegend.createDiv('legend-color income-color');
        incomeLegend.createEl('span', { text: 'Income' });
        const expenseLegend = legendContainer.createDiv('legend-item');
        expenseLegend.createDiv('legend-color expense-color');
        expenseLegend.createEl('span', { text: 'Expenses' });
        const balanceLegend = legendContainer.createDiv('legend-item');
        balanceLegend.createDiv('legend-color balance-color'); // Use a distinct color for balance bar
        balanceLegend.createEl('span', { text: 'Balance' });
        
        // Create trend analysis section
        const analysisSection = containerEl.createDiv('trend-analysis-section');
        analysisSection.createEl('h4', { text: 'Monthly Trend Analysis' });
        
        // Calculate averages over the displayed period
        const totalMonths = uniqueMonths.length;
        if (totalMonths > 1) { // Need at least 2 months for meaningful analysis
             const totalIncome = allIncomes.reduce((sum, val) => sum + val, 0);
             const totalExpenses = allExpenses.reduce((sum, val) => sum + val, 0);
             const totalBalance = totalIncome - totalExpenses; // Use summed totals for accuracy
            
            const avgIncome = totalIncome / totalMonths;
            const avgExpenses = totalExpenses / totalMonths;
            const avgBalance = totalBalance / totalMonths;
            
            // Find highest/lowest months within the displayed period
            let highestIncomeMonth = '';
            let highestIncomeValue = -Infinity;
            let highestExpenseMonth = '';
            let highestExpenseValue = -Infinity;
            let highestBalanceMonth = '';
            let highestBalanceValue = -Infinity;
            let lowestBalanceMonth = '';
            let lowestBalanceValue = Infinity;
            
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
                 if (monthData.balance > highestBalanceValue) {
                    highestBalanceValue = monthData.balance;
                    highestBalanceMonth = monthKey;
                }
                 if (monthData.balance < lowestBalanceValue) {
                    lowestBalanceValue = monthData.balance;
                    lowestBalanceMonth = monthKey;
                }
            });
            
            // Create analysis table
            const analysisTable = analysisSection.createEl('table', { cls: 'analysis-table' });
            const analysisBody = analysisTable.createEl('tbody'); // Use tbody directly for key-value pairs

            const analysisData = [
                { label: 'Avg Monthly Income', value: `¥${avgIncome.toFixed(2)}` },
                { label: 'Avg Monthly Expenses', value: `¥${avgExpenses.toFixed(2)}` },
                { label: 'Avg Monthly Balance', value: `¥${avgBalance.toFixed(2)}`, class: avgBalance >= 0 ? 'positive' : 'negative' },
                { label: 'Highest Income Month', value: `${moment(highestIncomeMonth).format('MMM YYYY')} (¥${highestIncomeValue.toFixed(2)})` },
                { label: 'Highest Expense Month', value: `${moment(highestExpenseMonth).format('MMM YYYY')} (¥${highestExpenseValue.toFixed(2)})` },
                 { label: 'Highest Balance Month', value: `${moment(highestBalanceMonth).format('MMM YYYY')} (¥${highestBalanceValue.toFixed(2)})`, class: 'positive' },
                 { label: 'Lowest Balance Month', value: `${moment(lowestBalanceMonth).format('MMM YYYY')} (¥${lowestBalanceValue.toFixed(2)})`, class: 'negative' },
                 { label: `Total Income (${totalMonths} mo)`, value: `¥${totalIncome.toFixed(2)}` },
                 { label: `Total Expenses (${totalMonths} mo)`, value: `¥${totalExpenses.toFixed(2)}` },
                 { label: `Net Balance (${totalMonths} mo)`, value: `¥${totalBalance.toFixed(2)}`, class: totalBalance >= 0 ? 'positive' : 'negative' }
            ];
            analysisData.forEach(item => {
                const row = analysisBody.createEl('tr');
                row.createEl('td', { text: item.label });
                 const valueCell = row.createEl('td', { text: item.value });
                 if (item.class) {
                     valueCell.addClass(item.class);
                 }
            });
        } else {
             analysisSection.createEl('p', { text: 'Need data from at least two months for trend analysis.' });
        }
    }
    
    /**
     * Render yearly trends
     */
    private renderYearlyTrends(containerEl: HTMLElement): void {
        // Get filtered transactions based on the main filters
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
        
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found for the selected filters to analyze yearly trends.' });
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
        chartSection.createEl('h4', { text: 'Yearly Income, Expenses & Balance' });
        
        // Create chart
        const chartGrid = chartSection.createDiv('bar-chart-grid trends-chart-grid');

        // Find max values across all displayed years
        const allIncomes = uniqueYears.map(y => transactionsByYear[y].income);
        const allExpenses = uniqueYears.map(y => transactionsByYear[y].expenses);
        const allBalancesAbs = uniqueYears.map(y => Math.abs(transactionsByYear[y].balance));
        const maxIncomeExpense = Math.max(1, ...allIncomes, ...allExpenses);
        const maxAbsBalance = Math.max(1, ...allBalancesAbs);
        
        // Add bars for each year
        uniqueYears.forEach(yearKey => {
            const yearData = transactionsByYear[yearKey];
            
            // Create year container
            const yearContainer = chartGrid.createDiv('bar-item-container trend-period-container');
            
            // Create bars container
            const barsContainer = yearContainer.createDiv('bar-group trend-bars-container');
            
            // Income bar
            const incomeBarWrapper = barsContainer.createDiv('bar-wrapper trend-bar-wrapper');
            const incomeBar = incomeBarWrapper.createDiv('bar trend-bar income-bar');
            const incomeHeightPercentage = maxIncomeExpense > 0 ? (yearData.income / maxIncomeExpense) * 100 : 0;
            incomeBar.style.height = `${incomeHeightPercentage}%`;
            if (yearData.income > 0) {
                 incomeBar.createDiv({cls: 'bar-value trend-bar-value'}).setText(`¥${yearData.income.toFixed(0)}`);
            }
            
            // Expense bar
            const expenseBarWrapper = barsContainer.createDiv('bar-wrapper trend-bar-wrapper');
            const expenseBar = expenseBarWrapper.createDiv('bar trend-bar expense-bar');
            const expenseHeightPercentage = maxIncomeExpense > 0 ? (yearData.expenses / maxIncomeExpense) * 100 : 0;
            expenseBar.style.height = `${expenseHeightPercentage}%`;
            if (yearData.expenses > 0) {
                 expenseBar.createDiv({cls: 'bar-value trend-bar-value'}).setText(`¥${yearData.expenses.toFixed(0)}`);
            }
            
            // Balance bar
            const balanceBarWrapper = barsContainer.createDiv('bar-wrapper trend-bar-wrapper');
            const balanceBar = balanceBarWrapper.createDiv(`bar trend-bar balance-bar ${yearData.balance >= 0 ? 'positive' : 'negative'}`);
            const balanceHeightPercentage = maxAbsBalance > 0 ? (Math.abs(yearData.balance) / maxAbsBalance) * 100 : 0;
            balanceBar.style.height = `${balanceHeightPercentage}%`;
             const balanceValueDiv = balanceBar.createDiv({cls: 'bar-value trend-bar-value'});
             balanceValueDiv.setText(`¥${yearData.balance.toFixed(0)}`);
            
            // Year label
            const yearLabelDiv = yearContainer.createDiv('bar-label trend-period-label');
            yearLabelDiv.setText(yearKey);
        });
        
        // Create legend
         const legendContainer = chartSection.createDiv('chart-legend trends-legend');
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
        analysisSection.createEl('h4', { text: 'Yearly Analysis Table' });
        
        // Calculate growth rates if more than one year exists
        const growthRates: Record<string, { income: number | null, expenses: number | null, balance: number | null }> = {};
        
        if (uniqueYears.length > 1) {
            for (let i = 1; i < uniqueYears.length; i++) {
                const currentYear = uniqueYears[i];
                const previousYear = uniqueYears[i - 1];
                
                const currentData = transactionsByYear[currentYear];
                const previousData = transactionsByYear[previousYear];
                
                 // Helper to calculate growth, handling division by zero and signs
                 const calculateGrowth = (current: number, previous: number): number | null => {
                     if (previous === 0) {
                         return current === 0 ? 0 : null; // 0% if both zero, Infinite if current is non-zero
                     }
                     return ((current - previous) / Math.abs(previous)) * 100;
                 };
                    
                growthRates[currentYear] = {
                    income: calculateGrowth(currentData.income, previousData.income),
                    expenses: calculateGrowth(currentData.expenses, previousData.expenses),
                    balance: calculateGrowth(currentData.balance, previousData.balance),
                };
            }
        }
        
        // Create analysis table
        const analysisTable = analysisSection.createEl('table', { cls: 'analysis-table yearly-analysis-table' }); // Add specific class
         const thead = analysisTable.createEl('thead');
        const headerRow = thead.createEl('tr');
        headerRow.createEl('th', { text: 'Year' });
        headerRow.createEl('th', { text: 'Income' });
        headerRow.createEl('th', { text: 'Expenses' });
        headerRow.createEl('th', { text: 'Balance' });
        headerRow.createEl('th', { text: 'Inc Growth' }); // Shorten headers
        headerRow.createEl('th', { text: 'Exp Growth' });
         headerRow.createEl('th', { text: 'Bal Growth' });

         const tbody = analysisTable.createEl('tbody');
        
        // Add rows for each year
        uniqueYears.forEach(yearKey => {
            const yearData = transactionsByYear[yearKey];
            const growthData = growthRates[yearKey]; // Might be undefined for the first year
            
            const row = tbody.createEl('tr');
            row.createEl('td', { text: yearKey });
            // Income
             const incomeCell = row.createEl('td');
             incomeCell.setText(`¥${yearData.income.toFixed(2)}`);
             incomeCell.addClass('income-value');
             // Expenses
             const expenseCell = row.createEl('td');
             expenseCell.setText(`¥${yearData.expenses.toFixed(2)}`);
             expenseCell.addClass('expense-value');
             // Balance
             const balanceCell = row.createEl('td');
             balanceCell.setText(`¥${yearData.balance.toFixed(2)}`);
             balanceCell.addClass(yearData.balance >= 0 ? 'positive' : 'negative');
            
             // Growth Columns
             const formatGrowth = (value: number | null): string => {
                 if (value === null) return '∞'; // Infinite growth
                 if (value === 0 || isNaN(value)) return '-'; // No change or invalid
                 return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`; // Add '+' sign for positive
             };
              const addGrowthClass = (cell: HTMLTableCellElement, value: number | null): void => {
                 if (value === null || value > 0) cell.addClass('positive'); // Infinite or positive growth is green
                 else if (value < 0) cell.addClass('negative'); // Negative growth is red
             };
             const addExpenseGrowthClass = (cell: HTMLTableCellElement, value: number | null): void => {
                  // Inverse coloring for expenses: growth is red, decrease is green
                  if (value === null || value > 0) cell.addClass('negative'); 
                  else if (value < 0) cell.addClass('positive');
             };

             const incGrowthCell = row.createEl('td');
             incGrowthCell.setText(growthData ? formatGrowth(growthData.income) : '-');
             if(growthData) addGrowthClass(incGrowthCell, growthData.income);

             const expGrowthCell = row.createEl('td');
             expGrowthCell.setText(growthData ? formatGrowth(growthData.expenses) : '-');
             if(growthData) addExpenseGrowthClass(expGrowthCell, growthData.expenses); // Use inverse coloring

             const balGrowthCell = row.createEl('td');
             balGrowthCell.setText(growthData ? formatGrowth(growthData.balance) : '-');
             if(growthData) addGrowthClass(balGrowthCell, growthData.balance);
        });
    }
    
    /**
     * Render category trends
     */
    private renderCategoryTrends(containerEl: HTMLElement): void {
        // Get filtered transactions based on the main filters
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
        
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found for the selected filters to analyze category trends.' });
            return;
        }
        
        // Create tabs for income and expense categories
        const categoryTypeTabs = containerEl.createDiv('category-type-tabs', el => {
            // Style similar to other tab groups
             el.style.display = 'flex';
             el.style.flexWrap = 'wrap';
             el.style.gap = '5px';
             el.style.marginBottom = '15px';
        });
        
         let currentCategoryType: 'income' | 'expense' = 'expense'; // Default to expense

        const incomeTab = categoryTypeTabs.createEl('button', {
            cls: ['category-type-tab', currentCategoryType === 'income' ? 'active' : ''],
            text: 'Income Categories'
        });
        
        const expenseTab = categoryTypeTabs.createEl('button', {
            cls: ['category-type-tab', currentCategoryType === 'expense' ? 'active' : ''],
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
            const transactionsByCategory: Record<string, { amount: number, count: number }> = {};
            const categories = flattenHierarchy(this.plugin.settings.categories);
            
            typeTransactions.forEach(transaction => {
                let categoryId = transaction.categoryId || 'uncategorized';
                let categoryName = 'Uncategorized';
                if (transaction.categoryId) {
                    const category = categories.find(c => c.id === transaction.categoryId);
                    if (category) categoryName = category.name;
                    else categoryId = 'uncategorized'; // Use ID if name not found but ID exists
                }

                if (!transactionsByCategory[categoryId]) {
                     transactionsByCategory[categoryId] = { amount: 0, count: 0 };
                 }
                transactionsByCategory[categoryId].amount += transaction.amount;
                 transactionsByCategory[categoryId].count++;
            });

             // Map back to names for display, keeping uncategorized separate
             const categoryDataForDisplay: { name: string, amount: number, count: number }[] = [];
             for (const catId in transactionsByCategory) {
                 let name = 'Uncategorized';
                 if (catId !== 'uncategorized') {
                     name = categories.find(c => c.id === catId)?.name || `Unknown (${catId})`;
                 }
                 categoryDataForDisplay.push({ 
                     name: name, 
                     amount: transactionsByCategory[catId].amount,
                     count: transactionsByCategory[catId].count 
                 });
             }
            
            // Sort categories by amount (descending)
            const sortedCategories = categoryDataForDisplay.sort((a, b) => b.amount - a.amount);
            
            // Calculate total amount
            const totalAmount = sortedCategories.reduce((sum, cat) => sum + cat.amount, 0);
            
            // Create chart section (Pie Chart)
            const chartSection = categoryDataContainer.createDiv('category-chart-section');
             chartSection.createEl('h4', { text: `${type === 'income' ? 'Income' : 'Expense'} Breakdown by Category` });
             // Reuse the pie chart rendering function
             this.renderCategoryPieChart(chartSection, sortedCategories, totalAmount); 
            
            // Create trend analysis section (Table)
            const analysisSection = categoryDataContainer.createDiv('trend-analysis-section category-table-section');
            analysisSection.createEl('h4', { text: 'Category Details Table' });
            const analysisTable = analysisSection.createEl('table', { cls: 'analysis-table category-analysis-table' });
             const thead = analysisTable.createEl('thead');
            const headerRow = thead.createEl('tr');
            headerRow.createEl('th', { text: 'Category' });
             headerRow.createEl('th', { text: 'Txns' }); // Transaction count
            headerRow.createEl('th', { text: 'Amount' });
            headerRow.createEl('th', { text: 'Percentage' });
            headerRow.createEl('th', { text: 'Avg Txn Amt' }); // Average amount per transaction

             const tbody = analysisTable.createEl('tbody');
            
            // Add rows for each category
            sortedCategories.forEach(catData => {
                const row = tbody.createEl('tr');
                row.createEl('td', { text: catData.name });
                 row.createEl('td', { text: catData.count.toString() });
                row.createEl('td', { text: `¥${catData.amount.toFixed(2)}` });
                const percentage = totalAmount > 0 ? (catData.amount / totalAmount) * 100 : 0;
                row.createEl('td', { text: `${percentage.toFixed(1)}%` });
                 const avgAmount = catData.count > 0 ? (catData.amount / catData.count) : 0;
                 row.createEl('td', { text: `¥${avgAmount.toFixed(2)}` });
            });
            
            // Add total row
             const tfoot = analysisTable.createEl('tfoot');
            const totalRow = tfoot.createEl('tr', { cls: 'total-row' });
            totalRow.createEl('td', { text: 'Total' });
             const totalCount = sortedCategories.reduce((sum, cat) => sum + cat.count, 0);
             totalRow.createEl('td', { text: totalCount.toString() });
            totalRow.createEl('td', { text: `¥${totalAmount.toFixed(2)}` });
            totalRow.createEl('td', { text: totalAmount > 0 ? '100.0%' : '0.0%' });
             const overallAvg = totalCount > 0 ? (totalAmount / totalCount) : 0;
             totalRow.createEl('td', { text: `¥${overallAvg.toFixed(2)}` });
        };
        
        // Render expense categories by default
        renderCategoryData(currentCategoryType);
        
        // Add event listeners to tabs
        incomeTab.addEventListener('click', () => {
            if (currentCategoryType !== 'income') {
                currentCategoryType = 'income';
                incomeTab.addClass('active');
                expenseTab.removeClass('active');
                renderCategoryData('income');
            }
        });
        
        expenseTab.addEventListener('click', () => {
             if (currentCategoryType !== 'expense') {
                currentCategoryType = 'expense';
                expenseTab.addClass('active');
                incomeTab.removeClass('active');
                renderCategoryData('expense');
             }
        });
    }

    /**
     * Render the Analysis tab
     */
    private renderAnalysisTab(containerEl: HTMLElement): void {
        // containerEl.createEl('h3', { text: 'Financial Analysis' }); // Title redundant
        
        // Add Summary for the filtered scope first
        this.addSummarySection(containerEl);

        // Get filtered transactions based on scope
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
        
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found for the selected filters to perform analysis.' });
            return; 
        }
        
        // --- Additional Analysis Sections ---
        
        // 1. Expense Breakdown (Reuse)
         const expenseBreakdownContainer = containerEl.createDiv('analysis-section expense-analysis');
         expenseBreakdownContainer.createEl('h4', { text: 'Expense Analysis' });
         this.renderExpensePieChart(expenseBreakdownContainer, filteredTransactions);
         this.renderExpenseData(expenseBreakdownContainer, filteredTransactions); // Show data table too

        // 2. Income Breakdown (Similar structure to expense)
         const incomeBreakdownContainer = containerEl.createDiv('analysis-section income-analysis');
         incomeBreakdownContainer.createEl('h4', { text: 'Income Analysis' });
         this.renderIncomeAnalysis(incomeBreakdownContainer, filteredTransactions);

        // 3. Cash Flow Analysis (Simple version)
         const cashFlowContainer = containerEl.createDiv('analysis-section cashflow-analysis');
         cashFlowContainer.createEl('h4', { text: 'Cash Flow Overview' });
         this.renderCashFlowAnalysis(cashFlowContainer, filteredTransactions);
         
         // 4. Tag Analysis
         const tagAnalysisContainer = containerEl.createDiv('analysis-section tag-analysis');
         tagAnalysisContainer.createEl('h4', { text: 'Tag Analysis' });
         this.renderTagAnalysis(tagAnalysisContainer, filteredTransactions);

    }

    /** Helper for Analysis Tab: Render Income Breakdown */
    private renderIncomeAnalysis(containerEl: HTMLElement, transactions: Transaction[]): void {
        const incomeTransactions = transactions.filter(t => t.type === 'income');
        if (incomeTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No income data found for this period.' });
            return;
        }

        // Group income by category
        const incomeByCategory: Record<string, { amount: number, count: number }> = {};
        const categories = flattenHierarchy(this.plugin.settings.categories);
        let totalIncome = 0;

        incomeTransactions.forEach(transaction => {
             let categoryId = transaction.categoryId || 'uncategorized';
             let categoryName = 'Uncategorized';
             if (transaction.categoryId) {
                 const category = categories.find(c => c.id === transaction.categoryId);
                 if (category) categoryName = category.name;
                 else categoryId = 'uncategorized';
             }
             if (!incomeByCategory[categoryId]) {
                 incomeByCategory[categoryId] = { amount: 0, count: 0 };
             }
             incomeByCategory[categoryId].amount += transaction.amount;
             incomeByCategory[categoryId].count++;
             totalIncome += transaction.amount;
        });

        const incomeDataForDisplay: { name: string, amount: number, count: number }[] = [];
        for (const catId in incomeByCategory) {
            let name = 'Uncategorized';
            if (catId !== 'uncategorized') {
                name = categories.find(c => c.id === catId)?.name || `Unknown (${catId})`;
            }
            incomeDataForDisplay.push({ name: name, amount: incomeByCategory[catId].amount, count: incomeByCategory[catId].count });
        }

        const sortedIncome = incomeDataForDisplay.sort((a, b) => b.amount - a.amount);

        // Render Pie Chart
        this.renderCategoryPieChart(containerEl, sortedIncome, totalIncome, 'Income Sources');

        // Render Table
        const tableContainer = containerEl.createDiv('income-data-container');
        const table = tableContainer.createEl('table', { cls: 'analysis-table income-analysis-table' });
        const thead = table.createEl('thead');
        const hr = thead.createEl('tr');
        hr.createEl('th', { text: 'Category' });
        hr.createEl('th', { text: 'Txns' });
        hr.createEl('th', { text: 'Amount' });
        hr.createEl('th', { text: '%' });
        hr.createEl('th', { text: 'Avg Txn Amt' });

        const tbody = table.createEl('tbody');
        sortedIncome.forEach(catData => {
            const row = tbody.createEl('tr');
            row.createEl('td', { text: catData.name });
            row.createEl('td', { text: catData.count.toString() });
            row.createEl('td', { text: `¥${catData.amount.toFixed(2)}` });
            const percentage = totalIncome > 0 ? (catData.amount / totalIncome) * 100 : 0;
            row.createEl('td', { text: `${percentage.toFixed(1)}%` });
            const avgAmount = catData.count > 0 ? (catData.amount / catData.count) : 0;
            row.createEl('td', { text: `¥${avgAmount.toFixed(2)}` });
        });
         const tfoot = table.createEl('tfoot');
         const totalRow = tfoot.createEl('tr');
         totalRow.createEl('td', { text: 'Total' });
         const totalCount = sortedIncome.reduce((sum, i) => sum + i.count, 0);
         totalRow.createEl('td', { text: totalCount.toString() });
         totalRow.createEl('td', { text: `¥${totalIncome.toFixed(2)}` });
         totalRow.createEl('td', { text: '100.0%' });
          const overallAvg = totalCount > 0 ? (totalIncome / totalCount) : 0;
         totalRow.createEl('td', { text: `¥${overallAvg.toFixed(2)}` });
    }

    /** Helper for Analysis Tab: Render Cash Flow Overview */
    private renderCashFlowAnalysis(containerEl: HTMLElement, transactions: Transaction[]): void {
         const totals = this.calculateTotals(transactions);
         const savingsRate = totals.income > 0 ? (totals.balance / totals.income) * 100 : 0;

         const table = containerEl.createEl('table', { cls: 'analysis-table cashflow-table' });
         const tbody = table.createEl('tbody');

         const createRow = (label: string, value: string, valueClass?: string) => {
             const row = tbody.createEl('tr');
             row.createEl('td', { text: label });
              const cell = row.createEl('td', { text: value });
              if (valueClass) cell.addClass(valueClass);
         };

         createRow('Total Income', `¥${totals.income.toFixed(2)}`, 'income-value');
         createRow('Total Expenses', `¥${totals.expenses.toFixed(2)}`, 'expense-value');
         createRow('Net Cash Flow (Balance)', `¥${totals.balance.toFixed(2)}`, totals.balance >= 0 ? 'positive' : 'negative');
         createRow('Savings Rate', `${savingsRate.toFixed(1)}%`, savingsRate >= 0 ? 'positive' : 'negative'); // Savings rate as % of income
         createRow('Average Transaction Amount', `¥${(transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length).toFixed(2)}`);
         createRow('Average Income Transaction', `¥${(totals.income / transactions.filter(t=>t.type==='income').length || 0).toFixed(2)}`);
         createRow('Average Expense Transaction', `¥${(totals.expenses / transactions.filter(t=>t.type==='expense').length || 0).toFixed(2)}`);
    }

    /** Helper for Analysis Tab: Render Tag Analysis */
     private renderTagAnalysis(containerEl: HTMLElement, transactions: Transaction[]): void {
        const tags = flattenHierarchy(this.plugin.settings.tags);
        if (tags.length === 0) {
            containerEl.createEl('p', { text: 'No tags defined in settings.' });
            return;
        }

        const tagData: Record<string, { income: number, expense: number, count: number }> = {};

         // Initialize tag data
         tags.forEach(tag => {
             tagData[tag.id] = { income: 0, expense: 0, count: 0 };
         });
         // Add an entry for transactions without tags
         tagData['untagged'] = { income: 0, expense: 0, count: 0 };


        transactions.forEach(t => {
            const tagIds = t.tagIds || [];
             if (tagIds.length === 0) {
                 // Count untagged transactions
                 if (t.type === 'income') tagData['untagged'].income += t.amount;
                 else tagData['untagged'].expense += t.amount;
                 tagData['untagged'].count++;
             } else {
                 tagIds.forEach(tagId => {
                     if (tagData[tagId]) {
                         if (t.type === 'income') tagData[tagId].income += t.amount;
                         else tagData[tagId].expense += t.amount;
                         tagData[tagId].count++;
                     }
                      // Could handle unknown tag IDs here if needed
                 });
             }
        });

         // Prepare data for table, filtering out tags with no transactions
         const tableData = tags.map(tag => ({
             id: tag.id,
             name: tag.name,
             ...tagData[tag.id],
             net: tagData[tag.id].income - tagData[tag.id].expense
         })).filter(d => d.count > 0); // Only show tags used in the filtered period

         // Add untagged data if it has transactions
         if (tagData['untagged'].count > 0) {
             tableData.push({
                 id: 'untagged',
                 name: 'Untagged',
                  ...tagData['untagged'],
                  net: tagData['untagged'].income - tagData['untagged'].expense
             });
         }
         
         if (tableData.length === 0) {
             containerEl.createEl('p', { text: 'No tagged transactions found in this period.' });
             return;
         }

         // Sort by count or net amount? Let's sort by count descending.
         tableData.sort((a, b) => b.count - a.count);

         // Create Table
         const table = containerEl.createEl('table', { cls: 'analysis-table tag-analysis-table' });
         const thead = table.createEl('thead');
         const hr = thead.createEl('tr');
         hr.createEl('th', { text: 'Tag' });
         hr.createEl('th', { text: 'Txns' });
         hr.createEl('th', { text: 'Income' });
         hr.createEl('th', { text: 'Expense' });
         hr.createEl('th', { text: 'Net' });

         const tbody = table.createEl('tbody');
         tableData.forEach(d => {
             const row = tbody.createEl('tr');
             row.createEl('td', { text: d.name });
             row.createEl('td', { text: d.count.toString() });
              const incCell = row.createEl('td', { text: `¥${d.income.toFixed(2)}` });
              if (d.income > 0) incCell.addClass('income-value');
              const expCell = row.createEl('td', { text: `¥${d.expense.toFixed(2)}` });
              if (d.expense > 0) expCell.addClass('expense-value');
              const netCell = row.createEl('td', { text: `¥${d.net.toFixed(2)}` });
              if (d.net !== 0) netCell.addClass(d.net > 0 ? 'positive' : 'negative');
         });
     }


    /**
     * Render the Reports tab
     */
    private renderReportsTab(containerEl: HTMLElement): void {
        // containerEl.createEl('h3', { text: 'Financial Reports' }); // Title redundant
        
        // Create period selector
        const periodSelector = containerEl.createDiv('report-period-selector', el => {
             // Style similar to main tabs
             el.style.display = 'flex';
             el.style.flexWrap = 'wrap';
             el.style.gap = '5px';
             el.style.marginBottom = '15px'; // Space below tabs
        });
        
        // Create period tabs
        const periodTabs = [
            // { id: 'daily', label: 'Daily Report' }, // Daily might be too granular
            { id: 'monthly', label: 'Monthly Report' },
            { id: 'yearly', label: 'Yearly Report' },
            { id: 'category', label: 'Category Report' },
             { id: 'account', label: 'Account Report' },
             { id: 'tag', label: 'Tag Report' }
        ];
        
        // Current period for reports (store as property?)
        let currentReportPeriod = 'monthly'; // Default
        
        // Create tabs
        periodTabs.forEach(tab => {
            const tabEl = periodSelector.createEl('button', {
                cls: ['report-period-tab', tab.id === currentReportPeriod ? 'active' : ''],
                text: tab.label
            });
            
            tabEl.addEventListener('click', () => {
                // Update current period
                currentReportPeriod = tab.id;
                
                // Remove active class from all tabs
                periodSelector.querySelectorAll('.report-period-tab').forEach(el => {
                    el.removeClass('active');
                });
                
                // Add active class to clicked tab
                tabEl.addClass('active');
                
                // Clear report container
                reportContainer.empty();
                
                // Render appropriate report
                // if (currentReportPeriod === 'daily') {
                //     this.renderDailyReport(reportContainer);
                // } else 
                if (currentReportPeriod === 'monthly') {
                    this.renderMonthlyReport(reportContainer);
                } else if (currentReportPeriod === 'yearly') {
                    this.renderYearlyReport(reportContainer);
                } else if (currentReportPeriod === 'category') {
                    this.renderCategoryReport(reportContainer);
                } else if (currentReportPeriod === 'account') {
                     this.renderAccountReport(reportContainer);
                 } else if (currentReportPeriod === 'tag') {
                     this.renderTagReport(reportContainer);
                 }
            });
        });
        
        // Create report container
        const reportContainer = containerEl.createDiv('report-content-container');
        
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
     /**
     * Renders a pie chart for category breakdown (income or expense).
     */
    private renderCategoryPieChart(
        containerEl: HTMLElement, 
        categoryData: { name: string, amount: number }[], // Expects sorted data with names and amounts
        totalAmount: number,
        title: string = 'Breakdown' // Optional title override
    ): void {
        const chartOuterContainer = containerEl.createDiv('pie-chart-outer-container');
        // chartOuterContainer.createEl('h5', { text: title }); // Title is usually provided by the calling context (e.g., h4)

        const chartContainer = chartOuterContainer.createDiv('category-pie-chart-container');

        if (categoryData.length === 0 || totalAmount <= 0) {
            chartContainer.createEl('p', { text: 'No data for pie chart.' });
            return;
        }

        // Limit slices shown? (e.g., top 9 + "Other")
        const maxSlices = 10;
        let displayData = categoryData;
        let otherAmount = 0;
        if (categoryData.length > maxSlices) {
            displayData = categoryData.slice(0, maxSlices - 1);
            otherAmount = categoryData.slice(maxSlices - 1).reduce((sum, cat) => sum + cat.amount, 0);
            if (otherAmount > 0) {
                displayData.push({ name: 'Other', amount: otherAmount });
            }
        }
        
        // Generate CSS conic gradient string
        let gradientString = 'conic-gradient(';
        let currentPercentage = 0;
        const colors = this.generateCategoryColors(displayData.length); // Helper to get distinct colors
        
        displayData.forEach(({ name, amount }, index) => {
            const percentage = (amount / totalAmount) * 100;
            const color = colors[index % colors.length]; // Cycle colors if needed
            gradientString += `${color} ${currentPercentage}% ${currentPercentage + percentage}%, `;
            currentPercentage += percentage;
        });
        
        // Remove trailing comma and space, add closing parenthesis
        gradientString = gradientString.slice(0, -2) + ')';

        // Create pie element
        const pieElement = chartContainer.createDiv({ cls: 'pie-chart' });
        pieElement.style.background = gradientString;
        // Add a tooltip showing the total?
        pieElement.title = `Total: ¥${totalAmount.toFixed(2)}`;
        
        // Create legend (optional, table often serves this purpose)
        // const legendContainer = chartContainer.createDiv({ cls: 'pie-chart-legend' });
        // displayData.forEach(({ name, amount }, index) => {
        //     const percentage = (amount / totalAmount) * 100;
        //     const legendItem = legendContainer.createDiv({ cls: 'legend-item' });
        //     const colorBox = legendItem.createDiv({ cls: 'legend-color' });
        //     colorBox.style.backgroundColor = colors[index % colors.length];
        //     legendItem.createEl('span', { text: `${name}: ¥${amount.toFixed(2)} (${percentage.toFixed(1)}%)` });
        // });
    }
    
    /**
     * Helper function to generate distinct colors for categories.
     * Simple HSL based color generation.
     */
    private generateCategoryColors(count: number): string[] {
        const colors: string[] = [];
         // Use a base hue and rotate, varying lightness/saturation slightly for more distinction
         const baseHue = 200; // Start somewhere like blue/teal
         const hueStep = count > 1 ? 360 / count : 0; 
        for (let i = 0; i < count; i++) {
            const hue = (baseHue + i * hueStep) % 360;
             // Alternate saturation/lightness slightly
            const saturation = 60 + (i % 2) * 10; // e.g., 60% or 70%
            const lightness = 55 + (i % 3) * 5; // e.g., 55%, 60%, 65%
            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`); 
        }
        // If only one color, make it reasonably distinct
         if (count === 1) {
             return ['hsl(210, 70%, 60%)']; // A standard blueish color
         }
        return colors;
    }

     /** Helper to add a standard Income/Expense legend */
     private addIncomeExpenseLegend(containerEl: HTMLElement): void {
        const legend = containerEl.createDiv({cls: 'chart-legend'});
        const incomeLegend = legend.createDiv({cls: 'legend-item'});
        incomeLegend.createDiv({cls: 'legend-color income-color'});
        incomeLegend.createEl('span', { text: 'Income' });
        const expenseLegend = legend.createDiv({cls: 'legend-item'});
        expenseLegend.createDiv({cls: 'legend-color expense-color'});
        expenseLegend.createEl('span', { text: 'Expenses' });
    }

    // --- Report Rendering Methods ---

    /** Base class or function for generating reports? Could abstract common parts. */
    
    /** Renders Monthly Report */
    private renderMonthlyReport(containerEl: HTMLElement): void {
         containerEl.createEl('h4', { text: 'Monthly Financial Report' });
         
         // Get filtered transactions (respecting main filters)
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
        
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found for the selected filters.' });
            return;
        }
         
        // Group by month
        const transactionsByMonth: Record<string, Transaction[]> = {};
        const uniqueMonths = [...new Set(filteredTransactions.map(t => moment(normalizeTransactionDate(t.date)).format('YYYY-MM')))].sort().reverse(); // Newest first

        uniqueMonths.forEach(monthKey => {
            transactionsByMonth[monthKey] = [];
        });
        filteredTransactions.forEach(t => {
             const monthKey = moment(normalizeTransactionDate(t.date)).format('YYYY-MM');
             if (transactionsByMonth[monthKey]) {
                 transactionsByMonth[monthKey].push(t);
             }
        });

        // Create table
        const table = containerEl.createEl('table', { cls: 'report-table monthly-report-table' });
        const thead = table.createEl('thead');
        const hr = thead.createEl('tr');
        hr.createEl('th', { text: 'Month' });
        hr.createEl('th', { text: 'Income' });
        hr.createEl('th', { text: 'Expenses' });
        hr.createEl('th', { text: 'Net Balance' });
        hr.createEl('th', { text: 'Transactions' });
        hr.createEl('th', { text: 'Top Expense Cat.' }); // Example additional column

        const tbody = table.createEl('tbody');
        let totalIncome = 0, totalExpenses = 0, totalCount = 0;

        uniqueMonths.forEach(monthKey => {
            const monthTransactions = transactionsByMonth[monthKey];
            const totals = this.calculateTotals(monthTransactions);
            totalIncome += totals.income;
            totalExpenses += totals.expenses;
            totalCount += monthTransactions.length;

             // Find top expense category for the month
             let topExpenseCat = '-';
             if (totals.expenses > 0) {
                 const expenses = monthTransactions.filter(t => t.type === 'expense');
                 const cats = flattenHierarchy(this.plugin.settings.categories);
                 const expByCat: Record<string, number> = {};
                 expenses.forEach(t => {
                     const catName = cats.find(c => c.id === t.categoryId)?.name || 'Uncategorized';
                     expByCat[catName] = (expByCat[catName] || 0) + t.amount;
                 });
                 const sortedExp = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);
                 if (sortedExp.length > 0) {
                     topExpenseCat = `${sortedExp[0][0]} (¥${sortedExp[0][1].toFixed(0)})`;
                 }
             }

            const row = tbody.createEl('tr');
            row.createEl('td', { text: moment(monthKey).format('MMM YYYY') });
            row.createEl('td', { text: `¥${totals.income.toFixed(2)}`, cls: 'income-value' });
            row.createEl('td', { text: `¥${totals.expenses.toFixed(2)}`, cls: 'expense-value' });
             const balanceCell = row.createEl('td', { text: `¥${totals.balance.toFixed(2)}` });
             balanceCell.addClass(totals.balance >= 0 ? 'positive' : 'negative');
            row.createEl('td', { text: monthTransactions.length.toString() });
            row.createEl('td', { text: topExpenseCat });
        });

        // Add total row
         const tfoot = table.createEl('tfoot');
         const totalRow = tfoot.createEl('tr');
         totalRow.createEl('th', { text: 'Total / Avg' });
         totalRow.createEl('th', { text: `¥${totalIncome.toFixed(2)}` });
         totalRow.createEl('th', { text: `¥${totalExpenses.toFixed(2)}` });
         const totalBalance = totalIncome - totalExpenses;
         const totalBalCell = totalRow.createEl('th', { text: `¥${totalBalance.toFixed(2)}` });
         totalBalCell.addClass(totalBalance >= 0 ? 'positive' : 'negative');
         totalRow.createEl('th', { text: totalCount.toString() });
         totalRow.createEl('th', { text: '-' }); // No total for top category
    }

    /** Renders Yearly Report */
    private renderYearlyReport(containerEl: HTMLElement): void {
         containerEl.createEl('h4', { text: 'Yearly Financial Report' });
         
        const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
        if (filteredTransactions.length === 0) {
            containerEl.createEl('p', { text: 'No transactions found.' }); return;
        }
         
        const transactionsByYear: Record<string, Transaction[]> = {};
        const uniqueYears = [...new Set(filteredTransactions.map(t => moment(normalizeTransactionDate(t.date)).format('YYYY')))].sort().reverse(); // Newest first

        uniqueYears.forEach(yearKey => { transactionsByYear[yearKey] = []; });
        filteredTransactions.forEach(t => {
             const yearKey = moment(normalizeTransactionDate(t.date)).format('YYYY');
             if (transactionsByYear[yearKey]) transactionsByYear[yearKey].push(t);
        });

        const table = containerEl.createEl('table', { cls: 'report-table yearly-report-table' });
        const thead = table.createEl('thead');
        const hr = thead.createEl('tr');
        hr.createEl('th', { text: 'Year' });
        hr.createEl('th', { text: 'Income' });
        hr.createEl('th', { text: 'Expenses' });
        hr.createEl('th', { text: 'Net Balance' });
        hr.createEl('th', { text: 'Avg Monthly Bal' }); // Example extra column
        hr.createEl('th', { text: 'Transactions' });

        const tbody = table.createEl('tbody');
        let grandTotalIncome = 0, grandTotalExpenses = 0, grandTotalCount = 0;

        uniqueYears.forEach(yearKey => {
            const yearTransactions = transactionsByYear[yearKey];
            const totals = this.calculateTotals(yearTransactions);
            grandTotalIncome += totals.income;
            grandTotalExpenses += totals.expenses;
            grandTotalCount += yearTransactions.length;

             // Calculate avg monthly balance for the year
             const monthsInYear = new Set(yearTransactions.map(t => moment(normalizeTransactionDate(t.date)).format('YYYY-MM'))).size;
             const avgMonthlyBal = monthsInYear > 0 ? totals.balance / monthsInYear : 0;

            const row = tbody.createEl('tr');
            row.createEl('td', { text: yearKey });
            row.createEl('td', { text: `¥${totals.income.toFixed(2)}`, cls: 'income-value' });
            row.createEl('td', { text: `¥${totals.expenses.toFixed(2)}`, cls: 'expense-value' });
            const balanceCell = row.createEl('td', { text: `¥${totals.balance.toFixed(2)}` });
            balanceCell.addClass(totals.balance >= 0 ? 'positive' : 'negative');
             const avgBalCell = row.createEl('td', { text: `¥${avgMonthlyBal.toFixed(2)}` });
             avgBalCell.addClass(avgMonthlyBal >= 0 ? 'positive' : 'negative');
            row.createEl('td', { text: yearTransactions.length.toString() });
        });

         const tfoot = table.createEl('tfoot');
         const totalRow = tfoot.createEl('tr');
         totalRow.createEl('th', { text: 'Overall Total / Avg' });
         totalRow.createEl('th', { text: `¥${grandTotalIncome.toFixed(2)}` });
         totalRow.createEl('th', { text: `¥${grandTotalExpenses.toFixed(2)}` });
         const grandTotalBalance = grandTotalIncome - grandTotalExpenses;
         const totalBalCell = totalRow.createEl('th', { text: `¥${grandTotalBalance.toFixed(2)}` });
         totalBalCell.addClass(grandTotalBalance >= 0 ? 'positive' : 'negative');
         // Avg monthly balance over the entire period shown
         const totalMonthsOverall = new Set(filteredTransactions.map(t => moment(normalizeTransactionDate(t.date)).format('YYYY-MM'))).size;
         const overallAvgMonthlyBal = totalMonthsOverall > 0 ? grandTotalBalance / totalMonthsOverall : 0;
         const overallAvgCell = totalRow.createEl('th', { text: `¥${overallAvgMonthlyBal.toFixed(2)}`});
         overallAvgCell.addClass(overallAvgMonthlyBal >= 0 ? 'positive' : 'negative');
         totalRow.createEl('th', { text: grandTotalCount.toString() });
    }

    /** Renders Category Report */
    private renderCategoryReport(containerEl: HTMLElement): void {
         containerEl.createEl('h4', { text: 'Category Financial Report' });

         const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
         if (filteredTransactions.length === 0) {
             containerEl.createEl('p', { text: 'No transactions found.' }); return;
         }

         const categories = flattenHierarchy(this.plugin.settings.categories);
         const categoryData: Record<string, { income: number, expense: number, count: number }> = {};

         // Initialize
         categories.forEach(cat => { categoryData[cat.id] = { income: 0, expense: 0, count: 0 }; });
         categoryData['uncategorized'] = { income: 0, expense: 0, count: 0 }; // For uncategorized

         filteredTransactions.forEach(t => {
             const catId = t.categoryId || 'uncategorized';
             if (!categoryData[catId]) { // Handle potentially unknown category IDs from data
                 categoryData[catId] = { income: 0, expense: 0, count: 0 }; 
             }
             if (t.type === 'income') categoryData[catId].income += t.amount;
             else categoryData[catId].expense += t.amount;
             categoryData[catId].count++;
         });

         const tableData = Object.entries(categoryData).map(([id, data]) => ({
             id: id,
             name: id === 'uncategorized' ? 'Uncategorized' : (categories.find(c => c.id === id)?.name || `Unknown (${id})`),
             ...data,
             net: data.income - data.expense
         })).filter(d => d.count > 0); // Only show categories with transactions

          if (tableData.length === 0) {
             containerEl.createEl('p', { text: 'No categorized transactions found.' }); return;
         }

         // Sort by net amount (most positive first) or total amount? Let's try net.
         tableData.sort((a, b) => b.net - a.net);

         const table = containerEl.createEl('table', { cls: 'report-table category-report-table' });
         const thead = table.createEl('thead');
         const hr = thead.createEl('tr');
         hr.createEl('th', { text: 'Category' });
         hr.createEl('th', { text: 'Income' });
         hr.createEl('th', { text: 'Expense' });
         hr.createEl('th', { text: 'Net' });
         hr.createEl('th', { text: 'Txns' });
         hr.createEl('th', { text: 'Avg Txn Net' });

         const tbody = table.createEl('tbody');
         let totalIncome = 0, totalExpenses = 0, totalCount = 0;
         tableData.forEach(d => {
             totalIncome += d.income; totalExpenses += d.expense; totalCount += d.count;
             const row = tbody.createEl('tr');
             row.createEl('td', { text: d.name });
             row.createEl('td', { text: `¥${d.income.toFixed(2)}`, cls: 'income-value' });
             row.createEl('td', { text: `¥${d.expense.toFixed(2)}`, cls: 'expense-value' });
             const netCell = row.createEl('td', { text: `¥${d.net.toFixed(2)}` });
             netCell.addClass(d.net >= 0 ? 'positive' : 'negative');
             row.createEl('td', { text: d.count.toString() });
             const avgNet = d.count > 0 ? d.net / d.count : 0;
             const avgNetCell = row.createEl('td', { text: `¥${avgNet.toFixed(2)}` });
             avgNetCell.addClass(avgNet >= 0 ? 'positive' : 'negative');
         });

         const tfoot = table.createEl('tfoot');
         const totalRow = tfoot.createEl('tr');
         totalRow.createEl('th', { text: 'Total' });
         totalRow.createEl('th', { text: `¥${totalIncome.toFixed(2)}` });
         totalRow.createEl('th', { text: `¥${totalExpenses.toFixed(2)}` });
         const totalNet = totalIncome - totalExpenses;
         const totalNetCell = totalRow.createEl('th', { text: `¥${totalNet.toFixed(2)}` });
         totalNetCell.addClass(totalNet >= 0 ? 'positive' : 'negative');
         totalRow.createEl('th', { text: totalCount.toString() });
          const totalAvgNet = totalCount > 0 ? totalNet / totalCount : 0;
          const totalAvgNetCell = totalRow.createEl('th', { text: `¥${totalAvgNet.toFixed(2)}` });
          totalAvgNetCell.addClass(totalAvgNet >= 0 ? 'positive' : 'negative');
    }
    
     /** Renders Account Report */
    private renderAccountReport(containerEl: HTMLElement): void {
         containerEl.createEl('h4', { text: 'Account Financial Report' });

         const filteredTransactions = this.getFilteredTransactionsForCurrentScope();
         if (filteredTransactions.length === 0) {
             containerEl.createEl('p', { text: 'No transactions found.' }); return;
         }

         const accounts = flattenHierarchy(this.plugin.settings.accounts);
         const accountData: Record<string, { income: number, expense: number, count: number }> = {};

         accounts.forEach(acc => { accountData[acc.id] = { income: 0, expense: 0, count: 0 }; });
         accountData['unassigned'] = { income: 0, expense: 0, count: 0 }; // For transactions without an account

         filteredTransactions.forEach(t => {
             const accId = t.accountId || 'unassigned';
             if (!accountData[accId]) { // Handle unknown account IDs
                 accountData[accId] = { income: 0, expense: 0, count: 0 }; 
             }
             if (t.type === 'income') accountData[accId].income += t.amount;
             else accountData[accId].expense += t.amount;
             accountData[accId].count++;
         });

         const tableData = Object.entries(accountData).map(([id, data]) => ({
             id: id,
             name: id === 'unassigned' ? 'Unassigned' : (accounts.find(a => a.id === id)?.name || `Unknown (${id})`),
             ...data,
             net: data.income - data.expense
         })).filter(d => d.count > 0);

         if (tableData.length === 0) {
             containerEl.createEl('p', { text: 'No transactions assigned to accounts found.' }); return;
         }

         tableData.sort((a, b) => b.net - a.net); // Sort by net contribution

         const table = containerEl.createEl('table', { cls: 'report-table account-report-table' });
         const thead = table.createEl('thead');
         const hr = thead.createEl('tr');
         hr.createEl('th', { text: 'Account' });
         hr.createEl('th', { text: 'Income' });
         hr.createEl('th', { text: 'Expense' });
         hr.createEl('th', { text: 'Net Flow' });
         hr.createEl('th', { text: 'Txns' });

         const tbody = table.createEl('tbody');
         let totalIncome = 0, totalExpenses = 0, totalCount = 0;
         tableData.forEach(d => {
             totalIncome += d.income; totalExpenses += d.expense; totalCount += d.count;
             const row = tbody.createEl('tr');
             row.createEl('td', { text: d.name });
             row.createEl('td', { text: `¥${d.income.toFixed(2)}`, cls: 'income-value' });
             row.createEl('td', { text: `¥${d.expense.toFixed(2)}`, cls: 'expense-value' });
             const netCell = row.createEl('td', { text: `¥${d.net.toFixed(2)}` });
             netCell.addClass(d.net >= 0 ? 'positive' : 'negative');
             row.createEl('td', { text: d.count.toString() });
         });

         const tfoot = table.createEl('tfoot');
         const totalRow = tfoot.createEl('tr');
         totalRow.createEl('th', { text: 'Total' });
         totalRow.createEl('th', { text: `¥${totalIncome.toFixed(2)}` });
         totalRow.createEl('th', { text: `¥${totalExpenses.toFixed(2)}` });
         const totalNet = totalIncome - totalExpenses;
         const totalNetCell = totalRow.createEl('th', { text: `¥${totalNet.toFixed(2)}` });
         totalNetCell.addClass(totalNet >= 0 ? 'positive' : 'negative');
         totalRow.createEl('th', { text: totalCount.toString() });
    }

     /** Renders Tag Report */
    private renderTagReport(containerEl: HTMLElement): void {
         containerEl.createEl('h4', { text: 'Tag Financial Report' });
        
        // Reuse the logic from renderTagAnalysis for data gathering and display
         const tagAnalysisContainer = containerEl.createDiv(); // Temporary container
         this.renderTagAnalysis(tagAnalysisContainer, this.getFilteredTransactionsForCurrentScope());
         
         // Move the generated table (if it exists) into the report container
         const generatedTable = tagAnalysisContainer.querySelector('.tag-analysis-table');
         if (generatedTable) {
             // Optionally modify the table class for report styling
             generatedTable.removeClass('analysis-table');
             generatedTable.addClass('report-table');
             containerEl.appendChild(generatedTable);
         } else {
              // If renderTagAnalysis didn't create a table (e.g., no tags/data), show message here
              if (!containerEl.querySelector('p')) { // Avoid duplicate messages
                 containerEl.createEl('p', { text: 'No tagged transaction data found for this report.' });
              }
         }
         tagAnalysisContainer.remove(); // Clean up temporary container
    }


    /**
     * Re-renders the content of the currently active tab.
     */
     private rerenderCurrentTabContent(containerEl: HTMLElement | null): void {
        // If the passed container is null, try to find it
        if (!containerEl) {
            containerEl = this.contentEl.querySelector('.tab-content');
        }
        
        if (containerEl instanceof HTMLElement) { // Check if it's a valid element
            containerEl.empty(); // Clear only the tab content area
            
            // Re-render the appropriate tab based on the currentTab state
            switch (this.currentTab) {
                case StatsTab.OVERVIEW:
                    this.renderOverviewTab(containerEl);
                    break;
                case StatsTab.TRANSACTIONS:
                    this.renderTransactionsTab(containerEl);
                    break;
                case StatsTab.CALENDAR:
                    this.renderCalendarTab(containerEl);
                    break;
                case StatsTab.ACCOUNTS:
                    this.renderAccountsTab(containerEl);
                    break;
                case StatsTab.TRENDS:
                    this.renderTrendsTab(containerEl);
                    break;
                case StatsTab.ANALYSIS:
                    this.renderAnalysisTab(containerEl);
                    break;
                case StatsTab.REPORTS:
                    this.renderReportsTab(containerEl);
                    break;
                default:
                     console.error("Unknown tab selected for rerendering:", this.currentTab);
                     // Optionally render a default state or error message
                     containerEl.setText('Error: Could not render selected tab.');
            }
        } else {
            // Fallback if the container is still not found: re-render the whole view
            console.warn("Could not find .tab-content, re-rendering entire StatsView");
            this.renderStats();
        }
    }

    // Removed redundant getScopedTransactionsForOverview, use getFilteredTransactionsForCurrentScope directly
    // private getScopedTransactionsForOverview(): Transaction[] {
    //     return this.getFilteredTransactionsForCurrentScope();
    // }
}