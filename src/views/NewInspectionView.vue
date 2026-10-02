<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { RouterLink, useRouter, onBeforeRouteLeave } from 'vue-router'
import Icon from '@/components/AppIcon.vue'
import { useInspectionsStore } from '@/stores/inspections'
import { formatSize, MAX_FILES, validateFile, demandLabels } from '@/lib/format'
import { SubmissionError } from '@/services/api'
import type { DemandType } from '@/types/inspection'
const store = useInspectionsStore()
const router = useRouter()
const name = ref('')
const address = ref('')
const type = ref<DemandType>('active')
const dengueBreedingSiteSpotted = ref(false)
const interrupted = ref(false)
const draftId = ref<number | null>(null)
const navigating = ref(false)
onBeforeRouteLeave(() => !submitting.value || navigating.value)
const files = ref<{ file: File; preview: string; key: string }[]>([])
const input = ref<HTMLInputElement>()
const errors = ref<string[]>([])
const dragging = ref(false)
const submitting = ref(false)
const totalSize = computed(() => files.value.reduce((sum, entry) => sum + entry.file.size, 0))
function addFiles(incoming: File[]) {
  errors.value = []
  for (const file of incoming) {
    const error = validateFile(file)
    const key = `${file.name}-${file.size}-${file.lastModified}`
    if (error) {
      errors.value.push(error)
      continue
    }
    if (files.value.some((f) => f.key === key)) {
      errors.value.push(`${file.name}: já foi adicionado.`)
      continue
    }
    if (files.value.length >= MAX_FILES) {
      errors.value.push(`Selecione no máximo ${MAX_FILES} arquivos.`)
      break
    }
    files.value.push({ file, key, preview: URL.createObjectURL(file) })
  }
}
function selected(event: Event) {
  const target = event.target as HTMLInputElement
  addFiles(Array.from(target.files || []))
  target.value = ''
}
function dropped(event: DragEvent) {
  dragging.value = false
  if (!submitting.value) addFiles(Array.from(event.dataTransfer?.files || []))
}
function remove(key: string) {
  const entry = files.value.find((f) => f.key === key)
  if (entry) URL.revokeObjectURL(entry.preview)
  files.value = files.value.filter((f) => f.key !== key)
}
async function submit() {
  if (interrupted.value || submitting.value) return
  errors.value = []
  if (!name.value.trim()) errors.value.push('Informe um nome para a solicitação.')
  if (!address.value.trim()) errors.value.push('Informe o endereço ou referência da localidade.')
  if (!files.value.length) errors.value.push('Adicione ao menos uma imagem ou um vídeo.')
  if (errors.value.length || submitting.value) return
  submitting.value = true
  try {
    const item = await store.create(
      {
        name: name.value.trim(),
        address: address.value.trim(),
        type: type.value,
        dengue_breeding_site_spotted: dengueBreedingSiteSpotted.value,
      },
      files.value.map((f) => f.file),
    )
    navigating.value = true
    await router.push(`/solicitacoes/${item.id}`)
  } catch (error) {
    if (error instanceof SubmissionError) {
      draftId.value = error.inspectionId
      interrupted.value = true
    }
    errors.value = [
      error instanceof Error ? error.message : 'Não foi possível criar a solicitação.',
    ]
    submitting.value = false
  }
}
onUnmounted(() => files.value.forEach((f) => URL.revokeObjectURL(f.preview)))
</script>
<template>
  <section>
    <RouterLink to="/" class="back-link"><Icon name="back" :size="17" />Solicitações</RouterLink>
    <div class="page-heading">
      <div>
        <div class="eyebrow">NOVO REGISTRO</div>
        <h1>Nova solicitação</h1>
        <p>Reúna as imagens do sobrevoo em uma única análise.</p>
      </div>
      <span class="outline-tag">Etapa 1 de 3 · Envio</span>
    </div>
    <div class="create-layout">
      <form class="panel form-panel" @submit.prevent="submit">
        <div class="section-heading">
          <span class="step-number">01</span>
          <div>
            <h2>Identifique a solicitação</h2>
            <p>Use um nome que facilite encontrar esta vistoria depois.</p>
          </div>
        </div>
        <label class="field-label" for="inspection-name"
          >Nome da solicitação <span aria-hidden="true">*</span></label
        ><input
          id="inspection-name"
          v-model="name"
          class="text-input"
          maxlength="255"
          required
          placeholder="Ex.: Vistoria de reservatórios · Santa Bárbara"
          :disabled="submitting"
        />
        <div class="field-hint">
          Bairro, referência ou identificação da operação.<span>{{ name.length }}/255</span>
        </div>
        <div class="new-fields">
          <label class="field-label" for="inspection-address"
            >Endereço ou referência da localidade *</label
          ><input
            id="inspection-address"
            v-model="address"
            class="text-input"
            maxlength="255"
            required
            :disabled="submitting || interrupted"
            placeholder="Ex.: entorno da praça ou endereço do local"
          />
          <p class="field-hint">
            Texto livre: pode indicar um endereço específico ou uma área de referência.
          </p>
          <label class="field-label" for="inspection-type">Tipo de demanda *</label
          ><select
            id="inspection-type"
            v-model="type"
            class="text-input"
            required
            :disabled="submitting || interrupted"
          >
            <option v-for="(label, value) in demandLabels" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
          <label class="checkbox-field" for="inspection-focus">
            <input
              id="inspection-focus"
              v-model="dengueBreedingSiteSpotted"
              type="checkbox"
              :disabled="submitting || interrupted"
              aria-describedby="focus-hint"
            />
            <span>Foco de dengue identificado</span>
          </label>
          <p id="focus-hint" class="field-hint">
            Marcação informada pelo usuário, independente dos relatórios da análise.
          </p>
        </div>
        <div class="section-heading upload-heading">
          <span class="step-number">02</span>
          <div>
            <h2>Adicione os registros</h2>
            <p>Imagens e vídeos capturados durante a vistoria.</p>
          </div>
        </div>
        <div
          class="dropzone"
          :class="{ dragging }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="dropped"
        >
          <div class="upload-icon"><Icon name="upload" :size="29" /></div>
          <h3>Arraste seus arquivos para cá</h3>
          <p>ou selecione os registros no seu dispositivo</p>
          <button
            type="button"
            class="button secondary"
            :disabled="submitting"
            @click="input?.click()"
          >
            <Icon name="plus" :size="17" />Selecionar arquivos</button
          ><small>JPG, PNG, WEBP, MP4 ou WEBM · Até 50 MB por arquivo</small
          ><input
            ref="input"
            type="file"
            class="sr-only"
            tabindex="-1"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            multiple
            aria-label="Selecionar imagens ou vídeos"
            @change="selected"
          />
        </div>
        <div v-if="files.length" class="selected-files">
          <div class="selected-heading">
            <strong>{{ files.length }} de {{ MAX_FILES }} arquivos</strong
            ><span>{{ formatSize(totalSize) }} no total</span>
          </div>
          <div v-for="entry in files" :key="entry.key" class="selected-file">
            <img
              v-if="entry.file.type.startsWith('image/')"
              :src="entry.preview"
              alt="Prévia do arquivo selecionado"
            /><span v-else class="video-thumb"><Icon name="video" /></span>
            <div>
              <strong>{{ entry.file.name }}</strong
              ><small
                >{{ formatSize(entry.file.size) }} ·
                {{ store.isDemo ? 'Pronto para simulação' : 'Pronto para envio' }}</small
              >
            </div>
            <button
              type="button"
              class="icon-button"
              :aria-label="`Remover ${entry.file.name}`"
              :disabled="submitting"
              @click="remove(entry.key)"
            >
              <Icon name="close" :size="18" />
            </button>
          </div>
        </div>
        <div v-if="errors.length" class="error-box" role="alert">
          <p v-for="error in errors" :key="error">{{ error }}</p>
          <RouterLink v-if="draftId" class="text-link" :to="`/solicitacoes/${draftId}`"
            >Conferir solicitação #{{ draftId }}</RouterLink
          >
        </div>
        <p v-if="submitting" class="notice" role="status">
          {{ store.isDemo ? 'Criando demonstração…' : store.progress }} Mantenha esta página aberta.
        </p>
        <div class="form-actions">
          <RouterLink class="button secondary" to="/">Cancelar</RouterLink
          ><button class="button primary" :disabled="submitting || interrupted">
            {{
              submitting
                ? 'Enviando…'
                : store.isDemo
                  ? 'Criar análise simulada'
                  : 'Enviar para análise'
            }}<Icon name="arrow" :size="18" />
          </button>
        </div>
      </form>
      <aside class="create-aside">
        <div class="panel guide-panel">
          <span class="eyebrow">DO REGISTRO AO RESULTADO</span>
          <h2>Como funciona</h2>
          <ol class="steps">
            <li>
              <span>1</span>
              <div>
                <strong>Envie os registros</strong>
                <p>Organize as imagens e vídeos da operação.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Acompanhe a análise</strong>
                <p>A solicitação passa pela fila de processamento.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Revise os resultados</strong>
                <p>Consulte cada arquivo e avalie as sinalizações.</p>
              </div>
            </li>
          </ol>
        </div>
        <div v-if="store.isDemo" class="demo-explainer">
          <Icon name="info" />
          <h3>Uma prévia do fluxo completo</h3>
          <p>
            Nesta versão, nenhum arquivo é enviado. A análise e os relatórios são exemplos, sem
            relação com o conteúdo selecionado.
          </p>
          <p>Ao atualizar a página, os registros e feedbacks desta sessão serão descartados.</p>
        </div>
        <div v-else class="demo-explainer">
          <Icon name="info" />
          <h3>Envio para análise</h3>
          <p>
            Os arquivos serão enviados ao armazenamento configurado pelo serviço. O processamento
            começa depois que todos os envios terminarem.
          </p>
          <p>
            Uma falha após criar o rascunho mantém a solicitação no servidor. Confira seu estado
            antes de criar outra.
          </p>
        </div>
      </aside>
    </div>
  </section>
</template>
