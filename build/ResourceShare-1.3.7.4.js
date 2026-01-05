/**
 * 高性能跨资源共享系统 - (架构重构 V1.3.7.4)
 * 
 * 【V1.3.7.4 更新内容】
 * 1. 修正 <resource-share> 脚本 SourceURL 路径映射：
 *    - 现在生成完整路径 + VM_前缀文件名 (如 https://.../3.6.0/VM_jquery.min.js)。
 *    - 保留内联脚本的虚拟路径规则。
 * 
 * Copyright (c) 2026 GVSDS Team
 * Licensed under MIT License
 */

'use strict';
// ======================== 文件检查 ========================
// （V1.3.7.4）
function getFileNameFromPath(path) {
  if (!path) return '';
  return path.split(/[?#]/)[0].replace(/\\/g, '/').split('/').pop() || '';
}
function getCurrentScriptFileName() {
  if (document.currentScript) { return getFileNameFromPath(document.currentScript.src); }
  const scripts = document.scripts;
  return getFileNameFromPath(scripts[scripts.length - 1].src);
}
const ResourceShareFileName = getCurrentScriptFileName();

// ======================== 全局常量配置（单文件内集中管理）========================
/**
 * 深度合并两个对象（后者覆盖前者同名属性，嵌套对象递归合并）(V1.3.7.4)
 */
function deepMerge(target = {}, source = {}) {
  const merged = { ...target };
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        merged[key] = deepMerge(target[key], source[key]);
      } else {
        merged[key] = target.hasOwnProperty(key) ? target[key] : source[key];
      }
    }
  }
  return merged;
}

// 辅助函数：获取当前配置允许的日志类型数组
function getAllowedLogTypes(target) {
  const levelKey = target === 'UI' ? RS_CONFIG.LOG_LEVEL_UI : RS_CONFIG.LOG_LEVEL_DEVTOOLS;
  return RS_CONFIG.LOG_LEVEL_MAP[levelKey] || RS_CONFIG.LOG_LEVEL_MAP.debug;
}

// 主题检测辅助函数 (挂载到 window 方便 Logger 调用)
window.isDarkTheme = () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    try {
        const bgColor = window.getComputedStyle(document.body).backgroundColor;
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            return brightness < 128;
        }
    } catch (e) {}
    return false;
};

