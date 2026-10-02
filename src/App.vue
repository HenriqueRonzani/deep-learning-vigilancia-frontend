<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import Icon from '@/components/AppIcon.vue'
import { useInspectionsStore } from '@/stores/inspections'
const store = useInspectionsStore()
const route = useRoute()
function focusMain() {
  document.getElementById('main')?.focus()
}
let timer: ReturnType<typeof setInterval>
let pollTimer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => store.tick(Date.now()), 1000)
  pollTimer = setInterval(() => {
    void store.poll()
  }, 5000)
})
onUnmounted(() => {
  clearInterval(timer)
  clearInterval(pollTimer)
  store.dispose()
})
watch(
  () => route.meta.title,
  (title) => {
    document.title = `${String(title || 'Vigia')} · Vigia`
  },
  { immediate: true },
)
</script>
<template>
  <a class="skip-link" href="#main" @click.prevent="focusMain">Pular para o conteúdo</a>
  <aside class="sidebar">
    <RouterLink to="/" class="brand" aria-label="Vigia — início"
      ><span class="brand-mark">V</span
      ><span
        >vigia<span class="brand-dot">.</span><small>INTELIGÊNCIA SANITÁRIA</small></span
      ></RouterLink
    >
    <div class="workspace-label">ÁREA DE TRABALHO</div>
    <nav aria-label="Navegação principal">
      <RouterLink to="/" :class="{ active: route.path === '/' }"
        ><Icon name="grid" />Solicitações</RouterLink
      >
      <RouterLink to="/fila" :class="{ active: route.path === '/fila' }"
        ><Icon name="clock" />Fila de análises
        <span class="nav-count">{{ store.pending.length }}</span></RouterLink
      >
      <RouterLink to="/finalizadas" :class="{ active: route.path === '/finalizadas' }"
        ><Icon name="checkCircle" />Finalizadas</RouterLink
      >
    </nav>
    <div class="sidebar-note">
      <Icon name="shield" :size="24" /><strong>Tecnologia a serviço<br />da saúde pública.</strong>
      <p>Apoio à fiscalização com<br />um novo ponto de vista.</p>
    </div>
    <div class="organization">
      <span class="organization-icon"><Icon name="pin" /></span>
      <div>Vigilância Sanitária<small>Criciúma · Santa Catarina</small></div>
    </div>
  </aside>
  <div class="app-content">
    <header class="topbar">
      <div>
        <span class="breadcrumb">Fiscalização</span><span class="slash">/</span
        ><span>{{ route.meta.title }}</span>
      </div>
      <span class="demo-tag"
        ><span></span>{{ store.isDemo ? 'Ambiente de demonstração' : 'Modo API' }}</span
      >
    </header>
    <main id="main" tabindex="-1">
      <p v-if="store.pollingError" role="alert" class="error-box">{{ store.pollingError }}</p>
      <RouterView />
    </main>
    <footer>Projeto Integrador · Deep Learning<span>Vigilância Sanitária de Criciúma</span></footer>
  </div>
</template>
