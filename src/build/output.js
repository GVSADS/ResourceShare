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