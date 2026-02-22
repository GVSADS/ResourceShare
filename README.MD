# ResourceShare.js - 高性能跨资源共享系统

**版本:** V1.3.7.5
**Copyright:** © 2026 GVSDS Team
**License:** MIT License

## 📖 简介

`ResourceShare.js` 是一个专为现代 Web 应用设计的高性能资源管理与共享系统。它通过拦截脚本加载、智能缓存、跨iframe/页面通信以及虚拟源映射技术，解决了复杂 Web 应用中资源加载顺序混乱、重复请求浪费带宽以及内联代码难以调试等问题。

**核心优势：**
*   **跨域/跨页面资源共享**：顶级页面加载一次资源，同源子页面直接复用，极大减少流量消耗。
*   **精准的加载控制**：使用 `<resource-share>` 标签明确定义加载顺序，确保依赖库（如 jQuery）先于业务代码执行。
*   **智能调试支持**：自动生成带有 `VM_` 前缀的虚拟 SourceURL，让原本混淆或内联的代码在浏览器开发者工具中拥有清晰的文件路径。
*   **可视化管理面板**：内置splash屏、进度条、日志控制台和错误诊断界面，开发体验极佳。
*   **健壮的错误处理**：内置自动重试机制和智能诊断系统（如检测 jQuery 缺失、CORS 错误等）。

---

## 🚀 快速开始

### 1. 引入脚本

将 `ResourceShare.js` 文件放入您的项目目录，并在 HTML 中尽可能早地引入它（建议在 `<head>` 中）。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>ResourceShare Demo</title>
    <!-- 引入 ResourceShare -->
    <script type="text/javascript" src="https://cdn.gvsds.com/ResourceShare/ResourceShare-1.3.7.2.js"></script>
</head>
<body>
    ...
</body>
</html>
```

### 2. 定义资源加载列表

使用自定义的 `<resource-share>` 标签来声明需要加载的资源。系统会严格按照标签出现的顺序进行加载。

**示例：**

```html
<body>
    <script type="text/javascript" src="https://cdn.gvsds.com/ResourceShare/ResourceShare-1.3.7.2.js"></script>
    <resource-share type="script" src="https://cdn.bootcdn.net/ajax/libs/jquery/3.6.0/jquery.min.js"></resource-share>
    <resource-share type="style" href="/assets/css/main.css"></resource-share>
    <resource-share type="script" src="/assets/js/app.js"></resource-share>
    <!-- 这些标签会被 ResourceShare 解析并接管加载过程 -->
</body>
```

### 3. 正常编写业务代码

除了引入资源的方式改变外，您的业务代码不需要做任何修改。系统会自动拦截 `<script>` 标签的执行，直到上述 `<resource-share>` 资源全部加载完毕。

```html
<script>
    // 即使这段代码写在 resource-share 标签下面，
    // 系统也会等待 jQuery 加载完成后才执行它，
    // 确保 $ 一定是可用的。
    $(document).ready(function() {
        console.log('App is ready!');
    });
</script>
```

---

## ⚙️ 配置选项

`ResourceShare.js` 提供了一个全局配置对象 `RS_CONFIG`。您可以在引入 `ResourceShare.js` **之前** 定义它来覆盖默认设置。

```html
<script>
    window.RS_CONFIG = {
        ENABLE_UI: false,           // 关闭内置UI界面
        LOG_LEVEL_UI: 'info',       // UI日志级别
        SCRIPT_TIMEOUT: 10000       // 脚本加载超时时间
    };
</script>
<script src="ResourceShare.js"></script>
```

### 配置参数详解

| 参数名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| **VERSION** | String | '1.3.7.4' | 系统版本号（只读） |
| **ENABLE_UI** | Boolean | `true` | 是否显示内置的 Splash 加载屏、进度条和日志面板。生产环境建议设为 `false`。 |
| **POST_MESSAGE_LIMIT** | Number | 1048576 (1MB) | 使用 postMessage 传输数据的最大阈值。超过此大小将自动使用 Blob URL。 |
| **BLOB_LIMIT** | Number | 1073741824 (1GB) | 单个资源允许的最大大小。 |
| **SCRIPT_TIMEOUT** | Number | 300000 (5分钟) | 资源加载的超时时间，超时后强制释放被阻塞的脚本。 |
| **RETRY.COUNT** | Number | `3` | 网络请求失败时的重试次数。 |
| **RETRY.DELAY** | Number | `1500` | 重试间隔（毫秒）。 |
| **LOG_LEVEL_UI** | String | `'debug'` | 屏幕日志面板的显示级别 (`'debug'`, `'info'`, `'error'`, `'none'`)。 |
| **LOG_LEVEL_DEVTOOLS** | String | `'error'` | 浏览器控制台 的日志级别。 |

---

## 🔧 高级用法

### 1. 跨 Iframe 资源共享

这是本系统的核心功能之一。当您的页面包含多个同源 iframe 时，只需在父页面（Top Level）加载一次资源，子页面即可直接读取父页面缓存。

**父页面:**
```html
<!-- 父页面正常加载资源 -->
<script src="ResourceShare.js"></script>
<resource-share type="script" src="large-library.js"></resource-share>
```

**子页面:**
```html
<!-- 子页面只需要引入 ResourceShare.js -->
<script src="ResourceShare.js"></script>
<resource-share type="script" src="large-library.js"></resource-share>
<!-- 子页面在加载时，会自动向父页面请求 large-library.js 的内容，而不会发起网络请求 -->
```

若父页面并未加载 large-library.js，但有一个子页面加载了 large-library.js，第二个子页面再次尝试加载 large-library.js 时即可直接读取父页面缓存。

### 2. 虚拟文件名映射 (V1.3.7.4 更新)

系统会自动为加载的脚本生成 SourceURL，以便在 Chrome DevTools 的 Sources 面板中调试。

*   **外部资源:** 如果加载 `https://example.com/libs/jquery.min.js`，在 Sources 中将显示为 `https://example.com/libs/VM_jquery.min.js`。这有助于区分这是由 ResourceShare 接管加载的文件。
*   **内联脚本:** 如果是页面内直接执行的脚本，将被映射为 `./RS_VM/VM_pageName_index_randomStr.js`。

