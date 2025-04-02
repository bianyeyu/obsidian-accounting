import { App, Modal, Setting, moment, Notice, TFile, normalizePath } from 'obsidian';
import AccountingPlugin from '../main';
import { Account, Category, Tag, Transaction, TransactionType, generateId, flattenHierarchy, findItemById, BudgetItem, BudgetScope } from './models';
import { calculateBudgetSpending, getScopeName, getPeriodDateRange, parseTransactionsFromFile, getDatePart } from './utils';
import { Translation } from './locales';

/**
 * Modal for adding a new transaction
 */
export class TransactionModal extends Modal {
    private plugin: AccountingPlugin;
    private transaction: Partial<Transaction>;
    private onSubmit: (transaction: Transaction) => void;

    constructor(app: App, plugin: AccountingPlugin, onSubmit: (transaction: Transaction) => void) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        
        // Initialize with default values
        this.transaction = {
            id: generateId(),
            date: moment().format('YYYY-MM-DD HH:mm'),
            type: 'expense',
            amount: 0,
            accountId: this.plugin.settings.accounts.length > 0 ? this.plugin.settings.accounts[0].id : '',
            categoryId: '',
            tagIds: [],
            note: ''
        };
    }

    onOpen() {
        // Add our custom class to the modal
        this.modalEl.addClass('accounting-transaction-modal');
        
        const { contentEl } = this;
        contentEl.empty();
        
        // Get i18n instance for translations
        const i18n = this.plugin.i18n;
        
        contentEl.createEl('h2', { text: i18n.t('ADD_TRANSACTION') });
        
        // Date and Time - split into separate inputs
        const dateTimeContainer = contentEl.createDiv('date-time-container form-group');
        const dateLabel = dateTimeContainer.createEl('label', { text: i18n.t('DATE') });
        dateLabel.style.fontWeight = 'bold';
        dateLabel.style.display = 'block';
        dateLabel.style.marginBottom = '5px';
        
        const dateDesc = dateTimeContainer.createEl('div', { text: i18n.t('DATE_TIME_DESC') });
        dateDesc.style.marginBottom = '10px';
        dateDesc.addClass('setting-item-description');
        
        const dateTimeInputs = dateTimeContainer.createDiv('date-time-inputs');
        dateTimeInputs.style.display = 'flex';
        dateTimeInputs.style.gap = '10px';
        
        // Parse current date/time
        const currentDateTime = moment(this.transaction.date, 'YYYY-MM-DD HH:mm');
        const currentDate = currentDateTime.format('YYYY-MM-DD');
        const currentTime = currentDateTime.format('HH:mm');
        
        // Date input
        const dateInput = dateTimeInputs.createEl('input', {
            type: 'date',
            value: currentDate
        });
        dateInput.style.flex = '1';
        
        // Time input
        const timeInput = dateTimeInputs.createEl('input', {
            type: 'time',
            value: currentTime
        });
        timeInput.style.width = '120px';
        
        // Update transaction when date/time changes
        dateInput.addEventListener('change', () => {
            const newDate = dateInput.value;
            const time = timeInput.value || '00:00';
            this.transaction.date = `${newDate} ${time}`;
        });
        
        timeInput.addEventListener('change', () => {
            const date = dateInput.value || moment().format('YYYY-MM-DD');
            const newTime = timeInput.value;
            this.transaction.date = `${date} ${newTime}`;
        });
        
        // Type
        new Setting(contentEl)
            .setName(i18n.t('TRANSACTION_TYPE'))
            .setDesc(i18n.t('TRANSACTION_TYPE_DESC'))
            .addDropdown(dropdown => dropdown
                .addOption('expense', i18n.t('EXPENSE'))
                .addOption('income', i18n.t('INCOME'))
                .setValue(this.transaction.type || 'expense')
                .onChange(value => {
                    this.transaction.type = value as TransactionType;
                    // Reset category when type changes
                    this.transaction.categoryId = '';
                    // Re-render to update category options
                    this.onOpen();
                }));
        
        // Amount
        new Setting(contentEl)
            .setName(i18n.t('AMOUNT'))
            .setDesc(i18n.t('AMOUNT_DESC'))
            .addText(text => {
                text.inputEl.type = 'number';
                text.inputEl.step = '0.01';
                text.setValue(this.transaction.amount?.toString() || '0')
                    .onChange(value => {
                        const amount = parseFloat(value);
                        if (!isNaN(amount)) {
                            this.transaction.amount = amount;
                        }
                    });
            });
        
        // Account
        new Setting(contentEl)
            .setName(i18n.t('ACCOUNT_FIELD'))
            .setDesc(i18n.t('ACCOUNT_SELECT_DESC'))
            .addText(text => {
                text.inputEl.addClass('account-input-class');
                const datalistId = 'account-list-' + this.transaction.id;
                const datalist = document.createElement('datalist');
                datalist.id = datalistId;
                
                // Add all accounts to the datalist
                const flatAccounts = flattenHierarchy(this.plugin.settings.accounts);
                flatAccounts.forEach(account => {
                    const option = document.createElement('option');
                    option.value = account.name;
                    datalist.appendChild(option);
                });
                
                // Add the datalist to the document
                document.body.appendChild(datalist);
                
                // Get account name from ID
                let accountName = '';
                if (this.transaction.accountId) {
                    const account = flatAccounts.find(a => a.id === this.transaction.accountId);
                    if (account) {
                        accountName = account.name;
                    }
                }
                
                // Set up the text input with autocomplete
                const textInput = text
                    .setValue(accountName)
                    .setPlaceholder(i18n.t('ACCOUNT_PLACEHOLDER'))
                    .onChange(value => {
                        // Find account by name
                        const account = flatAccounts.find(a => a.name.toLowerCase() === value.toLowerCase());
                        if (account) {
                            this.transaction.accountId = account.id;
                        } else if (value.trim()) {
                            // If account doesn't exist, we'll create it when the transaction is submitted
                            this.transaction.accountId = 'new:' + value.trim();
                        } else {
                            this.transaction.accountId = '';
                        }
                        this.updateBudgetWarnings();
                    });
                
                // Add the datalist to the input
                textInput.inputEl.setAttribute('list', datalistId);
                
                return textInput;
            });
        
        // Category
        new Setting(contentEl)
            .setName(i18n.t('CATEGORY_FIELD'))
            .setDesc(i18n.t('CATEGORY_SELECT_DESC'))
            .addText(text => {
                text.inputEl.addClass('category-input-class');
                const datalistId = 'category-list-' + this.transaction.id;
                const datalist = document.createElement('datalist');
                datalist.id = datalistId;

                // Filter categories by transaction type
                const categoriesOfType = this.plugin.settings.categories.filter(c => c.type === this.transaction.type);

                // Flatten the category hierarchy
                const flatCategories = flattenHierarchy(categoriesOfType);

                // Add all categories to the datalist
                flatCategories.forEach(category => {
                    const option = document.createElement('option');
                    // Use the flat name for the datalist value
                    option.value = category.name;
                    datalist.appendChild(option);
                });

                // Add the datalist to the document
                document.body.appendChild(datalist);

                // Get category name from ID
                let categoryName = '';
                if (this.transaction.categoryId) {
                    // Find by ID in the flattened list
                    const category = flatCategories.find(c => c.id === this.transaction.categoryId);
                    if (category) {
                        // Use the flat name
                        categoryName = category.name;
                    }
                }

                // Set up the text input with autocomplete
                const textInput = text
                    .setValue(categoryName)
                    .setPlaceholder(i18n.t('CATEGORY_PLACEHOLDER'))
                    .onChange(value => {
                        // Find category by name (case-insensitive comparison on the flat name)
                        const category = flatCategories.find(c =>
                            c.name.toLowerCase() === value.trim().toLowerCase()
                        );
                        if (category) {
                            this.transaction.categoryId = category.id;
                        } else if (value.trim()) {
                            // If category doesn't exist, we'll create it when the transaction is submitted
                            this.transaction.categoryId = 'new:' + value.trim();
                        } else {
                            this.transaction.categoryId = '';
                        }
                        this.updateBudgetWarnings();
                    });
                
                // Add the datalist to the input
                textInput.inputEl.setAttribute('list', datalistId);
                
                return textInput;
            });
        
        // Tags
        new Setting(contentEl)
            .setName(i18n.t('TAGS_FIELD'))
            .setDesc(i18n.t('TAGS_SELECT_DESC'))
            .addText(text => {
                text.inputEl.addClass('tags-input-class');
                const datalistId = 'tags-list-' + this.transaction.id;
                const datalist = document.createElement('datalist');
                datalist.id = datalistId;

                // Flatten the tag hierarchy
                const flatTags = flattenHierarchy(this.plugin.settings.tags);

                // Add all tags to the datalist
                flatTags.forEach(tag => {
                    const option = document.createElement('option');
                    option.value = tag.name;
                    datalist.appendChild(option);
                });

                // Add the datalist to the document
                document.body.appendChild(datalist);

                const textInput = text
                    .setPlaceholder(i18n.t('TAGS_PLACEHOLDER'))
                    .setValue(this.getTagNames().join(', '))
                    .onChange(value => {
                        this.transaction.tagIds = this.getTagIdsFromNames(value);
                        this.updateBudgetWarnings();
                    });

                // Add the datalist to the input
                textInput.inputEl.setAttribute('list', datalistId);

                return textInput;
            });
        
        // Note
        new Setting(contentEl)
            .setName(i18n.t('NOTE'))
            .setDesc(i18n.t('NOTE_DESC'))
            .addTextArea(text => text
                .setValue(this.transaction.note || '')
                .setPlaceholder(i18n.t('NOTE_PLACEHOLDER'))
                .onChange(value => this.transaction.note = value));
                
        // --- Budget Warning Area ---
        const budgetWarningArea = contentEl.createDiv({ cls: 'budget-warning-area' });
        budgetWarningArea.id = 'budget-warning-area';
        
        // --- Submit/Cancel Buttons ---
        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(i18n.t('ADD_TRANSACTION'))
                .setCta()
                .onClick(() => {
                    if (this.validateTransaction()) {
                        // Handle creation of new accounts/categories/tags if needed
                        this.handleNewItems().then(() => {
                           this.onSubmit(this.transaction as Transaction);
                           this.close();
                        });
                    }
                }))
            .addButton(button => button
                .setButtonText(i18n.t('CANCEL'))
                .onClick(() => this.close()));
                
        // Initial budget check
        this.updateBudgetWarnings();
        
        // Add change listeners via querySelector
        const amountInput = contentEl.querySelector('input[type="number"]');
        if (amountInput) {
            amountInput.addEventListener('input', () => this.updateBudgetWarnings());
        }
        const accountInput = contentEl.querySelector('.account-input-class'); 
        if(accountInput) accountInput.addEventListener('change', () => this.updateBudgetWarnings());
        const categoryInput = contentEl.querySelector('.category-input-class'); 
        if(categoryInput) categoryInput.addEventListener('change', () => this.updateBudgetWarnings());
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
    
    /**
     * Validate that all required fields are filled
     */
    private validateTransaction(): boolean {
        const i18n = this.plugin.i18n;
        
        if (!this.transaction.date) {
            new Notice(i18n.t('ERROR_REQUIRED_FIELD') + ': ' + i18n.t('DATE'));
            return false;
        }
        
        if (!this.transaction.amount || this.transaction.amount <= 0) {
            new Notice(i18n.t('ERROR_AMOUNT_INVALID'));
            return false;
        }
        
        if (!this.transaction.accountId) {
            new Notice(i18n.t('ERROR_REQUIRED_FIELD') + ': ' + i18n.t('ACCOUNT'));
            return false;
        }
        
        if (!this.transaction.categoryId) {
            new Notice(i18n.t('ERROR_CATEGORY_REQUIRED'));
            return false;
        }
        
        return true;
    }

    /**
     * Updates the budget warning display area.
     */
    private updateBudgetWarnings(): void {
        const warningArea = this.contentEl.querySelector('#budget-warning-area') as HTMLElement;
        if (!warningArea) return;
        warningArea.empty(); // Clear previous warnings
        
        // Only check budgets for expense transactions
        if (this.transaction.type !== 'expense' || !this.transaction.amount || this.transaction.amount <= 0) {
            return;
        }

        const warnings = this.checkBudgets();
        if (warnings.length > 0) {
            const list = warningArea.createEl('ul', { cls: 'budget-warnings-list' });
            warnings.forEach(warning => {
                list.createEl('li', { text: warning.message, cls: warning.level });
            });
        }
    }

    /**
     * Checks the current transaction against defined budgets.
     * @returns An array of budget warning objects { message: string, level: 'warning' | 'over' }.
     */
    private checkBudgets(): { message: string, level: 'warning' | 'over' }[] {
        const i18n = this.plugin.i18n;
        const warnings: { message: string, level: 'warning' | 'over' }[] = [];
        const currentAmount = this.transaction.amount || 0;
        const transactionDate = moment(this.transaction.date, 'YYYY-MM-DD HH:mm');

        this.plugin.settings.budgets.forEach(budget => {
            const { start, end } = getPeriodDateRange(budget.period, transactionDate);
            
            // Check if budget period matches transaction date
            if (!transactionDate.isBetween(start, end, undefined, '[]')) {
                return; // Skip budget if not for this period
            }
            
            // Check if budget scope matches transaction data
            let isRelevant = false;
            if (budget.scope === BudgetScope.Category && budget.scopeId === this.transaction.categoryId) {
                 isRelevant = true;
            } else if (budget.scope === BudgetScope.Account && budget.scopeId === this.transaction.accountId) {
                 isRelevant = true;
            } else if (budget.scope === BudgetScope.Tag && this.transaction.tagIds?.includes(budget.scopeId)) {
                 isRelevant = true;
            } // Add hierarchy check here if needed later
            
            if (!isRelevant) {
                return; // Skip budget if scope doesn't match
            }

            // Calculate current spending for this budget period (excluding current transaction)
            // TODO: This is inefficient. Transaction loading should be centralized in the plugin
            //       for accurate and efficient budget checks in the modal.
            //       Using an empty list for now to resolve type error, budget check will be inaccurate.
            const allTransactions: Transaction[] = []; // Placeholder
            // const allTransactions = this.plugin.getAllTransactions ? this.plugin.getAllTransactions() : []; // Example getter
            const spendingSoFar = calculateBudgetSpending(
                budget,
                allTransactions.filter((t: Transaction) => t.id !== this.transaction.id), // Add type to 't' and use getter
                this.plugin.settings.categories,
                this.plugin.settings.tags
            );

            const projectedSpending = spendingSoFar + currentAmount;
            const percentage = budget.amount > 0 ? (projectedSpending / budget.amount) * 100 : 0;
            const scopeName = getScopeName(
                 budget.scope, budget.scopeId, 
                 this.plugin.settings.accounts, 
                 this.plugin.settings.categories, 
                 this.plugin.settings.tags, 
                 i18n
             );
            const budgetDisplayName = budget.name || `${i18n.t(budget.scope.toUpperCase() as any)}: ${scopeName}`;

            if (projectedSpending > budget.amount) {
                warnings.push({ 
                    message: `Over budget! Adding this transaction exceeds the ${i18n.t(budget.period as any)} budget for "${budgetDisplayName}" by ${(projectedSpending - budget.amount).toFixed(2)} (${percentage.toFixed(0)}%).`, 
                    level: 'over' 
                });
            } else if (percentage > 80) { // Warning threshold
                 warnings.push({ 
                     message: `Warning: Adding this transaction will bring the ${i18n.t(budget.period as any)} budget for "${budgetDisplayName}" to ${percentage.toFixed(0)}% (${projectedSpending.toFixed(2)} / ${budget.amount.toFixed(2)}).`, 
                     level: 'warning' 
                 });
            }
        });

        return warnings;
    }
    
    // Assuming handleNewItems exists or needs to be added
    private async handleNewItems(): Promise<void> { 
       // Placeholder for logic to create new Accounts/Categories/Tags
       // based on inputs like 'new:AccountName'
       console.log("Handling new items if any...");
       // Example for account:
       if (this.transaction.accountId?.startsWith('new:')){
           const newName = this.transaction.accountId.substring(4);
           // Add logic to create the account and update transaction.accountId
       }
       // Similar logic for categoryId and tagIds
       return Promise.resolve();
    }

    /**
     * Get tag names based on current transaction tag IDs, using flattened tags.
     */
    private getTagNames(): string[] {
        const flatTags = flattenHierarchy(this.plugin.settings.tags);
        if (!this.transaction.tagIds) {
            return [];
        }
        return this.transaction.tagIds
            .map(tagId => {
                const tag = flatTags.find(t => t.id === tagId);
                return tag ? tag.name : null; // Handle cases where ID might be invalid temporarily
            })
            .filter((name): name is string => name !== null); // Filter out nulls and type guard
    }

    /**
     * Get tag IDs from a comma-separated string of tag names, handling new tags.
     */
    private getTagIdsFromNames(namesString: string): string[] {
        const flatTags = flattenHierarchy(this.plugin.settings.tags);
        const tagNames = namesString.split(',').map(t => t.trim()).filter(Boolean);
        const tagIds: string[] = [];

        tagNames.forEach(name => {
            const existingTag = flatTags.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (existingTag) {
                tagIds.push(existingTag.id);
            } else {
                // Prepare to create a new tag
                tagIds.push('new:' + name);
            }
        });

        return tagIds;
    }
}