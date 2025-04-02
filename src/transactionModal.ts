import { App, Modal, Setting, moment, Notice } from 'obsidian';
import AccountingPlugin from '../main';
import { Account, Category, Tag, Transaction, TransactionType, generateId, flattenHierarchy, findItemById } from './models';

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
        const dateTimeContainer = contentEl.createDiv('date-time-container');
        dateTimeContainer.addClass('form-group');
        
        const dateLabel = dateTimeContainer.createEl('label', { text: i18n.t('DATE') });
        dateLabel.style.fontWeight = 'bold';
        dateLabel.style.display = 'block';
        dateLabel.style.marginBottom = '5px';
        
        const dateDesc = dateTimeContainer.createEl('div', { text: i18n.t('Transaction date and time') });
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
            .setDesc(i18n.t('Transaction type'))
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
            .setDesc(i18n.t('Transaction amount'))
            .addText(text => text
                .setValue(this.transaction.amount?.toString() || '0')
                .onChange(value => {
                    const amount = parseFloat(value);
                    if (!isNaN(amount)) {
                        this.transaction.amount = amount;
                    }
                }));
        
        // Account
        new Setting(contentEl)
            .setName(i18n.t('ACCOUNT'))
            .setDesc(i18n.t('Select or create account'))
            .addText(text => {
                // Create a datalist for autocomplete
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
                    .setPlaceholder(i18n.t('Type to search or create new account'))
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
                    });
                
                // Add the datalist to the input
                textInput.inputEl.setAttribute('list', datalistId);
                
                return textInput;
            });
        
        // Category
        new Setting(contentEl)
            .setName(i18n.t('CATEGORY'))
            .setDesc(i18n.t('Select or create category'))
            .addText(text => {
                // Create a datalist for autocomplete
                const datalistId = 'category-list-' + this.transaction.id;
                const datalist = document.createElement('datalist');
                datalist.id = datalistId;
                
                // Filter categories by transaction type
                const categories = this.plugin.settings.categories.filter(c => c.type === this.transaction.type);
                
                // Flatten the category hierarchy for the dropdown with indentation
                const flatCategories: { id: string, name: string }[] = [];
                
                const processCategory = (category: Category, level = 0, parentPath = '') => {
                    const indent = '  '.repeat(level);
                    const displayName = indent + category.name;
                    const fullPath = parentPath ? `${parentPath} > ${category.name}` : category.name;
                    
                    flatCategories.push({
                        id: category.id,
                        name: displayName
                    });
                    
                    if (category.children && category.children.length > 0) {
                        category.children.forEach(child => {
                            processCategory(child, level + 1, fullPath);
                        });
                    }
                };
                
                categories.forEach(category => {
                    processCategory(category);
                });
                
                // Add all categories to the datalist
                flatCategories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.name;
                    datalist.appendChild(option);
                });
                
                // Add the datalist to the document
                document.body.appendChild(datalist);
                
                // Get category name from ID
                let categoryName = '';
                if (this.transaction.categoryId) {
                    const category = flatCategories.find(c => c.id === this.transaction.categoryId);
                    if (category) {
                        categoryName = category.name;
                    }
                }
                
                // Set up the text input with autocomplete
                const textInput = text
                    .setValue(categoryName)
                    .setPlaceholder(i18n.t('Type to search or create new category'))
                    .onChange(value => {
                        // Find category by name (ignoring indentation)
                        const normalizedValue = value.trim().replace(/^\s+/, '');
                        const category = flatCategories.find(c => 
                            c.name.replace(/^\s+/, '') === normalizedValue
                        );
                        if (category) {
                            this.transaction.categoryId = category.id;
                        } else if (value.trim()) {
                            // If category doesn't exist, we'll create it when the transaction is submitted
                            this.transaction.categoryId = 'new:' + value.trim();
                        } else {
                            this.transaction.categoryId = '';
                        }
                    });
                
                // Add the datalist to the input
                textInput.inputEl.setAttribute('list', datalistId);
                
                return textInput;
            });
        
        // Tags
        new Setting(contentEl)
            .setName(i18n.t('TAGS'))
            .setDesc(i18n.t('Select tags (semicolon-separated, optional)'))
            .addText(text => {
                // Create a datalist for autocomplete
                const datalistId = 'tag-list-' + this.transaction.id;
                const datalist = document.createElement('datalist');
                datalist.id = datalistId;
                
                // Flatten the tag hierarchy for the dropdown
                const flatTags = flattenHierarchy(this.plugin.settings.tags);
                
                // Add all tags to the datalist
                flatTags.forEach(tag => {
                    const option = document.createElement('option');
                    option.value = tag.name;
                    datalist.appendChild(option);
                });
                
                // Add the datalist to the document
                document.body.appendChild(datalist);
                
                // Get tag names from IDs
                const tagNames = this.transaction.tagIds?.map(id => {
                    const tag = flatTags.find(t => t.id === id);
                    return tag ? tag.name : '';
                }).filter(Boolean).join('; ') || '';
                
                // Set up the text input with autocomplete
                const textInput = text
                    .setValue(tagNames)
                    .setPlaceholder(i18n.t('Type tags separated by semicolons'))
                    .onChange(value => {
                        // Parse tag names and find corresponding IDs
                        const tagNames = value.split(';').map(t => t.trim()).filter(Boolean);
                        
                        this.transaction.tagIds = tagNames
                            .map(name => {
                                const tag = flatTags.find(t => t.name.toLowerCase() === name.toLowerCase());
                                return tag ? tag.id : 'new:' + name;
                            })
                            .filter(Boolean) as string[];
                    });
                
                // Add the datalist to the input
                textInput.inputEl.setAttribute('list', datalistId);
                
                return textInput;
            });
        
        // Note (replacing Description)
        new Setting(contentEl)
            .setName(i18n.t('NOTE'))
            .setDesc(i18n.t('Transaction note'))
            .addTextArea(text => text
                .setValue(this.transaction.note || '')
                .onChange(value => {
                    this.transaction.note = value;
                }));
        
        // Submit button
        new Setting(contentEl)