# Auto Blocker 🛡️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/github/v/release/onedooge/x-auto-blocker)](https://github.com/onedooge/x-auto-blocker/releases)

自动检测并屏蔽 **X（Twitter）/ YouTube** 上发布不当内容的账号或视频。

---

## 双平台支持

| 平台 | 检测内容 | 命中后动作 |
|------|---------|-----------|
| **𝕏 X / Twitter** | 推文文本 + 用户名 | 先本地隐藏，惯犯达阈值 → 调用 X API 永久屏蔽账号 |
| **▶ YouTube** | 视频标题 + 频道名 | 本地隐藏视频（YouTube 没有屏蔽 API） |

popup 顶部「X / YouTube」一键切换，两个平台**完全独立**的关键词、白名单和记录。

---

## 功能介绍（按标签页顺序）

### ⚙️ 设置

- **X**：设置「屏蔽阈值」（1–99，默认 10）
  - 推文命中关键词 → 先本地隐藏（不影响 X 服务端，刷新即恢复）
  - 同一账号 24 小时内累计触发达阈值 → 升级为屏蔽账号
- **YouTube**：仅本地隐藏，无阈值机制

| 动作 | 范围 | 可逆性 |
|------|------|--------|
| 🟡 隐藏 | 仅本地浏览器 | 刷新/重装即恢复 |
| 🔴 屏蔽（仅 X） | 调用 X 屏蔽功能 | 需在 X 设置中手动解除 |

**数据备份**：底部「⬇️ 全部备份 / ⬆️ 全部恢复」打包**两个平台**全部数据成 JSON。换浏览器、升级插件、跨设备同步都用得上。导入采用智能合并（关键词/白名单去重并集，记录按 id 去重）。

### 🔑 关键词

- 支持中英文，不区分大小写
- 3 列网格展示，新加的排最前
- 单平台关键词导出/导入
- X 匹配推文文本和用户名；YouTube 匹配视频标题和频道名

### 🛡️ 白名单

白名单内的账号 / 频道**永不**被隐藏或屏蔽，即使触发关键词也跳过。

### 🚫 屏蔽（仅 X）

已被屏蔽账号的记录，点击跳转到对应推文。YouTube 平台无此标签。

### 👁️ 隐藏

被本地隐藏的内容记录（X 推文 / YouTube 视频）。X 平台还显示触发次数进度条，可预判哪些账号即将升级屏蔽。

---

## 安装方法（Chrome / Edge）

1. 从 [Releases](https://github.com/onedooge/x-auto-blocker/releases) 下载最新 zip 解压（或 clone 整个仓库）
2. 浏览器地址栏输入：
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. 右上角开启「**开发者模式**」
4. 点击「**加载已解压的扩展程序**」
5. 选择解压后的 `x-auto-blocker` 文件夹

---

## 使用方法

1. 打开 x.com 或 youtube.com
2. 点击浏览器右上角的插件图标
3. 顶部切换 X / YouTube 平台
4. 关键词 tab 添加要屏蔽的词
5. 回到页面刷新，命中的内容会自动隐藏

---

## 注意事项

- 屏蔽逻辑依赖 X / YouTube 的 DOM 结构，平台改版后可能需要更新选择器
- X 第一次用建议把阈值设大一点（比如 20），观察一段时间再调小
- 数据都存在浏览器本地（chrome.storage.local），换浏览器/重装插件会丢失，记得用「全部备份」
- 升级插件时**不要卸载重装**，用 `edge://extensions` 的 🔄 重新加载按钮就能保留数据

---

## 文件结构

```
x-auto-blocker/
├── manifest.json        # 插件配置
├── content.js           # X 主逻辑（检测+隐藏+屏蔽）
├── content_youtube.js   # YouTube 主逻辑（检测+隐藏）
├── popup.html           # 弹窗界面
├── popup.js             # 弹窗逻辑
├── icons/               # 图标
├── LICENSE              # MIT 开源协议
└── README.md
```

---

## 许可证

[MIT License](LICENSE) © 2026 [onedooge](https://github.com/onedooge)

随便用、随便改、随便商用，保留版权声明就行。
