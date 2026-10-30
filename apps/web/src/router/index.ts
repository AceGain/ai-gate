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
          meta: { titleKey: 'nav.overview' },
        },
        {
          path: 'providers',
          name: 'providers',
          component: () => import('@/views/ProvidersView.vue'),
          meta: { titleKey: 'nav.providers' },
        },
        {
          path: 'providers/:id',
          name: 'provider-detail',
          component: () => import('@/views/ProviderDetailView.vue'),
          meta: {
            titleKey: 'common.configure',
            breadcrumbs: [
              { labelKey: 'nav.providers', to: '/providers' },
              { labelKey: 'common.configure' },
            ],
          },
        },
        {
          path: 'routes',
          name: 'routes',
          component: () => import('@/views/HomeView.vue'),
          meta: { titleKey: 'nav.routes' },
        },
        {
          path: 'models',
          name: 'models',
          component: () => import('@/views/HomeView.vue'),
          meta: { titleKey: 'nav.models' },
        },
        {
          path: 'agents',
          name: 'agents',
          component: () => import('@/views/HomeView.vue'),
          meta: { titleKey: 'nav.agents' },
        },
        {
          path: 'skills',
          name: 'skills',
          component: () => import('@/views/HomeView.vue'),
          meta: { titleKey: 'nav.skills' },
        },
        {
          path: 'mcp',
          name: 'mcp',
          component: () => import('@/views/HomeView.vue'),
          meta: { titleKey: 'nav.mcp' },
        },
        {
          path: 'usage',
          name: 'usage',
          component: () => import('@/views/HomeView.vue'),
          meta: { titleKey: 'nav.usage' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
          meta: { titleKey: 'nav.settings' },
        },
      ],
    },
  ],
})

export default router
