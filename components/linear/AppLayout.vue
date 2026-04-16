<!--
  AppLayout.vue - 应用主布局
-->
<template>
  <div class="app-layout">
    <LinearSidebar />
    <main class="main-content">
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="page-title">{{ title }}</h1>
          <span class="page-subtitle" v-if="subtitle">{{ subtitle }}</span>
        </div>
        <div class="topbar-right">
          <slot name="actions"></slot>
        </div>
      </header>
      <div class="page-body">
        <slot></slot>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import LinearSidebar from './LinearSidebar.vue'

interface Props {
  title: string
  subtitle?: string
}

defineProps<Props>()
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary);
}

.main-content {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 60px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}

.topbar-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
}

.page-body {
  flex: 1;
  padding: 24px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
