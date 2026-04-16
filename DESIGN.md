# DESIGN.md — Signage Dashboard 设计规范

基于 Linear App 设计系统的专业仪表盘规范。

---

## 1. Visual Theme & Atmosphere

**氛围**: 专业数据仪表盘，超极简主义，强调信息密度与精确感。

- **密度**: 高信息密度，但保持呼吸感（卡片间距24px）
- **风格**: Linear式极简——无多余装饰，每个元素都有存在的理由
- **情绪**: 精确、冷静、专业、高效

---

## 2. Color Palette & Roles

```css
:root {
  /* 背景层 */
  --bg-primary: #0D0D0F;          /* 主背景 - 深黑 */
  --bg-secondary: #141416;        /* 次级背景 - 卡片 */
  --bg-tertiary: #1C1C1F;         /* 三级背景 - 悬停 */
  --bg-elevated: #222225;         /* 抬起层 - 弹窗/下拉 */

  /* 边框 */
  --border-subtle: #2A2A2E;       /* 细分边框 */
  --border-default: #3A3A3F;      /* 默认边框 */
  --border-strong: #4A4A50;        /* 强调边框 */

  /* 文字 */
  --text-primary: #FAFAFA;        /* 主文字 */
  --text-secondary: #A0A0A8;      /* 次级文字 */
  --text-tertiary: #6B6B75;       /* 辅助文字 */
  --text-inverse: #0D0D0F;        /* 反色文字 */

  /* 强调色 */
  --accent-primary: #5E6AD2;      /* Linear Purple - 主强调 */
  --accent-hover: #6E7AE2;        /* 悬停态 */
  --accent-muted: rgba(94,106,210,0.15);

  /* 语义色 */
  --success: #26BF94;             /* 成功绿 */
  --warning: #F5A623;              /* 警告橙 */
  --error: #F52B3F;               /* 错误红 */
  --info: #5E6AD2;                /* 信息紫 */

  /* 图表色板 */
  --chart-1: #5E6AD2;             /* 紫 */
  --chart-2: #26BF94;             /* 绿 */
  --chart-3: #F5A623;             /* 橙 */
  --chart-4: #F52B3F;             /* 红 */
  --chart-5: #3DD9D9;             /* 青 */
}
```

---

## 3. Typography Rules

**字体**: Inter（正文）+ JetBrains Mono（数字/代码）

```css
/* 字体栈 */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* 字号层级 */
--text-3xs: 10px;    /* 标签/徽章 */
--text-2xs: 11px;    /* 小注释 */
--text-xs: 12px;     /* 次级说明 */
--text-sm: 13px;     /* 表格内容 */
--text-base: 14px;   /* 正文 */
--text-lg: 16px;     /* 标题 */
--text-xl: 20px;     /* 页面标题 */
--text-2xl: 24px;    /* 大标题 */
--text-3xl: 32px;    /* 统计数字 */

/* 字重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;

/* 行高 */
--leading-tight: 1.2;
--leading-normal: 1.5;
```

---

## 4. Component Stylings

### 4.1 按钮

```css
.btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

/* Primary */
.btn-primary {
  background: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}
.btn-primary:hover { background: var(--accent-hover); }

/* Secondary */
.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-subtle);
}
.btn-secondary:hover { background: var(--bg-elevated); border-color: var(--border-default); }

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover { background: var(--bg-tertiary); color: var(--text-primary); }

/* Danger */
.btn-danger {
  background: var(--error);
  color: white;
}

/* 尺寸变体 */
.btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
.btn-lg { height: 40px; padding: 0 16px; font-size: 14px; }
```

### 4.2 卡片

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 16px;
  transition: border-color 0.15s ease;
}
.card:hover { border-color: var(--border-default); }

/* 卡片头部 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
```

### 4.3 统计卡片

```css
.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 20px;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  margin-top: 8px;
  padding: 2px 6px;
  border-radius: 4px;
}
.stat-trend.up { color: var(--success); background: rgba(38,191,148,0.1); }
.stat-trend.down { color: var(--error); background: rgba(245,43,63,0.1); }
```

### 4.4 表格

```css
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.table td {
  padding: 12px;
  font-size: 13px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-subtle);
}

.table tr:hover td { background: var(--bg-tertiary); }
.table tr:last-child td { border-bottom: none; }
```

### 4.5 徽章/标签

```css
.badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
}

.badge-default { background: var(--bg-tertiary); color: var(--text-secondary); }
.badge-success { background: rgba(38,191,148,0.15); color: var(--success); }
.badge-warning { background: rgba(245,166,35,0.15); color: var(--warning); }
.badge-error { background: rgba(245,43,63,0.15); color: var(--error); }
.badge-info { background: rgba(94,106,210,0.15); color: var(--info); }
```

### 4.6 导航侧边栏

```css
.sidebar {
  width: 240px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-subtle);
  padding: 16px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.1s ease;
}

.nav-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.nav-item.active { color: var(--text-primary); background: var(--accent-muted); }
.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  width: 2px;
  height: 20px;
  background: var(--accent-primary);
  border-radius: 0 2px 2px 0;
}
```

### 4.7 输入框

```css
.input {
  height: 36px;
  padding: 0 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-primary);
  transition: all 0.15s ease;
}

.input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-muted);
}

.input::placeholder { color: var(--text-tertiary); }
```

---

## 5. Layout Principles

### 网格系统

```css
/* 间距 */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;

