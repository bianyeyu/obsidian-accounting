import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, addIcon, normalizePath, Events, TFile } from 'obsidian';
import * as moment from 'moment';
import { AccountingPluginSettings, AccountingSettingTab, DEFAULT_SETTINGS } from './src/settings';
import { TransactionModal } from './src/transactionModal';
import { saveTransaction, formatTransaction, normalizeTransactionDate, parseTransactionsFromFile, getDatePart } from './src/utils';
import { StatsView, STATS_VIEW_TYPE } from './src/statsView';
import { Account, Category, Tag, Transaction, TransactionType } from './src/models';
import { I18n } from './src/locales/i18n';
import { SupportedLocale } from './src/locales';

// Define the accounting icon
const ACCOUNTING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="3" width="20" height="18" rx="2" ry="2"></rect>
  <line x1="2" y1="8" x2="22" y2="8"></line>
  <line x1="12" y1="12" x2="18" y2="12"></line>
  <line x1="12" y1="16" x2="18" y2="16"></line>
  <line x1="6" y1="12" x2="8" y2="12"></line>
  <line x1="6" y1="16" x2="8" y2="16"></line>
</svg>`;

export default class AccountingPlugin extends Plugin {
	settings: AccountingPluginSettings;
	events: Events;
	i18n: I18n; // 添加I18n实例
	public transactions: Transaction[] = []; // Store loaded transactions

	async onload() {
		await this.loadSettings();

		// Initialize language manager
		this.i18n = I18n.getInstance();
		
		// Set locale based on settings
		if (this.settings.followSystemLanguage) {
			const obsidianLocale = this.getObsidianLocale();
			this.i18n.setLocale(obsidianLocale);
		} else {
			this.i18n.setLocale(this.settings.locale);
		}

		// Initialize events
		this.events = new Events();

		// Register the accounting icon
		addIcon('accounting', ACCOUNTING_ICON);

		// Load CSS styles
		this.loadStyles();

		// Initial load of transactions
		await this.loadAllTransactions(); 

		// Add ribbon icon
		this.addRibbonIcon('accounting', this.i18n.t('ADD_TRANSACTION'), (evt: MouseEvent) => {
			this.openTransactionModal();
		});

		// Add command to open transaction modal
		this.addCommand({
			id: 'open-transaction-modal',
			name: this.i18n.t('ADD_TRANSACTION'),
			callback: () => {
				this.openTransactionModal();
			}
		});

		// Add slash command for quick transaction entry
		this.addCommand({
			id: 'quick-transaction',
			name: this.i18n.t('TRANSACTION'),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				// Get the current line
				const cursor = editor.getCursor();
				const line = editor.getLine(cursor.line);
				
				// Check if the line starts with a slash command
				if (line.startsWith('/accounting') || line.startsWith('/transaction')) {
					// Parse the command
					this.handleSlashCommand(line, editor, view);
				} else {
					// Open the transaction modal
					this.openTransactionModal();
				}
			}
		});

		// Register the stats view
		this.registerView(
			STATS_VIEW_TYPE,
			(leaf) => new StatsView(leaf, this)
		);

		// Add command to open stats view
		this.addCommand({
			id: 'open-accounting-stats',
			name: this.i18n.t('STATISTICS'),
			callback: () => {
				this.activateStatsView();
			}
		});

		// Add settings tab
		this.addSettingTab(new AccountingSettingTab(this.app, this));

		// Optional: Reload transactions when relevant files change
		// this.registerEvent(
        //     this.app.metadataCache.on('changed', (file) => {
        //         // Check if the changed file is relevant (e.g., daily note or output file)
        //         if (this.isRelevantFile(file.path)) {
        //             this.loadAllTransactions();
        //         }
        //     })
        // );
	}

	/**
	 * Load all transactions based on settings
	 */
	async loadAllTransactions(): Promise<void> {
        this.transactions = [];
        try {
            if (this.settings.useDailyNotes) {
                const files = this.app.vault.getMarkdownFiles();
                let dailyNoteFormat = this.settings.dailyNotesFormat;
                // Optional: Try to get format from Daily Notes/Calendar plugin if needed

                for (const file of files) {
                    // Use moment directly for parsing - Ensure standard call
                    if (moment(file.basename, dailyNoteFormat, true).isValid()) { 
                        const fileTransactions = await parseTransactionsFromFile(this.app, file.path, this.settings);
                        this.transactions.push(...fileTransactions);
                    }
                }
            } else {
                this.transactions = await parseTransactionsFromFile(this.app, this.settings.outputFile, this.settings);
            }
            console.log('Loaded transactions:', this.transactions.length);
             // Trigger an event to notify views (like StatsView) that transactions have been loaded/reloaded
             this.events.trigger('transactions-updated');
        } catch (error) {
            console.error('Error loading transactions:', error);
            new Notice('Error loading transactions. Check console for details.');
        }
    }

	/**
	 * Get Obsidian's language and map it to supported locales
	 */
	public getObsidianLocale(): SupportedLocale {
		// Use moment's locale as Obsidian's setting is not directly accessible reliably
		const obsidianLocale = moment.locale(); // Get current moment locale 
		
		// Map Obsidian's locale to our supported locales
		if (obsidianLocale.startsWith('zh')) {
			return 'zh-CN';
		}
		
		// Default to English for other languages
		return 'en';
	}

	onunload() {
		// Clean up
		this.app.workspace.detachLeavesOfType(STATS_VIEW_TYPE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Open the transaction modal for adding a new transaction
	 */
	private openTransactionModal() {
		const modal = new TransactionModal(
			this.app,
			this,
			async (transaction) => {
				// Save the new transaction
				await saveTransaction(this.app, transaction, this.settings);
				new Notice(this.i18n.t('SUCCESS_SAVE_TRANSACTION'));
				// Reload transactions and notify views
				await this.loadAllTransactions();
				this.events.trigger('transaction-added', transaction); // Keep original event if needed
			}
		);
		
		modal.open();
	}

	/**
	 * Open the transaction modal for editing an existing transaction
	 */
	async editTransaction(transactionToEdit: Transaction): Promise<void> {
		const modal = new TransactionModal(
			this.app,
			this, 
			async (updatedTransaction) => {
				// Handle the updated transaction
				await this.updateTransaction(updatedTransaction);
				new Notice('Transaction updated successfully'); // Add translation key if needed
				// Reload transactions and notify views
				await this.loadAllTransactions(); 
				// Optionally trigger a specific update event
				// this.events.trigger('transaction-updated', updatedTransaction);
			},
			transactionToEdit // Pass the transaction to edit
		);

		modal.open();
	}

	/**
	 * Update an existing transaction in its file
	 * NOTE: This is a complex operation and needs careful implementation.
	 */
	private async updateTransaction(updatedTransaction: Transaction): Promise<void> {
		// 1. Find the original transaction in this.transactions to get its original date (for finding the file)
		const originalTransaction = this.transactions.find(t => t.id === updatedTransaction.id);
		if (!originalTransaction) {
			console.error('Cannot update transaction: Original not found.');
			new Notice('Error updating transaction: Original not found.');
			return;
		}

		// 2. Determine the file path based on the ORIGINAL transaction's date
		let filePath: string;
		if (this.settings.useDailyNotes) {
			const originalDateOnly = getDatePart(originalTransaction.date);
			const date = moment(originalDateOnly, 'YYYY-MM-DD'); // Use moment here
			const fileName = date.format(this.settings.dailyNotesFormat);
			filePath = `${fileName}.md`;
		} else {
			filePath = this.settings.outputFile;
		}

		// 3. Read the file content
		const normalizedPath = normalizePath(filePath);
		const file = this.app.vault.getAbstractFileByPath(normalizedPath) as TFile; // Use imported TFile
		if (!file) {
			console.error(`Cannot update transaction: File not found at ${filePath}`);
			new Notice(`Error updating transaction: File not found.`);
			return;
		}
		const content = await this.app.vault.read(file);
		const lines = content.split('\n');

		// 4. Find and replace the line
		//    THIS IS THE TRICKY PART. How are transactions uniquely identified in the line?
		//    Assuming the format includes the ID, e.g., `- {{date}} | ... | id={{id}}`
		//    Or relying on exact match of the original formatted string might be fragile.
		//    A robust solution might require parsing each line or adding explicit IDs.
		//    For now, let's try finding by ID if it's part of the format, or fall back to searching for original formatted line.
		
		let foundIndex = -1;
		// Try finding by ID embedded in the line (adjust regex/logic as needed)
		const idRegex = new RegExp(`id=${originalTransaction.id}( |$)`); 
		foundIndex = lines.findIndex(line => line.startsWith('- ') && idRegex.test(line));

		// Fallback: Find by matching the originally formatted string (less reliable)
		if (foundIndex === -1) {
			const originalFormatted = formatTransaction(originalTransaction, this.settings.transactionTemplate, this.settings.accounts, this.settings.categories, this.settings.tags);
			foundIndex = lines.findIndex(line => line.trim() === originalFormatted.trim());
		}

		if (foundIndex === -1) {
			console.error(`Cannot update transaction: Line for ID ${originalTransaction.id} not found in ${filePath}`);
			new Notice(`Error updating transaction: Could not find original record.`);
			return;
		}

		// 5. Format the updated transaction
		const updatedFormatted = formatTransaction(updatedTransaction, this.settings.transactionTemplate, this.settings.accounts, this.settings.categories, this.settings.tags);

		// 6. Replace the line and save
		lines[foundIndex] = updatedFormatted;
		await this.app.vault.modify(file, lines.join('\n'));

		// 7. Handle potential file move if date changed and using daily notes
		if (this.settings.useDailyNotes) {
			const newDateOnly = getDatePart(updatedTransaction.date);
			if (newDateOnly !== getDatePart(originalTransaction.date)) {
				// Transaction date changed, need to move it to the new daily note
				// This involves removing it from the old file (already done by replacing) 
				// and appending it to the new file.
				await saveTransaction(this.app, updatedTransaction, this.settings); // Save to potentially new file
				
				// Clean up the placeholder line in the original file if it wasn't the only content
				// (Re-reading and saving might be safer)
				const oldContent = await this.app.vault.read(file);
				const oldLines = oldContent.split('\n');
				// If the line we replaced was the only transaction, the file might just have that line.
				// Simple check: if the line exists and is just the updated one, remove it.
				// A more robust check is needed depending on file structure.
				if (oldLines[foundIndex] === updatedFormatted) { 
					 oldLines.splice(foundIndex, 1);
					 await this.app.vault.modify(file, oldLines.join('\n'));
				}
			}
		}
	}

	/**
	 * Handle slash command for quick transaction entry
	 */
	private handleSlashCommand(line: string, editor: Editor, view: MarkdownView) {
		// Remove the slash command prefix
		const commandText = line.replace(/^\/(accounting|transaction)\s*/, '').trim();
		
		if (!commandText) {
			// If no additional text, open the modal
			this.openTransactionModal();
			return;
		}
		
		// TODO: Implement parsing of command text for quick entry
		// For now, just open the modal
		this.openTransactionModal();
		
		// Remove the slash command line
		editor.replaceRange('', 
			{ line: editor.getCursor().line, ch: 0 },
			{ line: editor.getCursor().line, ch: line.length }
		);
	}

	/**
	 * Activate the stats view
	 */
	private async activateStatsView() {
		// Check if the view is already open
		const existing = this.app.workspace.getLeavesOfType(STATS_VIEW_TYPE);
		
		if (existing.length) {
			// Focus the existing leaf
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		
		// Open the view in a new leaf
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: STATS_VIEW_TYPE,
				active: true
			});
			
			// Focus the new leaf
			const leaves = this.app.workspace.getLeavesOfType(STATS_VIEW_TYPE);
			if (leaves.length > 0) {
				this.app.workspace.revealLeaf(leaves[0]);
			}
		}
	}

	/**
	 * Load custom CSS styles
	 */
	private loadStyles() {
		// Load trends styles
		// const trendsStylePath = this.manifest.dir + '/src/trends.css'; // Example, adjust if needed
		// this.registerDomEvent(document, 'DOMContentLoaded', () => {
		// 	const link = document.createElement('link');
		// 	link.rel = 'stylesheet';
		// 	link.href = trendsStylePath;
		// 	document.head.appendChild(link);
		// });
	}
}
