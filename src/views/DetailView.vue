<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Icon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useInspectionsStore } from '@/stores/inspections'
import { categoryLabels, demandLabels, formatDate, formatSize } from '@/lib/format'
import type { Feedback } from '@/types/inspection'
const store = useInspectionsStore()
const route = useRoute()
const inspection = computed(() => store.inspections.find((i) => i.id === Number(route.params.id)))
const activeFile = ref('')
watch(
  inspection,
  (item) => {
    if (!item?.files.some((f) => f.id === activeFile.value))
      activeFile.value = item?.files[0]?.id || ''
  },
  { immediate: true },
)
const selected = computed(() => inspection.value?.files.find((f) => f.id === activeFile.value))
const feedbackMessage = ref('')
const feedbackError = ref('')
const savingReport = ref<number | null>(null)
const loading = ref(false)
const loadError = ref('')
let loadVersion = 0
async function load() {
  const version = ++loadVersion
  loading.value = true
  loadError.value = ''
  try {
    await store.loadDetail(Number(route.params.id))
  } catch (error) {
    if (version === loadVersion)
      loadError.value =
        error instanceof Error ? error.message : 'Não foi possível carregar a solicitação.'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}
watch(() => route.params.id, load, { immediate: true })
watch(activeFile, () => {
  feedbackMessage.value = ''
  feedbackError.value = ''
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
async function saveFeedback(reportId: number, value: Feedback) {
  if (!inspection.value || !selected.value || savingReport.value !== null) return
  savingReport.value = reportId
  feedbackError.value = ''
  feedbackMessage.value = ''
  try {
    await store.feedback(inspection.value.id, selected.value.id, reportId, value)
    feedbackMessage.value = `Feedback do relatório #${reportId} salvo${store.isDemo ? ' nesta sessão' : ''}.`
  } catch (error) {
    feedbackError.value =
      error instanceof Error ? error.message : 'Não foi possível salvar o feedback.'
  } finally {
    savingReport.value = null
  }
}
</script>
<template>
  <section v-if="loading" class="panel empty-state" role="status">Carregando solicitação…</section>
  <section v-else-if="loadError" class="panel empty-state">
    <h1>Não foi possível abrir a solicitação</h1>
    <p role="alert">{{ loadError }}</p>
    <button class="button primary" @click="load">Tentar novamente</button>
    <RouterLink to="/" class="text-link">Voltar às solicitações</RouterLink>
  </section>
  <section v-else-if="inspection">
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
        <p class="address-detail">{{ inspection.address }} · {{ demandLabels[inspection.type] }}</p>
      </div>
      <StatusBadge :status="inspection.status" />
    </div>
    <p class="focus-value">
      <strong>Foco de dengue identificado:</strong>
      {{ inspection.dengue_breeding_site_spotted ? 'Marcado' : 'Não marcado' }}
      <span class="muted">· Informação do usuário</span>
    </p>
    <div v-if="store.isDemo" class="notice">
      <Icon name="info" />
      <p>
        <strong>Relatório demonstrativo.</strong> As sinalizações são fictícias e não resultam da
        análise dos arquivos. A confirmação de uma ocorrência cabe ao agente.
      </p>
    </div>
    <div v-else class="notice">
      <Icon name="info" />
      <p>
        Sinalizações da IA precisam de revisão do agente. Elas não confirmam abandono nem uma
        irregularidade sanitária.
      </p>
    </div>
    <div v-if="inspection.status !== 'completed'" class="panel processing-panel" role="status">
      <div class="processing-symbol"><Icon name="clock" :size="30" /></div>
      <div>
        <h2>
          {{
            inspection.status === 'draft'
              ? 'Rascunho: processamento não solicitado'
              : inspection.status === 'queued'
                ? 'Sua solicitação está na fila'
                : inspection.status === 'failed'
                  ? 'Não foi possível concluir a análise'
                  : 'Processando os arquivos'
          }}
        </h2>
        <p>
          {{
            inspection.status === 'draft'
              ? 'O envio pode ter sido interrompido. Confira a solicitação antes de criar outra.'
              : inspection.status === 'failed'
                ? 'O servidor informou uma falha no processamento.'
                : store.isDemo
                  ? `Conclusão simulada em aproximadamente ${seconds} segundos. Você pode navegar enquanto aguarda.`
                  : 'O status será atualizado automaticamente. Os relatórios ainda estão pendentes.'
          }}
        </p>
      </div>
      <RouterLink class="text-link" to="/fila">Ver fila<Icon name="arrow" :size="17" /></RouterLink>
    </div>
    <div v-else class="summary-bar">
      <div><Icon name="checkCircle" /><strong>Análise finalizada</strong></div>
      <p>
        {{ inspection.files.flatMap((f) => f.file_reports).length }} relatório(s) para consulta.
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
          <p v-if="!inspection.files.length" class="muted empty-files">
            Nenhum arquivo registrado nesta solicitação.
          </p>
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
            ><Icon
              v-if="file.file_reports.length && file.file_reports.every((r) => r.user_feedback)"
              name="checkCircle"
              :size="16"
            />
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
              <h3>{{ store.isDemo ? 'Arquivo de demonstração' : 'Prévia indisponível' }}</h3>
              <p>
                {{
                  store.isDemo
                    ? 'Este registro não possui uma imagem real. Crie uma solicitação para visualizar seus próprios arquivos.'
                    : 'A prévia deste arquivo ainda não está disponível.'
                }}
              </p>
            </div>
          </div>
        </section>
        <section class="panel report-panel">
          <div class="report-title">
            <span class="report-icon"><Icon name="file" /></span>
            <div>
              <h2>Relatórios do arquivo</h2>
              <p>{{ store.isDemo ? 'Resultado simulado · ' : '' }}Revisão do agente</p>
            </div>
          </div>
          <article
            v-for="report in selected.file_reports"
            :key="report.id"
            class="individual-report"
          >
            <span class="category-tag">{{
              report.irregularity ? categoryLabels[report.irregularity] : 'Nenhum alvo sinalizado'
            }}</span>
            <p class="muted">Relatório #{{ report.id }}</p>
            <p class="report-text">{{ report.agent_report }}</p>
            <div class="feedback-area">
              <div>
                <h3>A sinalização está correta?</h3>
                <p>
                  {{
                    store.isDemo
                      ? 'Seu feedback ficará registrado nesta sessão.'
                      : 'Avalie a sinalização deste relatório.'
                  }}
                </p>
              </div>
              <div class="feedback-buttons">
                <button
                  class="button secondary"
                  :class="{ chosen: report.user_feedback === 'correct' }"
                  :aria-pressed="report.user_feedback === 'correct'"
                  :disabled="savingReport !== null"
                  @click="saveFeedback(report.id, 'correct')"
                >
                  <Icon name="check" :size="17" />Correta</button
                ><button
                  class="button secondary"
                  :class="{ chosen: report.user_feedback === 'incorrect' }"
                  :aria-pressed="report.user_feedback === 'incorrect'"
                  :disabled="savingReport !== null"
                  @click="saveFeedback(report.id, 'incorrect')"
                >
                  <Icon name="close" :size="17" />Incorreta
                </button>
              </div>
            </div>
            <p class="feedback-confirmation" role="status">
              {{
                savingReport === report.id
                  ? 'Salvando…'
                  : report.user_feedback
                    ? 'Este relatório já recebeu feedback.'
                    : ''
              }}
            </p>
          </article>
          <p v-if="!selected.file_reports.length" class="muted">
            Nenhum relatório disponível para este arquivo.
          </p>
          <p class="feedback-confirmation" role="status">{{ feedbackMessage }}</p>
          <p v-if="feedbackError" class="error-message" role="alert">{{ feedbackError }}</p>
        </section>
      </div>
    </div>
  </section>
  <section v-else class="panel empty-state">
    <Icon name="search" :size="40" />
    <h1>Solicitação não encontrada</h1>
    <p>
      {{
        store.isDemo
          ? 'Os dados de demonstração são reiniciados ao atualizar a página.'
          : 'Confira o identificador e tente novamente.'
      }}
    </p>
    <RouterLink class="button primary" to="/">Voltar às solicitações</RouterLink>
  </section>
</template>
