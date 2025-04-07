import { App, Modal, Setting, moment, Notice, TFile, normalizePath } from 'obsidian';
import AccountingPlugin from '../main';
import { Account, Category, Tag, Transaction, TransactionType, generateId, flattenHierarchy, findItemById, BudgetItem, BudgetScope, BudgetPeriod } from './models';
import { calculateBudgetSpending, getScopeName, getPeriodDateRange, parseTransactionsFromFile, getDatePart, findAccountById, findCategoryById, findTagById, findAccountByName, findCategoryByName } from './utils';
import { Translation } from './locales';
import { I18n } from './locales/i18n';

/**
 * Modal for adding or editing a transaction
 */
export class TransactionModal extends Modal {
    private plugin: AccountingPlugin;
    private transaction: Partial<Transaction>;
    private onSubmit: (transaction: Transaction) => void;
    private isEditMode: boolean;
    private budgetWarningEl: HTMLElement | null = null;

    constructor(
        app: App,
        plugin: AccountingPlugin,
        onSubmit: (transaction: Transaction) => void,
        transactionToEdit?: Transaction
    ) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        this.isEditMode = !!transactionToEdit;

        if (transactionToEdit) {
            this.transaction = { ...transactionToEdit };
            if (!Array.isArray(this.transaction.tagIds)) {
                this.transaction.tagIds = [];
            }
        } else {
            this.transaction = {
                id: generateId(),
                date: moment().format('YYYY-MM-DD HH:mm'),
                type: 'expense',
                amount: 0,
                accountId: this.plugin.settings.accounts.length > 0 ? flattenHierarchy(this.plugin.settings.accounts)[0]?.id : '',
                categoryId: '',
                tagIds: [],
                note: ''
            };
        }
    }

    onOpen() {
        this.modalEl.addClass('accounting-transaction-modal');
        
        const { contentEl } = this;
        contentEl.empty();
        
        const i18n = this.plugin.i18n;
        
        // Add a container for better content organization
        const modalContent = contentEl.createDiv('modal-content');
        
        modalContent.createEl('h2', { text: this.isEditMode ? i18n.t('EDIT_TRANSACTION') : i18n.t('ADD_TRANSACTION') });
        
        // Date and Time Section with improved layout
        const dateTimeContainer = modalContent.createDiv('date-time-container form-group');
        const dateLabel = dateTimeContainer.createEl('label', { text: i18n.t('DATE') });
        dateLabel.style.fontWeight = 'bold';
        dateLabel.style.display = 'block';
        dateLabel.style.marginBottom = '8px';
        
        const dateDesc = dateTimeContainer.createEl('div', { text: i18n.t('DATE_TIME_DESC') });
        dateDesc.addClass('setting-item-description');
        dateDesc.style.marginBottom = '12px';
        
        const dateTimeInputs = dateTimeContainer.createDiv('date-time-inputs');
        
        const currentDateTime = moment(this.transaction.date, 'YYYY-MM-DD HH:mm', true);
        const currentDate = currentDateTime.isValid() ? currentDateTime.format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
        const currentTime = currentDateTime.isValid() ? currentDateTime.format('HH:mm') : moment().format('HH:mm');
        
        // Date input with improved styling
        const dateInput = dateTimeInputs.createEl('input', {
            type: 'date',
            value: currentDate
        });
        
        // Time input with improved styling
        const timeInput = dateTimeInputs.createEl('input', {
            type: 'time',
            value: currentTime
        });
        
        const updateDateTime = () => {
            const newDate = dateInput.value || moment().format('YYYY-MM-DD');
            const newTime = timeInput.value || '00:00';
            this.transaction.date = `${newDate} ${newTime}`;
            this.updateBudgetWarnings();
        };
        dateInput.addEventListener('change', updateDateTime);
        timeInput.addEventListener('change', updateDateTime);
        
        // Transaction Type with improved layout
        const typeSettingContainer = modalContent.createDiv('setting-item');
        const typeSettingInfo = typeSettingContainer.createDiv('setting-item-info');
        typeSettingInfo.createEl('div', { text: i18n.t('TRANSACTION_TYPE'), cls: 'setting-item-name' });
        typeSettingInfo.createEl('div', { text: i18n.t('TRANSACTION_TYPE_DESC'), cls: 'setting-item-description' });
        
        const typeSettingControl = typeSettingContainer.createDiv('setting-item-control');
        const typeSelect = typeSettingControl.createEl('select', { cls: 'dropdown' });
        
        const expenseOption = typeSelect.createEl('option', { text: i18n.t('EXPENSE'), value: 'expense' });
        const incomeOption = typeSelect.createEl('option', { text: i18n.t('INCOME'), value: 'income' });
        
        if (this.transaction.type === 'income') {
            incomeOption.selected = true;
        } else {
            expenseOption.selected = true;
        }
        
        typeSelect.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            this.transaction.type = select.value as TransactionType;
            this.onOpen(); // Refresh to update categories
            this.updateBudgetWarnings();
        });
        
        // Amount with improved layout
        const amountSettingContainer = modalContent.createDiv('setting-item');
        const amountSettingInfo = amountSettingContainer.createDiv('setting-item-info');
        amountSettingInfo.createEl('div', { text: i18n.t('AMOUNT'), cls: 'setting-item-name' });
        amountSettingInfo.createEl('div', { text: i18n.t('AMOUNT_DESC'), cls: 'setting-item-description' });
        
        const amountSettingControl = amountSettingContainer.createDiv('setting-item-control');
        const amountInput = amountSettingControl.createEl('input', {
            type: 'number',
            value: this.transaction.amount?.toString() || '0',
            placeholder: '0.00'
        });
        amountInput.step = '0.01';
        
        amountInput.addEventListener('input', (e) => {
            const input = e.target as HTMLInputElement;
            const amount = parseFloat(input.value);
            if (!isNaN(amount)) {
                this.transaction.amount = amount;
                this.updateBudgetWarnings();
            }
        });
        
        // Account with improved layout and autocomplete
        const accountSettingContainer = modalContent.createDiv('setting-item');
        const accountSettingInfo = accountSettingContainer.createDiv('setting-item-info');
        accountSettingInfo.createEl('div', { text: i18n.t('ACCOUNT_FIELD'), cls: 'setting-item-name' });
        accountSettingInfo.createEl('div', { text: i18n.t('ACCOUNT_SELECT_DESC'), cls: 'setting-item-description' });
        
        const accountSettingControl = accountSettingContainer.createDiv('setting-item-control');
        
        const datalistId = 'account-list-' + (this.transaction.id || generateId());
        const datalist = document.createElement('datalist');
        datalist.id = datalistId;
        
        const flatAccounts = flattenHierarchy(this.plugin.settings.accounts);
        flatAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.name;
            datalist.appendChild(option);
        });
        
        modalContent.appendChild(datalist);
        
        let accountName = '';
        if (this.transaction.accountId) {
            const account = findAccountById(this.plugin.settings.accounts, this.transaction.accountId);
            if (account) {
                accountName = account.name;
            }
        }
        
        const accountInput = accountSettingControl.createEl('input', {
            type: 'text',
            value: accountName,
            placeholder: i18n.t('ACCOUNT_PLACEHOLDER'),
            cls: 'account-input-class'
        });
        
        accountInput.setAttribute('list', datalistId);
        
        accountInput.addEventListener('input', (e) => {
            const input = e.target as HTMLInputElement;
            const account = findAccountByName(this.plugin.settings.accounts, input.value.trim());
            if (account) {
                this.transaction.accountId = account.id;
            } else if (input.value.trim()) {
                this.transaction.accountId = 'new:' + input.value.trim();
            } else {
                this.transaction.accountId = '';
            }
            this.updateBudgetWarnings();
        });
        
        // Category with improved layout and autocomplete
        const categorySettingContainer = modalContent.createDiv('setting-item');
        const categorySettingInfo = categorySettingContainer.createDiv('setting-item-info');
        categorySettingInfo.createEl('div', { text: i18n.t('CATEGORY_FIELD'), cls: 'setting-item-name' });
        categorySettingInfo.createEl('div', { text: i18n.t('CATEGORY_SELECT_DESC'), cls: 'setting-item-description' });
        
        const categorySettingControl = categorySettingContainer.createDiv('setting-item-control');
        
        const categoryDatalistId = 'category-list-' + (this.transaction.id || generateId());
        const categoryDatalist = document.createElement('datalist');
        categoryDatalist.id = categoryDatalistId;

        const categoriesOfType = this.plugin.settings.categories.filter(c => c.type === this.transaction.type);
        const flatCategories = flattenHierarchy(categoriesOfType);

        flatCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            categoryDatalist.appendChild(option);
        });

        modalContent.appendChild(categoryDatalist);

        let categoryName = '';
        if (this.transaction.categoryId) {
            const category = findCategoryById(this.plugin.settings.categories, this.transaction.categoryId);
            if (category) {
                categoryName = category.name;
            }
        }

        const categoryInput = categorySettingControl.createEl('input', {
            type: 'text',
            value: categoryName,
            placeholder: i18n.t('CATEGORY_PLACEHOLDER'),
            cls: 'category-input-class'
        });
        
        categoryInput.setAttribute('list', categoryDatalistId);
        
        categoryInput.addEventListener('input', (e) => {
            const input = e.target as HTMLInputElement;
            const category = findCategoryByName(categoriesOfType, input.value.trim());

            if (category) {
                this.transaction.categoryId = category.id;
            } else if (input.value.trim()) {
                this.transaction.categoryId = 'new:' + input.value.trim();
            } else {
                this.transaction.categoryId = '';
            }
            this.updateBudgetWarnings();
        });
        
        // Tags with improved layout and autocomplete
        const tagsSettingContainer = modalContent.createDiv('setting-item');
        const tagsSettingInfo = tagsSettingContainer.createDiv('setting-item-info');
        tagsSettingInfo.createEl('div', { text: i18n.t('TAGS_FIELD'), cls: 'setting-item-name' });
        tagsSettingInfo.createEl('div', { text: i18n.t('TAGS_SELECT_DESC'), cls: 'setting-item-description' });
        
        const tagsSettingControl = tagsSettingContainer.createDiv('setting-item-control');
        
        const tagsDatalistId = 'tags-list-' + (this.transaction.id || generateId());
        const tagsDatalist = document.createElement('datalist');
        tagsDatalist.id = tagsDatalistId;

        const flatTags = flattenHierarchy(this.plugin.settings.tags);
        flatTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.name;
            tagsDatalist.appendChild(option);
        });

        modalContent.appendChild(tagsDatalist);

        let tagNames = '';
        if (this.transaction.tagIds && this.transaction.tagIds.length > 0) {
             tagNames = this.transaction.tagIds
                .map(id => findTagById(this.plugin.settings.tags, id)?.name)
                .filter(Boolean)
                .join(', ');
        }

        const tagsInput = tagsSettingControl.createEl('input', {
            type: 'text',
            value: tagNames,
            placeholder: i18n.t('TAGS_PLACEHOLDER'),
            cls: 'tags-input-class'
        });
        
        tagsInput.setAttribute('list', tagsDatalistId);
        
        tagsInput.addEventListener('input', (e) => {
            const input = e.target as HTMLInputElement;
            this.transaction.tagIds = this.getTagIdsFromNames(input.value);
        });
        
        // Note with improved layout
        const noteSettingContainer = modalContent.createDiv('setting-item');
        const noteSettingInfo = noteSettingContainer.createDiv('setting-item-info');
        noteSettingInfo.createEl('div', { text: i18n.t('NOTE'), cls: 'setting-item-name' });
        noteSettingInfo.createEl('div', { text: i18n.t('NOTE_DESC'), cls: 'setting-item-description' });
        
        const noteSettingControl = noteSettingContainer.createDiv('setting-item-control');
        const noteTextarea = noteSettingControl.createEl('textarea', {
            value: this.transaction.note || '',
            placeholder: i18n.t('NOTE_PLACEHOLDER')
        });
        
        noteTextarea.addEventListener('input', (e) => {
            const textarea = e.target as HTMLTextAreaElement;
            this.transaction.note = textarea.value;
        });
        
        // Budget warnings section
        this.budgetWarningEl = modalContent.createDiv('budget-warnings-container');
        this.budgetWarningEl.style.display = 'none';

        // Button container
        const buttonContainer = modalContent.createDiv('modal-button-container');

        const cancelButton = buttonContainer.createEl('button', { text: i18n.t('CANCEL') });
        cancelButton.addEventListener('click', () => {
            this.close();
        });

        const submitButton = buttonContainer.createEl('button', {
             text: this.isEditMode ? i18n.t('UPDATE') : i18n.t('ADD'),
             cls: 'mod-cta'
            });
        submitButton.addEventListener('click', async () => {
            await this.handleNewItems();

            if (!this.validateTransaction()) {
                return;
            }

            this.onSubmit(this.transaction as Transaction);
            this.close();
        });

        this.updateBudgetWarnings();
    }
    
    onClose() {
        const datalistAccount = this.contentEl.querySelector('#account-list-' + (this.transaction.id || ''));
        if (datalistAccount) datalistAccount.remove();
        const datalistCategory = this.contentEl.querySelector('#category-list-' + (this.transaction.id || ''));
        if (datalistCategory) datalistCategory.remove();
        const datalistTags = this.contentEl.querySelector('#tags-list-' + (this.transaction.id || ''));
        if (datalistTags) datalistTags.remove();

        const { contentEl } = this;
        contentEl.empty();
    }
    
    private validateTransaction(): boolean {
        const i18n = this.plugin.i18n;
        const errors: string[] = [];

        if (!this.transaction.date || !moment(this.transaction.date, 'YYYY-MM-DD HH:mm', true).isValid()) {
            errors.push(i18n.t('ERROR_INVALID_DATE'));
        }

        if (!this.transaction.type || (this.transaction.type !== 'income' && this.transaction.type !== 'expense')) {
            errors.push(i18n.t('ERROR_INVALID_TYPE'));
        }

        if (this.transaction.amount === undefined || this.transaction.amount <= 0) {
            errors.push(i18n.t('ERROR_AMOUNT_INVALID'));
        }

        if (!this.transaction.accountId) {
            errors.push(i18n.t('ERROR_ACCOUNT_REQUIRED'));
        }

        if (!this.transaction.categoryId) {
             errors.push(i18n.t('ERROR_CATEGORY_REQUIRED'));
        }

        if (errors.length > 0) {
            new Notice(errors.join('\n'));
            return false;
        }

        return true;
    }

    private updateBudgetWarnings(): void {
        if (!this.budgetWarningEl) return;

        this.budgetWarningEl.empty();
        const warnings = this.checkBudgets();

        if (warnings.length > 0) {
             this.budgetWarningEl.style.display = '';
             let isOverBudget = false;
            warnings.forEach(warning => {
                const warningEl = this.budgetWarningEl!.createEl('div', {
                    text: warning.message,
                    cls: `budget-warning ${warning.level}`
                });
                
                if (warning.level === 'over') {
                    isOverBudget = true;
                }
            });
             this.budgetWarningEl.style.borderLeftColor = isOverBudget ? 'var(--text-error)' : 'var(--text-warning)';
        } else {
            this.budgetWarningEl.style.display = 'none';
        }
    }

    private checkBudgets(): { message: string, level: 'warning' | 'over' }[] {
        const warnings: { message: string, level: 'warning' | 'over' }[] = [];
        const i18n = this.plugin.i18n;

        if (this.transaction.type !== 'expense' || !this.transaction.amount || !this.transaction.date) {
            return warnings;
        }

        const budgets = this.plugin.settings.budgets;
        const transactionMoment = moment(this.transaction.date, 'YYYY-MM-DD HH:mm', true);
        if (!transactionMoment.isValid()) {
             return warnings;
        }
        const transactionAmount = this.transaction.amount || 0;
        const accountId = this.transaction.accountId?.startsWith('new:') ? undefined : this.transaction.accountId;
        const categoryId = this.transaction.categoryId?.startsWith('new:') ? undefined : this.transaction.categoryId;

        const allAccounts = this.plugin.settings.accounts;
        const allCategories = this.plugin.settings.categories;
        const allTags = this.plugin.settings.tags;

        budgets.forEach(budget => {
            let isApplicable = false;
            let applicableScopeId: string | undefined = undefined;

            const { start, end } = getPeriodDateRange(budget.period, transactionMoment);
            if (!transactionMoment.isBetween(start, end, undefined, '[]')) {
                return;
            }

            if (budget.scope === BudgetScope.Category && budget.scopeId === categoryId) {
                 isApplicable = true;
                 applicableScopeId = categoryId;
            } else if (budget.scope === BudgetScope.Account && budget.scopeId === accountId) {
                 isApplicable = true;
                 applicableScopeId = accountId;
            }

            if (isApplicable && applicableScopeId) {
                const allPluginTransactions = this.plugin.transactions || [];

                const currentSpending = calculateBudgetSpending(
                    budget,
                    allPluginTransactions.filter(t => t.id !== this.transaction.id),
                    allCategories,
                    allTags,
                    start,
                    end
                );

                const projectedSpending = currentSpending + transactionAmount;
                const scopeName = getScopeName(
                    budget.scope,
                    applicableScopeId,
                    allAccounts,
                    allCategories,
                    allTags,
                    i18n
                );

                if (projectedSpending > budget.amount) {
                    let message = i18n.t('WARN_BUDGET_OVER');
                    message = message.replace('{budgetName}', budget.name || i18n.t('UNNAMED_BUDGET'));
                    message = message.replace('{scopeName}', scopeName);
                    message = message.replace('{projected}', projectedSpending.toFixed(2));
                    message = message.replace('{limit}', budget.amount.toFixed(2));
                    warnings.push({ message: message, level: 'over' });
                } else if (projectedSpending > budget.amount * 0.9) {
                    let message = i18n.t('WARN_BUDGET_CLOSE');
                    message = message.replace('{budgetName}', budget.name || i18n.t('UNNAMED_BUDGET'));
                    message = message.replace('{scopeName}', scopeName);
                    message = message.replace('{projected}', projectedSpending.toFixed(2));
                    message = message.replace('{limit}', budget.amount.toFixed(2));
                    warnings.push({ message: message, level: 'warning' });
                }
            }
        });

        return warnings;
    }

    private async handleNewItems(): Promise<void> {
        const i18n = this.plugin.i18n;
        const settings = this.plugin.settings;
        let settingsChanged = false;

        if (this.transaction.accountId?.startsWith('new:')) {
            const newName = this.transaction.accountId.substring(4);
            const existingAccount = findAccountByName(settings.accounts, newName);
            if (existingAccount) {
                 this.transaction.accountId = existingAccount.id;
            } else {
                const newAccount: Account = { id: generateId(), name: newName, children: [], parentId: null };
                settings.accounts.push(newAccount);
                this.transaction.accountId = newAccount.id;
                settingsChanged = true;
                let noticeMsg = i18n.t('INFO_NEW_ACCOUNT').replace('{name}', newName);
                new Notice(noticeMsg);
            }
        }

        if (this.transaction.categoryId?.startsWith('new:')) {
            const newName = this.transaction.categoryId.substring(4);
            const relevantCategories = settings.categories.filter(c => c.type === this.transaction.type);
            const existingCategory = findCategoryByName(relevantCategories, newName);
            if (existingCategory) {
                this.transaction.categoryId = existingCategory.id;
            } else {
                const newCategory: Category = {
                    id: generateId(),
                    name: newName,
                    type: this.transaction.type || 'expense',
                    parentId: null,
                    children: []
                };
                settings.categories.push(newCategory);
                this.transaction.categoryId = newCategory.id;
                settingsChanged = true;
                let noticeMsg = i18n.t('INFO_NEW_CATEGORY').replace('{name}', newName);
                new Notice(noticeMsg);
            }
        }

        const currentTagNames = this.getTagNames();
        const resolvedTagIds: string[] = [];
        const flatTags = flattenHierarchy(settings.tags);

        for (const name of currentTagNames) {
            const existingTag = flatTags.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (existingTag) {
                resolvedTagIds.push(existingTag.id);
            } else {
                const newTag: Tag = { id: generateId(), name: name, children: [], parentId: null };
                settings.tags.push(newTag);
                flatTags.push(newTag);
                resolvedTagIds.push(newTag.id);
                settingsChanged = true;
                let noticeMsg = i18n.t('INFO_NEW_TAG').replace('{name}', name);
                new Notice(noticeMsg);
            }
        }
        this.transaction.tagIds = resolvedTagIds;

        if (settingsChanged) {
            await this.plugin.saveSettings();
        }
    }

    private getTagNames(): string[] {
        const tagsInput = this.contentEl.querySelector('.tags-input-class') as HTMLInputElement;
        if (!tagsInput) return [];
        return tagsInput.value.split(',')
               .map(t => t.trim())
               .filter(t => t);
    }

    private getTagIdsFromNames(namesString: string): string[] {
        const names = namesString.split(',')
                      .map(t => t.trim())
                      .filter(t => t);
        const flatTags = flattenHierarchy(this.plugin.settings.tags);
        return names.map(name => {
            const tag = flatTags.find(t => t.name.toLowerCase() === name.toLowerCase());
            return tag ? tag.id : ('new:' + name);
        }).filter(id => id);
    }
}