// ==========================================
// UI 管理器类 (V1.3.7 - 移除日志级别判断逻辑)
// ==========================================
class ResourceShareUI {
    constructor(manager) {
        this.manager = manager;
        this.isVisible = true;
        this.consoleVisible = true;
        
        // 仅当启用 UI 时才初始化
        if (RS_CONFIG.ENABLE_UI) {
            this.initStyles();
            this.initDOM();
            this.startSplashScreen();
        }
    }

    initStyles() {
        const style = document.createElement('style');
        style.id = 'rs-ui-styles';
        style.textContent = `
            @font-face { font-family: 'Segoe UI Variable'; src: local('Segoe UI Variable Display'), local('Segoe UI Variable Text'), local('Segoe UI'); }
            * { box-sizing: border-box; }
            
            #rs-splash-screen {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: #ffffff; z-index: ${RS_CONFIG.Z_INDEX.SPLASH};
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                transition: opacity 0.8s ease-in-out, transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
                font-family: ${RS_CONFIG.UI_STYLE.FONT_FAMILY}; color: #1d1d1f;
            }
            #rs-splash-screen.hidden { opacity: 0; pointer-events: none; transform: scale(1.05); }
            
            .rs-splash-title { font-size: 16px; font-weight: 600; letter-spacing: 1px; color: #0078d4; margin-bottom: 8px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; }
            
            .rs-loader {
                width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #0078d4; border-radius: 50%;
                animation: rs-spin 1s linear infinite; margin-bottom: 15px;
            }
            @keyframes rs-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

            #rs-progress-bar {
                position: fixed; top: 0; left: 0; width: 0%; height: 4px; background: #0078d4;
                z-index: ${RS_CONFIG.Z_INDEX.PROGRESS}; transition: width 0.4s cubic-bezier(0.33, 1, 0.68, 1);
                box-shadow: 0 2px 5px rgba(0, 120, 212, 0.3);
            }
            #rs-progress-bar.complete { width: 100% !important; transition: width 0.3s ease, opacity 0.5s ease 0.3s; opacity: 0; }

            #rs-overlay-panel {
                position: fixed; bottom: 24px; left: 24px; right: 24px; max-height: 35vh;
                background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(${RS_CONFIG.UI_STYLE.BLUR_VALUE}) saturate(120%);
                -webkit-backdrop-filter: blur(${RS_CONFIG.UI_STYLE.BLUR_VALUE}) saturate(120%);
                border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.6);
                box-shadow: 0 8px 32px rgba(0, 0, 0, ${RS_CONFIG.UI_STYLE.SHADOW_OPACITY}), 0 0 0 1px rgba(0,0,0,0.02);
                z-index: ${RS_CONFIG.Z_INDEX.PANEL}; display: flex; flex-direction: column;
                transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
                font-family: ${RS_CONFIG.UI_STYLE.MONO_FONT}; overflow: hidden;
            }
            #rs-overlay-panel.rs-closed { transform: translateY(110%) scale(0.95); opacity: 0; pointer-events: none; }

            .rs-panel-header {
                display: flex; justify-content: space-between; align-items: center; padding: 8px 16px;
                background: rgba(255, 255, 255, 0.5); border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                cursor: grab; user-select: none; font-family: ${RS_CONFIG.UI_STYLE.FONT_FAMILY};
            }
            .rs-panel-title { color: #202020; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
            .rs-status-indicator { width: 8px; height: 8px; background-color: #107c10; border-radius: 50%; box-shadow: 0 0 4px #107c10; transition: background-color 0.3s; }
            .rs-status-indicator.error { background-color: #d13438; box-shadow: 0 0 4px #d13438; }
            .rs-controls { display: flex; gap: 4px; }
            .rs-btn { background: transparent; border: 1px solid transparent; color: #5e5e5e; padding: 4px 10px; font-size: 12px; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-family: ${RS_CONFIG.UI_STYLE.FONT_FAMILY}; }
            .rs-btn:hover { background: rgba(0, 0, 0, 0.04); color: #202020; }
            .rs-btn.active { background: rgba(0, 120, 212, 0.1); color: #0078d4; font-weight: 600; }
            .rs-btn-close { color: #d13438; padding: 4px 8px; }
            .rs-btn-close:hover { background: rgba(209, 52, 56, 0.1); }

            #rs-console-output {
                flex: 1; overflow-y: auto; padding: 12px 16px; font-size: 11px; line-height: 1.5; color: #d4d4d4;
                background-color: #1e1e1e; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent;
            }
            #rs-console-output::-webkit-scrollbar { width: 6px; }
            #rs-console-output::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
            .rs-log-entry { margin-bottom: 3px; border-left: 2px solid transparent; padding-left: 8px; word-break: break-all; opacity: 0; animation: rsFadeIn ${RS_CONFIG.ANIMATION.LOG_FADE_IN}ms forwards; }
            @keyframes rsFadeIn { to { opacity: 1; } }
            .rs-log-info { border-color: #0078d4; color: #60cdff; background: rgba(0, 120, 212, 0.1); }
            .rs-log-success { border-color: #107c10; color: #6ccf70; background: rgba(16, 124, 16, 0.1); }
            .rs-log-warning { border-color: #ffb900; color: #ffb900; background: rgba(255, 185, 0, 0.1); }
            .rs-log-danger { border-color: #d13438; color: #f1707b; background: rgba(209, 52, 56, 0.15); }
            .rs-log-cache { border-color: #c48bf2; color: #c48bf2; background: rgba(196, 139, 242, 0.1); }

            #rs-fatal-error-screen {
                display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(32, 32, 32, 0.6); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                z-index: ${RS_CONFIG.Z_INDEX.ERROR}; align-items: center; justify-content: center;
                font-family: ${RS_CONFIG.UI_STYLE.FONT_FAMILY};
            }
            .rs-error-card {
                background: #fbfbfb; width: 90%; max-width: 600px; max-height: 85vh; border-radius: 8px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column;
                border: 1px solid rgba(0,0,0,0.1); animation: rsSlideUp ${RS_CONFIG.ANIMATION.ERROR_SLIDE_UP}ms cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes rsSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            .rs-error-header { padding: 24px 24px 10px 24px; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; gap: 16px; }
            .rs-error-icon { width: 32px; height: 32px; background: #d13438; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; flex-shrink: 0; }
            .rs-error-title { font-size: 18px; font-weight: 600; color: #201f1e; line-height: 1.3; }
            .rs-error-desc { font-size: 13px; color: #605e5c; margin-top: 4px; line-height: 1.5; }
            .rs-error-content { padding: 16px 24px; overflow-y: auto; flex: 1; }
            .rs-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #605e5c; margin-bottom: 8px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
            .rs-section-title:first-child { margin-top: 0; }
            .rs-stack-trace { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 4px; font-family: ${RS_CONFIG.UI_STYLE.MONO_FONT}; font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 150px; overflow-y: auto; border: 1px solid #333; }
            .rs-diagnosis-box { background: #fdefeb; border-left: 3px solid #d13438; padding: 12px; border-radius: 2px; font-size: 13px; color: #3b1305; line-height: 1.6; }
            .rs-error-footer { padding: 16px 24px; background: #f3f3f3; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end; gap: 12px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; }
            .rs-btn-primary { background: #0078d4; color: white; border: 1px solid #0078d4; padding: 6px 20px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; min-width: 80px; }
            .rs-btn-primary:hover { background: #106ebe; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .rs-btn-secondary { background: white; color: #323130; border: 1px solid #8a8886; padding: 6px 20px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; min-width: 80px; }
            .rs-btn-secondary:hover { background: #f3f2f1; }
        `;
        document.head.appendChild(style);
    }

