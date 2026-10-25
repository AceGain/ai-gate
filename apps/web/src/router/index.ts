import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      redirect: '/overview',
      children: [
        {
          path: 'overview',
          name: 'overview',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: '概览' },
        },
        {
          path: 'providers',
          name: 'providers',
          component: () => import('@/views/ProvidersView.vue'),
          meta: { title: '供应商' },
        },
        {
          path: 'providers/:id',
          name: 'provider-detail',
          component: () => import('@/views/ProviderDetailView.vue'),
          meta: { title: '供应商' },
        },
        {
          path: 'routes',
          name: 'routes',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: '路由' },
        },
        {
          path: 'models',
          name: 'models',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: '虚拟模型' },
        },
        {
          path: 'agents',
          name: 'agents',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: '智能体' },
        },
        {
          path: 'skills',
          name: 'skills',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: 'Skill' },
        },
        {
          path: 'mcp',
          name: 'mcp',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: 'MCP' },
        },
        {
          path: 'usage',
          name: 'usage',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: '使用统计' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: '设置' },
        },
      ],
    },
  ],
})

export default router
