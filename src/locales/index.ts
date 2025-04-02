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

    // 交易相关
    TRANSACTION: string;
    ADD_TRANSACTION: string;
    EDIT_TRANSACTION: string;
    TRANSACTION_TYPE: string;
    INCOME: string;
    EXPENSE: string;
    AMOUNT: string;
    ACCOUNT: string;
    CATEGORY: string;
    TAGS: string;
    NOTE: string;
    DATE: string;
    TIME: string;
    
    // 账户相关
    ACCOUNTS: string;
    ADD_ACCOUNT: string;
    EDIT_ACCOUNT: string;
    ACCOUNT_NAME: string;
    ACCOUNT_DESCRIPTION: string;
    PARENT_ACCOUNT: string;
    TOP_LEVEL: string;
    
    // 类别相关
    CATEGORIES: string;
    ADD_CATEGORY: string;
    EDIT_CATEGORY: string;
    INCOME_CATEGORIES: string;
    EXPENSE_CATEGORIES: string;
    CATEGORY_NAME: string;
    PARENT_CATEGORY: string;
    
    // 标签相关
    TAGS_TITLE: string;
    ADD_TAG: string;
    EDIT_TAG: string;
    TAG_NAME: string;
    PARENT_TAG: string;
    
    // 预算相关
    BUDGETS: string;
    ADD_BUDGET: string;
    EDIT_BUDGET: string;
    BUDGET_NAME: string;
    BUDGET_AMOUNT: string;
    BUDGET_PERIOD: string;
    BUDGET_MONTHLY: string;
    BUDGET_YEARLY: string;
    
    // 设置相关
    SETTINGS: string;
    GENERAL_SETTINGS: string;
    OUTPUT_SETTINGS: string;
    OUTPUT_FILE: string;
    USE_DAILY_NOTES: string;
    DAILY_NOTES_FORMAT: string;
    TRANSACTION_TEMPLATE: string;
    LANGUAGE: string;
    
    // 统计相关
    STATISTICS: string;
    OVERVIEW: string;
    TRANSACTIONS_LIST: string;
    CALENDAR: string;
    TRENDS: string;
    ANALYSIS: string;
    REPORTS: string;
    DAILY: string;
    MONTHLY: string;
    YEARLY: string;
    CUSTOM: string;
    SUMMARY: string;
    TOTAL_INCOME: string;
    TOTAL_EXPENSES: string;
    BALANCE: string;
    TRANSACTIONS_COUNT: string;
    
    // 错误信息
    ERROR_SAVE_TRANSACTION: string;
    ERROR_REQUIRED_FIELD: string;
    ERROR_INVALID_AMOUNT: string;
    
    // 成功信息
    SUCCESS_SAVE_TRANSACTION: string;
}

// 支持的语言列表
export type SupportedLocale = 'en' | 'zh-CN';

// 语言显示名称
export const localeDisplayNames: Record<SupportedLocale, string> = {
    'en': 'English',
    'zh-CN': '简体中文'
};

// 默认语言
export const DEFAULT_LOCALE: SupportedLocale = 'en';