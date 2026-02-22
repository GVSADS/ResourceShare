# ResourceShare.js 系统原理文档 (V1.3.7.4)

**版本:** V1.3.7.5
**发布日期:** 2026
**开发团队:** GVSDS Team
**许可协议:** MIT License

---

## 1. 系统概述

`ResourceShare.js` 是一个高性能的跨域资源共享系统，专门设计用于解决复杂 Web 应用（特别是包含大量 iframe 嵌套的单页应用）中的资源重复加载、依赖管理混乱以及脚本执行顺序不可控等问题。

### 1.1 核心特性
*   **跨级资源共享:** 利用 `postMessage` 和 `Blob URL` 技术，使得同源下的子页面可以直接复用父页面已加载的 JS/CSS 资源，极大减少网络请求。
*   **智能脚本阻塞:** 在资源加载期间自动阻塞页面上的业务脚本，确保核心依赖（如 jQuery, Layui）先于业务代码执行。
*   **虚拟路径映射:** 为内联脚本和远程加载的脚本生成带 `VM_` 前缀的 SourceURL，解决调试时代码定位混乱的问题。
*   **可视化 UI 面板:** 提供原生 JavaScript 编写的加载日志、进度条和错误诊断面板，无需依赖第三方 UI 库。
*   **自动诊断系统:** 内置规则引擎，能够识别常见的错误（如 jQuery 未定义、CORS 错误）并给出修复建议。

---

## 2. 架构设计

系统采用模块化类结构设计，主要分为以下几个核心部分：

### 2.1 类结构概览
1.  **`ResourceShareManager` (核心管理器)**: 负责资源加载、缓存管理、脚本拦截、跨页面通信协调。
2.  **`ResourceShareUI` (UI 管理器)**: 负责 DOM 元素的渲染（启动页、进度条、日志面板、错误弹窗）。
3.  **`ResourceShareLogger` (日志系统)**: 统一日志输出入口，负责根据配置过滤日志，并分发到 DevTools 控制台和 UI 面板。
4.  **`ResourceShareElement` (Web Components)**: 自定义标签 `<resource-share>`，用于声明页面需要加载的依赖资源。

### 2.2 初始化流程
1.  **配置合并**: 脚本加载时，首先执行 `deepMerge`，将用户定义的 `window.RS_CONFIG` 与系统默认配置合并。
2.  **单例检测**: 检查 `window.resourceShareManager` 是否存在，若不存在则实例化。
3.  **环境检测**: 判断当前页面是 `Top Level` (顶级父页面) 还是 `Sub Level` (子页面)。
4.  **组件初始化**: 
    *   初始化 Logger。
    *   若 `ENABLE_UI` 为 true，初始化 UI 并显示启动屏。
5.  **DOM 扫描**: 监听 `DOMContentLoaded`，扫描页面中的 `<resource-share>` 标签，构建加载队列。

---

## 3. 核心机制详解

### 3.1 资源加载与缓存策略

系统采用“源驱动，缓存优先”的策略。

*   **队列机制**: 扫描到的 `<resource-share>` 标签会被推入 `resourceExecutionQueue`。系统严格按顺序处理队列，确保依赖关系（例如 jQuery 必须在业务插件前加载）。
*   **顶级页面**:
    1.  检查本地内存缓存 (`this.cache`)。
    2.  若未缓存，发起 `fetch` 请求。
    3.  **重试机制**: 内置请求失败重试逻辑（默认 3 次，间隔 1.5s），提高弱网环境下的成功率。
    4.  **缓存决策**: 
        *   小于 `POST_MESSAGE_LIMIT` (1MB)：存储为字符串文本。
        *   大于阈值：转换为 `Blob URL` 并存储，防止 `postMessage` 数据过大导致报错。
*   **子页面**:
    1.  先通过 `postMessage` 向父页面请求资源 (`resource-request`)。
    2.  父页面若缓存，直接返回数据（文本或 Blob URL）。
    3.  父页面若未缓存，子页面回退到直接 `fetch`，并将结果同步给父页面更新缓存。

