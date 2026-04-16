<!--
  LinearBadge.vue - 徽章/标签组件
-->
<template>
  <span class="badge" :class="[`badge--${type}`]">
    <slot></slot>
  </span>
</template>

<script setup lang="ts">
interface Props {
  type?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

withDefaults(defineProps<Props>(), {
  type: 'default'
})
</script>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.badge--default {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.badge--success {
  background: var(--success-bg);
  color: var(--success);
}

.badge--warning {
  background: var(--warning-bg);
  color: var(--warning);
}

.badge--error {
  background: var(--error-bg);
  color: var(--error);
}

.badge--info {
  background: var(--info-bg);
  color: var(--info);
}
</style>
