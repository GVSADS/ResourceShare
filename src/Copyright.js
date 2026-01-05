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