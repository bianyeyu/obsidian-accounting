import en from './en';
import zhCN from './zh-CN';

/**
 * 插件多语言支持接口定义
 */
export interface Translation {
    // 通用
    PLUGIN_NAME: string;
    SAVE: string;
    CANCEL: string;
    CONFIRM: string;
    DELETE: string;
    ADD: string;
    EDIT: string;
    BACK: string;
    CLOSE: string;
    SEARCH: string;
    NAME: string;
    DESCRIPTION: string;
    TYPE: string;
    PARENT: string;
    NONE: string;
    ROOT_LEVEL: string;
    SAVE_CHANGES_CONFIRM: string;
    DELETE_CONFIRM: string;
    NO_PARENT: string;
    ALL: string;

    // 交易相关
    TRANSACTION: string;
    ADD_TRANSACTION: string;
    EDIT_TRANSACTION: string;
    TRANSACTION_TYPE: string;
    INCOME: string;
    EXPENSE: string;
    AMOUNT: string;
    ACCOUNT: string; // Used for labels/headings
    CATEGORY: string; // Used for labels/headings
    TAGS: string; // Used for labels/headings
    NOTE: string;
    DATE: string;
    TIME: string;
    // Add keys for modal descriptions/placeholders
    DATE_TIME_DESC: string;
    TRANSACTION_TYPE_DESC: string;
    AMOUNT_DESC: string;
    ACCOUNT_SELECT_DESC: string;
    ACCOUNT_PLACEHOLDER: string;
    CATEGORY_SELECT_DESC: string;
    CATEGORY_PLACEHOLDER: string;
    TAGS_SELECT_DESC: string;
    TAGS_PLACEHOLDER: string;
    NOTE_DESC: string;
    NOTE_PLACEHOLDER: string;
    ACCOUNT_FIELD: string; // Used specifically in forms/modals
    CATEGORY_FIELD: string; // Used specifically in forms/modals
    TAGS_FIELD: string; // Used specifically in forms/modals
    DESCRIPTION_FIELD: string; // Used specifically in forms/modals
    SELECT_ACCOUNT: string;
    SELECT_CATEGORY: string;
    SELECT_TAGS: string;
    TRANSACTION_SAVED: string;
    TRANSACTION_APPENDED: string;
    ERROR_SAVING_TRANSACTION: string;
    ERROR_AMOUNT_INVALID: string; // General invalid amount
    ERROR_CATEGORY_REQUIRED: string;

    // 账户相关
    ACCOUNTS: string;
    ADD_ACCOUNT: string;
    EDIT_ACCOUNT: string;
    ACCOUNT_NAME: string;
    ACCOUNT_DESCRIPTION: string;
    PARENT_ACCOUNT: string;
    TOP_LEVEL: string;
    MANAGE_ACCOUNTS: string;
    DELETE_ACCOUNT_CONFIRM: string;
    ACCOUNT_NAME_PLACEHOLDER: string;
    ACCOUNT_ICON: string;
    ACCOUNT_ICON_DESC: string;
    ACCOUNT_PARENT: string;
    ACCOUNT_PARENT_DESC: string;
    ACCOUNT_SAVED: string;
    ACCOUNT_DELETED: string;
    NO_ACCOUNTS_CONFIGURED: string;
    ACCOUNT_NAME_DESC: string;
    ENTER_ACCOUNT_NAME: string;
    ACCOUNT_DESCRIPTION_DESC: string;
    ENTER_ACCOUNT_DESCRIPTION: string;
    ACCOUNT_NAME_REQUIRED: string;

    // 类别相关
    CATEGORIES: string;
    ADD_CATEGORY: string;
    EDIT_CATEGORY: string;
    INCOME_CATEGORIES: string;
    EXPENSE_CATEGORIES: string;
    CATEGORY_NAME: string;
    PARENT_CATEGORY: string;
    MANAGE_CATEGORIES: string;
    DELETE_CATEGORY_CONFIRM: string;
    CATEGORY_NAME_PLACEHOLDER: string;
    CATEGORY_TYPE: string;
    CATEGORY_TYPE_DESC: string;
    CATEGORY_PARENT: string;
    CATEGORY_PARENT_DESC: string;
    CATEGORY_SAVED: string;
    CATEGORY_DELETED: string;
    CATEGORY_NAME_REQUIRED: string;
    ENTER_CATEGORY_NAME: string;

    // 标签相关
    TAGS_TITLE: string;
    ADD_TAG: string;
    EDIT_TAG: string;
    TAG_NAME: string;
    PARENT_TAG: string;
    MANAGE_TAGS: string;
    DELETE_TAG_CONFIRM: string;
    TAG_NAME_PLACEHOLDER: string;
    TAG_PARENT: string;
    TAG_PARENT_DESC: string;
    TAG_SAVED: string;
    TAG_DELETED: string;
    NO_TAGS_CONFIGURED: string;
    TAG_DESCRIPTION: string;
    ENTER_TAG_NAME: string;
    ENTER_TAG_DESCRIPTION: string;
    TAG_NAME_REQUIRED: string;
    TAG_DESCRIPTION_DESC: string;

