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