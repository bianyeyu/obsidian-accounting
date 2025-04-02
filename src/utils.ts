import { App, TFile, normalizePath, moment } from 'obsidian';
import { Account, Category, Tag, Transaction, findItemById, findItemByName } from './models';
import { AccountingPluginSettings } from './settings';

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