<script setup lang="ts">
import { statusLabels } from '@/lib/format'
import type { InspectionStatus } from '@/types/inspection'
defineProps<{ status: InspectionStatus }>()
</script>
<template>
  <span class="status-badge" :class="status"
    ><span class="status-dot"></span>{{ statusLabels[status] }}</span
  >
</template>
