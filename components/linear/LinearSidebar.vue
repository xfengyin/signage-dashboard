<!--
  LinearSidebar.vue - 侧边导航栏
-->
<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <span class="logo-icon">📺</span>
        <span class="logo-text">Signage</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div
        v-for="item in navItems"
        :key="item.path"
        class="nav-item"
        :class="{ 'nav-item--active': currentPath === item.path }"
        @click="navigate(item.path)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="nav-item" @click="$emit('settings')">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">设置</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

interface NavItem {
  path: string
  label: string
  icon: string
}

const router = useRouter()
const currentPath = ref('/')

const navItems: NavItem[] = [
  { path: '/', label: '首页', icon: '📊' },
  { path: '/exceptions', label: '异常管理', icon: '⚠️' },
  { path: '/tasks', label: '任务管理', icon: '📋' },
  { path: '/components', label: '元器件', icon: '📦' },
  { path: '/ee-qual', label: 'EE Qual', icon: '🔧' },
  { path: '/leaderboard', label: '排行榜', icon: '🏆' },
  { path: '/import', label: '数据导入', icon: '📥' },
]

const navigate = (path: string) => {
  currentPath.value = path
  router.push(path)
}

defineEmits(['settings'])
</script>

<style scoped>
.sidebar {
  width: 240px;
  height: 100vh;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-nav {
  flex: 1;
  padding: 12px 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 16px;
  margin: 2px 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  position: relative;
}

.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-item--active {
  background: var(--accent-muted);
  color: var(--text-primary);
}

.nav-item--active::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--accent-primary);
  border-radius: 0 2px 2px 0;
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.nav-label {
  flex: 1;
}

.sidebar-footer {
  padding: 12px 0;
  border-top: 1px solid var(--border-subtle);
}
</style>
