<!--
  ChartCard.vue - 图表卡片容器
-->
<template>
  <div class="chart-card">
    <div class="chart-header">
      <div class="chart-title-area">
        <h3 class="chart-title">{{ title }}</h3>
        <span class="chart-subtitle" v-if="subtitle">{{ subtitle }}</span>
      </div>
      <div class="chart-actions">
        <slot name="actions"></slot>
      </div>
    </div>
    <div class="chart-body" :style="{ height: height }">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
  height?: string
}

withDefaults(defineProps<Props>(), {
  subtitle: '',
  height: '300px'
})
</script>

<style scoped>
.chart-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 20px;
  transition: border-color var(--transition-base);
}

.chart-card:hover {
  border-color: var(--border-default);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.chart-title-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.chart-subtitle {
  font-size: 12px;
  color: var(--text-tertiary);
}

.chart-body {
  width: 100%;
  position: relative;
}
</style>
