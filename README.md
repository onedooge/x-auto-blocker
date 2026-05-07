# X Auto Blocker 🛡️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/github/v/release/onedooge/x-auto-blocker)](https://github.com/onedooge/x-auto-blocker/releases)

自动检测并屏蔽 X（Twitter）上发布不当内容的账号。

---

## 功能介绍（按标签页顺序）

### ⚙️ 设置

设置「**屏蔽阈值**」，决定一个账号触发多少次后被永久屏蔽。

- 推文命中关键词 → **先本地隐藏**（不影响 X 服务端，刷新即恢复）
- 同一账号 24 小时内累计触发达到阈值 → **升级为屏蔽账号**（调用 X 屏蔽 API，需在 X 设置里手动解除）
- 阈值可调，范围 1–99，默认 10

| 动作 | 范围 | 可逆性 |
|------|------|--------|
| 🟡 隐藏推文 | 仅本地浏览器 | 刷新即恢复 |
| 🔴 屏蔽账号 | 调用 X 屏蔽功能 | 需手动解除 |

**数据备份**：底部「⬇️ 全部备份 / ⬆️ 全部恢复」可以把所有数据（关键词、白名单、记录、设置）打包成 JSON。换浏览器、升级插件、跨设备同步都用得上。导入采用智能合并（关键词/白名单去重并集，记录按 id 去重）。

### 🔑 关键词

- 支持中英文，不区分大小写
- 增删自由
- **导出备份**：把当前关键词列表存成 JSON 文件
- **导入恢复**：从 JSON 文件批量导入（自动去重）
- 列表按最新添加排序，新加的在最上面

### 🛡️ 白名单

加入白名单的账号**永远不会**被隐藏或屏蔽，即使触发关键词也跳过。
适合给信任的朋友、官方账号开绿灯。

### 🚫 屏蔽

查看所有已被屏蔽账号的记录，点击可跳转到对应推文。

### 👁️ 隐藏

查看所有被本地隐藏的推文记录，附带触发次数进度条，可以预判哪些账号即将升级屏蔽。

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

1. 打开 x.com，登录账号
2. 点击浏览器右上角的插件图标
3. 确认底部状态显示「运行中」
4. 插件会自动扫描并处理命中关键词的推文

---

## 注意事项

- 屏蔽逻辑依赖 X 页面 DOM 结构，X 改版后可能需要更新选择器
- 第一次用建议把阈值设大一点（比如 20），观察一段时间再调小
- 关键词、白名单、记录都存在浏览器本地（chrome.storage.local），换浏览器/重装会丢失，记得用导出备份

---

## 文件结构

```
x-auto-blocker/
├── manifest.json   # 插件配置
├── content.js      # 主逻辑（检测+隐藏+屏蔽）
├── popup.html      # 弹窗界面
├── popup.js        # 弹窗逻辑
├── icons/          # 图标
├── LICENSE         # MIT 开源协议
└── README.md
```

---

## 许可证

[MIT License](LICENSE) © 2026 [onedooge](https://github.com/onedooge)

随便用、随便改、随便商用，保留版权声明就行。
