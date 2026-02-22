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