<!--
  DashboardPage.vue - 仪表盘首页示例
  基于 Linear Design System
-->
<template>
  <AppLayout title="仪表盘" :subtitle="currentDate">
    <template #actions>
      <el-button type="primary" @click="refresh">
        <span>🔄</span> 刷新
      </el-button>
    </template>

    <!-- 统计卡片网格 -->
    <div class="stats-grid">
      <StatCard
        label="总任务数"
        :value="stats.totalTasks"
        :trend="8"
        icon="📋"
      />
      <StatCard
        label="进行中"
        :value="stats.inProgress"
        icon="⏳"
      />
      <StatCard
        label="已完成"
        :value="stats.completed"
        :trend="12"
        icon="✅"
      />
      <StatCard
        label="异常数"
        :value="stats.exceptions"
        :trend="-5"
        icon="⚠️"
      />
    </div>

    <!-- 图表网格 -->
    <div class="charts-grid">
      <ChartCard title="任务趋势" subtitle="近7天任务完成情况">
        <div ref="trendChartRef" style="width: 100%; height: 280px;"></div>
      </ChartCard>

      <ChartCard title="异常分布" subtitle="按类型统计">
        <div ref="pieChartRef" style="width: 100%; height: 280px;"></div>
      </ChartCard>
    </div>

    <!-- 最近异常列表 -->
    <div class="recent-section">
      <div class="section-header">
        <h3>最近异常</h3>
        <el-button link @click="$router.push('/exceptions')">查看全部 →</el-button>
      </div>
      <el-table :data="recentExceptions" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="type" label="类型">
          <template #default="{ row }">
            <LinearBadge :type="getBadgeType(row.severity)">
              {{ row.type }}
            </LinearBadge>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="assignee" label="负责人" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <LinearBadge :type="row.status === '已解决' ? 'success' : 'warning'">
              {{ row.status }}
            </LinearBadge>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="120" />
      </el-table>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { AppLayout, StatCard, ChartCard, LinearBadge } from '@/components/linear'
import * as echarts from 'echarts'

// 数据
const stats = ref({
  totalTasks: 128,
  inProgress: 23,
  completed: 105,
  exceptions: 8
})

const currentDate = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
})

const recentExceptions = ref([
  { id: 'EX-001', type: '软件', description: 'UI 响应延迟', assignee: '张三', status: '处理中', severity: 'warning', createdAt: '04-16' },
  { id: 'EX-002', type: '硬件', description: '显示屏闪烁', assignee: '李四', status: '已解决', severity: 'error', createdAt: '04-15' },
  { id: 'EX-003', type: '网络', description: '连接不稳定', assignee: '王五', status: '处理中', severity: 'info', createdAt: '04-15' },
])

const trendChartRef = ref<HTMLDivElement>()
const pieChartRef = ref<HTMLDivElement>()

// 图表
const initTrendChart = () => {
  if (!trendChartRef.value) return
  const chart = echarts.init(trendChartRef.value)
  chart.setOption({
    color: ['#5E6AD2', '#26BF94'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#222225',
      borderColor: '#3A3A3F',
      textStyle: { color: '#FAFAFA' }
    },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      axisLine: { lineStyle: { color: '#2A2A2E' } },
      axisLabel: { color: '#6B6B75' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#2A2A2E' } },
      axisLabel: { color: '#6B6B75' }
    },
    series: [
      { name: '完成', type: 'line', smooth: true, data: [12, 18, 15, 22, 19, 25, 20] },
      { name: '新增', type: 'line', smooth: true, data: [8, 12, 10, 15, 14, 18, 12] }
    ]
  })
}

const initPieChart = () => {
  if (!pieChartRef.value) return
  const chart = echarts.init(pieChartRef.value)
  chart.setOption({
    color: ['#5E6AD2', '#26BF94', '#F5A623', '#F52B3F', '#3DD9D9'],
    tooltip: {
      backgroundColor: '#222225',
      borderColor: '#3A3A3F',
      textStyle: { color: '#FAFAFA' }
    },
    legend: {
      orient: 'vertical',
      right: 20,
      top: 'center',
      textStyle: { color: '#A0A0A8' }
    },
    series: [{
      type: 'pie',
      radius: ['50%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      data: [
        { value: 35, name: '软件问题' },
        { value: 25, name: '硬件问题' },
        { value: 20, name: '网络问题' },
        { value: 12, name: '配置错误' },
        { value: 8, name: '其他' }
      ]
    }]
  })
}

const refresh = () => {
  // 刷新数据逻辑
  console.log('Refreshing...')
}

const getBadgeType = (severity: string) => {
  const map: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    info: 'info',
    warning: 'warning',
    error: 'error'
  }
  return map[severity] || 'default'
}

onMounted(() => {
  initTrendChart()
  initPieChart()
})
</script>

<style scoped>
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
  margin-bottom: var(--space-6);
}

.recent-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

@media (max-width: 1200px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .stats-grid { grid-template-columns: 1fr; }
}
</style>
