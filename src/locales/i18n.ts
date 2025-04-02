import { SupportedLocale, Translation, DEFAULT_LOCALE } from './index';
import en from './en';
import zhCN from './zh-CN';

/**
 * 语言管理器，负责管理多语言支持
 */
export class I18n {
    private static instance: I18n;
    private locale: SupportedLocale;
    private translations: Record<SupportedLocale, Translation> = {
        'en': en,
        'zh-CN': zhCN
    };

    private constructor(locale: SupportedLocale = DEFAULT_LOCALE) {
        this.locale = locale;
    }

    /**
     * 获取语言管理器实例（单例模式）
     */
    public static getInstance(): I18n {
        if (!I18n.instance) {
            I18n.instance = new I18n();
        }
        return I18n.instance;
    }

    /**
     * 设置当前语言
     */
    public setLocale(locale: SupportedLocale): void {
        if (this.translations[locale]) {
            this.locale = locale;
        } else {
            console.error(`Locale ${locale} not supported, falling back to ${DEFAULT_LOCALE}`);
            this.locale = DEFAULT_LOCALE;
        }
    }

    /**
     * 获取当前语言
     */
    public getLocale(): SupportedLocale {
        return this.locale;
    }

    /**
     * 获取翻译文本
     */
    public t(key: keyof Translation): string {
        const translation = this.translations[this.locale];
        if (translation && translation[key]) {
            return translation[key];
        }
        
        // 如果找不到翻译，使用默认语言
        const defaultTranslation = this.translations[DEFAULT_LOCALE];
        if (defaultTranslation && defaultTranslation[key]) {
            return defaultTranslation[key];
        }
        
        // 如果默认语言也没有，返回键名
        console.warn(`Translation key "${key}" not found in any language`);
        return key;
    }
}