    // 初始化 DOM 结构
    initDOM() {
        // 1. 启动页
        const splash = document.createElement('div');
        splash.id = 'rs-splash-screen';
        splash.innerHTML = `<div class="rs-loader"></div><div class="rs-splash-title">RS-LCDN System V${RS_CONFIG.VERSION}</div>`;
        document.documentElement.appendChild(splash);
        this.splashElement = splash;

        // 2. 进度条
        const progress = document.createElement('div');
        progress.id = 'rs-progress-bar';
        document.documentElement.appendChild(progress);
        this.progressBarElement = progress;

        // 3. 主面板
        const panel = document.createElement('div');
        panel.id = 'rs-overlay-panel';
        panel.innerHTML = `
            <div class="rs-panel-header">
                <div class="rs-panel-title"><div class="rs-status-indicator"></div><span>ResourceShare Log</span></div>
                <div class="rs-controls">
                    <button class="rs-btn active" id="rs-toggle-console">日志</button>
                    <button class="rs-btn active" id="rs-toggle-overlay">隐藏</button>
                    <button class="rs-btn rs-btn-close" id="rs-close-btn">×</button>
                </div>
            </div>
            <div id="rs-console-output"></div>
        `;
        document.documentElement.appendChild(panel);
        this.overlayPanel = panel;
        this.consoleOutput = panel.querySelector('#rs-console-output');

        // 4. 错误屏幕
        const errorScreen = document.createElement('div');
        errorScreen.id = 'rs-fatal-error-screen';
        errorScreen.innerHTML = `
            <div class="rs-error-card">
                <div class="rs-error-header">
                    <div class="rs-error-icon">!</div>
                    <div><div class="rs-error-title">系统严重错误</div><div class="rs-error-desc">ResourceShare 遇到不可恢复的错误。</div></div>
                </div>
                <div class="rs-error-content">
                    <div class="rs-section-title"><span>智能诊断与建议</span></div>
                    <div id="rs-diagnosis-content" class="rs-diagnosis-box">正在检查...</div>
                    <div class="rs-section-title"><span>错误堆栈跟踪</span><button id="rs-copy-btn" style="background:none; border:none; color:#0078d4; cursor:pointer; font-size:12px;">复制信息</button></div>
                    <div id="rs-stack-content" class="rs-stack-trace">等待详细信息...</div>
                </div>
                <div class="rs-error-footer"><button id="rs-refresh-btn" class="rs-btn-primary">刷新页面</button></div>
            </div>
        `;
        document.documentElement.appendChild(errorScreen);
        this.errorScreen = errorScreen;

        this.bindEvents();
    }

