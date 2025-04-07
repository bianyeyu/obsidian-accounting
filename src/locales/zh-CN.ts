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
    ERROR_SAVING_TRANSACTION: '保存交易出错',
    ERROR_REQUIRED_FIELD: '此字段为必填项',
    ERROR_AMOUNT_INVALID: '请输入有效金额',
    
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

    // --- Start of Added/Updated Keys ---
    UPDATE: '更新',
    ERROR_INVALID_DATE: '请输入有效的日期和时间 (YYYY-MM-DD HH:mm)。',
    ERROR_INVALID_TYPE: '请选择有效的交易类型（收入或支出）。',
    ERROR_ACCOUNT_REQUIRED: '账户是必填项。',
    WARN_BUDGET_OVER: '警告：添加此交易将超出预算"{budgetName}"({scopeName})！预计：¥{projected}，限制：¥{limit}。',
    WARN_BUDGET_CLOSE: '注意：添加此交易将使用预算"{budgetName}"({scopeName})的90%以上。预计：¥{projected}，限制：¥{limit}。',
    INFO_NEW_ACCOUNT: '已创建新账户"{name}"。',
    INFO_NEW_CATEGORY: '已创建新分类"{name}"。',
    INFO_NEW_TAG: '已创建新标签"{name}"。',
    // --- End of Added/Updated Keys ---

    // Missing Keys Start
    NAME: '名称',
    DESCRIPTION: '描述',
    TYPE: '类型',
    PARENT: '父级',
    NONE: '无',
    ROOT_LEVEL: '根级别',
    SAVE_CHANGES_CONFIRM: '保存更改?',
    DELETE_CONFIRM: '您确定要删除此项吗？',
    NO_PARENT: '无父级',
    ALL: '全部',
    // Missing Keys End

    // Missing Keys Start
    DATE_TIME_DESC: '交易日期和时间',
    TRANSACTION_TYPE_DESC: '选择收入或支出',
    AMOUNT_DESC: '交易金额',
    ACCOUNT_SELECT_DESC: '选择或输入以创建账户',
    ACCOUNT_PLACEHOLDER: '输入以搜索或创建...',
    CATEGORY_SELECT_DESC: '选择或输入以创建分类',
    CATEGORY_PLACEHOLDER: '输入以搜索或创建...',
    TAGS_SELECT_DESC: '输入标签，以逗号分隔',
    TAGS_PLACEHOLDER: '例如：工作，购物',
    NOTE_DESC: '可选的交易备注',
    NOTE_PLACEHOLDER: '在此输入交易备注...',
    ACCOUNT_FIELD: '账户',
    CATEGORY_FIELD: '分类',
    TAGS_FIELD: '标签',
    DESCRIPTION_FIELD: '描述',
    SELECT_ACCOUNT: '选择账户',
    SELECT_CATEGORY: '选择分类',
    SELECT_TAGS: '选择标签',
    TRANSACTION_SAVED: '交易已保存',
    TRANSACTION_APPENDED: '交易已附加到文件',
    ERROR_CATEGORY_REQUIRED: '分类是必填项。',
    // Missing Keys End
    
    // 账户相关
    MANAGE_ACCOUNTS: '管理账户',
    DELETE_ACCOUNT_CONFIRM: '您确定要删除此账户及其所有子账户吗？',
    ACCOUNT_NAME_PLACEHOLDER: '输入账户名称',
    ACCOUNT_ICON: '图标 (可选)',
    ACCOUNT_ICON_DESC: '输入一个 Lucide 图标名称 (例如：wallet, landmark)',
    ACCOUNT_PARENT: '父账户',
    ACCOUNT_PARENT_DESC: '为层级结构分配一个父账户',
    ACCOUNT_SAVED: '账户保存成功',
    ACCOUNT_DELETED: '账户删除成功',
    
    // 类别相关
    MANAGE_CATEGORIES: '管理分类',
    DELETE_CATEGORY_CONFIRM: '您确定要删除此分类及其所有子分类吗？',
    CATEGORY_NAME_PLACEHOLDER: '输入分类名称',
    CATEGORY_TYPE: '类型',
    CATEGORY_TYPE_DESC: '选择此分类是用于收入还是支出',
    CATEGORY_PARENT: '父分类',
    CATEGORY_PARENT_DESC: '为层级结构分配一个父分类',
    CATEGORY_SAVED: '分类保存成功',
    CATEGORY_DELETED: '分类删除成功',
    CATEGORY_NAME_REQUIRED: '分类名称是必需的。',
    ENTER_CATEGORY_NAME: '为分类输入一个名称',
    
    // 标签相关
    MANAGE_TAGS: '管理标签',
    DELETE_TAG_CONFIRM: '您确定要删除此标签及其所有子标签吗？',
    TAG_NAME_PLACEHOLDER: '输入标签名称',
    TAG_PARENT: '父标签',
    TAG_PARENT_DESC: '为层级结构分配一个父标签',
    TAG_SAVED: '标签保存成功',
    TAG_DELETED: '标签删除成功',
    
    // 预算相关
    BUDGET_SETTINGS: '预算设置',
    MANAGE_BUDGETS: '管理预算',
    DELETE_BUDGET: '删除预算',
    BUDGET_DELETED: '预算项已删除',
    NO_BUDGETS_DEFINED: '尚未定义预算。',
    UNNAMED_BUDGET: '未命名预算',
    BUDGET_DETAILS: '金额：{amount}，周期：{period}，范围：{scope} ({scopeName})',
    BUDGET_NAME_DESC: '此预算项的可选名称',
    BUDGET_NAME_PLACEHOLDER: '例如：每月食品预算',
    BUDGET_SCOPE: '预算范围',
    TAG: '标签',
    APPLIES_TO: '应用于',
    QUARTERLY: '每季度',
    ERROR_SELECT_SCOPE_ITEM: '请选择此预算适用的项目。',
    ERROR_INVALID_BUDGET_AMOUNT: '请输入大于零的有效预算金额。',
    SELECT_ITEM_PLACEHOLDER: '-- 选择项目 --',
    NO_ITEMS_AVAILABLE: '此范围没有可用项目',
    UNKNOWN_TAG: '未知标签',
    UNKNOWN_ACCOUNT: '未知账户',
    UNKNOWN_CATEGORY: '未知分类',
    UNKNOWN_SCOPE: '未知范围',
    
    // 数据管理
    EXPORT_DATA: '导出数据',
    EXPORT_DATA_DESC: '将所有插件数据（设置、账户、分类、标签、预算）导出到 JSON 文件。',
    EXPORT: '导出',
    DATA_EXPORTED_SUCCESS: '数据导出成功。',
    IMPORT_DATA: '导入数据',
    IMPORT_DATA_DESC: '从 JSON 文件导入插件数据。这将覆盖现有设置。',
    IMPORT: '导入',
    DATA_IMPORTED_SUCCESS: '数据导入成功。设置可能需要重新加载 Obsidian。',
    DATA_IMPORT_FAILED: '数据导入失败。请检查控制台错误。',
    
    // 统计相关
    STATS_VIEW_TITLE: '统计视图',
    TOTAL_EXPENSE: '总支出', // Note: Duplicate of TOTAL_EXPENSES
    NET_INCOME: '净收入',
    TRANSACTIONS: '交易', // Note: Duplicate of TRANSACTION
    FILTER_BY_DATE: '按日期筛选',
    START_DATE: '开始日期',
    END_DATE: '结束日期',
    FILTER_BY_TYPE: '按类型筛选',
    FILTER_BY_ACCOUNT: '按账户筛选',
    FILTER_BY_CATEGORY: '按分类筛选',
    FILTER_BY_TAG: '按标签筛选',
    APPLY_FILTERS: '应用筛选',
    RESET_FILTERS: '重置筛选',
    NO_TRANSACTIONS_FOUND: '未找到匹配筛选的交易。',
    CHART_TYPE: '图表类型',
    PIE_CHART: '饼图',
    BAR_CHART: '条形图',
    LINE_CHART: '折线图',
    GROUP_BY: '分组依据',
    WEEK: '周',
    YEAR: '年',
    TRENDS_VIEW_TITLE: '趋势视图',
    // Missing Keys Start
    FOLLOW_OBSIDIAN: '跟随 Obsidian 语言',
    DAY: '天', // Note: Duplicate of DAILY
    MONTH: '月', // Note: Duplicate of MONTHLY
    // Missing Keys End
};

export default zhCN;