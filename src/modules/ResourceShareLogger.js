// ==========================================
// [新增] 独立日志系统
// ==========================================
class ResourceShareLogger {
    constructor(manager) {
        this.manager = manager;
        this.uiManager = null; // 由外部注入
    }

    setUIManager(uiManager) {
        this.uiManager = uiManager;
    }

    // 获取主题颜色（复用原逻辑）
    getThemeColors() {
        const dark = window.isDarkTheme ? window.isDarkTheme() : false;
        return {
            info: dark ? '#60cdff' : '#0078d4',
            success: dark ? '#6ccf70' : '#107c10',
            warning: dark ? '#ffb900' : '#ff8c00',
            danger: dark ? '#f1707b' : '#d13438',
            cache: dark ? '#c48bf2' : '#8a2be2',
            request: dark ? '#4ec2b8' : '#008272',
            pageType: dark ? '#9cdcfe' : '#2b88d8',
            sourceFile: dark ? '#ce9178' : '#a1260d',
            message: dark ? '#d4d4d4' : '#323130'
        };
    }

    log(message, category = 'info') {
        const colors = this.getThemeColors();
        const timestamp = new Date().toLocaleTimeString();
        const pageType = this.manager.isTopLevel ? 'Top' : 'Sub';
        const logMessage = `[${timestamp}] ${message}`;

        // --- 1. DevTools 输出 ---
        const allowedDevTypes = getAllowedLogTypes('DEVTOOLS');
        if (allowedDevTypes.includes(category)) {
            const styles = {
                info: { prefix: '%c[INFO]', style: `color: ${colors.info}; font-weight: bold;` },
                success: { prefix: '%c[SUCCESS]', style: `color: ${colors.success}; font-weight: bold;` },
                warning: { prefix: '%c[WARNING]', style: `color: ${colors.warning}; font-weight: bold;` },
                danger: { prefix: '%c[ERROR]', style: `color: ${colors.danger}; font-weight: bold;` },
                cache: { prefix: '%c[CACHE]', style: `color: ${colors.cache}; font-weight: bold;` },
                request: { prefix: '%c[REQUEST]', style: `color: ${colors.request}; font-weight: bold;` }
            };
            const catStyle = styles[category] || styles.info;
            const fn = category === 'danger' ? console.error : console.log;
            fn.call(console,
                `${catStyle.prefix}%c[${pageType}]%c[${RS_CONFIG.SOURCE_FILE}]%c ${logMessage}`,
                catStyle.style,
                `color: ${colors.pageType}; font-weight: bold;`,
                `color: ${colors.sourceFile}; font-style: italic;`,
                `color: ${colors.message};`
            );
        }

        // --- 2. UI 输出 ---
        // 只有启用了 UI 且日志级别允许时才输出
        if (RS_CONFIG.ENABLE_UI && this.uiManager) {
            const allowedUITypes = getAllowedLogTypes('UI');
            if (allowedUITypes.includes(category)) {
                this.uiManager.log(message, category);
            }
        }
        
        // --- 3. 严重错误触发 ---
        if (category === 'danger' && message.includes('Unrecoverable')) {
            const pseudoError = new Error(message);
            this.manager.handleCriticalError(pseudoError, 'SystemLog');
        }
    }
}