// [辅助] 生成随机字符串
function generateRandomString(length) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
window.RS_CONFIG = deepMerge(window.RS_CONFIG || {}, {
  // 版本/版权
  VERSION: '1.3.7.4',
  COPYRIGHT: '© 2026 GVSDS Team',
  SOURCE_FILE: 'ResourceShare.js',
  
  // 功能开关
  ENABLE_UI: true,

  // 阈值配置
  POST_MESSAGE_LIMIT: 1 * 1024 * 1024,
  BLOB_LIMIT: 1024 * 1024 * 1024,
  SCRIPT_TIMEOUT: 5 * 60 * 1000,
  PING_INTERVAL: 100,
  PING_TIMEOUT: 5000,
  REQUEST_TIMEOUT: 10000,
  
  // 重试机制配置
  RETRY: {
    COUNT: 3,
    DELAY: 1500
  },

  // Z-Index层级
  Z_INDEX: {
    SPLASH: 2147483647,
    PROGRESS: 2147483646,
    PANEL: 2147483645,
    ERROR: 2147483648
  },
  
  // 日志级别配置
  LOG_LEVEL_UI: 'debug',
  LOG_LEVEL_DEVTOOLS: 'error',

  // 日志级别定义映射
  LOG_LEVEL_MAP: {
    debug: ['info', 'success', 'warning', 'danger', 'cache', 'request'],
    info: ['info', 'success', 'warning', 'danger'],
    error: ['danger'],
    none: []
  },

  // UI动画时长
  ANIMATION: {
    SPLASH_HIDE: 800,
    PROGRESS_COMPLETE: 800,
    PANEL_HIDE: 500,
    ERROR_SLIDE_UP: 400,
    LOG_FADE_IN: 200
  },
  
  // 样式常量
  UI_STYLE: {
    FONT_FAMILY: "'Segoe UI Variable', 'Segoe UI', sans-serif",
    MONO_FONT: "'Consolas', 'Monaco', monospace",
    BLUR_VALUE: '20px',
    SHADOW_OPACITY: 0.12
  }
});
// ==========================================
// 快速代码诊断系统
// ==========================================
const DIAGNOSTIC_RULES = [
    {
        id: 'jquery_missing',
        check: (error) => error.message && (error.message.includes('$ is not defined') || error.message.includes('jQuery is not defined')),
        diagnose: (error) => `<strong>jQuery 依赖错误:</strong><br/>脚本依赖 jQuery，但似乎未加载或加载顺序错误。<br/><em>解决方案: 请检查 resource-share 中 jQuery 是否在其他依赖库之前声明。</em>`,
        headerStyle: 'color: #ff3b30; font-weight: bold; font-size: 14px;',
        bodyStyle: 'color: #fbff00; font-size: 12px;'
    },
    {
        id: 'layui_missing',
        check: (error) => error.message && (error.message.includes('layui is not defined') || error.message.includes('Layui is not defined')),
        diagnose: (error) => `<strong>Layui 缺失:</strong><br/>脚本依赖 Layui，但 Layui 似乎未加载。<br/><em>解决方案: 确保已正确引入 Layui 相关资源。</em>`,
        headerStyle: 'color: #ff9500; font-weight: bold; font-size: 14px;',
        bodyStyle: 'color: #ffe4b5; font-size: 12px;'
    },
    {
        id: 'syntax_error',
        check: (error) => error.name === 'SyntaxError',
        diagnose: (error) => `<strong>语法错误:</strong><br/>代码中存在语法错误。<br/><em>详情: ${error.message}</em>`,
        headerStyle: 'color: #8e0000; font-weight: bold; font-size: 14px;',
        bodyStyle: 'color: #ffb3ba; font-size: 12px;'
    },
    {
        id: 'type_error',
        check: (error) => error.name === 'TypeError',
        diagnose: (error) => `<strong>类型错误:</strong><br/>尝试调用 undefined/null 的方法或访问属性。<br/><em>详情: ${error.message}</em>`,
        headerStyle: 'color: #ff3a30; font-weight: bold; font-size: 14px;',
        bodyStyle: 'color: #ffd6d6; font-size: 12px;'
    },
    {
        id: 'network_error',
        check: (error) => error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('4') || error.message.includes('5')),
        diagnose: (error) => `<strong>网络错误:</strong><br/>资源无法获取，可能是断网或服务器故障。<br/><em>解决方案: 请检查网络连接。</em>`,
        headerStyle: 'color: #ff2d55; font-weight: bold; font-size: 14px;',
        bodyStyle: 'color: #ffc7d0; font-size: 12px;'
    },
    {
        id: 'cors_error',
        check: (error) => error.message && error.message.includes('CORS'),
        diagnose: (error) => `<strong>跨域错误 (CORS):</strong><br/>跨域请求被浏览器安全策略拦截。<br/><em>解决方案: 配置服务器响应头 (Access-Control-Allow-Origin) 或使用代理。</em>`,
        headerStyle: 'color: #007aff; font-weight: bold; font-size: 14px;',
        bodyStyle: 'color: #b3d4ff; font-size: 12px;'
    }
];

function runDiagnostics(error) {
    let htmlOutput = '';
    DIAGNOSTIC_RULES.forEach(rule => {
        if (rule.check(error)) {
            htmlOutput += rule.diagnose(error) + '<br/><br/>';
        }
    });
    if (!htmlOutput) htmlOutput = `<span style="color:#666">未找到匹配此错误的诊断规则。</span>`;

    let hasMatchedRule = false;
    DIAGNOSTIC_RULES.forEach(rule => {
        if (rule.check(error)) {
            try {
                const diagnosticHTML = rule.diagnose(error);
                let plainText = diagnosticHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '').trim();
                const hStyle = rule.headerStyle || 'color: #ff3b30; font-weight: bold; font-size: 14px;';
                const bStyle = rule.bodyStyle || 'color: #fbff00; font-size: 12px;';
                console.error(`%c[ResourceShare 诊断]%c ${plainText}`, hStyle, bStyle);
                hasMatchedRule = true;
            } catch (e) {
                console.error(`[ResourceShare 诊断] 诊断逻辑自身出错: ${e.message}`);
            }
        }
    });
    if (!hasMatchedRule) {
        console.error(`%c[ResourceShare 诊断]%c 未找到匹配的诊断规则，无法定位错误原因`, 'color: #8e8e93; font-weight: bold; font-size: 14px;', 'color: #ffffff; font-size: 12px;');
    }
    return htmlOutput;
}
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
// ==========================================
// 核心 ResourceShareManager 逻辑 (V1.3.7.2)
// ==========================================

