# Obsidian Personal Accounting

A comprehensive personal accounting plugin for Obsidian that helps you track your income and expenses directly within your vault. Manage your finances with hierarchical accounts, categories, and tags while viewing detailed statistics and trends.

## ✨ Implemented Features

- **Transaction Management**: 
  - Add income and expense transactions with detailed information
  - Support for date, time, amount, account, category, tags, description, and notes
  - Quick entry through commands or ribbon icon

- **Customizable Organization**:
  - **Accounts**: Create and manage your accounts with support for nested accounts
  - **Categories**: Organize income and expense categories in a hierarchical structure
  - **Tags**: Add tags to transactions with support for nested tags

- **Multi-language Support**:
  - Internationalization with support for multiple languages
  - Currently supported: English and Chinese (简体中文)
  - Default follows Obsidian system language
  - Option to manually select preferred language (English/Chinese)
  - Easily extensible for additional languages

- **Enhanced Statistics View**: View detailed statistics about your finances through multiple tabs:
  - **Overview**: Summary cards and configurable charts
  - **Transactions**: Detailed transaction list with sorting and filtering
  - **Calendar**: View transactions by date in a calendar format
  - **Accounts**: View account balances and transaction history
  - **Trends**: Visualize your financial patterns over time

- **Advanced Filtering**: Filter your data by:
  - Date range (including custom date ranges)
  - Transaction type (income/expense)
  - Account
  - Category

- **Flexible Output Options**:
  - Save transactions to a dedicated file or integrate with Daily Notes
  - Customizable transaction template for formatting

## 🚧 Planned Features

- **Budgeting**: Set and track budgets for categories
- **Analysis Tab**: In-depth analysis of spending habits with recommendations
- **Reports Tab**: Generate detailed financial reports with custom parameters
- **Slash Command Parsing**: Quick transaction entry through slash commands
- **Data Import/Export**: Import from and export to CSV/Excel formats
- **Currency Support**: Add multi-currency support with exchange rates
- **Mobile Optimization**: Enhanced mobile interface
- **Data Visualization Enhancements**: Additional chart types and customization options

## 🔧 Getting Started

1. Install the plugin from the Obsidian Community Plugins browser or manually
2. Configure your accounts, categories, and tags in the plugin settings
3. Start adding transactions using the "Add Transaction" command or ribbon icon
4. View your financial statistics using the "Open Accounting Statistics" command

## 📝 Usage

### Adding Transactions

You can add transactions in two ways:

1. **Using the Command Palette**: Open the command palette (Ctrl/Cmd+P) and search for "Add Transaction"
2. **Using the Ribbon Icon**: Click the accounting icon in the ribbon

When adding a transaction, you'll need to provide:
- Date and Time
- Type (Income or Expense)
- Amount
- Account
- Category
- Tags (optional)
- Description
- Note (optional)

### Viewing Statistics

To view your financial statistics:

1. **Using the Command Palette**: Open the command palette (Ctrl/Cmd+P) and search for "Open Accounting Statistics"
2. **Using the Ribbon Icon**: Click the chart icon in the ribbon (if available)

The statistics view provides multiple tabs:

#### Overview Tab
- Filter controls for date range, transaction type, account, and category
- Summary cards showing total income, expenses, balance, and transaction count
- Configurable charts (monthly, yearly, and category breakdowns)

#### Transactions Tab
- Complete list of transactions matching your filter criteria
- Detailed information for each transaction

#### Calendar Tab
- View transactions organized by date in a calendar format
- Quick overview of daily income and expenses

#### Accounts Tab
- View all accounts with their current balances
- See hierarchical structure of nested accounts

#### Trends Tab
- Visualize your financial trends over time with interactive charts
- View monthly trends with income, expense, and balance data

### Managing Accounts, Categories, and Tags

In the plugin settings, you can:
- Add, edit, and delete accounts
- Add, edit, and delete income and expense categories
- Add, edit, and delete tags
- Create nested hierarchies for each of these elements

## ⚙️ Configuration

The plugin settings allow you to configure:

- **Language**: Choose your preferred display language
- **Output File**: The file where transactions will be saved if not using daily notes
- **Use Daily Notes**: Option to add transactions to daily notes instead of a single file
- **Daily Notes Format**: Format for daily notes filenames
- **Transaction Template**: Template for formatting transactions in markdown

## 📋 Transaction Format

By default, transactions are formatted as:

```
- {{date}} | {{type}} | {{amount}} | {{account}} | {{category}} | {{tags}} | {{description}} {{#note}}| {{note}}{{/note}}
```

You can customize this format in the plugin settings.

## 📜 License

This plugin is licensed under the MIT License.

## 🤝 Support and Contribution

If you encounter any issues or have suggestions for improvements, please open an issue on the GitHub repository.

Contributions are welcome! Please feel free to submit a pull request.

---

## For Developers

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run development build: `npm run dev`

### Building the Plugin

- Run `npm run build` to create a production build

### Releasing New Versions

1. Update `manifest.json` with your new version number and minimum Obsidian version
2. Update `versions.json` file with compatibility information
3. Create new GitHub release using your version number as the "Tag version"
4. Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments
5. Publish the release

You can simplify the version bump process by running:
- `npm version patch` for bug fixes
- `npm version minor` for new features
- `npm version major` for breaking changes

### Adding Your Plugin to the Community Plugin List

1. Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
2. Publish an initial version
3. Make sure you have a `README.md` file in the root of your repo
4. Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin
