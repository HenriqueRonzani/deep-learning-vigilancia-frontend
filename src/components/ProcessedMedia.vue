<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { mediaUrl } from '@/lib/media-url'

const props = defineProps<{ url?: string | null; mimeType: string; reportId: number }>()
const url = computed(() => mediaUrl(props.url))
const failed = ref(false)
watch(
  () => props.url,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <section class="processed-media" :aria-label="`Arquivo processado do relatório ${reportId}`">
    <h3>Arquivo processado</h3>
    <template v-if="url">
      <div v-if="!failed" class="media-viewer">
        <video
          v-if="mimeType.startsWith('video/')"
          :key="url"
          :src="url"
          controls
          preload="metadata"
          @error="failed = true"
        >
          Seu navegador não suporta a reprodução deste vídeo.
        </video>
        <img
          v-else
          :key="url"
          :src="url"
          :alt="`Resultado processado do relatório ${reportId}`"
          loading="lazy"
          @error="failed = true"
        />
      </div>
      <p v-else class="muted" role="status">
        Não foi possível carregar a prévia do arquivo processado. O link pode ter expirado ou estar
        indisponível.
      </p>
      <a
        class="text-link"
        :href="url"
        target="_blank"
        rel="noopener noreferrer"
        referrerpolicy="no-referrer"
        >Abrir arquivo processado em nova aba</a
      >
    </template>
    <p v-else class="muted">
      {{
        props.url
          ? 'O servidor não forneceu um link de leitura válido para o arquivo processado.'
          : 'Nenhum arquivo processado disponível neste relatório.'
      }}
    </p>
  </section>
</template>

<style scoped>
.processed-media {
  margin: 20px 0;
  min-width: 0;
}
h3 {
  margin-bottom: 12px;
}
.text-link {
  display: inline-block;
  margin-top: 12px;
  overflow-wrap: anywhere;
}
</style>