### 3.2 智能脚本阻塞系统

为了防止业务脚本在依赖库加载完成前执行，系统劫持了 DOM 操作。

1.  **拦截目标**: 
    *   页面初始化时已存在的 `<script>`。
    *   动态插入的 `<script>`（通过 `MutationObserver` 监听）。
    *   `appendChild` 和 `insertBefore` 方法的调用。
2.  **拦截逻辑**: 
    *   如果当前处于 `isBlockingEnabled` 状态。
    *   且脚本不是 `ResourceShare.js` 自身。
    *   且脚本不包含 `data-resource-share` 或 `DisableRS` 标记。
    *   **结果**: 脚本被移除 DOM，其信息（src, text, async 等）被存入 `blockedScripts` 数组。
3.  **释放机制**: 
    *   当所有 `<resource-share>` 依赖加载并执行完毕，或发生超时/错误时。
    *   调用 `releaseBlockedScripts()`，遍历 `blockedScripts`，重建 `<script>` 标签并插入 DOM 执行。

### 3.3 SourceURL 路径映射 (V1.3.7.4 更新)

为了提升开发体验，系统会对执行的脚本进行重定向，使其在 Chrome DevTools 中显示为独立的虚拟文件。

1.  **内联脚本**:
    *   逻辑位于 `generateInlineScriptSourceURL()`。
    *   格式: `./RS_VM/VM_{页面名}_{序号}_{随机码}.js`。
    *   效果: 即使是写在 HTML 里的 JS，也会显示为一个独立的虚拟文件。
2.  **ResourceShare 远程脚本**:
    *   逻辑位于 `getResourceShareSourceURL(url)`。
    *   **V1.3.7.4 修正**: 现在保留原始 URL 的目录结构，仅修改文件名。
    *   原始 URL: `https://cdn.example.com/js/3.6.0/jquery.min.js`
    *   映射后: `https://cdn.example.com/js/3.6.0/VM_jquery.min.js`
    *   效果: 开发者能清晰看到资源来源路径，同时区分出这是经过 ResourceShare 加载的版本。

### 3.4 跨域/跨框架通信

基于 `window.postMessage` 实现，实现了“父子握手”协议。

1.  **Ping/Pong**: 子页面加载后发送 `resource-share-ping`，父页面回复 `resource-share-pong` 以建立连接。
2.  **资源请求**: 子页面发送 `resource-request` (包含 type, url, messageId)。
3.  **资源响应**: 父页面匹配缓存后，发送 `resource-response`。
4.  **缓存同步**: 若子页面自己加载了资源，会发送 `resource-cache-update` 通知父页面更新缓存。

---

## 4. 配置说明

所有配置项挂载在 `window.RS_CONFIG` 下，支持在脚本加载前重写。

```javascript
window.RS_CONFIG = {
  // 基础信息
  VERSION: '1.3.7.4',
  ENABLE_UI: true,          // 是否显示内置 UI 面板

  // 阈值 (单位: 字节/毫秒)
  POST_MESSAGE_LIMIT: 1048576, // 1MB，超过此大小使用 Blob URL 传递
  BLOB_LIMIT: 1073741824,      // 1GB，最大缓存文件大小限制
  SCRIPT_TIMEOUT: 300000,      // 5分钟，脚本强制释放超时
  REQUEST_TIMEOUT: 10000,      // 10秒，跨父请求超时

  // 重试策略
  RETRY: {
    COUNT: 3,   // 失败重试次数
    DELAY: 1500 // 重试间隔
  },

  // 日志控制
  LOG_LEVEL_UI: 'debug',       // UI 面板显示级别
  LOG_LEVEL_DEVTOOLS: 'error', // 控制台显示级别
  
  // Z-Index 管理
  Z_INDEX: {
    SPLASH: 2147483647,
    // ...
  }
};
```

---

