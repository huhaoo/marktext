<template>
  <Teleport
    v-if="target"
    :to="target"
  >
    <div
      v-if="citationState.bibliography || citationState.pending"
      class="mt-reference-footer"
      contenteditable="false"
    >
      <p
        v-if="citationState.pending"
        class="mt-reference-pending"
      >
        {{ t('citations.pending') }}
      </p>
      <details open>
        <summary>{{ citationState.bibliographyTitle || t('citations.references') }}</summary>
        <!-- Content is sanitized in the citation service before reaching this view. -->
        <div v-html="citationState.bibliography" />
      </details>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { citationState } from '@/services/citations'
import { bibliographyCss } from 'muya/lib/citations/syntax'
import { onBeforeUnmount } from 'vue'
defineProps<{ target: HTMLElement | null }>()
const { t } = useI18n()
const sheet = document.createElement('style')
sheet.textContent = bibliographyCss
document.head.appendChild(sheet)
onBeforeUnmount(() => sheet.remove())
</script>
