<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Icon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useInspectionsStore } from '@/stores/inspections'
import { formatDate, demandLabels } from '@/lib/format'
import { filterInspections } from '@/lib/inspection-query'
import type { Inspection } from '@/types/inspection'
const store = useInspectionsStore()
const route = useRoute()
const search = ref('')
const status = ref('all')
const address = ref('')
const exact = ref(false)
const demand = ref('all')
const page = ref(1)
const hasFilters = computed(() =>
  Boolean(search.value || address.value || status.value !== 'all' || demand.value !== 'all'),
)
function clearFilters() {
  search.value = ''
  status.value = 'all'
  address.value = ''
  demand.value = 'all'
  exact.value = false
}
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval>
onMounted(() => {
  void store.loadList()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => clearInterval(timer))
watch(
  () => route.path,
  () => {
    search.value = ''
    status.value = 'all'
  },
)
const queue = computed(() => route.path === '/fila')
const done = computed(() => route.path === '/finalizadas')
const filtered = computed(() =>
  filterInspections(store.inspections, {
    search: search.value,
    address: address.value,
    exact: exact.value,
    type: demand.value,
    status: status.value,
    scope: queue.value ? 'queue' : done.value ? 'completed' : 'all',
  }),
)
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 10)))
const rows = computed(() => filtered.value.slice((page.value - 1) * 10, page.value * 10))
watch([search, address, exact, demand, status, () => route.path], () => {
  page.value = 1
})
watch(pages, (value) => {
  page.value = Math.min(page.value, value)
})
function estimate(item: Inspection) {
  if (!item.finishesAt) return 'Aguardando estimativa'
  const seconds = Math.max(0, Math.ceil((item.finishesAt - now.value) / 1000))
  return seconds > 60 ? `~${Math.ceil(seconds / 60)} min` : `~${seconds} s`
}
function summary(item: Inspection) {
  if (item.status !== 'completed') return 'Aguardando o relatório da análise'
  if (!item.filesLoaded) return 'Abra para consultar os relatórios'
  const reports = item.files.flatMap((f) => f.file_reports)
  const tanks = reports.filter((r) => r.irregularity === 'open_water_tank').length
  const pools = reports.filter((r) => r.irregularity === 'abandoned_pool').length
  return (
    [
      tanks ? `${tanks} caixa${tanks > 1 ? 's' : ''}-d’água` : '',
      pools ? `${pools} piscina${pools > 1 ? 's' : ''}` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'Nenhum alvo sinalizado'
  )
}
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <div class="eyebrow">MONITORAMENTO AÉREO</div>
        <h1>
          {{ queue ? 'Fila de análises' : done ? 'Solicitações finalizadas' : 'Suas solicitações' }}
        </h1>
        <p>
          {{
            queue
              ? 'Acompanhe o andamento dos registros enviados.'
              : done
                ? 'Consulte os resultados e contribua com sua avaliação.'
                : 'Da imagem à inspeção. Acompanhe cada análise por aqui.'
          }}
        </p>
      </div>
      <RouterLink class="button primary" to="/nova"
        ><Icon name="plus" />Nova solicitação</RouterLink
      >
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total de solicitações<Icon name="layers" /></div>
        <strong>{{ String(store.inspections.length).padStart(2, '0') }}</strong
        ><span>{{ store.isDemo ? 'Registros nesta sessão' : 'Registros carregados da API' }}</span>
      </div>
      <div class="stat-card">
        <div class="stat-label">Em andamento<Icon name="clock" /></div>
        <strong>{{ String(store.pending.length).padStart(2, '0') }}</strong
        ><span>Na fila ou em análise</span>
      </div>
      <div class="stat-card">
        <div class="stat-label">Finalizadas<Icon name="checkCircle" /></div>
        <strong>{{ String(store.completed.length).padStart(2, '0') }}</strong
        ><span>Relatórios disponíveis</span>
      </div>
      <div class="stat-card accent">
        <div class="stat-label">Relatórios revisados<Icon name="shield" /></div>
        <strong>{{ String(store.reviewed).padStart(2, '0') }}</strong
        ><span>{{ store.isDemo ? 'Com feedback do agente' : 'Nos detalhes já consultados' }}</span>
      </div>
    </div>
    <div v-if="store.isDemo" class="notice">
      <Icon name="info" />
      <p>
        <strong>Explore o fluxo de trabalho.</strong> Dados, prazos e resultados são simulados. Os
        arquivos ficam apenas nesta sessão do navegador.
      </p>
    </div>
    <div v-else class="notice">
      <Icon name="info" />
      <p>
        Busca e filtros abrangem todas as páginas carregadas da API. Use “Atualizar lista” para
        obter novas solicitações.
      </p>
      <button class="button secondary" :disabled="store.loading" @click="store.loadList">
        Atualizar lista
      </button>
    </div>
    <p v-if="store.loading" class="notice" role="status">
      Carregando todas as páginas de solicitações…
    </p>
    <div v-if="store.error" class="error-box" role="alert">
      <p>{{ store.error }}</p>
      <p>A lista pode estar desatualizada ou incompleta.</p>
      <button class="button secondary" @click="store.loadList">Tentar novamente</button>
    </div>
    <section class="panel requests-panel" aria-labelledby="list-title">
      <div class="panel-title">
        <div>
          <h2 id="list-title">
            {{
              queue
                ? 'Análises em andamento'
                : done
                  ? 'Relatórios disponíveis'
                  : 'Solicitações recentes'
            }}<span class="count-badge">{{ filtered.length }}</span>
          </h2>
          <p>
            {{
              queue
                ? 'O status das análises carregadas é atualizado automaticamente.'
                : 'Abra uma solicitação para consultar seus arquivos e resultados.'
            }}
          </p>
        </div>
      </div>
      <div class="toolbar">
        <label class="search-field"
          ><Icon name="search" /><input
            v-model="search"
            type="search"
            placeholder="Buscar por nome ou número"
            aria-label="Buscar solicitações" /></label
        ><label v-if="!done" class="filter-field"
          ><span class="sr-only">Filtrar por status</span
          ><select v-model="status">
            <option value="all">Todos os status</option>
            <option v-if="!queue" value="draft">Rascunho</option>
            <option value="queued">Na fila</option>
            <option value="processing">Em análise</option>
            <option v-if="!queue" value="completed">Finalizada</option>
            <option v-if="!queue" value="failed">Falhou</option>
          </select></label
        >
      </div>
      <div class="toolbar address-filters">
        <label class="filter-control"
          ><span>Endereço</span
          ><input
            v-model="address"
            class="text-input"
            type="search"
            placeholder="Rua, número, bairro ou referência"
        /></label>
        <label class="filter-control"
          ><span>Correspondência</span
          ><select v-model="exact" class="text-input">
            <option :value="false">Contém o trecho</option>
            <option :value="true">Endereço completo exato</option>
          </select></label
        >
        <label class="filter-control"
          ><span>Tipo de demanda</span
          ><select v-model="demand" class="text-input">
            <option value="all">Todos os tipos</option>
            <option v-for="(label, value) in demandLabels" :key="value" :value="value">
              {{ label }}
            </option>
          </select></label
        >
      </div>
      <p v-if="address" class="filter-help">
        {{
          exact
            ? 'Comparação do endereço completo, ignorando acentos, maiúsculas e espaços repetidos.'
            : 'Busca por trecho; use endereço completo exato para diferenciar números semelhantes.'
        }}
      </p>
      <div v-if="rows.length" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Solicitação</th>
              <th>Arquivos</th>
              <th>Status</th>
              <th>
                {{ queue ? (store.isDemo ? 'Estimativa simulada' : 'Estimativa') : 'Criada em' }}
              </th>
              <th><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rows" :key="item.id">
              <td>
                <RouterLink class="request-name" :to="`/solicitacoes/${item.id}`"
                  ><span class="row-icon"><Icon name="layers" /></span
                  ><span
                    ><span class="request-id">#{{ item.id }}</span
                    ><strong>{{ item.name }}</strong
                    ><small class="address-text">{{ item.address }}</small
                    ><small>{{ demandLabels[item.type] }} · {{ summary(item) }}</small></span
                  ></RouterLink
                >
              </td>
              <td>
                <span class="file-count"
                  ><Icon name="image" :size="16" />{{
                    item.filesLoaded ? `${item.files.length} arquivo(s)` : 'Consultar detalhes'
                  }}</span
                >
              </td>
              <td><StatusBadge :status="item.status" /></td>
              <td class="date-cell">
                {{ queue ? estimate(item) : formatDate(item.requested_at) }}
              </td>
              <td>
                <RouterLink
                  class="icon-button"
                  :to="`/solicitacoes/${item.id}`"
                  :aria-label="`Abrir solicitação ${item.id}`"
                  ><Icon name="arrow"
                /></RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="!store.loading && !store.error" class="empty-state">
        <Icon :name="queue ? 'checkCircle' : 'search'" :size="40" />
        <h3>
          {{
            hasFilters
              ? 'Nenhuma solicitação encontrada'
              : queue
                ? 'Tudo em dia por aqui'
                : 'Ainda não há resultados'
          }}
        </h3>
        <p>
          {{
            hasFilters
              ? 'Tente outro nome, endereço ou combinação de filtros.'
              : queue
                ? 'As próximas solicitações aparecerão aqui durante a análise.'
                : 'Envie os primeiros registros para começar.'
          }}
        </p>
        <button v-if="hasFilters" class="button secondary" @click="clearFilters">
          Limpar filtros</button
        ><RouterLink v-else class="text-link" to="/nova"
          >Criar solicitação <Icon name="arrow" :size="16"
        /></RouterLink>
      </div>
      <div class="table-footer">
        <span>{{ filtered.length }} solicitação(ões) · Mais recentes primeiro</span>
        <div class="pagination">
          <button class="button secondary" :disabled="page <= 1" @click="page--">Anterior</button
          ><span>Página {{ page }} de {{ pages }}</span
          ><button class="button secondary" :disabled="page >= pages" @click="page++">
            Próxima
          </button>
        </div>
      </div>
    </section>
    <div class="scope-strip">
      <span class="scope-icon"><Icon name="water" :size="24" /></span>
      <div>
        <strong>Um olhar atento aos pontos de interesse</strong>
        <p>Caixas-d’água abertas e piscinas com possíveis sinais de abandono.</p>
      </div>
      <span class="outline-tag">Validação humana</span>
    </div>
  </section>
</template>