### 3. 禁用特定脚本的接管

如果您希望某个脚本不被 ResourceShare 阻塞（即希望它立即执行），可以添加 `DisableRS` 属性。

```html
<!-- 这个脚本会忽略 ResourceShare 的队列，立即执行 -->
<script src="https://www.googletagmanager.com/gtag/js" DisableRS></script>
```

### 4. 错误诊断系统

当发生严重错误（如 jQuery 未定义）导致加载停止时，系统会自动弹出一个诊断模态框。该模态框会根据错误堆栈提供解决建议（例如：“脚本依赖 jQuery，但似乎未加载...”）。

---

## 🐛 调试与日志

### 屏幕日志面板
默认情况下，页面左下角会出现一个悬浮面板，显示资源加载的实时日志。
*   **蓝色:** 普通信息 / 请求
*   **绿色:** 加载成功 / 缓存命中
*   **黄色:** 警告 / 重试中
*   **红色:** 错误 / 加载失败

### 控制台日志
在浏览器控制台中，日志以彩色前缀输出，方便过滤：
*   `[INFO]`
*   `[SUCCESS]`
*   `[WARNING]`
*   `[ERROR]`
*   `[CACHE]` - 表示命中了父页面缓存或本地缓存

---

## 🏗️ 工作原理

1.  **初始化**: 脚本加载后，立即覆盖原生的 `appendChild` 和 `insertBefore` 方法，拦截所有 `<script>` 和 `<style>` 标签的插入。（这可能会导致类似的js无法正常发挥作用或者导致本程序失效）
2.  **阻塞**: 被拦截的标签会被暂时移除 DOM，并存入阻塞队列。
3.  **扫描**: 扫描页面中的 `<resource-share>` 标签，按顺序建立加载队列。
4.  **加载**:
    *   如果是**顶级页面**：直接发起网络请求。
    *   如果是**子页面**：先通过 `postMessage` 询问父页面是否有缓存。
5.  **执行**: 资源加载完成后，根据类型处理：
    *   **Script**: 构造带有 `sourceURL` 的代码，使用 `new Function` 执行，确保调试栈清晰。
    *   **Style**: 插入 `<style>` 标签或创建 Blob URL 链接。
6.  **释放**: 当所有 `<resource-share>` 资源就绪后，释放之前被阻塞的队列，触发页面的 `DOMContentLoaded` 和 `jQuery.ready` 等事件。

---

## 📜 更新日志

### V1.3.7.4 (Current)
*   **修正**: 修正了 `<resource-share>` 脚本的 SourceURL 路径映射规则，现在生成完整路径 + `VM_` 前缀文件名（例如 `https://.../VM_jquery.min.js`），便于在 DevTools 中识别资源来源。
*   **优化**: 保留了内联脚本的 `VM_pageName_index.js` 虚拟路径规则。

### V1.3.7.2
*   修复 Blob URL 执行时的无限拦截循环问题。
*   完善重试机制。

### V1.3.7
*   重构日志系统，分离 UI 日志和 DevTools 日志。
*   新增 `ResourceShareLogger` 类，统一管理日志输出。
*   UI 层不再判断日志级别，改为由 Logger 统一分发。

---

## ⚠️ 注意事项

1.  **同源策略**: 跨 iframe 共享功能目前仅适用于 **同源** 页面。跨域场景需要额外配置 CORS（安全保护，可修改）。
2.  **Inline Script 执行**: 内联脚本使用 `new Function` 执行，这意味着它无法直接访问块级作用域变量（如 `const` 声明在 `<script>` 标签顶部的变量），但全局变量（`var`, `window.xxx`）不受影响。建议将依赖全局变量的代码放在 ResourceShare 管理的队列之后。
3.  **动态插入脚本**: 系统通过 `MutationObserver` 监听 DOM 变化，动态插入的 `<script>` 也会被自动接管。

---

## 💡 常见问题 (FAQ)

**Q: 为什么我的页面一直显示 Loading？**
A: 可能是某个 `<resource-share>` 资源加载失败。请查看控制台是否有红色 `[ERROR]` 日志，或查看是否触发了错误诊断弹窗。

**Q: 如何关闭左下角的日志面板？**
A: 设置 `window.RS_CONFIG = { ENABLE_UI: false };` 或者在加载完成后点击面板上的“隐藏”/“关闭”按钮。

**Q: 这个系统能兼容所有老的 jQuery 插件吗？**
A: 可以。系统确保了 jQuery 及其插件按照你书写的顺序依次加载，完美解决 `jQuery is not defined` 的问题。