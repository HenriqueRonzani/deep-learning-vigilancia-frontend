<script setup lang="ts">
import { statusLabels } from '@/lib/format'
import type { ReportStatus } from '@/types/inspection'
defineProps<{ status: ReportStatus }>()
</script>
<template>
  <span class="status-badge" :class="status"
    ><span class="status-dot"></span>{{ statusLabels[status] }}</span
  >
</template>
