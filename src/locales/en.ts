import { Translation } from './index';

const en: Translation = {
    // 通用
    PLUGIN_NAME: 'Personal Accounting',
    SAVE: 'Save',
    CANCEL: 'Cancel',
    CONFIRM: 'Confirm',
    DELETE: 'Delete',
    ADD: 'Add',
    EDIT: 'Edit',
    BACK: 'Back',
    CLOSE: 'Close',
    SEARCH: 'Search',

    // 交易相关
    TRANSACTION: 'Transaction',
    ADD_TRANSACTION: 'Add Transaction',
    EDIT_TRANSACTION: 'Edit Transaction',
    TRANSACTION_TYPE: 'Transaction Type',
    INCOME: 'Income',
    EXPENSE: 'Expense',
    AMOUNT: 'Amount',
    ACCOUNT: 'Account',
    CATEGORY: 'Category',
    TAGS: 'Tags',
    NOTE: 'Note',
    DATE: 'Date',
    TIME: 'Time',
    
    // 账户相关
    ACCOUNTS: 'Accounts',
    ADD_ACCOUNT: 'Add Account',
    EDIT_ACCOUNT: 'Edit Account',
    ACCOUNT_NAME: 'Account Name',
    ACCOUNT_DESCRIPTION: 'Account Description',
    PARENT_ACCOUNT: 'Parent Account',
    TOP_LEVEL: 'None (Top Level)',
    
    // 类别相关
    CATEGORIES: 'Categories',
    ADD_CATEGORY: 'Add Category',
    EDIT_CATEGORY: 'Edit Category',
    INCOME_CATEGORIES: 'Income Categories',
    EXPENSE_CATEGORIES: 'Expense Categories',
    CATEGORY_NAME: 'Category Name',
    PARENT_CATEGORY: 'Parent Category',
    
    // 标签相关
    TAGS_TITLE: 'Tags',
    ADD_TAG: 'Add Tag',
    EDIT_TAG: 'Edit Tag',
    TAG_NAME: 'Tag Name',
    PARENT_TAG: 'Parent Tag',
    
    // 预算相关
    BUDGETS: 'Budgets',
    ADD_BUDGET: 'Add Budget',
    EDIT_BUDGET: 'Edit Budget',
    BUDGET_NAME: 'Budget Name',
    BUDGET_AMOUNT: 'Amount',
    BUDGET_PERIOD: 'Period',
    BUDGET_MONTHLY: 'Monthly',
    BUDGET_YEARLY: 'Yearly',
    
    // 设置相关
    SETTINGS: 'Settings',
    GENERAL_SETTINGS: 'General Settings',
    OUTPUT_SETTINGS: 'Output Settings',
    OUTPUT_FILE: 'Output File',
    USE_DAILY_NOTES: 'Use Daily Notes',
    DAILY_NOTES_FORMAT: 'Daily Notes Format',
    TRANSACTION_TEMPLATE: 'Transaction Template',
    LANGUAGE: 'Language',
    
    // 统计相关
    STATISTICS: 'Accounting Statistics',
    OVERVIEW: 'Overview',
    TRANSACTIONS_LIST: 'Transactions',
    CALENDAR: 'Calendar',
    TRENDS: 'Trends',
    ANALYSIS: 'Analysis',
    REPORTS: 'Reports',
    DAILY: 'Daily',
    MONTHLY: 'Monthly',
    YEARLY: 'Yearly',
    CUSTOM: 'Custom',
    SUMMARY: 'Summary',
    TOTAL_INCOME: 'Total Income',
    TOTAL_EXPENSES: 'Total Expenses',
    BALANCE: 'Balance',
    TRANSACTIONS_COUNT: 'Transactions',
    
    // 错误信息
    ERROR_SAVE_TRANSACTION: 'Error saving transaction',
    ERROR_REQUIRED_FIELD: 'This field is required',
    ERROR_INVALID_AMOUNT: 'Please enter a valid amount',
    
    // 成功信息
    SUCCESS_SAVE_TRANSACTION: 'Transaction added successfully'
};

export default en;