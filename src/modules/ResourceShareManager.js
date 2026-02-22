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
                                else if (resource.type === 'style') await this.injectStyle(content, resource.url);
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

        // V1.3.7.4 [修正版]: 生成内联脚本 SourceURL
        // 增强了文件名清理逻辑，防止特殊字符破坏 SourceMap
        generateInlineScriptSourceURL() {
            let pageName = 'unknown';
            try {
                const pathParts = window.location.pathname.split('/');
                let fileName = pathParts[pathParts.length - 1];
                if (!fileName || fileName.endsWith('/')) fileName = 'index';
                
                // 去除文件扩展名
                const lastDot = fileName.lastIndexOf('.');
                if (lastDot > -1) fileName = fileName.substring(0, lastDot);
                
                // 过滤非法字符 (防止路径包含 ? 等查询符)
                fileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
                if (fileName.length === 0) fileName = 'page';
                pageName = fileName;
            } catch (e) {
                pageName = 'unknown';
            }
            
            const index = this.scriptExecuteCounter++;
            const randomStr = generateRandomString(6);
            
            // 返回当前域下的虚拟路径
            return `./RS_VM/VM_${pageName}_inline_${index}_${randomStr}.js`;
        }

        // V1.3.7.4 [修正版]: 生成 resource-share 虚拟 SourceURL
        // 解决异源加载时 sourceURL 映射无效的问题，统一映射为当前域名的虚拟路径
        getResourceShareSourceURL(url) {
            try {
                // 解析 URL 获取原始文件名
                const urlObj = new URL(url, window.location.href);
                let filename = urlObj.pathname.split('/').pop(); 
                
                // 如果文件名为空（如以 / 结尾），使用默认名
                if (!filename) filename = 'resource.js';

                // 1. 移除查询参数和哈希 (保留纯文件名)
                // 避免生成 VM_jquery.min.js?v=1.0.js 这种无效路径
                const queryIndex = filename.indexOf('?');
                if (queryIndex !== -1) filename = filename.substring(0, queryIndex);
                const hashIndex = filename.indexOf('#');
                if (hashIndex !== -1) filename = filename.substring(0, hashIndex);

                // 2. 过滤文件名中的非法字符
                // 保留字母、数字、点、下划线、连字符，其他替换为下划线
                filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

                // 3. 添加 VM_ 前缀
                const vmFilename = 'VM_' + filename;

                // 4. 返回相对路径而非绝对路径
                // 使用 ./RS_VM/ 前缀，确保该文件在当前页面源下显示
                return `./RS_VM/${vmFilename}`;
            } catch (e) {
                // 解析失败时的回退方案
                const safeName = url.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50);
                return `./RS_VM/VM_${safeName}.js`;
            }
        }

        async executeScript(content, sourceUrl = 'Unknown') {
            return new Promise((resolve, reject) => {
                if (!content) { resolve(); return; }

                // 1. 生成干净的 SourceURL
                const cleanSourceUrl = sourceUrl.replace(/^\.\//, '');
                
                // 2. 追加 SourceURL 到代码末尾，确保 Chrome DevTools 能正确映射
                const codeWithSourceMap = `${content}\n//# sourceURL=${cleanSourceUrl}`;

                try {
                    // 3. 创建 Blob 对象
                    const blob = new Blob([codeWithSourceMap], { type: 'text/javascript' });
                    const blobUrl = URL.createObjectURL(blob);
                    
                    // 4. 创建真实的 Script 标签
                    const script = document.createElement('script');
                    script.src = blobUrl;
                    script.type = 'text/javascript';
                    
                    // 5. 关键：设置 Layui 需要的数据属性
                    // 当浏览器通过 src 执行 blob 时，document.currentScript 将指向这个 script 标签
                    // 我们设置一个自定义属性，以便在获取 src 时能还原出逻辑路径（虽然 Layui 主要读取 blobUrl 本身）
                    script.setAttribute('data-resource-share-src', cleanSourceUrl);
                    
                    // 6. 标记为 ResourceShare 内部标签，防止被拦截
                    script.setAttribute('data-resource-share', 'executing');

                    // 7. 处理加载结果
                    script.onload = () => {
                        this.log(`JS 已执行 [${cleanSourceUrl}]`, 'success');
                        // 执行成功后，释放 Blob URL 内存
                        URL.revokeObjectURL(blobUrl);
                        resolve();
                    };

                    script.onerror = (e) => {
                        this.log(`JS 执行出错 [${cleanSourceUrl}]`, 'danger');
                        // 只有在发生真正错误时才打印堆栈，避免干扰
                        console.error('ResourceShare Script Error:', e);
                        URL.revokeObjectURL(blobUrl);
                        resolve(); // 即使出错也要 resolve，防止卡死后续流程
                    };

                    // 8. 插入页面触发执行
                    document.head.appendChild(script);

                } catch (error) {
                    reject(error);
                }
            });
        }

        async injectStyle(content, sourceUrl = 'Unknown') {
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
                        // 1. 生成干净的 SourceURL
                        const cleanSourceUrl = sourceUrl.replace(/^\.\//, '');
                        
                        // 2. 创建一个临时的 link 标签，用于解析相对路径
                        // 但不直接添加到文档中
                        const tempLink = document.createElement('link');
                        tempLink.href = sourceUrl;
                        
                        // 3. 获取完整的基础 URL
                        const baseUrl = tempLink.href;
                        
                        // 4. 使用 DOMParser 解析 CSS 内容，替换相对路径
                        const parser = new DOMParser();
                        const cssDoc = parser.parseFromString(`<style>${content}</style>`, 'text/html');
                        const styleElement = cssDoc.querySelector('style');
                        
                        // 5. 替换 CSS 中的相对路径
                        let processedContent = styleElement.textContent;
                        
                        // 匹配 CSS 中的 url() 函数
                        processedContent = processedContent.replace(/url\(['"]?(?!data:|http:|https:)([^'")]+)['"]?\)/g, (match, path) => {
                            // 解析相对路径为绝对路径
                            const absoluteUrl = new URL(path, baseUrl).href;
                            return `url('${absoluteUrl}')`;
                        });
                        
                        // 6. 创建 Blob 对象
                        const cssWithSourceMap = `${processedContent}\n/*# sourceURL=${cleanSourceUrl} */`;
                        const blob = new Blob([cssWithSourceMap], { type: 'text/css' });
                        const blobUrl = URL.createObjectURL(blob);
                        
                        // 7. 创建 link 标签
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = blobUrl;
                        
                        // 8. 标记为 ResourceShare 内部标签，防止被拦截
                        link.setAttribute('data-resource-share', 'executing');
                        
                        // 9. 处理加载结果
                        link.onload = () => {
                            this.log(`CSS 已注入 [${cleanSourceUrl}]`, 'success');
                            // 执行成功后，释放 Blob URL 内存
                            URL.revokeObjectURL(blobUrl);
                            resolve();
                        };

                        link.onerror = () => {
                            this.log(`CSS 注入出错 [${cleanSourceUrl}]`, 'danger');
                            URL.revokeObjectURL(blobUrl);
                            resolve();
                        };

                        // 10. 插入页面
                        document.head.appendChild(link);
                    } catch (error) { 
                        this.log(`CSS注入出错: ${error.message}`, 'danger'); 
                        // 降级方案：使用原来的 Blob URL 方式
                        try {
                            const cleanSourceUrl = sourceUrl.replace(/^\.\//, '');
                            const cssWithSourceMap = `${content}\n/*# sourceURL=${cleanSourceUrl} */`;
                            const blob = new Blob([cssWithSourceMap], { type: 'text/css' });
                            const blobUrl = URL.createObjectURL(blob);
                            const link = document.createElement('link');
                            link.rel = 'stylesheet';
                            link.href = blobUrl;
                            link.setAttribute('data-resource-share', 'executing');
                            link.onload = () => {
                                this.log(`CSS(Blob) 已注入 [${cleanSourceUrl}]`, 'success');
                                URL.revokeObjectURL(blobUrl);
                                resolve();
                            };
                            link.onerror = () => {
                                this.log(`CSS(Blob) 注入出错 [${cleanSourceUrl}]`, 'danger');
                                URL.revokeObjectURL(blobUrl);
                                resolve();
                            };
                            document.head.appendChild(link);
                        } catch (fallbackError) {
                            this.log(`CSS注入降级方案失败: ${fallbackError.message}`, 'danger');
                            resolve();
                        }
                    }
                }
            });
        }
    };
}