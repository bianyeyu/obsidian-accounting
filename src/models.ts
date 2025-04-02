// Data models for the accounting plugin

/**
 * Represents a financial account (e.g., Alipay, WeChat, bank account, credit card)
 */
export interface Account {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    parentId?: string | null;
    children?: Account[];
}

/**
 * Type of transaction: income or expense
 */
export type TransactionType = 'income' | 'expense';

/**
 * Represents a category for income or expense with support for nested hierarchy
 */
export interface Category {
    id: string;
    name: string;
    type: TransactionType;
    parentId: string | null;
    children?: Category[];
}

/**
 * Represents a tag with support for nested hierarchy
 */
export interface Tag {
    id: string;
    name: string;
    description?: string; // Optional description for the tag
    parentId: string | null;
    children?: Tag[];
}

/**
 * Represents a financial transaction
 */
export interface Transaction {
    id: string;
    date: string; // ISO format
    amount: number;
    type: TransactionType;
    accountId?: string;
    categoryId: string;
    tagIds: string[];
    note?: string;
    description?: string; // Transaction description
}

/**
 * Scope of the budget (Tag, Account, or Category)
 */
export enum BudgetScope {
    Tag = 'tag',
    Account = 'account',
    Category = 'category',
}

/**
 * Time period for the budget
 */
export enum BudgetPeriod {
    Daily = 'daily',
    Monthly = 'monthly',
    Quarterly = 'quarterly',
}

/**
 * Represents a budget item
 */
export interface BudgetItem {
    id: string;
    name: string; // Optional name for the budget item
    scope: BudgetScope;
    scopeId: string; // ID of the Tag, Account, or Category
    period: BudgetPeriod;
    amount: number;
}

/**
 * Helper function to generate a unique ID
 */
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Helper function to find an item in a nested structure by ID
 */
export function findItemById<T extends { id: string, children?: T[] }>(
    items: T[],
    id: string
): T | undefined {
    for (const item of items) {
        if (item.id === id) {
            return item;
        }
        if (item.children && item.children.length > 0) {
            const found = findItemById(item.children, id);
            if (found) {
                return found;
            }
        }
    }
    return undefined;
}

/**
 * Helper function to add an item to a nested structure
 */
export function addItemToHierarchy<T extends { id: string, parentId: string | null, children?: T[] }>(
    items: T[],
    newItem: T
): T[] {
    if (!newItem.parentId) {
        return [...items, { ...newItem, children: newItem.children || [] }];
    }

    return items.map(item => {
        if (item.id === newItem.parentId) {
            return {
                ...item,
                children: [...(item.children || []), { ...newItem, children: newItem.children || [] }]
            };
        }
        if (item.children && item.children.length > 0) {
            return {
                ...item,
                children: addItemToHierarchy(item.children, newItem)
            };
        }
        return item;
    });
}

/**
 * Helper function to remove an item from a nested structure
 */
export function removeItemFromHierarchy<T extends { id: string, children?: T[] }>(
    items: T[],
    id: string
): T[] {
    return items
        .filter(item => item.id !== id)
        .map(item => {
            if (item.children && item.children.length > 0) {
                return {
                    ...item,
                    children: removeItemFromHierarchy(item.children, id)
                };
            }
            return item;
        });
}

/**
 * Helper function to update an item in a nested structure
 */
export function updateItemInHierarchy<T extends { id: string, children?: T[] }>(
    items: T[],
    updatedItem: T
): T[] {
    return items.map(item => {
        if (item.id === updatedItem.id) {
            return {
                ...updatedItem,
                children: item.children || []
            };
        }
        if (item.children && item.children.length > 0) {
            return {
                ...item,
                children: updateItemInHierarchy(item.children, updatedItem)
            };
        }
        return item;
    });
}

/**
 * Helper function to flatten a nested structure into a list
 */
export function flattenHierarchy<T extends { id: string, children?: T[] }>(
    items: T[]
): Omit<T, 'children'>[] {
    return items.reduce((acc, item) => {
        const { children, ...itemWithoutChildren } = item;
        acc.push(itemWithoutChildren as Omit<T, 'children'>);
        if (children && children.length > 0) {
            acc.push(...flattenHierarchy(children));
        }
        return acc;
    }, [] as Omit<T, 'children'>[]);
}

/**
 * Find an item by name in a hierarchical structure
 * @param items The hierarchical items to search
 * @param name The name to find
 * @returns The found item or undefined
 */
export function findItemByName<T extends { name: string, children?: T[] }>(items: T[], name: string): T | undefined {
    if (!items) return undefined;
    
    // Check each item
    for (const item of items) {
        // If this is the item we're looking for, return it
        if (item.name === name) {
            return item;
        }
        
        // If this item has children, search them
        if (item.children && item.children.length > 0) {
            const found = findItemByName(item.children, name);
            if (found) {
                return found;
            }
        }
    }
    
    // Item not found
    return undefined;
} 