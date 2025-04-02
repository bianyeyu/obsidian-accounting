import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, addIcon, normalizePath, Events } from 'obsidian';
import { AccountingPluginSettings, AccountingSettingTab, DEFAULT_SETTINGS } from './src/settings';
import { TransactionModal } from './src/transactionModal';
import { saveTransaction } from './src/utils';
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

	async onload() {
		await this.loadSettings();

		// 初始化语言管理器
		this.i18n = I18n.getInstance();
		
		// If user has set to follow system language, detect Obsidian's language
		if (this.settings.followSystemLanguage) {
			const obsidianLocale = this.getObsidianLocale();
			this.i18n.setLocale(obsidianLocale);
		} else {
			// Use the manually selected language
			this.i18n.setLocale(this.settings.locale);
		}

		// Initialize events
		this.events = new Events();

		// Register the accounting icon
		addIcon('accounting', ACCOUNTING_ICON);

		// Load CSS styles
		this.loadStyles();

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
	}

	/**
	 * Get Obsidian's language and map it to supported locales
	 */
	public getObsidianLocale(): SupportedLocale {
		// Get Obsidian's locale from app settings
		const obsidianLocale = this.app.vault.config?.locale || 'en';
		
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
	 * Open the transaction modal
	 */
	private openTransactionModal() {
		const modal = new TransactionModal(
			this.app,
			this,
			(transaction) => {
				// Save the transaction
				saveTransaction(this.app, transaction, this.settings)
					.then(() => {
						new Notice(this.i18n.t('SUCCESS_SAVE_TRANSACTION'));
						// Trigger transaction added event
						this.events.trigger('transaction-added', transaction);
					})
					.catch((error) => {
						console.error('Error saving transaction:', error);
						new Notice(this.i18n.t('ERROR_SAVE_TRANSACTION'));
					});
			}
		);
		
		modal.open();
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
		const trendsStylePath = this.manifest.dir + '/src/trends.css';
		this.registerDomEvent(document, 'DOMContentLoaded', () => {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = trendsStylePath;
			document.head.appendChild(link);
		});
	}
}
