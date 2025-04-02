import { App, TFile, normalizePath } from 'obsidian';
import { Account, Category, Tag, Transaction, findItemById, findItemByName, BudgetItem, BudgetScope, BudgetPeriod } from './models';
import { AccountingPluginSettings } from './settings';
import { I18n } from './locales/i18n';
import * as moment from 'moment';

/**
 * Format a transaction as a markdown string
 * @param transaction The transaction to format
 * @param template The transaction template
 * @param accounts The accounts list
 * @param categories The categories list
 * @param tags The tags list
 * @returns The formatted transaction string
 */
export function formatTransaction(
    transaction: Transaction,
    template: string,
    accounts: Account[],
    categories: Category[],
    tags: Tag[]
): string {
    // Find the account, category, and tags
    const account = transaction.accountId ? findAccountById(accounts, transaction.accountId) : undefined;
    const category = findCategoryById(categories, transaction.categoryId);
    const transactionTags = transaction.tagIds
        .map(id => findTagById(tags, id))
        .filter(Boolean)
        .map(tag => tag?.name);
    
    // Replace template variables
    let result = template;
    
    // Basic replacements
    result = result.replace(/{{date}}/g, transaction.date);
    result = result.replace(/{{type}}/g, transaction.type);
    result = result.replace(/{{amount}}/g, transaction.amount.toString());
    result = result.replace(/{{account}}/g, account?.name || '');
    result = result.replace(/{{category}}/g, category?.name || '');
    result = result.replace(/{{tags}}/g, transactionTags.join(', '));
    
    // Replace description with note
    result = result.replace(/{{description}}/g, transaction.note || '');
    
    // Handle optional note
    if (transaction.note) {
        result = result.replace(/{{#note}}(.*?){{\/note}}/g, '$1');
        result = result.replace(/{{note}}/g, transaction.note);
    } else {
        result = result.replace(/{{#note}}(.*?){{\/note}}/g, '');
    }
    
    return result;
}

/**
 * Ensure transaction date has time component
 * If no time is present, add default time (00:00)
 * @param dateStr The date string to normalize
 * @returns Normalized date string in format "YYYY-MM-DD HH:mm"
 */
export function normalizeTransactionDate(dateStr: string): string {
    if (!dateStr) {
        return moment().format('YYYY-MM-DD HH:mm');
    }
    
    // Check if the date already has time component
    if (dateStr.includes(' ') && dateStr.includes(':')) {
        return dateStr;
    }
    
    // Format is just date (YYYY-MM-DD), add default time
    return `${dateStr} 00:00`;
}

/**
 * Extract date-only part from a date string
 * @param dateStr Date string which may include time
 * @returns Date part in YYYY-MM-DD format
 */
export function getDatePart(dateStr: string): string {
    if (!dateStr) {
        return moment().format('YYYY-MM-DD');
    }
    
    // If the date includes time, extract just the date part
    if (dateStr.includes(' ')) {
        return dateStr.split(' ')[0];
    }
    
    return dateStr;
}

/**
 * Save a transaction to a file
 * @param app The Obsidian app
 * @param transaction The transaction to save
 * @param settings The plugin settings
 */
export async function saveTransaction(
    app: App,
    transaction: Transaction,
    settings: AccountingPluginSettings
): Promise<void> {
    // Ensure the transaction date has time component
    transaction.date = normalizeTransactionDate(transaction.date);
    
    // Determine the file path
    let filePath: string;
    
    if (settings.useDailyNotes) {
        // Use daily notes - extract just the date part for the filename
        const dateOnly = getDatePart(transaction.date);
        const date = moment(dateOnly, 'YYYY-MM-DD');
        const fileName = date.format(settings.dailyNotesFormat);
        filePath = `${fileName}.md`;
    } else {
        // Use the configured output file
        filePath = settings.outputFile;
    }
    
    // Format the transaction
    const formattedTransaction = formatTransaction(
        transaction,
        settings.transactionTemplate,
        settings.accounts,
        settings.categories,
        settings.tags
    );
    
    // Ensure the file exists
    await ensureFileExists(app, filePath);
    
    // Append the transaction to the file
    await appendToFile(app, filePath, formattedTransaction);
}

/**
 * Ensure a file exists, creating it if necessary
 * @param app The Obsidian app
 * @param filePath The file path
 */
export async function ensureFileExists(app: App, filePath: string): Promise<void> {
    const normalizedPath = normalizePath(filePath);
    const file = app.vault.getAbstractFileByPath(normalizedPath);
    
    if (!file) {
        // Create the directory if it doesn't exist
        const dirPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        if (dirPath && dirPath.length > 0) {
            try {
                await app.vault.createFolder(dirPath);
            } catch (error) {
                // Folder might already exist, ignore the error
            }
        }
        
        // Create the file
        await app.vault.create(normalizedPath, '');
    }
}

/**
 * Append text to a file
 * @param app The Obsidian app
 * @param filePath The file path
 * @param text The text to append
 */
export async function appendToFile(app: App, filePath: string, text: string): Promise<void> {
    const normalizedPath = normalizePath(filePath);
    const file = app.vault.getAbstractFileByPath(normalizedPath) as TFile;
    
    if (file) {
        // Read the current content
        const content = await app.vault.read(file);
        
        // Append the new content
        const newContent = content ? `${content}\n${text}` : text;
        
        // Write back to the file
        await app.vault.modify(file, newContent);
    }
}

/**
 * Parse transactions from a file
 * @param app The Obsidian app
 * @param filePath The file path
 * @param settings The plugin settings
 * @returns An array of transactions
 */
export async function parseTransactionsFromFile(
    app: App,
    filePath: string,
    settings: AccountingPluginSettings
): Promise<Transaction[]> {
    const normalizedPath = normalizePath(filePath);
    const file = app.vault.getAbstractFileByPath(normalizedPath) as TFile;
    
    if (!file) {
        return [];
    }
    
    // Read the file content
    const content = await app.vault.read(file);
    
    // Split into lines
    const lines = content.split('\n');
    
    // Parse transactions from lines
    const transactions: Transaction[] = [];
    
    for (const line of lines) {
        // Skip empty lines
        if (!line.trim()) {
            continue;
        }
        
        // Check if the line is a transaction (starts with '- ')
        if (line.startsWith('- ')) {
            const transaction = parseTransactionFromLine(
                line,
                settings.accounts,
                settings.categories,
                settings.tags
            );
            
            if (transaction) {
                transactions.push(transaction);
            }
        }
    }
    
    return transactions;
}

/**
 * Parse a transaction from a line of markdown
 * @param line The line to parse
 * @param accounts The accounts list
 * @param categories The categories list
 * @param tags The tags list
 * @returns The parsed transaction or undefined
 */
export function parseTransactionFromLine(
    line: string,
    accounts: Account[],
    categories: Category[],
    tags: Tag[]
): Transaction | undefined {
    // Remove the leading '- '
    const content = line.substring(2).trim();
    
    // Split by ' | '
    const parts = content.split(' | ');
    
    // Ensure we have at least the minimum number of parts
    if (parts.length < 7) {
        return undefined;
    }
    
    // Extract the parts
    let date = parts[0].trim(); // This may or may not include time
    date = normalizeTransactionDate(date); // Ensure it has time component
    
    const type = parts[1].trim() as 'income' | 'expense';
    const amount = parseFloat(parts[2].trim());
    const accountName = parts[3].trim();
    const categoryName = parts[4].trim();
    const tagNames = parts[5].trim().split(',').map(t => t.trim()).filter(Boolean);
    const note = parts[6].trim(); // Use the description field as note
    
    // Find the account, category, and tags
    const account = findAccountByName(accounts, accountName);
    const category = findCategoryByName(categories, categoryName);
    const tagIds = tagNames.map(name => {
        const tag = findTagByName(tags, name);
        return tag ? tag.id : '';
    }).filter(Boolean);
    
    // Create the transaction
    return {
        id: Date.now().toString(),
        date,
        type,
        amount,
        accountId: account?.id || '',
        categoryId: category?.id || '',
        tagIds,
        note
    };
}

/**
 * Find an account by name
 * @param accounts The accounts list
 * @param name The name to find
 * @returns The found account or undefined
 */
export function findAccountByName(accounts: Account[], name: string): Account | undefined {
    return findItemByName(accounts, name);
}

/**
 * Find an account by ID
 * @param accounts The accounts list
 * @param id The ID to find
 * @returns The found account or undefined
 */
export function findAccountById(accounts: Account[], id: string): Account | undefined {
    return findItemById(accounts, id);
}

/**
 * Find a category by name
 * @param categories The categories list
 * @param name The name to find
 * @returns The found category or undefined
 */
export function findCategoryByName(categories: Category[], name: string): Category | undefined {
    return findItemByName(categories, name);
}

/**
 * Find a category by ID
 * @param categories The categories list
 * @param id The ID to find
 * @returns The found category or undefined
 */
export function findCategoryById(categories: Category[], id: string): Category | undefined {
    return findItemById(categories, id);
}

/**
 * Find a tag by name
 * @param tags The tags list
 * @param name The name to find
 * @returns The found tag or undefined
 */
export function findTagByName(tags: Tag[], name: string): Tag | undefined {
    return findItemByName(tags, name);
}

/**
 * Find a tag by ID
 * @param tags The tags list
 * @param id The ID to find
 * @returns The found tag or undefined
 */
export function findTagById(tags: Tag[], id: string): Tag | undefined {
    return findItemById(tags, id);
}

/**
 * Helper to get the display name of the tag, account, or category based on scope and ID.
 * @param scope The budget scope (Tag, Account, Category).
 * @param scopeId The ID of the item.
 * @param allAccounts List of all accounts.
 * @param allCategories List of all categories.
 * @param allTags List of all tags.
 * @param i18nInstance The i18n instance for translations.
 * @returns The name of the item or an 'Unknown' string.
 */
export function getScopeName(
    scope: BudgetScope,
    scopeId: string,
    allAccounts: Account[],
    allCategories: Category[],
    allTags: Tag[],
    i18nInstance: I18n 
): string {
    switch (scope) {
        case BudgetScope.Tag:
            const tag = findItemById(allTags, scopeId);
            return tag ? tag.name : i18nInstance.t('UNKNOWN_TAG');
        case BudgetScope.Account:
            const account = findItemById(allAccounts, scopeId); 
            return account ? account.name : i18nInstance.t('UNKNOWN_ACCOUNT');
        case BudgetScope.Category:
            const category = findItemById(allCategories, scopeId);
            return category ? category.name : i18nInstance.t('UNKNOWN_CATEGORY');
        default:
            return i18nInstance.t('UNKNOWN_SCOPE');
    }
}

/**
 * Gets the start and end dates for a given budget period relative to today.
 * @param period The BudgetPeriod enum value.
 * @returns Object with start and end moment objects.
 */
export function getPeriodDateRange(period: BudgetPeriod): { start: moment.Moment, end: moment.Moment } {
    const now = moment();
    let start: moment.Moment;
    let end: moment.Moment;

    switch (period) {
        case BudgetPeriod.Daily:
            start = now.clone().startOf('day');
            end = now.clone().endOf('day');
            break;
        case BudgetPeriod.Monthly:
            start = now.clone().startOf('month');
            end = now.clone().endOf('month');
            break;
        case BudgetPeriod.Quarterly: // Handle Quarterly as defined in the enum
            start = now.clone().startOf('quarter');
            end = now.clone().endOf('quarter');
            break;
        default:
            // Handle potential unknown cases or future additions
            console.warn(`Unknown budget period: ${period}. Defaulting to monthly.`);
            start = now.clone().startOf('month');
            end = now.clone().endOf('month');
            break;
    }
    return { start, end };
}

/**
 * Gets all descendant IDs (including the parent) for a given item in a hierarchical list.
 * @param items The hierarchical list (e.g., Categories or Tags).
 * @param parentId The ID of the parent item.
 * @returns An array of strings containing the parent ID and all descendant IDs.
 */
export function getAllDescendantIds(items: Array<{ id: string, children?: any[] }>, parentId: string): string[] {
    const ids: string[] = [];
    const parentItem = findItemById(items, parentId);

    if (!parentItem) {
        return [parentId]; // Return just the ID if item not found (might be top-level or error)
    }

    ids.push(parentId); // Add the parent ID itself

    if (parentItem.children) {
        parentItem.children.forEach(child => {
            // Find the full child item in the original list to ensure children are fetched correctly
            const fullChildItem = findItemById(items, child.id); 
            if(fullChildItem){
                 ids.push(...getAllDescendantIds(items, fullChildItem.id)); // Recursively get IDs of children
            } else {
                 ids.push(child.id); // Add child ID directly if not found (should not happen in consistent data)
            }
        });
    }
    
    return [...new Set(ids)]; 
}

/**
 * Calculates the total spending for a given budget item within its current period.
 * @param budget The budget item to calculate spending for.
 * @param transactions A list of all transactions.
 * @param allCategories The complete list of categories (for hierarchy lookup).
 * @param allTags The complete list of tags (for hierarchy lookup).
 * @returns The total spending amount for the current budget period.
 */
export function calculateBudgetSpending(
    budget: BudgetItem,
    transactions: Transaction[],
    allCategories: Category[],
    allTags: Tag[]
): number {
    // Pass the enum directly
    const { start, end } = getPeriodDateRange(budget.period);
    let relevantIds: string[] = [];

    if (budget.scope === BudgetScope.Category) {
        relevantIds = getAllDescendantIds(allCategories, budget.scopeId);
    } else if (budget.scope === BudgetScope.Tag) {
        relevantIds = getAllDescendantIds(allTags, budget.scopeId);
    } else if (budget.scope === BudgetScope.Account) {
        relevantIds = [budget.scopeId]; 
    }

    const relevantTransactions = transactions.filter(t => {
        const transactionDate = moment(t.date, 'YYYY-MM-DD HH:mm');
        if (t.type !== 'expense' || !transactionDate.isBetween(start, end, undefined, '[]')) {
            return false;
        }
        switch (budget.scope) {
            case BudgetScope.Category:
                return relevantIds.includes(t.categoryId);
            case BudgetScope.Tag:
                return t.tagIds.some(tagId => relevantIds.includes(tagId));
            case BudgetScope.Account:
                return t.accountId === budget.scopeId;
            default:
                return false;
        }
    });

    const totalSpending = relevantTransactions.reduce((sum, t) => sum + t.amount, 0);
    return totalSpending;
} 