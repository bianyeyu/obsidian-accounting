import { App, PluginSettingTab, Setting, Modal, Notice, moment } from 'obsidian';
import AccountingPlugin from '../main';
import { Account, Category, Tag, TransactionType, generateId } from './models';
import { SupportedLocale, DEFAULT_LOCALE, localeDisplayNames } from './locales';

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
    },
    {
        id: generateId(),

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
    locale: DEFAULT_LOCALE // 使用默认语言（英文）
};

/**
 * Plugin settings interface
 */
export interface AccountingPluginSettings {
    accounts: Account[];
    categories: Category[];
    tags: Tag[];
    budgets: Budget[];
    outputFile: string;
    useDailyNotes: boolean;
    dailyNotesFormat: string;
    transactionTemplate: string;
    locale: SupportedLocale; // 添加语言设置
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
        
        // 使用i18n获取翻译后的文本
        const i18n = this.plugin.i18n;

        containerEl.createEl('h2', { text: i18n.t('SETTINGS') });

        // 添加语言选择
        containerEl.createEl('h3', { text: i18n.t('GENERAL_SETTINGS') });
        
        new Setting(containerEl)
            .setName(i18n.t('LANGUAGE'))
            .setDesc('Choose display language / 选择显示语言')
            .addDropdown(dropdown => {
                // 添加所有支持的语言
                Object.entries(localeDisplayNames).forEach(([locale, name]) => {
                    dropdown.addOption(locale, name);
                });
                
                // 设置当前语言
                dropdown.setValue(this.plugin.settings.locale)
                    .onChange(async (value: SupportedLocale) => {
                        // 更新设置
                        this.plugin.settings.locale = value;
                        // 更新语言管理器
                        this.plugin.i18n.setLocale(value);
                        // 保存设置
                        await this.plugin.saveSettings();
                        // 重新渲染设置界面以应用新语言
                        this.display();
                    });
            });

        // 输出设置
        containerEl.createEl('h3', { text: i18n.t('OUTPUT_SETTINGS') });
        
        new Setting(containerEl)
            .setName(i18n.t('OUTPUT_FILE'))
            .setDesc(i18n.t('The file where transactions will be saved'))
            .addText(text => text
                .setPlaceholder('Accounting/transactions.md')
                .setValue(this.plugin.settings.outputFile)
                .onChange(async (value) => {
                    this.plugin.settings.outputFile = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.t('USE_DAILY_NOTES'))
            .setDesc(i18n.t('Add transactions to daily notes instead of a single file'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useDailyNotes)
                .onChange(async (value) => {
                    this.plugin.settings.useDailyNotes = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.t('DAILY_NOTES_FORMAT'))
            .setDesc(i18n.t('Format for daily notes filenames (only used if Use Daily Notes is enabled)'))
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD')
                .setValue(this.plugin.settings.dailyNotesFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dailyNotesFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.t('TRANSACTION_TEMPLATE'))
            .setDesc(i18n.t('Template for formatting transactions in markdown'))
            .addTextArea(text => text
                .setPlaceholder('- {{date}} | {{type}} | {{amount}} | {{account}} | {{category}} | {{tags}} | {{description}} {{#note}}| {{note}}{{/note}}')
                .setValue(this.plugin.settings.transactionTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.transactionTemplate = value;
                    await this.plugin.saveSettings();
                }));

        // 账户管理
        this.addAccountsSection(containerEl);
        
        // 分类管理
        this.addCategoriesSection(containerEl);
        
        // 标签管理
        this.addTagsSection(containerEl);
        
        // 添加预算部分
        this.addBudgetsSection(containerEl);
    }
}
