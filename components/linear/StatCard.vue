<!--
  Linear Style Vue 3 组件库
  基于 DESIGN.md 规范，适用于 Signage Dashboard

  使用方式：
  1. 复制 components/linear/ 目录到项目 src/components/linear/
  2. 在 main.ts 中全局注册，或按需引入
-->

<!-- ========== StatCard.vue - 统计卡片 ========== -->
<template>
  <div class="stat-card" :class="{ 'stat-card--clickable': clickable }">
    <div class="stat-header">
      <span class="stat-icon" v-if="icon">{{ icon }}</span>
      <span class="stat-label">{{ label }}</span>
    </div>
    <div class="stat-value">{{ formattedValue }}</div>
    <div class="stat-trend" :class="trendClass" v-if="trend !== undefined">
      <span class="stat-trend-icon">{{ trendIcon }}</span>
      <span>{{ Math.abs(trend) }}%</span>
    </div>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label: string
  value: number | string
  trend?: number
  icon?: string
  clickable?: boolean
  format?: 'number' | 'percent' | 'currency'
}

const props = withDefaults(defineProps<Props>(), {
  trend: undefined,
  icon: '',
  clickable: false,
  format: 'number'
})

const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value
  switch (props.format) {
    case 'percent': return `${props.value}%`
    case 'currency': return `¥${props.value.toLocaleString()}`
    default: return props.value.toLocaleString()
  }
})

const trendClass = computed(() => ({
  'stat-trend--up': props.trend! > 0,
  'stat-trend--down': props.trend! < 0,
  'stat-trend--neutral': props.trend === 0
}))

const trendIcon = computed(() => {
  if (props.trend! > 0) return '↑'
  if (props.trend! < 0) return '↓'
  return '→'
})
</script>

<style scoped>
.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 20px;
  transition: border-color var(--transition-base);
}

.stat-card--clickable {
  cursor: pointer;
}

.stat-card--clickable:hover {
  border-color: var(--border-default);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-icon {
  font-size: 16px;
  opacity: 0.7;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: var(--text-primary);
  line-height: 1;
  margin-bottom: 8px;
}

.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.stat-trend--up {
  color: var(--success);
  background: var(--success-bg);
}

.stat-trend--down {
  color: var(--error);
  background: var(--error-bg);
}

.stat-trend--neutral {
  color: var(--text-secondary);
  background: var(--bg-tertiary);
}
</style>
