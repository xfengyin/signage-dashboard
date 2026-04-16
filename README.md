# Signage Dashboard - Linear Design System

基于 Linear App 设计风格的专业仪表盘 UI 规范。

## 📦 文件结构

```
signage-dashboard/
├── DESIGN.md                           # 设计规范主文档
├── styles/
│   └── linear-variables.css             # CSS 变量（可直接导入 Vue 项目）
├── components/linear/
│   ├── index.ts                         # 统一导出
│   ├── AppLayout.vue                    # 应用主布局
│   ├── LinearSidebar.vue               # 侧边导航
│   ├── StatCard.vue                    # 统计卡片
│   ├── LinearBadge.vue                 # 徽章标签
│   └── ChartCard.vue                   # 图表卡片容器
└── examples/
    └── DashboardPage.vue               # 仪表盘首页示例
```

## 🚀 快速开始

### 1. 导入 CSS 变量

在 `main.ts` 或 `App.vue` 中导入：

```typescript
import '@/styles/linear-variables.css'
```

### 2. 使用组件

```vue
<script setup lang="ts">
import { AppLayout, StatCard, ChartCard, LinearBadge } from '@/components/linear'
</script>

<template>
  <AppLayout title="仪表盘" subtitle="2026年4月16日">
    <!-- 统计卡片 -->
    <StatCard label="总任务" :value="128" :trend="8" />

    <!-- 徽章 -->
    <LinearBadge type="success">已解决</LinearBadge>

    <!-- 图表卡片 -->
    <ChartCard title="任务趋势">
      <div ref="chartRef" style="width:100%;height:300px;"></div>
    </ChartCard>
  </AppLayout>
</template>
```

### 3. 全局注册组件

在 `main.ts` 中：

```typescript
import * as LinearComponents from '@/components/linear'

// Vue 3
const app = createApp(App)
Object.entries(LinearComponents).forEach(([name, component]) => {
  app.component(name, component)
})
```

## 🎨 核心规范速查

| 元素 | 规范 |
|------|------|
| 主背景 | `#0D0D0F` |
| 卡片背景 | `#141416` |
| 悬停背景 | `#1C1C1F` |
| 强调色 | `#5E6AD2` |
| 边框 | `#2A2A2E` |
| 主文字 | `#FAFAFA` |
| 次级文字 | `#A0A0A8` |
| 卡片圆角 | `8px` |
| 按钮圆角 | `6px` |
| 间距基准 | `4px` 倍数 |
| 字体 | Inter + JetBrains Mono |

## 📊 页面布局模板

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

## 🔧 Element Plus 覆盖说明

已内置 Element Plus 组件的 Linear 风格覆盖，包括：

- `el-button--primary` - 紫色主题按钮
- `el-card` - 深色卡片样式
- `el-input` - 深色输入框 + focus 紫色发光
- `el-table` - 深色表格 + 悬停高亮
- `el-pagination` - 深色分页器

## 📝 ECharts 主题配置

图表组件使用以下统一配置：

```typescript
const chartTheme = {
  backgroundColor: 'transparent',
  textStyle: { color: '#A0A0A8' },
  tooltip: {
    backgroundColor: '#222225',
    borderColor: '#3A3A3F',
    textStyle: { color: '#FAFAFA' }
  },
  legend: {
    textStyle: { color: '#A0A0A8' }
  },
  grid: {
    borderColor: '#2A2A2E'
  }
}
```

## 📱 响应式断点

| 断点 | 屏幕宽度 | 布局变化 |
|------|---------|---------|
| Desktop | > 1200px | 4列统计 / 2列图表 |
| Tablet | 768-1200px | 2列统计 / 1列图表 |
| Mobile | < 768px | 侧边栏隐藏 / 1列布局 |

---

**遵循此规范开发，界面将呈现与 Linear App 一致的专业质感。**
