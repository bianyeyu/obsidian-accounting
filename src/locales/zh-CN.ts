import { Translation } from './index';

const zhCN: Translation = {
    // 通用
    PLUGIN_NAME: '个人记账',
    SAVE: '保存',
    CANCEL: '取消',
    CONFIRM: '确认',
    DELETE: '删除',
    ADD: '添加',
    EDIT: '编辑',
    BACK: '返回',
    CLOSE: '关闭',
    SEARCH: '搜索',

    // 交易相关
    TRANSACTION: '交易',
    ADD_TRANSACTION: '添加交易',
    EDIT_TRANSACTION: '编辑交易',
    TRANSACTION_TYPE: '交易类型',
    INCOME: '收入',
    EXPENSE: '支出',
    AMOUNT: '金额',
    ACCOUNT: '账户',
    CATEGORY: '分类',
    TAGS: '标签',
    NOTE: '备注',
    DATE: '日期',
    TIME: '时间',
    
    // 账户相关
    ACCOUNTS: '账户',
    ADD_ACCOUNT: '添加账户',
    EDIT_ACCOUNT: '编辑账户',
    ACCOUNT_NAME: '账户名称',
    ACCOUNT_DESCRIPTION: '账户描述',
    PARENT_ACCOUNT: '父账户',
    TOP_LEVEL: '无（顶级）',
    
    // 类别相关
    CATEGORIES: '分类',
    ADD_CATEGORY: '添加分类',
    EDIT_CATEGORY: '编辑分类',
    INCOME_CATEGORIES: '收入分类',
    EXPENSE_CATEGORIES: '支出分类',
    CATEGORY_NAME: '分类名称',
    PARENT_CATEGORY: '父分类',
    
    // 标签相关
    TAGS_TITLE: '标签',
    ADD_TAG: '添加标签',
    EDIT_TAG: '编辑标签',
    TAG_NAME: '标签名称',
    PARENT_TAG: '父标签',
    
    // 预算相关
    BUDGETS: '预算',
    ADD_BUDGET: '添加预算',
    EDIT_BUDGET: '编辑预算',
    BUDGET_NAME: '预算名称',
    BUDGET_AMOUNT: '金额',
    BUDGET_PERIOD: '周期',
    BUDGET_MONTHLY: '每月',
    BUDGET_YEARLY: '每年',
    
    // 设置相关
    SETTINGS: '设置',
    GENERAL_SETTINGS: '通用设置',
    OUTPUT_SETTINGS: '输出设置',
    OUTPUT_FILE: '输出文件',
    USE_DAILY_NOTES: '使用日记',
    DAILY_NOTES_FORMAT: '日记格式',
    TRANSACTION_TEMPLATE: '交易模板',
    LANGUAGE: '语言',
    OUTPUT_FILE_DESC: '用于保存交易记录的文件',
    USE_DAILY_NOTES_DESC: '将交易添加到日记中，而不是单个文件',
    DAILY_NOTES_FORMAT_DESC: '日记文件名格式（仅在启用"使用日记"时使用）',
    TRANSACTION_TEMPLATE_DESC: '用于格式化交易记录的模板。占位符：{{date}}, {{type}}, {{amount}}, {{account}}, {{category}}, {{tags}}, {{description}}, {{note}}',
    FOLLOW_SYSTEM: '跟随系统',
    
    // 统计相关
    STATISTICS: '统计',
    OVERVIEW: '概览',
    TRANSACTIONS_LIST: '交易记录',
    CALENDAR: '日历',
    TRENDS: '趋势',
    ANALYSIS: '分析',
    REPORTS: '报表',
    DAILY: '日',
    MONTHLY: '月',
    YEARLY: '年',
    CUSTOM: '自定义',
    SUMMARY: '摘要',
    TOTAL_INCOME: '总收入',
    TOTAL_EXPENSES: '总支出',
    BALANCE: '余额',
    TRANSACTIONS_COUNT: '交易笔数',
    
    // 错误信息
    ERROR_SAVE_TRANSACTION: '保存交易出错',
    ERROR_REQUIRED_FIELD: '此字段为必填项',
    ERROR_INVALID_AMOUNT: '请输入有效金额',
    
    // 成功信息
    SUCCESS_SAVE_TRANSACTION: '交易添加成功',

    // 新增键
    DATA_MANAGEMENT: '数据管理',
    OUTPUT_FILE_PATH: '输出文件路径',
    CONFIRM_DELETE: '确认删除',
    CANNOT_BE_UNDONE: '此操作无法撤销。',
    NO_ACCOUNTS_CONFIGURED: '尚未配置账户。',
    NO_TAGS_CONFIGURED: '尚未配置标签。',
    FEATURE_UNDER_DEVELOPMENT: '功能开发中。',

    // 为账户/标签模态框添加
    ACCOUNT_NAME_DESC: '为账户输入一个唯一的名称。',
    ENTER_ACCOUNT_NAME: '例如：银行账户、信用卡',
    ACCOUNT_DESCRIPTION_DESC: '账户的可选描述。',
    ENTER_ACCOUNT_DESCRIPTION: '例如：主要支票账户',
    ACCOUNT_NAME_REQUIRED: '账户名称是必需的。',
    TAG_DESCRIPTION: '标签描述', // 为保持一致性添加
    ENTER_TAG_NAME: '例如：食品杂货、旅行',
    ENTER_TAG_DESCRIPTION: '例如：所有食品购买',
    TAG_NAME_REQUIRED: '标签名称是必需的。',
    TAG_DESCRIPTION_DESC: '标签的可选描述。',
};

export default zhCN;