import { App, PluginSettingTab, Setting, Modal, Notice, moment, TextComponent, DropdownComponent } from 'obsidian';
import AccountingPlugin from '../main';
import { Account, Category, Tag, TransactionType, generateId, addItemToHierarchy, findItemById, updateItemInHierarchy, removeItemFromHierarchy, BudgetItem, BudgetScope, BudgetPeriod } from './models';
import { SupportedLocale, DEFAULT_LOCALE, localeDisplayNames, Translation } from './locales';
import { parseTransactionsFromFile, findAccountById, findCategoryById, findTagById, normalizeTransactionDate, getDatePart, calculateBudgetSpending, getScopeName } from './utils';

/**
 * Default categories for income and expense
 */
const DEFAULT_CATEGORIES: Category[] = [
    {
        id: generateId(),
        name: '工资',
        type: 'income',
        parentId: null,
        children: [
            {
                id: generateId(),
                name: '基本工资',
                type: 'income',
                parentId: null
            },
            {
                id: generateId(),
                name: '奖金',
                type: 'income',
                parentId: null
            }
        ]
    },
    {
        id: generateId(),
        name: '投资',
        type: 'income',
        parentId: null,
        children: [
            {
                id: generateId(),
                name: '股票',
                type: 'income',
                parentId: null
            },
            {
                id: generateId(),
                name: '基金',
                type: 'income',
                parentId: null
            }
        ]
    },
    {
        id: generateId(),
        name: '餐饮',
        type: 'expense',
        parentId: null,
        children: [
            {
                id: generateId(),
                name: '早餐',
                type: 'expense',
                parentId: null
            },
            {
                id: generateId(),
                name: '午餐',
                type: 'expense',
                parentId: null
            },
            {
                id: generateId(),
                name: '晚餐',
                type: 'expense',
                parentId: null
            }
        ]
    },
    {
        id: generateId(),
        name: '交通',
        type: 'expense',
        parentId: null,
        children: [
            {
                id: generateId(),
                name: '公共交通',
                type: 'expense',
                parentId: null
            },
            {
                id: generateId(),
                name: '打车',
                type: 'expense',
                parentId: null
            }
        ]
    },
    {
        id: generateId(),
        name: '购物',
        type: 'expense',
        parentId: null,
        children: [
            {
                id: generateId(),
                name: '日用品',
                type: 'expense',
                parentId: null
            },
            {
                id: generateId(),
                name: '衣物',
                type: 'expense',
                parentId: null
            }
        ]
    }
];

/**
 * Default accounts
 */
const DEFAULT_ACCOUNTS: Account[] = [
    {
        id: generateId(),
        name: '支付宝',
        description: '支付宝账户'
    },
    {
        id: generateId(),
        name: '微信',
        description: '微信支付'
    },
    {
        id: generateId(),
        name: '现金',
        description: '现金账户'
    },
    {
        id: generateId(),
        name: '银行卡',
        description: '银行卡账户'
    }
];

/**
 * Default tags
 */
const DEFAULT_TAGS: Tag[] = [
    {
        id: generateId(),
        name: '家庭',
        description: '家庭相关支出',
        parentId: null
    },
    {
        id: generateId(),
        name: '工作',
        description: '工作相关支出',
        parentId: null
    },
    {
        id: generateId(),
        name: '娱乐',
        description: '娱乐相关支出',
        parentId: null
    }
];

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: AccountingPluginSettings = {
    accounts: DEFAULT_ACCOUNTS,
    categories: DEFAULT_CATEGORIES,
    tags: DEFAULT_TAGS,
    budgets: [],
    outputFile: 'Accounting/transactions.md',
    useDailyNotes: false,
    dailyNotesFormat: 'YYYY-MM-DD',
    transactionTemplate: '- {{date}} | {{type}} | {{amount}} | {{account}} | {{category}} | {{tags}} | {{description}} {{#note}}| {{note}}{{/note}}',
    locale: DEFAULT_LOCALE, // 默认语言（英文）
    followSystemLanguage: true // 默认跟随系统语言
};

/**
 * Plugin settings interface
 */
export interface AccountingPluginSettings {
    accounts: Account[];
    categories: Category[];
    tags: Tag[];
    budgets: BudgetItem[];
    outputFile: string;
    useDailyNotes: boolean;
    dailyNotesFormat: string;
    transactionTemplate: string;
    locale: SupportedLocale; // 添加语言设置
    followSystemLanguage: boolean; // 是否跟随系统语言
}

/**
 * Settings tab for the plugin
 */
export class AccountingSettingTab extends PluginSettingTab {
    plugin: AccountingPlugin;

    constructor(app: App, plugin: AccountingPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        
        const i18n = this.plugin.i18n;

        containerEl.createEl('h2', { text: i18n.t('SETTINGS') });

        // --- General Settings ---
        containerEl.createEl('h3', { text: i18n.t('GENERAL_SETTINGS') });
        this.addGeneralSettings(containerEl);

        // --- Accounts Section ---
        this.addAccountsSection(containerEl);

        // --- Categories Section ---
        this.addCategoriesSection(containerEl);

        // --- Tags Section ---
        this.addTagsSection(containerEl);
        
        // --- Budgets Section ---
        this.addBudgetsSection(containerEl);

        // --- Data Management ---
        containerEl.createEl('h3', { text: i18n.t('DATA_MANAGEMENT') });
        this.addDataManagementSection(containerEl);
    }

