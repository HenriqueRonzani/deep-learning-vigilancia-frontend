<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Icon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useInspectionsStore } from '@/stores/inspections'
import { categoryLabels, formatDate, formatSize } from '@/lib/format'
import type { Feedback } from '@/types/inspection'
const store = useInspectionsStore()
const route = useRoute()
const inspection = computed(() => store.inspections.find((i) => i.id === Number(route.params.id)))
const activeFile = ref('')
watch(
  inspection,
  (item) => {
    activeFile.value = item?.files[0]?.id || ''
  },
  { immediate: true },
)
const selected = computed(() => inspection.value?.files.find((f) => f.id === activeFile.value))
const feedbackMessage = ref('')
watch(activeFile, () => {
  feedbackMessage.value = ''
})
const time = ref(Date.now())
let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => {
    time.value = Date.now()
  }, 1000)
})
onUnmounted(() => clearInterval(timer))
const seconds = computed(() =>
  Math.max(0, Math.ceil(((inspection.value?.finishesAt ?? time.value) - time.value) / 1000)),
)
function saveFeedback(value: Feedback) {
  if (!inspection.value || !selected.value) return
  store.feedback(inspection.value.id, selected.value.id, value)
  feedbackMessage.value = 'Feedback salvo nesta sessão.'
}
</script>
<template>
  <section v-if="inspection">
    <RouterLink to="/" class="back-link"
      ><Icon name="back" :size="17" />Todas as solicitações</RouterLink
    >
    <div class="page-heading">
      <div>
        <div class="eyebrow">SOLICITAÇÃO #{{ inspection.id }}</div>
        <h1>{{ inspection.name }}</h1>
        <p>
          {{ formatDate(inspection.requested_at) }} <span class="inline-divider">/</span>
          {{ inspection.files.length }} {{ inspection.files.length === 1 ? 'arquivo' : 'arquivos' }}
        </p>
      </div>
      <StatusBadge :status="inspection.status" />
    </div>
    <div class="notice">
      <Icon name="info" />
      <p>
        <strong>Relatório demonstrativo.</strong> As sinalizações são fictícias e não resultam da
        análise dos arquivos. A confirmação de uma ocorrência cabe ao agente.
      </p>
    </div>
    <div v-if="inspection.status !== 'completed'" class="panel processing-panel" role="status">
      <div class="processing-symbol"><Icon name="clock" :size="30" /></div>
      <div>
        <h2>
          {{
            inspection.status === 'queued'
              ? 'Sua solicitação está na fila'
              : inspection.status === 'failed'
                ? 'Não foi possível concluir a análise'
                : 'Preparando os resultados de exemplo'
          }}
        </h2>
        <p>
          {{
            inspection.status === 'failed'
              ? 'Os arquivos continuam disponíveis para consulta.'
              : `Conclusão simulada em aproximadamente ${seconds} segundos. Você pode navegar enquanto aguarda.`
          }}
        </p>
      </div>
      <RouterLink class="text-link" to="/fila">Ver fila<Icon name="arrow" :size="17" /></RouterLink>
    </div>
    <div v-else class="summary-bar">
      <div><Icon name="checkCircle" /><strong>Análise finalizada</strong></div>
      <p>
        {{ inspection.files.filter((f) => f.report?.irregularity).length }} arquivo(s) com
        sinalizações de exemplo para revisão.
      </p>
    </div>
    <div class="detail-layout">
      <aside class="panel file-panel">
        <div class="panel-title">
          <h2>
            Arquivos <span class="count-badge">{{ inspection.files.length }}</span>
          </h2>
        </div>
        <div class="file-list">
          <button
            v-for="file in inspection.files"
            :key="file.id"
            class="file-option"
            :class="{ selected: file.id === activeFile }"
            :aria-pressed="file.id === activeFile"
            @click="activeFile = file.id"
          >
            <span class="row-icon"
              ><Icon :name="file.mime_type.startsWith('video/') ? 'video' : 'image'" /></span
            ><span
              ><strong>{{ file.name }}</strong
              ><small>{{ formatSize(file.size) }}</small></span
            ><Icon v-if="file.report?.user_feedback" name="checkCircle" :size="16" />
          </button>
        </div>
      </aside>
      <div v-if="selected" class="file-detail">
        <section class="panel preview-panel">
          <div class="panel-title">
            <h2 class="filename-title">{{ selected.name }}</h2>
            <span class="muted">{{
              selected.mime_type.startsWith('video/') ? 'Vídeo' : 'Imagem'
            }}</span>
          </div>
          <div class="media-viewer">
            <template v-if="selected.url"
              ><video
                v-if="selected.mime_type.startsWith('video/')"
                :key="selected.id"
                :src="selected.url"
                controls
                preload="metadata"
              >
                Seu navegador não suporta a reprodução deste vídeo.</video
              ><img v-else :src="selected.url" :alt="`Registro selecionado: ${selected.name}`"
            /></template>
            <div v-else class="preview-placeholder">
              <Icon name="image" :size="46" />
              <h3>Arquivo de demonstração</h3>
              <p>
                Este registro não possui uma imagem real.<br />Crie uma solicitação para visualizar
                seus próprios arquivos.
              </p>
            </div>
          </div>
        </section>
        <section class="panel report-panel">
          <div class="report-title">
            <span class="report-icon"><Icon name="file" /></span>
            <div>
              <h2>Relatório do arquivo</h2>
              <p>Resultado simulado · Revisão do agente</p>
            </div>
          </div>
          <template v-if="selected.report"
            ><span class="category-tag">{{
              selected.report.irregularity
                ? categoryLabels[selected.report.irregularity]
                : 'Nenhum alvo sinalizado'
            }}</span>
            <p class="report-text">{{ selected.report.agent_report }}</p>
            <div class="feedback-area">
              <div>
                <h3>A sinalização está correta?</h3>
                <p>Seu feedback ficará registrado nesta sessão.</p>
              </div>
              <div class="feedback-buttons">
                <button
                  class="button secondary"
                  :class="{ chosen: selected.report.user_feedback === 'correct' }"
                  :aria-pressed="selected.report.user_feedback === 'correct'"
                  @click="saveFeedback('correct')"
                >
                  <Icon name="check" :size="17" />Correta</button
                ><button
                  class="button secondary"
                  :class="{ chosen: selected.report.user_feedback === 'incorrect' }"
                  :aria-pressed="selected.report.user_feedback === 'incorrect'"
                  @click="saveFeedback('incorrect')"
                >
                  <Icon name="close" :size="17" />Incorreta
                </button>
              </div>
            </div>
            <p class="feedback-confirmation" role="status">
              {{
                feedbackMessage ||
                (selected.report.user_feedback ? 'Este arquivo já recebeu seu feedback.' : '')
              }}
            </p></template
          >
          <p v-else class="muted">
            O relatório aparecerá aqui quando o processamento simulado for concluído.
          </p>
        </section>
      </div>
    </div>
  </section>
  <section v-else class="panel empty-state">
    <Icon name="search" :size="40" />
    <h1>Solicitação não encontrada</h1>
    <p>Os dados de demonstração são reiniciados ao atualizar a página.</p>
    <RouterLink class="button primary" to="/">Voltar às solicitações</RouterLink>
  </section>
</template>
