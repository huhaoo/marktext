<template>
  <div class="pref-features">
    <h4>{{ t('preferences.features.title') }}</h4>
    <section class="pref-features-macros">
      <div class="description">
        {{ t('preferences.features.mathMacros.description') }}
      </div>
      <el-input
        v-model="input"
        type="textarea"
        :rows="10"
        :placeholder="t('preferences.features.mathMacros.placeholder')"
        spellcheck="false"
        @input="handleInput"
      />
      <div class="notes">
        {{ t('preferences.features.mathMacros.notes') }}
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'

const { t } = useI18n()
const preferenceStore = usePreferencesStore()
const { mathMacros } = storeToRefs(preferenceStore)
const input = ref(mathMacros.value)
let timer: ReturnType<typeof setTimeout> | null = null

watch(mathMacros, (value) => {
  if (value !== input.value) input.value = value
})

const handleInput = (value: string | number) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    preferenceStore.SET_SINGLE_PREFERENCE({
      type: 'mathMacros',
      value: String(value)
    })
  }, 300)
}
</script>

<style scoped>
.pref-features {
  color: var(--editorColor);
}

.pref-features-macros {
  margin: 24px 0;
}

.description {
  margin-bottom: 10px;
  font-size: 14px;
}

.notes {
  margin-top: 8px;
  color: var(--editorColor80);
  font-size: 12px;
  line-height: 1.5;
  user-select: text;
}

:deep(textarea) {
  color: var(--editorColor);
  background: transparent;
  font-family: monospace;
}
</style>
