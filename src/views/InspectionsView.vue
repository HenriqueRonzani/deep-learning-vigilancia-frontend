<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Icon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useInspectionsStore } from '@/stores/inspections'
import { formatDate } from '@/lib/format'
import type { Inspection } from '@/types/inspection'
const store = useInspectionsStore()
const route = useRoute()
const search = ref('')
const status = ref('all')
function clearFilters() {
  search.value = ''
  status.value = 'all'
}
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval>
onMounted(() => {
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
const rows = computed(() => {
  const source = queue.value ? store.pending : done.value ? store.completed : store.inspections
  const query = search.value.toLocaleLowerCase('pt-BR').trim()
  return source.filter(
    (i) =>
      `${i.id} ${i.name}`.toLocaleLowerCase('pt-BR').includes(query) &&
      (status.value === 'all' || i.status === status.value),
  )
})
function estimate(item: Inspection) {
  if (!item.finishesAt) return 'Aguardando estimativa'
  const seconds = Math.max(0, Math.ceil((item.finishesAt - now.value) / 1000))
  return seconds > 60 ? `~${Math.ceil(seconds / 60)} min` : `~${seconds} s`
}
function summary(item: Inspection) {
  if (item.status !== 'completed') return 'Aguardando o relatório da análise'
  const tanks = item.files.filter((f) => f.report?.irregularity === 'open_water_tank').length
  const pools = item.files.filter((f) => f.report?.irregularity === 'abandoned_pool').length
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
        ><span>Registros nesta sessão</span>
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
        <div class="stat-label">Arquivos revisados<Icon name="shield" /></div>
        <strong>{{ String(store.reviewed).padStart(2, '0') }}</strong
        ><span>Com feedback do agente</span>
      </div>
    </div>
    <div class="notice">
      <Icon name="info" />
      <p>
        <strong>Explore o fluxo de trabalho.</strong> Dados, prazos e resultados são simulados. Os
        arquivos ficam apenas nesta sessão do navegador.
      </p>
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
            }}<span class="count-badge">{{ rows.length }}</span>
          </h2>
          <p>
            {{
              queue
                ? 'O status é atualizado automaticamente nesta demonstração.'
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
            <option value="queued">Na fila</option>
            <option value="processing">Em análise</option>
            <option v-if="!queue" value="completed">Finalizada</option>
            <option v-if="!queue" value="failed">Falhou</option>
          </select></label
        >
      </div>
      <div v-if="rows.length" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Solicitação</th>
              <th>Arquivos</th>
              <th>Status</th>
              <th>{{ queue ? 'Estimativa simulada' : 'Criada em' }}</th>
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
                    ><small>{{ summary(item) }}</small></span
                  ></RouterLink
                >
              </td>
              <td>
                <span class="file-count"
                  ><Icon name="image" :size="16" />{{ item.files.length }}
                  {{ item.files.length === 1 ? 'arquivo' : 'arquivos' }}</span
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
      <div v-else class="empty-state">
        <Icon :name="queue ? 'checkCircle' : 'search'" :size="40" />
        <h3>
          {{
            search || status !== 'all'
              ? 'Nenhuma solicitação encontrada'
              : queue
                ? 'Tudo em dia por aqui'
                : 'Ainda não há resultados'
          }}
        </h3>
        <p>
          {{
            search || status !== 'all'
              ? 'Tente outro nome ou altere o filtro de status.'
              : queue
                ? 'As próximas solicitações aparecerão aqui durante a análise.'
                : 'Envie os primeiros registros para começar.'
          }}
        </p>
        <button
          v-if="search || status !== 'all'"
          class="button secondary"
          @click="clearFilters"
        >
          Limpar filtros</button
        ><RouterLink v-else class="text-link" to="/nova"
          >Criar solicitação <Icon name="arrow" :size="16"
        /></RouterLink>
      </div>
      <div class="table-footer">
        {{ rows.length }} {{ rows.length === 1 ? 'solicitação' : 'solicitações'
        }}<span>Mais recentes primeiro</span>
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