/* 容器 */
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--space-6);
}

/* 页面布局 */
.page-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.page-content {
  padding: var(--space-6);
}

/* 卡片网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}
```

### 断点

```css
@media (max-width: 1200px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .page-layout { grid-template-columns: 1fr; }
  .sidebar { display: none; }
  .stats-grid { grid-template-columns: 1fr; }
}
```

---

## 6. Depth & Elevation

```css
/* 阴影系统 */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
--shadow-md: 0 4px 12px rgba(0,0,0,0.4);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
--shadow-glow: 0 0 20px rgba(94,106,210,0.3);

/* 层级 */
--z-dropdown: 100;
--z-sticky: 200;
--z-modal: 300;
--z-toast: 400;
```

---

## 7. Do's and Don'ts

### ✅ 这样做

- 使用 `var(--text-secondary)` 作为辅助信息，避免纯白文字造成视觉疲劳
- 统计数字使用 `JetBrains Mono` 等宽字体，数字更整齐
- 卡片统一圆角 `8px`，保持视觉一致性
- 悬停态使用微妙的颜色变化，而非大范围高亮
- 重要数据使用强调色 `accent-primary`，但克制使用

### ❌ 不要这样做

- 避免在深色背景上使用过亮的颜色（纯白 `#FFFFFF` 仅用于大标题）
- 不要混用多种强调色，保持一个主强调色
- 避免过大的阴影，Linear 风格依赖边框而非阴影
- 不要在表格中使用过多颜色，保持中性
- 避免使用过多的圆角，半径不超过 `8px`

---

## 8. Responsive Behavior

```css
/* 触控友好 */
@media (pointer: coarse) {
  .btn, .input { min-height: 44px; }
  .nav-item { min-height: 48px; }
}

/* 折叠策略 */
.hide-mobile { /* 默认显示 */ }
@media (max-width: 768px) {
  .hide-mobile { display: none; }
}
```

---

## 9. Agent Prompt Guide

### 快速颜色参考

```
背景: #0D0D0F (主) / #141416 (卡片) / #1C1C1F (悬停)
文字: #FAFAFA (主) / #A0A0A8 (次) / #6B6B75 (辅助)
强调: #5E6AD2 (紫)
成功: #26BF94 | 警告: #F5A623 | 错误: #F52B3F
边框: #2A2A2E (细) / #3A3A3F (默认)
```

### 即用型提示词

```
按照 DESIGN.md 的 Linear 风格重写 Signage Dashboard 前端：
- 使用深色主题 (#0D0D0F 背景)
- 紫色强调色 (#5E6AD2)
- Inter + JetBrains Mono 字体
- 卡片圆角 8px，边框 #2A2A2E
- 统计数字使用等宽字体，字号 32px
```

---

## 页面结构示例

### 仪表盘首页

```
┌─────────────────────────────────────────────────────────────┐
│  ≡  Signage Dashboard              [搜索] [通知] [头像]     │
├──────────┬──────────────────────────────────────────────────┤
│          │  📊 仪表盘    2026年4月16日                        │
│  📊 首页  │                                                  │
│  ⚠️ 异常  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  📋 任务  │  │ 总任务 │ │ 进行中 │ │ 已完成 │ │ 异常数 │          │
│  📦 元器件│  │  128  │ │   23  │ │  105  │ │   8   │          │
│  🏆 排行  │  └──────┘ └──────┘ └──────┘ └──────┘          │
│  📥 导入  │                                                  │
│          │  ┌─────────────────┐ ┌─────────────────┐        │
│          │  │   任务趋势图     │ │   异常分布图     │        │
│          │  │   (ECharts)     │ │   (ECharts)     │        │
│          │  └─────────────────┘ └─────────────────┘        │
└──────────┴──────────────────────────────────────────────────┘
```

### 排行榜页

```
┌─────────────────────────────────────────────────────────────┐
│  🏆 排行榜                                      [时间筛选]  │
├──────────┬──────────────────────────────────────────────────┤
│  📊 首页  │  ┌──────────────────────────────────────────┐    │
│  ⚠️ 异常  │  │ #1  🏅 张三          处理: 45  得分: 98   │    │
│  📋 任务  │  │ #2  🥈 李四          处理: 38  得分: 92   │    │
│  📦 元器件│  │ #3  🥉 王五          处理: 32  得分: 88   │    │
│  🏆 排行  │  │ #4     赵六          处理: 28  得分: 85   │    │
│  📥 导入  │  └──────────────────────────────────────────┘    │
└──────────┴──────────────────────────────────────────────────┘
```