    private addGeneralSettings(containerEl: HTMLElement): void {
        const i18n = this.plugin.i18n;
        // Language Setting
        new Setting(containerEl)
            .setName(i18n.t('LANGUAGE'))
            .setDesc('Choose display language / 选择显示语言')
            .addDropdown(dropdown => {
                // Add "Follow Obsidian" option
                dropdown.addOption('follow-obsidian', i18n.t('FOLLOW_OBSIDIAN') || 'Follow Obsidian Language / 跟随 Obsidian 语言');
                
                // Add all supported languages
                Object.entries(localeDisplayNames).forEach(([locale, name]) => {
                    dropdown.addOption(locale, name);
                });
                
                // Set current value
                if (this.plugin.settings.followSystemLanguage) {
                    dropdown.setValue('follow-obsidian');
                } else {
                    dropdown.setValue(this.plugin.settings.locale);
                }
                
                dropdown.onChange(async (value) => {
                    if (value === 'follow-obsidian') {
                        this.plugin.settings.followSystemLanguage = true;
                        // Determine Obsidian's language and set locale
                        const obsidianLang = moment.locale(); // Or use Obsidian API if available
                        // Ensure the detected language is supported, otherwise fallback
                        const supportedLocales = Object.keys(localeDisplayNames) as SupportedLocale[];
                        if (supportedLocales.includes(obsidianLang as SupportedLocale)) {
                             this.plugin.settings.locale = obsidianLang as SupportedLocale;
                        } else {
                             this.plugin.settings.locale = DEFAULT_LOCALE; // Fallback to default
                        }
                    } else {
                        this.plugin.settings.followSystemLanguage = false;
                        this.plugin.settings.locale = value as SupportedLocale;
                    }
                    await this.plugin.saveSettings();
                    this.plugin.i18n.setLocale(this.plugin.settings.locale);
                    this.display(); // Refresh settings tab
                });
            });

        // Output File Setting
        new Setting(containerEl)
            .setName(i18n.t('OUTPUT_FILE_PATH'))
            .setDesc(i18n.t('OUTPUT_FILE_DESC') || 'Path for the transaction file.')
            .addText(text => text
                .setPlaceholder('Accounting/transactions.md')
                .setValue(this.plugin.settings.outputFile)
                .onChange(async (value) => {
                    this.plugin.settings.outputFile = value;
                    await this.plugin.saveSettings();
                }));

        // Daily Notes Setting
        new Setting(containerEl)
            .setName(i18n.t('USE_DAILY_NOTES'))
            .setDesc(i18n.t('USE_DAILY_NOTES_DESC') || 'Append transactions to daily notes instead of a single file.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useDailyNotes)
                .onChange(async (value) => {
                    this.plugin.settings.useDailyNotes = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide format setting
                }));

        if (this.plugin.settings.useDailyNotes) {
            new Setting(containerEl)
                .setName(i18n.t('DAILY_NOTES_FORMAT'))
                .setDesc(i18n.t('DAILY_NOTES_FORMAT_DESC') || 'Date format for daily notes (e.g., YYYY-MM-DD).')
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD')
                .setValue(this.plugin.settings.dailyNotesFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dailyNotesFormat = value;
                    await this.plugin.saveSettings();
                    }));
        }

        // Transaction Template Setting
        new Setting(containerEl)
            .setName(i18n.t('TRANSACTION_TEMPLATE'))
            .setDesc(i18n.t('TRANSACTION_TEMPLATE_DESC') || 'Template for formatting transactions.')
            .addTextArea(text => {
                text
                    .setPlaceholder('- {{date}} | {{type}} | {{amount}} | {{account}} | {{category}} | {{tags}} | {{description}} {{#note}}| {{note}}{{/note}}')
                    .setValue(this.plugin.settings.transactionTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.transactionTemplate = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 5;
                text.inputEl.cols = 40;
            });
    }

    private addDataManagementSection(containerEl: HTMLElement): void {
        const i18n = this.plugin.i18n;
        // --- Data Import/Export ---
        // Add import/export buttons and logic here later if needed
        new Setting(containerEl)
            .setName(i18n.t('EXPORT_DATA'))
            .setDesc(i18n.t('EXPORT_DATA_DESC'))
            .addButton(button => button
                .setButtonText(i18n.t('EXPORT'))
                .onClick(() => {
                    // Implement export logic
                    const dataToExport = JSON.stringify(this.plugin.settings, null, 2);
                    const blob = new Blob([dataToExport], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'obsidian-accounting-data.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    new Notice(i18n.t('DATA_EXPORTED_SUCCESS'));
                }));

        new Setting(containerEl)
            .setName(i18n.t('IMPORT_DATA'))
            .setDesc(i18n.t('IMPORT_DATA_DESC'))
            .addButton(button => {
                const input = createEl('input', { type: 'file', attr: { accept: '.json' } });
                input.style.display = 'none';
                input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                        try {
                            const content = await file.text();
                            const importedSettings = JSON.parse(content);
                            // Add validation here if necessary
                            this.plugin.settings = { ...this.plugin.settings, ...importedSettings }; // Merge carefully
                            await this.plugin.saveSettings();
                            this.display(); // Refresh settings tab
                            new Notice(i18n.t('DATA_IMPORTED_SUCCESS'));
                        } catch (err) {
                            console.error("Error importing data:", err);
                            new Notice(i18n.t('DATA_IMPORT_FAILED'));
                        }
                    }
                };
                button
                    .setButtonText(i18n.t('IMPORT'))
                    .onClick(() => input.click());
                containerEl.appendChild(input); // Append hidden input
             });
    }

    /**
     * Adds the account management section to the settings tab.
     * @param containerEl The HTML element to append the settings to.
     */
    private addAccountsSection(containerEl: HTMLElement): void {
        const i18n = this.plugin.i18n;
        containerEl.createEl('h3', { text: i18n.t('ACCOUNTS') });

        // Button to add a new account
        new Setting(containerEl)
            .addButton(button => button
                .setButtonText(i18n.t('ADD_ACCOUNT'))
                .setCta() // Makes the button more prominent
                .onClick(() => {
                    // Open the Add Account Modal
                    new AccountModal(this.app, this.plugin, (newAccount) => {
                        this.plugin.settings.accounts.push(newAccount);
                        this.plugin.saveSettings();
                        this.display(); // Refresh the settings tab
                    }).open();
                }));

        // Display existing accounts
        this.plugin.settings.accounts.forEach((account, index) => {
            const setting = new Setting(containerEl)
                .setName(account.name)
                .setDesc(account.description || ''); // Show description if available

            // Add Edit button (placeholder)
            setting.addButton(button => button
                .setIcon('pencil')
                .setTooltip(i18n.t('EDIT'))
                .onClick(() => {
                    // Open the modal for editing the specific account
                    new AccountModal(this.app, this.plugin, (updatedAccount) => {
                        // Find the index of the account to update
                        const indexToUpdate = this.plugin.settings.accounts.findIndex(a => a.id === updatedAccount.id);
                        if (indexToUpdate !== -1) {
                            this.plugin.settings.accounts[indexToUpdate] = updatedAccount;
                            this.plugin.saveSettings();
                            this.display(); // Refresh the settings tab
                        } else {
                            new Notice(`Error updating account: ${account.name}. Account not found.`);
                        }
                    }, account).open(); // Pass the current account to the modal constructor
                }));

            // Add Delete button (placeholder)
            setting.addButton(button => button
                .setIcon('trash')
                .setTooltip(i18n.t('DELETE'))
                .onClick(async () => {
                    // Use Obsidian's Notice for better integration than confirm()
                    const confirmationMessage = `${i18n.t('CONFIRM_DELETE').replace("this", `the account "${account.name}"`)} ${i18n.t('CANNOT_BE_UNDONE')}`; // Assuming CANNOT_BE_UNDONE key exists
                    // We should ideally use a custom confirmation modal here for better UX,
                    // but window.confirm is simpler for now.
                    if (confirm(confirmationMessage)) {
                         try {
                             this.plugin.settings.accounts.splice(index, 1);
                             await this.plugin.saveSettings();
                             this.display(); // Refresh the settings tab
                             new Notice(`Account "${account.name}" deleted.`);
                         } catch (error) {
                             console.error("Error deleting account:", error);
                             new Notice(`Failed to delete account "${account.name}".`);
                         }
                    }
                }));
        });

        if (this.plugin.settings.accounts.length === 0) {
             containerEl.createEl('p', { text: i18n.t('NO_ACCOUNTS_CONFIGURED') });
        }
    }

    /**
     * Adds the category management section to the settings tab.
     * @param containerEl The HTML element to append the settings to.
     */
    private addCategoriesSection(containerEl: HTMLElement): void {
        const i18n = this.plugin.i18n;
        // Removed the old h3, the main display method adds it.
        // containerEl.createEl('h3', { text: i18n.t('CATEGORIES') });

        // Button to add a new top-level category
        new Setting(containerEl)
            .addButton(button => button
                .setButtonText(i18n.t('ADD_CATEGORY'))
                .setCta()
                .onClick(() => {
                    new CategoryModal(this.app, this.plugin, (newCategory) => {
                        this.plugin.settings.categories = addItemToHierarchy(
                            this.plugin.settings.categories,
                            newCategory
                        );
                        this.plugin.saveSettings();
                        this.display(); // Refresh the settings tab
                    }).open();
                }));

        // Container for the category tree
        const categoryTreeEl = containerEl.createDiv('accounting-category-tree');

        // Recursive function to display categories
        const displayCategory = (category: Category, parentEl: HTMLElement, level: number = 0) => {
            const categoryItemEl = parentEl.createDiv({ cls: 'setting-item accounting-hierarchy-item' });
            categoryItemEl.style.marginLeft = `${level * 20}px`; // Indentation

            const infoEl = categoryItemEl.createDiv({ cls: 'setting-item-info' });
            infoEl.createEl('div', { text: category.name, cls: 'setting-item-name' });
            // Use specific keys for type display
            const typeText = category.type === 'income' ? i18n.t('INCOME') : i18n.t('EXPENSE');
            infoEl.createEl('div', { text: `(${typeText})`, cls: 'setting-item-description' });

            const controlsEl = categoryItemEl.createDiv({ cls: 'setting-item-control' });

            // Add Child Button
            new Setting(controlsEl)
                .setClass('accounting-item-button')
                .addButton(button => button
                    .setIcon('plus-circle')
                    .setTooltip(i18n.t('ADD_CATEGORY')) // Re-use ADD_CATEGORY for child
                    .onClick(() => {
                        new CategoryModal(this.app, this.plugin, (newChild) => {
                            this.plugin.settings.categories = addItemToHierarchy(
                                this.plugin.settings.categories,
                                newChild
                            );
                            this.plugin.saveSettings();
                            this.display();
                        }, undefined, category.id, category.type).open(); // Pass parentId and type
                    }));

            // Edit Button
            new Setting(controlsEl)
                .setClass('accounting-item-button')
                .addButton(button => button
                    .setIcon('pencil')
                    .setTooltip(i18n.t('EDIT_CATEGORY'))
                    .onClick(() => {
                        new CategoryModal(this.app, this.plugin, (updatedCategory) => {
                            this.plugin.settings.categories = updateItemInHierarchy(
                                this.plugin.settings.categories,
                                updatedCategory
                            );
                            this.plugin.saveSettings();
                            this.display();
                        }, category).open(); // Pass the category to edit
                    }));

            // Delete Button
            new Setting(controlsEl)
                .setClass('accounting-item-button')
                .addButton(button => button
                    .setIcon('trash')
                    .setTooltip(i18n.t('DELETE'))
                    .onClick(async () => {
                        // Basic check: Don't allow deleting categories with children easily
                        if (category.children && category.children.length > 0) {
                            new Notice('Cannot delete category with children. Delete children first.'); // TODO: Add i18n key
                            return;
                        }

                        const confirmationMessage = `${i18n.t('CONFIRM_DELETE')} "${category.name}"? ${i18n.t('CANNOT_BE_UNDONE')}`;
                        if (confirm(confirmationMessage)) {
                            try {
                                this.plugin.settings.categories = removeItemFromHierarchy(
                                    this.plugin.settings.categories,
                                    category.id
                                );
                                await this.plugin.saveSettings();
                                this.display();
                                new Notice(`Category "${category.name}" deleted.`); // TODO: Add i18n key
                            } catch (error) {
                                console.error("Error deleting category:", error);
                                new Notice(`Failed to delete category "${category.name}".`); // TODO: Add i18n key
                            }
                        }
                    }));

            // Recursively display children
            if (category.children && category.children.length > 0) {
                const childrenContainer = parentEl.createDiv('accounting-hierarchy-children');
                category.children.forEach(child => displayCategory(child, childrenContainer, level + 1));
            }
        };

        // Start rendering the tree from top-level categories
        if (this.plugin.settings.categories && this.plugin.settings.categories.length > 0) {
            this.plugin.settings.categories.forEach(category => displayCategory(category, categoryTreeEl));
        } else {
            categoryTreeEl.createEl('p', { text: 'No categories configured yet.' }); // TODO: Add i18n key
        }

        // Remove the old placeholder message if it exists
        // const oldPlaceholder = containerEl.querySelector('p');
        // if (oldPlaceholder && oldPlaceholder.textContent === i18n.t('FEATURE_UNDER_DEVELOPMENT')) {
        //     oldPlaceholder.remove();
        // }
    }

    /**
     * Adds the tag management section to the settings tab.
     * @param containerEl The HTML element to append the settings to.
     */
    private addTagsSection(containerEl: HTMLElement): void {
        const i18n = this.plugin.i18n;
        // Removed the old h3, the main display method adds it.
        // containerEl.createEl('h3', { text: i18n.t('TAGS') });

        // Button to add a new top-level tag
        new Setting(containerEl)
            .addButton(button => button
                .setButtonText(i18n.t('ADD_TAG'))
                .setCta()
                .onClick(() => {
                    new TagModal(this.app, this.plugin, (newTag) => {
                        this.plugin.settings.tags = addItemToHierarchy(
                            this.plugin.settings.tags,
                            newTag
                        );
                        this.plugin.saveSettings();
                        this.display(); // Refresh the settings tab
                    }).open();
                }));

        // Container for the tag tree
        const tagTreeEl = containerEl.createDiv('accounting-tag-tree');

        // Recursive function to display tags
        const displayTag = (tag: Tag, parentEl: HTMLElement, level: number = 0) => {
            const tagItemEl = parentEl.createDiv({ cls: 'setting-item accounting-hierarchy-item' });
            tagItemEl.style.marginLeft = `${level * 20}px`; // Indentation

            const infoEl = tagItemEl.createDiv({ cls: 'setting-item-info' });
            infoEl.createEl('div', { text: tag.name, cls: 'setting-item-name' });
            if (tag.description) {
                infoEl.createEl('div', { text: tag.description, cls: 'setting-item-description' });
            }

            const controlsEl = tagItemEl.createDiv({ cls: 'setting-item-control' });

            // Add Child Button
            new Setting(controlsEl)
                .setClass('accounting-item-button')
                .addButton(button => button
                    .setIcon('plus-circle')
                    .setTooltip(i18n.t('ADD_TAG')) // Re-use ADD_TAG for child
                    .onClick(() => {
                        new TagModal(this.app, this.plugin, (newChild) => {
                            this.plugin.settings.tags = addItemToHierarchy(
                                this.plugin.settings.tags,
                                newChild
                            );
                            this.plugin.saveSettings();
                            this.display();
                        }, undefined, tag.id).open(); // Pass parentId
                    }));

            // Edit Button
            new Setting(controlsEl)
                .setClass('accounting-item-button')
                .addButton(button => button
                    .setIcon('pencil')
                    .setTooltip(i18n.t('EDIT_TAG'))
                    .onClick(() => {
                        new TagModal(this.app, this.plugin, (updatedTag) => {
                            this.plugin.settings.tags = updateItemInHierarchy(
                                this.plugin.settings.tags,
                                updatedTag
                            );
                            this.plugin.saveSettings();
                            this.display();
                        }, tag).open(); // Pass the tag to edit
                    }));

            // Delete Button
            new Setting(controlsEl)
                .setClass('accounting-item-button')
                .addButton(button => button
                    .setIcon('trash')
                    .setTooltip(i18n.t('DELETE'))
                    .onClick(async () => {
                        // Basic check: Don't allow deleting tags with children easily
                        if (tag.children && tag.children.length > 0) {
                            new Notice('Cannot delete tag with children. Delete children first.'); // TODO: Add i18n key
                            return;
                        }
                        const confirmationMessage = `${i18n.t('CONFIRM_DELETE')} "${tag.name}"? ${i18n.t('CANNOT_BE_UNDONE')}`;
                        if (confirm(confirmationMessage)) {
                            try {
                                this.plugin.settings.tags = removeItemFromHierarchy(
                                    this.plugin.settings.tags,
                                    tag.id
                                );
                                await this.plugin.saveSettings();
                                this.display();
                                new Notice(`Tag "${tag.name}" deleted.`); // TODO: Add i18n key
                            } catch (error) {
                                console.error("Error deleting tag:", error);
                                new Notice(`Failed to delete tag "${tag.name}".`); // TODO: Add i18n key
                            }
                        }
                    }));

            // Recursively display children
            if (tag.children && tag.children.length > 0) {
                const childrenContainer = parentEl.createDiv('accounting-hierarchy-children');
                tag.children.forEach(child => displayTag(child, childrenContainer, level + 1));
            }
        };

        // Start rendering the tree from top-level tags
        if (this.plugin.settings.tags && this.plugin.settings.tags.length > 0) {
            this.plugin.settings.tags.forEach(tag => displayTag(tag, tagTreeEl));
        } else {
            tagTreeEl.createEl('p', { text: i18n.t('NO_TAGS_CONFIGURED') });
        }
    }

    private addBudgetsSection(containerEl: HTMLElement): void {
        const i18n = this.plugin.i18n;
        containerEl.createEl('h3', { text: i18n.t('BUDGET_SETTINGS') });

         new Setting(containerEl)
            .setName(i18n.t('MANAGE_BUDGETS'))
            .addButton(button => button
                .setButtonText(i18n.t('ADD_BUDGET'))
                .setIcon('plus')
                .onClick(() => {
                    new BudgetModal(this.app, this.plugin, (result) => {
                        this.plugin.settings.budgets.push(result);
                        this.plugin.saveSettings();
                        this.display(); // Refresh the settings tab
                    }).open();
                }));

        // Display existing budgets
        const budgetsListEl = containerEl.createDiv('budgets-list');
        if (this.plugin.settings.budgets.length === 0) {
            budgetsListEl.createEl('p', { text: i18n.t('NO_BUDGETS_DEFINED') });
        } else {
            this.plugin.settings.budgets.forEach(budget => {
                // Map period/scope enums to translation keys
                const periodKey = budget.period === BudgetPeriod.Daily ? 'DAILY' :
                                budget.period === BudgetPeriod.Monthly ? 'MONTHLY' :
                                budget.period === BudgetPeriod.Quarterly ? 'QUARTERLY' : 'MONTHLY';
                const scopeKey = budget.scope === BudgetScope.Category ? 'CATEGORY' :
                               budget.scope === BudgetScope.Tag ? 'TAG' :
                               budget.scope === BudgetScope.Account ? 'ACCOUNT' : 'CATEGORY';
                
                // Pre-calculate scope name
                const scopeNameStr = getScopeName(
                    budget.scope, 
                    budget.scopeId, 
                    this.plugin.settings.accounts,
                    this.plugin.settings.categories,
                    this.plugin.settings.tags,
                    i18n
                );
                
                // Define type for interpolation object
                type BudgetDetailsParams = { amount: number; period: string; scope: string; scopeName: string };
                
                // Create the interpolation object with the defined type
                const budgetDetailsParams: BudgetDetailsParams = {
                    amount: budget.amount,
                    period: i18n.t(periodKey as keyof Translation),
                    scope: i18n.t(scopeKey as keyof Translation),
                    scopeName: scopeNameStr
                };
                
                // Pre-calculate description string using the typed object
                const description = i18n.t('BUDGET_DETAILS', budgetDetailsParams);
                               
                const settingItem = new Setting(budgetsListEl)
                    .setName(budget.name || i18n.t('UNNAMED_BUDGET'))
                    .setDesc(description) // Use the pre-calculated string
                    .addButton(button => button
                        .setIcon('pencil')
                        .setTooltip(i18n.t('EDIT_BUDGET'))
                        .onClick(() => {
                            new BudgetModal(this.app, this.plugin, (result) => {
                                const index = this.plugin.settings.budgets.findIndex(b => b.id === budget.id);
                                if (index > -1) {
                                    this.plugin.settings.budgets[index] = result;
                                    this.plugin.saveSettings();
                                    this.display();
                                }
                            }, budget).open();
                        }))
                    .addButton(button => button
                        .setIcon('trash')
                        .setTooltip(i18n.t('DELETE_BUDGET'))
                        .onClick(async () => {
                            this.plugin.settings.budgets = this.plugin.settings.budgets.filter(b => b.id !== budget.id);
                            await this.plugin.saveSettings();
                            this.display();
                            new Notice(i18n.t('BUDGET_DELETED'));
                        }));
            });
        }
    }
}