    bindEvents() {
        this.errorScreen.querySelector('#rs-refresh-btn').addEventListener('click', () => window.location.reload());
        this.errorScreen.querySelector('#rs-copy-btn').addEventListener('click', () => {
            const stackText = document.getElementById('rs-stack-content').textContent;
            const diagText = document.getElementById('rs-diagnosis-content').innerText;
            navigator.clipboard.writeText(`=== 错误日志 ===\n${stackText}\n\n=== 诊断信息 ===\n${diagText}`).then(() => {
                const btn = this.errorScreen.querySelector('#rs-copy-btn');
                const originalText = btn.textContent; btn.textContent = '已复制！'; setTimeout(() => btn.textContent = originalText, 2000);
            });
        });
        document.getElementById('rs-close-btn').addEventListener('click', () => this.setOverlayVisible(false));
        const overlayBtn = document.getElementById('rs-toggle-overlay');
        overlayBtn.addEventListener('click', () => {
            this.setOverlayVisible(!this.isVisible);
            overlayBtn.classList.toggle('active', this.isVisible);
            overlayBtn.textContent = this.isVisible ? '隐藏' : '显示';
        });
        const consoleBtn = document.getElementById('rs-toggle-console');
        consoleBtn.addEventListener('click', () => {
            this.consoleVisible = !this.consoleVisible;
            consoleBtn.classList.toggle('active', this.consoleVisible);
            this.consoleOutput.style.display = this.consoleVisible ? 'block' : 'none';
        });
    }

    startSplashScreen() {
        setTimeout(() => {
            this.splashElement.classList.add('hidden');
            setTimeout(() => { if (this.splashElement.parentNode) this.splashElement.parentNode.removeChild(this.splashElement); }, RS_CONFIG.ANIMATION.SPLASH_HIDE);
        }, 1500);
    }

    setOverlayVisible(visible) {
        this.isVisible = visible;
        if (visible) this.overlayPanel.classList.remove('rs-closed');
        else this.overlayPanel.classList.add('rs-closed');
    }

    // V1.3.7: 此方法不再判断日志级别，仅负责渲染
    log(message, type) {
        if (!this.consoleOutput) return;
        const entry = document.createElement('div');
        entry.className = `rs-log-entry rs-log-${type}`;
        const time = new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + new Date().getMilliseconds().toString().padStart(3, '0');
        entry.textContent = `[${time}] ${message}`;
        this.consoleOutput.appendChild(entry);
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
    }

    updateProgress(current, total) {
        if (total === 0) return;
        const percent = Math.min(100, Math.round((current / total) * 100));
        this.progressBarElement.style.width = percent + '%';
        const title = document.querySelector('.rs-panel-title span');
        if (title) title.textContent = `资源加载中... ${percent}%`;
    }

    finishLoading() {
        this.progressBarElement.classList.add('complete');
        setTimeout(() => { if (this.progressBarElement.parentNode) this.progressBarElement.parentNode.removeChild(this.progressBarElement); }, RS_CONFIG.ANIMATION.PROGRESS_COMPLETE);
        const status = document.querySelector('.rs-status-indicator');
        if (status) status.style.backgroundColor = '#107c10';
        const title = document.querySelector('.rs-panel-title span');
        if (title) title.textContent = '系统就绪';
        setTimeout(() => {
            this.setOverlayVisible(false);
            setTimeout(() => {
                if (this.overlayPanel && this.overlayPanel.parentNode) this.overlayPanel.parentNode.removeChild(this.overlayPanel);
                if (this.errorScreen && this.errorScreen.parentNode) this.errorScreen.parentNode.removeChild(this.errorScreen);
                const style = document.getElementById('rs-ui-styles');
                if (style && style.parentNode) style.parentNode.removeChild(style);
            }, RS_CONFIG.ANIMATION.PANEL_HIDE);
        }, 2000);
    }

    showFatalError(error, diagnosticsHTML) {
        const stackEl = document.getElementById('rs-stack-content');
        const diagEl = document.getElementById('rs-diagnosis-content');
        if (error) stackEl.textContent = error.stack || error.message || String(error);
        else stackEl.textContent = "无可用的堆栈跟踪。";
        if (diagnosticsHTML) diagEl.innerHTML = diagnosticsHTML;
        else diagEl.innerHTML = "<span style='color:#666'>未找到特定的诊断信息。</span>";
        this.errorScreen.style.display = 'flex';
        const status = document.querySelector('.rs-status-indicator');
        if (status) { status.classList.add('error'); status.style.backgroundColor = '#d13438'; status.style.boxShadow = '0 0 5px #d13438'; }
        this.progressBarElement.style.opacity = '0';
    }
}