import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // Hash routes work with S3/CloudFront without fallback rewrite rules.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/views/InspectionsView.vue'),
      meta: { title: 'Solicitações' },
    },
    {
      path: '/nova',
      component: () => import('@/views/NewInspectionView.vue'),
      meta: { title: 'Nova solicitação' },
    },
    {
      path: '/fila',
      component: () => import('@/views/InspectionsView.vue'),
      meta: { title: 'Fila de análises' },
    },
    {
      path: '/finalizadas',
      component: () => import('@/views/InspectionsView.vue'),
      meta: { title: 'Finalizadas' },
    },
    {
      path: '/solicitacoes/:id',
      component: () => import('@/views/DetailView.vue'),
      meta: { title: 'Detalhes da solicitação' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