// --- Account Modal ---
class AccountModal extends Modal {
    plugin: AccountingPlugin;
    account: Account;
    isNew: boolean;
    onSubmit: (result: Account) => void;

    constructor(app: App, plugin: AccountingPlugin, onSubmit: (result: Account) => void, accountToEdit?: Account) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        this.isNew = !accountToEdit;
        this.account = accountToEdit ? { ...accountToEdit } : {
            id: generateId(),
            name: '',
            description: '',
            icon: '',
            parentId: null
        };
    }

    private getAccountOptions(accounts: Account[], currentAccountId?: string, prefix = ''): { [key: string]: string } {
        let options: { [key: string]: string } = {};
        accounts.forEach(acc => {
            // Prevent setting an account as its own parent or a child as its parent
            if (acc.id === currentAccountId) return;
            // Check if the current account is a child of this potential parent (preventing circular refs)
            if (currentAccountId && this.isDescendant(this.plugin.settings.accounts, acc.id, currentAccountId)) return;

            options[acc.id] = prefix + acc.name;
            if (acc.children && acc.children.length > 0) {
                options = { ...options, ...this.getAccountOptions(acc.children, currentAccountId, prefix + acc.name + ' / ') };
            }
        });
        return options;
    }

    // Helper to check if childId is a descendant of parentId
    private isDescendant(accounts: Account[], parentId: string, childId: string): boolean {
        const parent = findItemById(accounts, parentId);
        if (!parent || !parent.children) return false;
        
        for (const child of parent.children) {
            if (child.id === childId) return true;
            if (this.isDescendant(parent.children, child.id, childId)) return true; // Check recursively
        }
        return false;
    }

    onOpen() {
        const { contentEl } = this;
        const i18n = this.plugin.i18n;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.isNew ? i18n.t('ADD_ACCOUNT') : i18n.t('EDIT_ACCOUNT') });

        // Account Name
        new Setting(contentEl)
            .setName(i18n.t('ACCOUNT_NAME'))
            .setDesc(i18n.t('ACCOUNT_NAME_DESC')) // Use key
            .addText(text => text
                .setPlaceholder(i18n.t('ENTER_ACCOUNT_NAME')) // Use key
                    .setValue(this.account.name)
                .onChange(value => this.account.name = value.trim()));

        // Account Description
        new Setting(contentEl)
            .setName(i18n.t('ACCOUNT_DESCRIPTION'))
            .setDesc(i18n.t('ACCOUNT_DESCRIPTION_DESC')) // Use key
            .addText(text => text
                .setPlaceholder(i18n.t('ENTER_ACCOUNT_DESCRIPTION')) // Use key
                    .setValue(this.account.description || '')
                .onChange(value => this.account.description = value.trim()));

        // Account Icon (Optional)
        new Setting(contentEl)
            .setName(i18n.t('ACCOUNT_ICON')) // Use key
            .setDesc(i18n.t('ACCOUNT_ICON_DESC')) // Use key
            .addText(text => text
                .setPlaceholder('lucide-wallet') // Example placeholder
                .setValue(this.account.icon || '')
                .onChange(value => this.account.icon = value.trim()));

        // Parent Account Dropdown
        const accountOptions = this.getAccountOptions(this.plugin.settings.accounts, this.isNew ? undefined : this.account.id);
        new Setting(contentEl)
            .setName(i18n.t('PARENT_ACCOUNT')) // Use key
            .setDesc(i18n.t('ACCOUNT_PARENT_DESC')) // Use key
            .addDropdown(dropdown => {
                dropdown.addOption('', i18n.t('TOP_LEVEL')); // Use key
                Object.entries(accountOptions).forEach(([id, name]) => {
                    dropdown.addOption(id, name);
                });
                dropdown.setValue(this.account.parentId || '');
                dropdown.onChange(value => {
                    this.account.parentId = value === '' ? null : value;
                    });
            });

        // Submit Button
        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(i18n.t('SAVE')) // Use key
                .setCta()
                .onClick(() => {
                    if (!this.account.name) {
                        new Notice(i18n.t('ACCOUNT_NAME_REQUIRED')); // Use key
                        return;
                    }
                    this.onSubmit(this.account);
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// --- Tag Modal ---
class TagModal extends Modal {
    plugin: AccountingPlugin;
    tag: Tag;
    isNew: boolean;
    onSubmit: (result: Tag) => void;
    initialParentId: string | null;

    constructor(app: App, plugin: AccountingPlugin, onSubmit: (result: Tag) => void, tagToEdit?: Tag, parentId: string | null = null) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        this.isNew = !tagToEdit;
        this.tag = tagToEdit ? { ...tagToEdit } : {
            id: generateId(),
            name: '',
            description: '',
            parentId: parentId, // Use provided parentId for new tags
        };
        this.initialParentId = parentId; // Store initial parent ID
    }

    private getTagOptions(tags: Tag[], currentTagId?: string, prefix = ''): { [key: string]: string } {
        let options: { [key: string]: string } = {};
        tags.forEach(t => {
            // Prevent setting tag as its own parent or a child as parent
            if (t.id === currentTagId) return;
            if (currentTagId && this.isDescendant(this.plugin.settings.tags, t.id, currentTagId)) return;

            options[t.id] = prefix + t.name;
            if (t.children && t.children.length > 0) {
                options = { ...options, ...this.getTagOptions(t.children, currentTagId, prefix + t.name + ' / ') };
            }
        });
        return options;
    }
    
    // Helper to check if childId is a descendant of parentId
    private isDescendant(tags: Tag[], parentId: string, childId: string): boolean {
        const parent = findItemById(tags, parentId);
        if (!parent || !parent.children) return false;
        
        for (const child of parent.children) {
            if (child.id === childId) return true;
            if (this.isDescendant(parent.children, child.id, childId)) return true; // Check recursively
        }
        return false;
    }

    onOpen() {
        const { contentEl } = this;
        const i18n = this.plugin.i18n;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.isNew ? i18n.t('ADD_TAG') : i18n.t('EDIT_TAG') });

        // Tag Name
        new Setting(contentEl)
            .setName(i18n.t('TAG_NAME')) // Use key
            .setDesc(i18n.t('ENTER_TAG_NAME')) // Use descriptive key
            .addText(text => text
                .setPlaceholder(i18n.t('TAG_NAME_PLACEHOLDER')) // Use key
                    .setValue(this.tag.name)
                .onChange(value => this.tag.name = value.trim()));

        // Tag Description
        new Setting(contentEl)
            .setName(i18n.t('TAG_DESCRIPTION')) // Use key
            .setDesc(i18n.t('TAG_DESCRIPTION_DESC')) // Use key
            .addText(text => text
                .setPlaceholder(i18n.t('ENTER_TAG_DESCRIPTION')) // Use key
                    .setValue(this.tag.description || '')
                .onChange(value => this.tag.description = value.trim()));

        // Parent Tag Dropdown
        const tagOptions = this.getTagOptions(this.plugin.settings.tags, this.isNew ? undefined : this.tag.id);
        new Setting(contentEl)
            .setName(i18n.t('PARENT_TAG')) // Use key
            .setDesc(i18n.t('TAG_PARENT_DESC')) // Use key
            .addDropdown(dropdown => {
                dropdown.addOption('', i18n.t('TOP_LEVEL')); // Use key
                Object.entries(tagOptions).forEach(([id, name]) => {
                        dropdown.addOption(id, name);
                });
                dropdown.setValue(this.tag.parentId || '');
                dropdown.onChange(value => {
                    this.tag.parentId = value === '' ? null : value;
                });
            });

        // Submit Button
        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(i18n.t('SAVE')) // Use key
                .setCta()
                .onClick(() => {
                    if (!this.tag.name) {
                        new Notice(i18n.t('TAG_NAME_REQUIRED')); // Use key
                        return;
                    }
                    this.onSubmit(this.tag);
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// --- Category Modal ---
class CategoryModal extends Modal {
    plugin: AccountingPlugin;
    category: Category;
    isNew: boolean;
    onSubmit: (result: Category) => void;
    initialParentId: string | null;
    initialType: TransactionType;

    constructor(app: App, plugin: AccountingPlugin, onSubmit: (result: Category) => void, categoryToEdit?: Category, parentId: string | null = null, type: TransactionType = 'expense') {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        this.isNew = !categoryToEdit;
        this.category = categoryToEdit ? { ...categoryToEdit } : {
            id: generateId(),
            name: '',
            type: type, // Set initial type
            parentId: parentId, // Set initial parent
        };
        this.initialParentId = parentId;
        this.initialType = type;
    }

    private getCategoryOptions(categories: Category[], currentCategoryId?: string, targetType?: TransactionType, prefix = ''): { [key: string]: string } {
        let options: { [key: string]: string } = {};
        categories.forEach(cat => {
            // Prevent loops and type mismatch
            if (cat.id === currentCategoryId) return;
            if (targetType && cat.type !== targetType) return; // Ensure parent type matches
            if (currentCategoryId && this.isDescendant(this.plugin.settings.categories, cat.id, currentCategoryId)) return;

            options[cat.id] = prefix + cat.name;
            if (cat.children && cat.children.length > 0) {
                options = { ...options, ...this.getCategoryOptions(cat.children, currentCategoryId, targetType, prefix + cat.name + ' / ') };
            }
        });
        return options;
    }
    
    // Helper to check if childId is a descendant of parentId
    private isDescendant(categories: Category[], parentId: string, childId: string): boolean {
        const parent = findItemById(categories, parentId);
        if (!parent || !parent.children) return false;
        
        for (const child of parent.children) {
            if (child.id === childId) return true;
            if (this.isDescendant(parent.children, child.id, childId)) return true; // Check recursively
        }
        return false;
    }

    onOpen() {
        const { contentEl } = this;
        const i18n = this.plugin.i18n;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.isNew ? i18n.t('ADD_CATEGORY') : i18n.t('EDIT_CATEGORY') });

        // Category Name
        new Setting(contentEl)
            .setName(i18n.t('CATEGORY_NAME')) // Use key
            .setDesc(i18n.t('ENTER_CATEGORY_NAME') || 'Enter a name for the category') // Use key + fallback
            .addText(text => text
                .setPlaceholder(i18n.t('CATEGORY_NAME_PLACEHOLDER')) // Use key
                    .setValue(this.category.name)
                .onChange(value => this.category.name = value.trim()));

        // Category Type (Income/Expense) - Disable if editing?
        const typeSetting = new Setting(contentEl)
            .setName(i18n.t('CATEGORY_TYPE')) // Use key
            .setDesc(i18n.t('CATEGORY_TYPE_DESC')) // Use key
            .addDropdown(dropdown => {
                dropdown
                    .addOption('income', i18n.t('INCOME')) // Use key
                    .addOption('expense', i18n.t('EXPENSE')) // Use key
                .setValue(this.category.type)
                .onChange(value => {
                    this.category.type = value as TransactionType;
                        // Maybe update parent options if type changes?
                        this.rebuildParentCategoryDropdown(parentSetting, parentDropdownEl);
                    });
                // Disable type change if editing and has children?
                // Or show warning?
                // if (!this.isNew && this.category.children && this.category.children.length > 0) {
                //     dropdown.setDisabled(true);
                // }
            });

        // Parent Category Dropdown
        let parentDropdownEl: HTMLSelectElement;
        const parentSetting = new Setting(contentEl)
            .setName(i18n.t('PARENT_CATEGORY')) // Use key
            .setDesc(i18n.t('CATEGORY_PARENT_DESC')) // Use key
            .addDropdown(dropdown => {
                parentDropdownEl = dropdown.selectEl; // Store reference
                this.populateParentCategoryDropdown(dropdown, this.category.type);
                dropdown.setValue(this.category.parentId || '');
                dropdown.onChange(value => {
                    this.category.parentId = value === '' ? null : value;
                });
            });

        // Submit Button
        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(i18n.t('SAVE')) // Use key
                .setCta()
                .onClick(() => {
                    if (!this.category.name) {
                        new Notice(i18n.t('CATEGORY_NAME_REQUIRED') || 'Category name is required.'); // Use key + fallback
                        return;
                    }
                    this.onSubmit(this.category);
                    this.close();
                }));
    }
    
    // Helper to rebuild parent category dropdown
    private rebuildParentCategoryDropdown(setting: Setting, dropdownEl: HTMLSelectElement) {
        dropdownEl.empty(); // Clear existing options
        this.populateParentCategoryDropdown({ selectEl: dropdownEl } as any, this.category.type);
        this.category.parentId = null; // Reset parent selection
        dropdownEl.value = '';
    }

    // Helper to populate parent category dropdown based on type
    private populateParentCategoryDropdown(dropdown: any, type: TransactionType) {
        const i18n = this.plugin.i18n;
        dropdown.addOption('', i18n.t('TOP_LEVEL')); // Use key
        const filteredCategories = this.plugin.settings.categories.filter(c => c.type === type);
        const categoryOptions = this.getCategoryOptions(filteredCategories, this.isNew ? undefined : this.category.id, type);
        Object.entries(categoryOptions).forEach(([id, name]) => {
            dropdown.addOption(id, name);
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// --- Budget Modal ---
class BudgetModal extends Modal {
    plugin: AccountingPlugin;
    budget: BudgetItem;
    isNew: boolean;
    onSubmit: (result: BudgetItem) => void;

    constructor(app: App, plugin: AccountingPlugin, onSubmit: (result: BudgetItem) => void, budgetToEdit?: BudgetItem) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        this.isNew = !budgetToEdit;
        this.budget = budgetToEdit ? { ...budgetToEdit } : {
            id: generateId(),
            name: '',
            scope: BudgetScope.Category,
            scopeId: '',
            period: BudgetPeriod.Monthly,
            amount: 0
        };
    }

    onOpen() {
        const { contentEl } = this;
        const i18n = this.plugin.i18n;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.isNew ? i18n.t('ADD_BUDGET') : i18n.t('EDIT_BUDGET') });

        // Budget Name
        new Setting(contentEl)
            .setName(i18n.t('BUDGET_NAME'))
            .setDesc(i18n.t('BUDGET_NAME_DESC'))
            .addText(text => text
                .setPlaceholder(i18n.t('BUDGET_NAME_PLACEHOLDER'))
                .setValue(this.budget.name)
                .onChange(value => this.budget.name = value));

        let scopeIdDropdownComponent: DropdownComponent; // Variable to store the component

        // Budget Scope (Tag, Account, Category)
        const scopeSetting = new Setting(contentEl)
            .setName(i18n.t('BUDGET_SCOPE'))
            .addDropdown(dropdown => {
                dropdown
                    .addOption(BudgetScope.Category, i18n.t('CATEGORY'))
                    .addOption(BudgetScope.Tag, i18n.t('TAG'))
                    .addOption(BudgetScope.Account, i18n.t('ACCOUNT'))
                    .setValue(this.budget.scope)
                    .onChange(value => {
                        this.budget.scope = value as BudgetScope;
                        this.budget.scopeId = ''; 
                        // Pass the DropdownComponent instance to rebuild
                        if (scopeIdDropdownComponent) { 
                           this.rebuildScopeIdDropdown(scopeIdDropdownComponent); 
                        }
                    });
            });

        // Scope ID Dropdown (dynamically populated based on scope)
        const scopeIdSetting = new Setting(contentEl)
            .setName(i18n.t('APPLIES_TO'))
            .addDropdown(dropdown => {
                 scopeIdDropdownComponent = dropdown; // Store component reference
                 this.populateScopeIdDropdown(dropdown, this.budget.scope); // Initial population
                 dropdown.setValue(this.budget.scopeId); // Set initial value if editing
                 dropdown.onChange(value => this.budget.scopeId = value);
             });

        // Budget Period (Daily, Monthly, Quarterly)
        new Setting(contentEl)
            .setName(i18n.t('BUDGET_PERIOD'))
            .addDropdown(dropdown => {
                dropdown
                    .addOption(BudgetPeriod.Daily, i18n.t('DAILY'))
                    .addOption(BudgetPeriod.Monthly, i18n.t('MONTHLY'))
                    .addOption(BudgetPeriod.Quarterly, i18n.t('QUARTERLY'))
                    .setValue(this.budget.period)
                    .onChange(value => this.budget.period = value as BudgetPeriod);
            });

        // Budget Amount
        new Setting(contentEl)
            .setName(i18n.t('BUDGET_AMOUNT'))
            .addText(text => text
                .setPlaceholder('1000')
                .setValue(this.budget.amount.toString())
                .onChange(value => {
                    const amount = parseFloat(value);
                    this.budget.amount = isNaN(amount) ? 0 : amount;
                 })
                 .inputEl.setAttribute('type', 'number') // Set input type to number
            );

        // Submit Button
        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(this.isNew ? i18n.t('ADD') : i18n.t('SAVE'))
                .setCta()
                .onClick(() => {
                    if (!this.budget.scopeId) {
                        new Notice(i18n.t('ERROR_SELECT_SCOPE_ITEM'));
                        return;
                    }
                    if (this.budget.amount <= 0) {
                        new Notice(i18n.t('ERROR_INVALID_BUDGET_AMOUNT'));
                        return;
                    }
                    this.onSubmit(this.budget);
                    this.close();
                }));
    }

    // Helper to rebuild the scope ID dropdown
    private rebuildScopeIdDropdown(dropdownComponent: DropdownComponent) { // Expect DropdownComponent
        const dropdownEl = dropdownComponent.selectEl; // Get select element from component

        // Clear existing dropdown options
        dropdownEl.empty(); 
        
        // Add placeholder option using the component
        dropdownComponent.addOption('', this.plugin.i18n.t('SELECT_ITEM_PLACEHOLDER'));
        // Disable the placeholder option directly on the element
        if (dropdownEl.options[0]) {
             dropdownEl.options[0].disabled = true;
        }
        
        // Repopulate based on the new scope using the component
        this.populateScopeIdDropdown(dropdownComponent, this.budget.scope); 
        
        // Reset value using component method
        this.budget.scopeId = ''; 
        dropdownComponent.setValue('');
    }

    // Helper to populate the scope ID dropdown based on the selected scope
    private populateScopeIdDropdown(dropdownComponent: DropdownComponent, scope: BudgetScope) { // Expect DropdownComponent
        const items: { id: string, name: string }[] = [];
        const i18n = this.plugin.i18n;
        
        // Use a more type-safe recursive helper
        interface HierarchicalItem { id: string; name: string; children?: HierarchicalItem[] }
        const addItemsRecursively = <T extends HierarchicalItem>(itemList: T[], prefix = '') => {
             itemList.forEach(item => {
                items.push({ id: item.id, name: prefix + item.name });
                if (item.children && item.children.length > 0) {
                    addItemsRecursively(item.children as T[], prefix + item.name + ' / ');
                }
            });
        };

        switch (scope) {
            case BudgetScope.Tag:
                addItemsRecursively(this.plugin.settings.tags);
                break;
            case BudgetScope.Account:
                 addItemsRecursively(this.plugin.settings.accounts);
                break;
            case BudgetScope.Category:
                const expenseCategories = this.plugin.settings.categories.filter(c => c.type === 'expense');
                 addItemsRecursively(expenseCategories);
                break;
        }

        // Add options using the component
        if (items.length === 0) {
             // Handle no items available
             dropdownComponent.addOption('', i18n.t('NO_ITEMS_AVAILABLE'));
             const option = dropdownComponent.selectEl.options[dropdownComponent.selectEl.options.length - 1];
             if(option) option.disabled = true;
             dropdownComponent.setValue(''); // Ensure value is empty
        } else {
             items.forEach(item => dropdownComponent.addOption(item.id, item.name));
        }
        
        // Set the initial value *after* populating, only if editing
        if (!this.isNew && this.budget.scope === scope) {
             dropdownComponent.setValue(this.budget.scopeId);
        } else if (!dropdownComponent.selectEl.options[0]?.disabled) {
            // If placeholder wasn't added (because items exist), explicitly set value to empty
            dropdownComponent.setValue(''); 
        } // Otherwise, placeholder is selected by default
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