if (typeof window.ResourceShareManager === 'undefined') {
    
    window.ResourceShareManager = class ResourceShareManager {
        constructor() {
            this.cache = new Map();
            this.pendingRequests = new Map();
            this.globalRequestLocks = new Map();
            this.blobUrls = new Set();
            this.isTopLevel = !window.parent || window.parent === window;
            this.myOrigin = window.location.origin;
            
            this.resourceShareElements = [];
            this.loadedResources = new Set();
            this.blockedScripts = [];
            this.isBlockingEnabled = true;
            this.allResourcesLoaded = false;
            this.scriptBlockingInitialized = false;
            this.domContentLoadedFired = false;
            this.domReadyCallbacks = [];
            this.scriptTimeout = null;
            
            this.resourceExecutionQueue = [];
            this.isExecutingResources = false;
            this.isLoadingStopped = false;

            // V1.3.7.1: 脚本执行计数器
            this.scriptExecuteCounter = 0;

            // V1.3.7: 初始化日志系统
            this.logger = new ResourceShareLogger(this);
            this.uiManager = null;

            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQuery.addListener(() => this.logger.log('主题已更新', 'info'));
            }
            
            this.init();
        }

        init() {
            // V1.3.7: 根据 ENABLE_UI 决定是否实例化 UI
            if (RS_CONFIG.ENABLE_UI) {
                this.uiManager = new ResourceShareUI(this);
                this.logger.setUIManager(this.uiManager);
            }
            
            this.logger.log(`系统初始化 - ${this.isTopLevel ? '顶级页面' : '子页面'}`, 'info');
            this.logger.log(`传输阈值: PM=${this.formatBytes(RS_CONFIG.POST_MESSAGE_LIMIT)}, Blob=${this.formatBytes(RS_CONFIG.BLOB_LIMIT)}`, 'info');
            
            if (this.isTopLevel) {
                this.interceptDOMReadyEvents();
                window.addEventListener('message', (event) => this.handleChildRequest(event));
                this.logger.log('顶级页面：监听同源子页面请求', 'success');
            } else {
                this.logger.log('子页面：准备向同源父页面请求资源', 'info');
                this.waitForParentManager();
            }

            this.initScriptBlocking();
            window.addEventListener('beforeunload', () => this.cleanupBlobUrls());

            this.scriptTimeout = setTimeout(() => {
                if (this.isBlockingEnabled) {
                    this.logger.log('脚本加载超时，强制释放被阻塞的脚本', 'warning');
                    this.releaseBlockedScripts();
                }
            }, RS_CONFIG.SCRIPT_TIMEOUT);

            this.updateStatus();
            if (window.parent == window) {
                this.showCopyright();
            }
        }
        
        showCopyright() {
            // 只在 DevTools 显示，不传给 UI
            const colors = this.logger.getThemeColors();
            console.log(
                `%c${RS_CONFIG.COPYRIGHT}%c\n%cResourceShare.js v${RS_CONFIG.VERSION}%c - 高性能跨iframe资源共享系统`,
                `font-weight: bold; color: ${colors.info};`,
                '',
                `font-weight: bold; color: ${colors.danger};`,
                `font-weight: normal; color: ${colors.success};`
            );
        }

        // 统一日志入口
        log(message, category = 'info') {
            this.logger.log(message, category);
        }

        waitForParentManager() {
            const checkParentManager = () => {
                try { window.parent.postMessage({ type: 'resource-share-ping', origin: this.myOrigin }, '*'); }
                catch (error) { this.log('无法与父页面通信', 'warning'); this.isBlockingEnabled = false; }
            };
            checkParentManager();
            const interval = setInterval(() => {
                if (window.parent && window.parent !== window) checkParentManager();
                else clearInterval(interval);
            }, RS_CONFIG.PING_INTERVAL);
            setTimeout(() => {
                clearInterval(interval);
                if (!window.parent || window.parent === window) {
                    this.log('无法连接到父页面，释放脚本以避免页面卡死', 'warning');
                    this.isBlockingEnabled = false;
                    this.releaseBlockedScripts();
                }
            }, RS_CONFIG.PING_TIMEOUT);
        }
        
        interceptDOMReadyEvents() {
            if (!this.isTopLevel) return;
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                if (type === 'DOMContentLoaded' && window.resourceShareManager && window.resourceShareManager.isBlockingEnabled) {
                    window.resourceShareManager.domReadyCallbacks.push({ target: this, listener, options });
                    if (this === document) window.resourceShareManager.domContentLoadedFired = false;
                    return;
                }
                return originalAddEventListener.call(this, type, listener, options);
            };
            if (typeof window.layui !== 'undefined' && window.layui.$.fn) {
                const originalReady = window.layui.$.fn.ready;
                window.layui.$.fn.ready = function(callback) {
                    if (window.resourceShareManager && window.resourceShareManager.isBlockingEnabled) {
                        window.resourceShareManager.domReadyCallbacks.push({ target: window.layui.$, listener: callback, options: null, isLayui: true });
                        return this;
                    }
                    return originalReady.call(this, callback);
                };
            }
        }
        
        fireDelayedDOMReadyEvents() {
            this.log('触发延迟的DOM就绪事件', 'info');
            this.domContentLoadedFired = true;
            document.dispatchEvent(new Event('DOMContentLoaded'));
            this.domReadyCallbacks.forEach(callback => {
                try {
                    if (callback.isLayui) callback.listener.call(callback.target);
                    else callback.target.addEventListener('DOMContentLoaded', callback.listener, callback.options);
                } catch (error) { this.log(`执行DOM就绪回调出错: ${error.message}`, 'danger'); }
            });
            this.domReadyCallbacks = [];
        }
        
        initScriptBlocking() {
            this.log('启用脚本阻塞功能', 'info');
            this.setupScriptInterception();
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.scanResourceShareElements());
            } else {
                this.scanResourceShareElements();
            }
        }
        
        setupScriptInterception() {
            if (this.scriptBlockingInitialized) return;
            this.scriptBlockingInitialized = true;
            this.interceptExistingScripts();
            this.setupMutationObserver();
            this.overrideDOMMethods();
        }
        
        isScriptToBeBlocked(script) {
            if (script.hasAttribute('data-resource-share')) return false;
            if (script.hasAttribute('DisableRS')) return false;
            if (script.src && script.src.includes('ResourceShare.js')) return false;
            const scriptType = script.type;
            if (scriptType && scriptType !== 'text/javascript') return false;
            return true;
        }
        
        scanResourceShareElements() {
            this.resourceShareElements = Array.from(document.querySelectorAll('resource-share'));
            this.log(`发现 ${this.resourceShareElements.length} 个 resource-share 标签`, 'info');
            if (this.resourceShareElements.length === 0) {
                this.log('未发现 resource-share 标签，禁用脚本阻塞', 'warning');
                this.isBlockingEnabled = false;
                this.releaseBlockedScripts();
                this.uiManager.finishLoading();
                return;
            }
            this.initializeResourceQueue();
        }
        
        initializeResourceQueue() {
            this.resourceExecutionQueue = [];
            this.resourceShareElements.forEach((element, index) => {
                const type = element.getAttribute('type');
                const url = element.getAttribute('src') || element.getAttribute('href');
                if (type && url) {
                    this.resourceExecutionQueue.push({ element, type, url, index, loaded: false, executed: false });
                }
            });
            this.log(`初始化资源执行队列，共 ${this.resourceExecutionQueue.length} 个资源`, 'info');
            this.processResourceQueue();
        }
        
        async processResourceQueue() {
            if (this.isExecutingResources) return;
            this.isExecutingResources = true;
            if (this.isLoadingStopped) {
                this.log('加载因严重错误已停止', 'danger');
                this.isExecutingResources = false;
                return;
            }

            try {
                for (let i = 0; i < this.resourceExecutionQueue.length; i++) {
                    if (this.isLoadingStopped) break;
                    const resource = this.resourceExecutionQueue[i];
                    if (!resource.loaded) {
                        try {
                            this.log(`按顺序加载资源 (${i + 1}/${this.resourceExecutionQueue.length}): ${resource.type}:${resource.url}`, 'info');
                            const content = await this.loadResource(resource.type, resource.url);
                            resource.loaded = true;
                            try {
                                if (resource.type === 'script') await this.executeScript(content, resource.url);
                                else if (resource.type === 'style') await this.injectStyle(content);
                                resource.executed = true;
                            } catch (execError) {
                                console.error(execError);
                                this.log(`资源执行报错 (非致命): ${resource.url} - ${execError.message}`, 'danger');
                                runDiagnostics(execError);
                            }
                            this.markResourceLoaded(resource.url);
                        } catch (loadError) {
                            console.error(loadError);
                            this.log(`资源加载失败 (致命): ${resource.url} - ${loadError.message}`, 'danger');
                            this.handleCriticalError(loadError, resource.url);
                            break;
                        }
                    }
                }
            } finally {
                this.isExecutingResources = false;
            }
        }

        handleCriticalError(error, url) {
            this.isLoadingStopped = true;
            const diagnosticsHTML = runDiagnostics(error);
            if (this.uiManager) {
                this.uiManager.showFatalError(error, diagnosticsHTML);
            }
        }
        
        interceptExistingScripts() {
            const scripts = document.querySelectorAll('script');
            this.log(`检查 ${scripts.length} 个现有脚本`, 'info');
            scripts.forEach(script => {
                if (this.isScriptToBeBlocked(script)) this.blockScript(script);
            });
        }
        
        blockScript(script) {
            script.setAttribute('data-resource-share', 'blocked');
            const scriptInfo = {
                src: script.src,
                text: script.textContent,
                type: script.type || 'text/javascript',
                async: script.async, defer: script.defer,
                crossOrigin: script.crossOrigin, integrity: script.integrity,
                nonce: script.nonce, referrerPolicy: script.referrerPolicy
            };
            try { if (script.parentNode) script.parentNode.removeChild(script); } catch (e) {}
            this.blockedScripts.push(scriptInfo);
        }
        
        setupMutationObserver() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeName === 'SCRIPT' && this.isScriptToBeBlocked(node)) {
                                this.log(`拦截动态脚本: ${node.src || 'inline'}`, 'info');
                                this.blockScript(node);
                            }
                            if (node.querySelectorAll) {
                                node.querySelectorAll('script').forEach(script => {
                                    if (this.isScriptToBeBlocked(script)) {
                                        this.log(`拦截动态子脚本: ${script.src || 'inline'}`, 'info');
                                        this.blockScript(script);
                                    }
                                });
                            }
                        });
                    }
                });
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
        }
        
        overrideDOMMethods() {
            const manager = this;
            const originalAppendChild = Node.prototype.appendChild;
            Node.prototype.appendChild = function(child) {
                // [修复] 放过 Blob URL 脚本，避免大文件执行时的无限拦截
                if (child && child.nodeName === 'SCRIPT' && manager.isBlockingEnabled) {
                    // 如果是 Blob URL，说明是内部生成的，直接放行
                    if (child.src && child.src.startsWith('blob:')) {
                        // 直接执行原操作，不进入 block 逻辑
                        return originalAppendChild.call(this, child);
                    }
                    
                    // 常规脚本检查
                    if (manager.isScriptToBeBlocked(child)) {
                        manager.log(`拦截appendChild: ${child.src || 'inline'}`, 'info');
                        manager.blockScript(child);
                        return child;
                    }
                }
                return originalAppendChild.call(this, child);
            };
            
            const originalInsertBefore = Node.prototype.insertBefore;
            Node.prototype.insertBefore = function(child, referenceNode) {
                // [修复] 放过 Blob URL 脚本
                if (child && child.nodeName === 'SCRIPT' && manager.isBlockingEnabled) {
                     if (child.src && child.src.startsWith('blob:')) {
                        return originalInsertBefore.call(this, child, referenceNode);
                    }

                    if (manager.isScriptToBeBlocked(child)) {
                        manager.log(`拦截insertBefore: ${child.src || 'inline'}`, 'info');
                        manager.blockScript(child);
                        return child;
                    }
                }
                return originalInsertBefore.call(this, child, referenceNode);
            };
        }
        
        markResourceLoaded(url) {
            this.loadedResources.add(url);
            this.log(`资源加载完成: ${url} (${this.loadedResources.size}/${this.resourceShareElements.length})`, 'success');
            
            if (this.uiManager) {
                this.uiManager.updateProgress(this.loadedResources.size, this.resourceShareElements.length);
            }

            if (this.loadedResources.size >= this.resourceShareElements.length && !this.allResourcesLoaded) {
                this.allResourcesLoaded = true;
                this.log('所有 resource-share 资源加载完成', 'success');
                
                if (this.scriptTimeout) { clearTimeout(this.scriptTimeout); this.scriptTimeout = null; }
                this.releaseBlockedScripts();
                
                if (this.uiManager) {
                    this.uiManager.finishLoading();
                }
                
                if (this.isTopLevel) this.fireDelayedDOMReadyEvents();
            }
        }
        
        releaseBlockedScripts() {
            this.isBlockingEnabled = false;
            this.log(`释放 ${this.blockedScripts.length} 个被阻塞的脚本`, 'info');
            this.blockedScripts.forEach(scriptInfo => this.executeScriptInfo(scriptInfo));
            this.blockedScripts = [];
        }
        
        executeScriptInfo(scriptInfo) {
            try {
                if (scriptInfo.src) {
                    if (getFileNameFromPath(scriptInfo.src) == ResourceShareFileName) {
                        this.log(`绕过自指: ${scriptInfo.src}`, 'success');
                        return;
                    }
                    const script = document.createElement('script');
                    script.src = scriptInfo.src; script.type = scriptInfo.type;
                    script.async = scriptInfo.async; script.defer = scriptInfo.defer;
                    if (scriptInfo.crossOrigin) script.crossOrigin = scriptInfo.crossOrigin;
                    if (scriptInfo.integrity) script.integrity = scriptInfo.integrity;
                    if (scriptInfo.nonce) script.nonce = scriptInfo.nonce;
                    if (scriptInfo.referrerPolicy) script.referrerPolicy = scriptInfo.referrerPolicy;
                    
                    script.onerror = (e) => {
                        const loadError = new Error(`Script Load Error: ${scriptInfo.src}`);
                        console.error(loadError);
                        this.log(`外部脚本加载失败 (致命): [${scriptInfo.src}]`, 'danger');
                        this.handleCriticalError(loadError, scriptInfo.src);
                    };
                    document.head.appendChild(script);
                    this.log(`执行外部脚本: ${scriptInfo.src}`, 'success');
                } else if (scriptInfo.text) {
                    try {
                        // V1.3.7.1: 生成内联脚本的 SourceURL (独立逻辑，不受 resource-share 逻辑影响)
                        const sourceURL = this.generateInlineScriptSourceURL();
                        const codeWithSourceMap = `${scriptInfo.text}\n//# sourceURL=${sourceURL}`;
                        const executeFunction = new Function(codeWithSourceMap);
                        executeFunction();
                        this.log(`执行内联脚本 [${sourceURL}]`, 'success');
                    } catch (error) {
                        console.error(error);
                        this.log(`内联脚本执行出错 (非致命): ${error.message}`, 'danger');
                        runDiagnostics(error);
                    }
                }
            } catch (error) { 
                this.log(`脚本执行封装出错: ${error.message}`, 'danger'); 
                console.error(error);
            }
        }

        async loadResource(type, url) {
            const cacheKey = `${type}:${url}`;
            if (this.cache.has(cacheKey)) {
                return this.processCachedData(this.cache.get(cacheKey), type);
            }
            if (this.globalRequestLocks.has(cacheKey)) {
                return await this.globalRequestLocks.get(cacheKey);
            }
            const requestPromise = this.createResourceRequest(type, url);
            this.globalRequestLocks.set(cacheKey, requestPromise);
            try { return await requestPromise; } finally { this.globalRequestLocks.delete(cacheKey); }
        }

        async createResourceRequest(type, url) {
            const cacheKey = `${type}:${url}`;
            if (this.isTopLevel) {
                const content = await this.fetchAndCache(type, url);
                return this.processContent(content, type);
            } else {
                try {
                    const parentResponse = await this.requestFromParent(type, url);
                    if (parentResponse !== undefined && parentResponse !== null) {
                        return this.processParentResponse(parentResponse, type);
                    }
                } catch (error) { this.log(`父页面请求失败: ${error.message}`, 'warning'); }
                const content = await this.fetchAndCache(type, url);
                const processedContent = this.processContent(content, type);
                this.sendToParent(type, url, content);
                return processedContent;
            }
        }

        // V1.3.7: 集成重试机制
        async fetchAndCache(type, url) {
            const cacheKey = `${type}:${url}`;
            if (this.pendingRequests.has(cacheKey)) {
                return await this.pendingRequests.get(cacheKey);
            }
            this.log(`发起网络请求: ${cacheKey}`, 'request');
            
            // 定义重试逻辑
            const maxRetries = RS_CONFIG.RETRY.COUNT;
            const retryDelay = RS_CONFIG.RETRY.DELAY;
            let attempt = 0;
            let lastError = null;

            const requestPromise = new Promise(async (resolve, reject) => {
                while (attempt <= maxRetries) {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
                        }
                        const content = await response.text();
                        const size = new Blob([content]).size;
                        if (size > RS_CONFIG.BLOB_LIMIT) {
                            resolve(content); return;
                        }
                        this.cache.set(cacheKey, content);
                        this.updateStatus();
                        resolve(content);
                        return; // 成功则退出循环
                    } catch (error) {
                        lastError = error;
                        attempt++;
                        if (attempt <= maxRetries) {
                            this.log(`请求失败，将在 ${retryDelay}ms 后重试 (${attempt}/${maxRetries}): ${error.message}`, 'warning');
                            await new Promise(r => setTimeout(r, retryDelay));
                        } else {
                            // 重试次数耗尽
                            this.log(`请求彻底失败: ${cacheKey} - ${error.message}`, 'danger');
                            reject(lastError);
                        }
                    } finally {
                        if (attempt > maxRetries || !lastError) {
                           this.pendingRequests.delete(cacheKey);
                        }
                    }
                }
            });

            this.pendingRequests.set(cacheKey, requestPromise);
            return await requestPromise;
        }

        processContent(content, type) {
            if (!content) return content;
            const size = new Blob([content]).size;
            if (size <= RS_CONFIG.POST_MESSAGE_LIMIT) return content;
            const blob = new Blob([content], { type: type === 'script' ? 'text/javascript' : 'text/css' });
            const blobUrl = URL.createObjectURL(blob);
            this.blobUrls.add(blobUrl);
            this.updateStatus(); return blobUrl;
        }

        processCachedData(cachedData, type) {
            if (!cachedData) return cachedData;
            if (typeof cachedData === 'string' && cachedData.startsWith('blob:')) return cachedData;
            return this.processContent(cachedData, type);
        }

        processParentResponse(response, type) {
            if (!response) return null;
            if (response.contentType === 'blob') {
                if (response.content) this.blobUrls.add(response.content);
                this.updateStatus(); return response.content;
            }
            return this.processContent(response.content, type);
        }

        async requestFromParent(type, url) {
            return new Promise((resolve, reject) => {
                const messageId = Date.now() + Math.random();
                const timeout = setTimeout(() => reject(new Error('Timeout')), RS_CONFIG.REQUEST_TIMEOUT);
                const handleMessage = (event) => {
                    if (event.data.type === 'resource-response' && event.data.messageId === messageId) {
                        clearTimeout(timeout);
                        window.removeEventListener('message', handleMessage);
                        if (event.data.success) resolve({ contentType: event.data.contentType || 'direct', content: event.data.content });
                        else reject(new Error(event.data.error));
                    }
                };
                window.addEventListener('message', handleMessage);
                window.parent.postMessage({ type: 'resource-request', messageId, resourceType: type, url: url }, '*');
            });
        }

        sendToParent(type, url, content) {
            if (!content) return;
            const size = new Blob([content]).size;
            let messageData;
            if (size <= RS_CONFIG.POST_MESSAGE_LIMIT) {
                messageData = { type: 'resource-cache-update', resourceType: type, url: url, contentType: 'direct', content: content };
            } else {
                const blob = new Blob([content], { type: type === 'script' ? 'text/javascript' : 'text/css' });
                const blobUrl = URL.createObjectURL(blob);
                this.blobUrls.add(blobUrl);
                messageData = { type: 'resource-cache-update', resourceType: type, url: url, contentType: 'blob', content: blobUrl };
            }
            window.parent.postMessage(messageData, '*');
        }

        handleChildRequest(event) {
            const { type, messageId, resourceType, url } = event.data;
            if (type === 'resource-request') {
                const cacheKey = `${resourceType}:${url}`;
                if (this.cache.has(cacheKey)) {
                    const content = this.cache.get(cacheKey);
                    const size = new Blob([content]).size;
                    let responseData;
                    if (size <= RS_CONFIG.POST_MESSAGE_LIMIT) {
                        responseData = { type: 'resource-response', messageId, success: true, contentType: 'direct', content: content };
                    } else {
                        const blob = new Blob([content], { type: resourceType === 'script' ? 'text/javascript' : 'text/css' });
                        const blobUrl = URL.createObjectURL(blob);
                        this.blobUrls.add(blobUrl);
                        responseData = { type: 'resource-response', messageId, success: true, contentType: 'blob', content: blobUrl };
                    }
                    event.source.postMessage(responseData, event.origin);
                } else {
                    event.source.postMessage({ type: 'resource-response', messageId, success: false, error: 'Not cached' }, event.origin);
                }
            } else if (type === 'resource-cache-update') {
                const cacheKey = `${resourceType}:${url}`;
                if (event.data.contentType === 'blob') {
                    this.cache.set(cacheKey, event.data.content);
                    this.blobUrls.add(event.data.content);
                } else {
                    this.cache.set(cacheKey, event.data.content);
                }
                this.updateStatus();
            }
        }

        cleanupBlobUrls() {
            this.blobUrls.forEach(url => URL.revokeObjectURL(url));
            this.blobUrls.clear();
            this.log('清理Blob URL', 'info');
            this.updateStatus();
        }

        formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        updateStatus() {}
        clearCache() { this.cache.clear(); this.cleanupBlobUrls(); }

        // V1.3.7.1: 生成内联脚本 SourceURL 的辅助方法
        generateInlineScriptSourceURL() {
            let pageName = 'unknown';
            try {
                const pathParts = window.location.pathname.split('/');
                let fileName = pathParts[pathParts.length - 1];
                if (!fileName || fileName.endsWith('/')) fileName = 'index';
                // 去除后缀
                const lastDot = fileName.lastIndexOf('.');
                if (lastDot > -1) fileName = fileName.substring(0, lastDot);
                // 去除非法字符
                fileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
                if (fileName.length === 0) fileName = 'page';
                pageName = fileName;
            } catch (e) {
                pageName = 'unknown';
            }
            const index = this.scriptExecuteCounter++;
            const randomStr = generateRandomString(6);
            return `./RS_VM/VM_${pageName}_${index}_${randomStr}.js`;
        }

        // V1.3.7.2: 生成 resource-share 完整路径 SourceURL
        getResourceShareSourceURL(url) {
            try {
                const urlObj = new URL(url, window.location.href);
                const pathParts = urlObj.pathname.split('/');
                const filename = pathParts.pop(); // 取出文件名
                const vmFilename = 'VM_' + filename;
                pathParts.push(vmFilename); // 放回带前缀的文件名
                const newPath = pathParts.join('/');
                return urlObj.origin + newPath;
            } catch (e) {
                // 解析失败回退到基本格式
                return 'VM_' + url.replace(/[^a-zA-Z0-9_]/g, '_') + '.js';
            }
        }

        async executeScript(content, sourceUrl = 'Unknown') {
            return new Promise((resolve) => {
                if (!content) { resolve(); return; }
                if (content.startsWith('blob:')) {
                    const script = document.createElement('script');
                    script.src = content;
                    script.onload = () => { 
                        this.log(`JS(Blob) 已执行 [${sourceUrl}]`, 'success'); 
                        resolve(); 
                    };
                    script.onerror = (e) => {
                        const loadError = new Error(`Blob Script Load Error: ${sourceUrl}`);
                        console.error(loadError);
                        this.handleCriticalError(loadError, sourceUrl);
                        resolve(); 
                    };
                    document.head.appendChild(script);
                } else {
                    try {
                        // V1.3.7.2: 使用生成完整路径的方法
                        const filename = this.getResourceShareSourceURL(sourceUrl);
                        const codeWithSourceMap = `${content}\n//# sourceURL=${filename}`;
                        const executeFunction = new Function(codeWithSourceMap);
                        executeFunction();
                        this.log(`JS 已执行 [${filename}]`, 'success');
                        resolve();
                    } catch (error) { 
                        throw error; 
                    }
                }
            });
        }

        async injectStyle(content) {
            return new Promise((resolve) => {
                if (!content) { resolve(); return; }
                if (content.startsWith('blob:')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet'; link.href = content;
                    link.onload = () => { this.log(`CSS(Blob) 已注入`, 'success'); resolve(); };
                    link.onerror = () => { this.log(`CSS(Blob) 失败`, 'danger'); resolve(); };
                    document.head.appendChild(link);
                } else {
                    try {
                        const style = document.createElement('style');
                        style.textContent = content;
                        document.head.appendChild(style);
                        this.log(`CSS 已注入`, 'success');
                        resolve();
                    } catch (error) { 
                        this.log(`CSS注入出错: ${error.message}`, 'danger'); 
                        resolve(); 
                    }
                }
            });
        }
    };
}
if (typeof window.ResourceShareElement === 'undefined') {
    window.ResourceShareElement = class ResourceShareElement extends HTMLElement {
        constructor() {
            super();
            // 确保 manager 存在，如果 window 上还没挂载则创建临时实例
            this.manager = window.resourceShareManager || new window.ResourceShareManager();
        }
        connectedCallback() { 
            this.log('ResourceShare 元素已挂载到 DOM', 'info'); 
        }
        log(message, category = 'info') {
            // [重构] 强制使用统一的日志系统，移除 console.log 回退
            // 确保无论何种情况，日志都通过 ResourceShareManager 处理（包含颜色、UI渲染等）
            if (this.manager && this.manager.log) {
                this.manager.log(message, category);
            }
        }
    };
    customElements.define('resource-share', window.ResourceShareElement);
}

// 如果全局管理器实例尚未初始化，则进行初始化
if (typeof window.resourceShareManager === 'undefined') {
    window.resourceShareManager = new window.ResourceShareManager();
}

// 全局消息监听（处理跨页面握手）
if (window.addEventListener) {
    window.addEventListener('message', (event) => {
        // 顶级页面：响应子页面的 Ping 请求
        if (event.data.type === 'resource-share-ping' && window.resourceShareManager && window.resourceShareManager.isTopLevel) {
            event.source.postMessage({ type: 'resource-share-pong', origin: event.origin }, event.origin);
        }
        
        // 子页面：收到父页面的 Pong 响应，确认连接建立
        if (event.data.type === 'resource-share-pong' && window.resourceShareManager && !window.resourceShareManager.isTopLevel) {
            // [重构] 移除手动获取颜色和 console.log，改用统一的日志系统
            // 日志系统会自动根据 'success' 类别配置颜色和时间戳
            window.resourceShareManager.log('父页面连接已建立 (Channel Ready)', 'success');
        }
    });
}

// 支持 CommonJS 环境导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ResourceShareManager: window.ResourceShareManager, ResourceShareElement: window.ResourceShareElement };
}