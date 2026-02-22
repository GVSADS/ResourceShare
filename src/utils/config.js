window.RS_CONFIG = deepMerge(window.RS_CONFIG || {}, {
  // 版本/版权
  VERSION: '1.3.7.5',
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