    // 预算相关
    BUDGETS: string;
    ADD_BUDGET: string;
    EDIT_BUDGET: string;
    BUDGET_NAME: string;
    BUDGET_AMOUNT: string;
    BUDGET_PERIOD: string;
    BUDGET_MONTHLY: string; // Keep specific if used differently than MONTHLY
    BUDGET_YEARLY: string; // Keep specific if used differently than YEARLY
    BUDGET_SETTINGS: string;
    MANAGE_BUDGETS: string;
    DELETE_BUDGET: string;
    BUDGET_DELETED: string;
    NO_BUDGETS_DEFINED: string;
    UNNAMED_BUDGET: string;
    BUDGET_DETAILS: string; // Format string: "Amount: {amount}, Period: {period}, Scope: {scope} ({scopeName})"
    BUDGET_NAME_DESC: string;
    BUDGET_NAME_PLACEHOLDER: string;
    BUDGET_SCOPE: string;
    TAG: string; // Use specific 'TAG' for scope display if needed
    APPLIES_TO: string;
    DAILY: string; // Use general DAILY for period display
    MONTHLY: string; // Use general MONTHLY for period display
    QUARTERLY: string; // New period
    YEARLY: string; // Use general YEARLY for period display
    ERROR_SELECT_SCOPE_ITEM: string;
    ERROR_INVALID_BUDGET_AMOUNT: string; // Specific budget amount error
    SELECT_ITEM_PLACEHOLDER: string;
    NO_ITEMS_AVAILABLE: string;
    UNKNOWN_TAG: string;
    UNKNOWN_ACCOUNT: string;
    UNKNOWN_CATEGORY: string;
    UNKNOWN_SCOPE: string;

    // 设置相关
    SETTINGS: string;
    GENERAL_SETTINGS: string;
    OUTPUT_SETTINGS: string;
    OUTPUT_FILE: string; // Path label
    USE_DAILY_NOTES: string;
    DAILY_NOTES_FORMAT: string;
    TRANSACTION_TEMPLATE: string;
    LANGUAGE: string;
    FOLLOW_SYSTEM: string; // Original key
    FOLLOW_OBSIDIAN: string; // Key used in new code
    OUTPUT_FILE_DESC: string;
    USE_DAILY_NOTES_DESC: string;
    DAILY_NOTES_FORMAT_DESC: string;
    TRANSACTION_TEMPLATE_DESC: string;
    OUTPUT_FILE_PATH: string; // Key used in new code for setting name
    CONFIRM_DELETE: string;
    CANNOT_BE_UNDONE: string;
    FEATURE_UNDER_DEVELOPMENT: string;

    // 数据管理 (Data Management)
    DATA_MANAGEMENT: string;
    EXPORT_DATA: string;
    EXPORT_DATA_DESC: string;
    EXPORT: string;
    DATA_EXPORTED_SUCCESS: string;
    IMPORT_DATA: string;
    IMPORT_DATA_DESC: string;
    IMPORT: string;
    DATA_IMPORTED_SUCCESS: string;
    DATA_IMPORT_FAILED: string;

    // 统计相关
    STATISTICS: string;
    OVERVIEW: string;
    TRANSACTIONS_LIST: string;
    CALENDAR: string;
    TRENDS: string;
    ANALYSIS: string;
    REPORTS: string;
    // DAILY: string; // Defined in budget
    // MONTHLY: string; // Defined in budget
    // YEARLY: string; // Defined in budget
    CUSTOM: string;
    SUMMARY: string;
    TOTAL_INCOME: string;
    TOTAL_EXPENSES: string;
    BALANCE: string;
    TRANSACTIONS_COUNT: string;
    // --- Keys added in settings code ---
    STATS_VIEW_TITLE: string;
    TOTAL_EXPENSE: string; // Potentially duplicate of TOTAL_EXPENSES
    NET_INCOME: string;
    TRANSACTIONS: string; // Potentially duplicate of TRANSACTIONS_LIST
    FILTER_BY_DATE: string;
    START_DATE: string;
    END_DATE: string;
    FILTER_BY_TYPE: string;
    // ALL: string; // Defined in General
    FILTER_BY_ACCOUNT: string;
    FILTER_BY_CATEGORY: string;
    FILTER_BY_TAG: string;
    APPLY_FILTERS: string;
    RESET_FILTERS: string;
    NO_TRANSACTIONS_FOUND: string;
    CHART_TYPE: string;
    PIE_CHART: string;
    BAR_CHART: string;
    LINE_CHART: string;
    GROUP_BY: string;
    DAY: string; // Potentially duplicate of DAILY
    WEEK: string;
    MONTH: string; // Potentially duplicate of MONTHLY
    YEAR: string; // Potentially duplicate of YEARLY
    TRENDS_VIEW_TITLE: string;

    // 错误信息
    // ERROR_SAVE_TRANSACTION: string; // Defined in Transaction
    ERROR_REQUIRED_FIELD: string;
    // ERROR_INVALID_AMOUNT: string; // Defined in Transaction

    // 成功信息
    SUCCESS_SAVE_TRANSACTION: string;
}

// Display names for locales first
export const localeDisplayNames = {
    en: 'English',
    'zh-CN': '简体中文 (Simplified Chinese)',
} as const; // Use 'as const' for stricter typing

// Define SupportedLocale based on the keys of localeDisplayNames
export type SupportedLocale = keyof typeof localeDisplayNames;

// Default locale
export const DEFAULT_LOCALE: SupportedLocale = 'en';

// Supported locales map using the defined types
export const locales: Record<SupportedLocale, Translation> = {
    en,
    'zh-CN': zhCN,
};

// Function to get translations based on locale
export function getTranslations(locale: SupportedLocale): Translation {
    return locales[locale] || locales[DEFAULT_LOCALE];
}