## 5. 错误处理与诊断 (V1.3.7.4)

系统包含一个快速代码诊断模块 (`DIAGNOSTIC_RULES`)，当发生运行时错误时：

1.  **捕获**: 通过 `window.onerror` 或 `try-catch` 捕获错误对象。
2.  **匹配**: 遍历诊断规则数组，检查错误信息或错误名称。
3.  **输出**:
    *   **UI 层**: 弹出模态框 (`#rs-fatal-error-screen`)，显示错误堆栈和修复建议。
    *   **DevTools**: 以彩色格式输出诊断信息。
4.  **常见规则**:
    *   `jquery_missing`: 检测 `$ is not defined`。
    *   `layui_missing`: 检测 `layui is not defined`。
    *   `cors_error`: 检测 `Failed to fetch` 及 CORS 相关字眼。

---

## 6. 版本更新日志 (V1.3.7.4)

**发布日期:** 2026

**重点修正: SourceURL 路径映射逻辑**

1.  **修正 `getResourceShareSourceURL` 函数**:
    *   **旧版行为**: 可能将路径完全扁平化或生成无意义的随机文件名，导致调试时难以定位真实资源路径。
    *   **新版行为**: 
        *   解析输入 URL 的路径部分 (`pathname`)。
        *   提取目录结构和文件名。
        *   仅在文件名前添加 `VM_` 前缀，目录结构保持不变。
        *   例如：`/lib/js/module.js` -> `/lib/js/VM_module.js`。
    *   **影响**: 开发者在 Sources 面板中看到的文件树结构将与 CDN 或服务器结构一致，大幅提升调试体验。

2.  **保留内联脚本逻辑**:
    *   `generateInlineScriptSourceURL` 保持不变，继续生成 `./RS_VM/VM_{page}_{index}.js` 格式的路径，用于区分内联代码。

3.  **稳定性优化**:
    *   增强了 `deepMerge` 函数对特殊对象结构的处理。
    *   优化了 UI 面板在暗黑模式下的色彩对比度。

---

## 7. 使用示例

### 7.1 基础 HTML 集成

```html
<!DOCTYPE html>
<html>
<head>
    <!-- 1. 引入 ResourceShare -->
    <script src="ResourceShare.js"></script>
    
    <!-- 2. 声明需要加载和共享的资源 -->
    <resource-share type="script" src="https://cdn.com/jquery.min.js"></resource-share>
    <resource-share type="style" src="https://cdn.com/bootstrap.css"></resource-share>
</head>
<body>
    <!-- 3. 业务脚本 (会被自动阻塞，直到 jQuery 加载完成) -->
    <script>
        // 这里可以直接使用 $，不会报错
        $(document).ready(function(){
            console.log('Ready!');
        });
    </script>
</body>
</html>
```

### 7.2 iframe 子页面自动共享

**父页面**:
```html
<!-- 父页面加载了 Vue -->
<resource-share type="script" src="vue.js"></resource-share>
<iframe src="child.html"></iframe>
```

**子页面**:
```html
<!-- 子页面只需声明依赖，不需要再次下载 -->
<resource-share type="script" src="vue.js"></resource-share>
<script>
    // 瞬间完成加载，直接使用父页面的 Vue 实例
    new Vue({ ... });
</script>
```

---

## 8. 注意事项与最佳实践

1.  **同源限制**: 资源共享主要基于 `postMessage`，在严格跨域（Top-Level Domain 不同）场景下，子页面将回退到独立加载模式，但不会报错。
2.  **Blob URL 清理**: 系统在页面卸载 (`beforeunload`) 时会自动清理生成的 Blob URL，防止内存泄漏。
3.  **脚本顺序**: 请严格按照依赖顺序在 HTML 中编写 `<resource-share>` 标签，系统不会自动分析依赖拓扑。
4.  **调试建议**: 开发环境下建议设置 `RS_CONFIG.LOG_LEVEL_DEVTOOLS = 'debug'` 以查看详细的加载链路日志。