<template>
  <div
    v-if="citationState.enabled || citationState.error"
    class="mt-citation-status"
  >
    <button @click="open">
      {{ t('citations.settings') }}
    </button>
    <button @click="refresh">
      {{ t('citations.refresh') }}
    </button>
    <div
      v-if="citationState.error"
      class="mt-citation-error"
    >
      {{ citationState.error }}
    </div>
    <div
      v-else-if="citationState.notice"
      class="mt-citation-notice"
    >
      {{ citationState.notice }}
    </div>
  </div>
  <el-dialog
    v-model="visible"
    :title="t('citations.settings')"
    width="560px"
  >
    <el-form label-position="top">
      <el-form-item :label="t('citations.bibliography')">
        <el-input
          v-model="paths"
          type="textarea"
          :rows="3"
          :placeholder="t('citations.pathsHint')"
        />
        <el-button @click="chooseBibliography">
          {{ t('citations.chooseBibliography') }}
        </el-button>
      </el-form-item>
      <el-form-item :label="t('citations.style')">
        <el-select v-model="style">
          <el-option
            label="IEEE"
            value="ieee"
          />
          <el-option
            label="APA"
            value="apa"
          />
          <el-option
            :label="t('citations.customStyle')"
            value="custom"
          />
        </el-select>
        <template v-if="style === 'custom'">
          <el-input
            v-model="customStyle"
            placeholder="./style.csl"
          />
          <el-button @click="chooseStyle">
            {{ t('citations.chooseStyle') }}
          </el-button>
        </template>
      </el-form-item>
      <el-form-item :label="t('citations.sectionTitle')">
        <el-input v-model="title" />
      </el-form-item>
      <p>{{ t('citations.saveHint') }}</p>
      <p
        v-if="error"
        role="alert"
      >
        {{ error }}
      </p>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">
        {{ t('common.cancel') }}
      </el-button>
      <el-button
        type="primary"
        @click="apply"
      >
        {{ t('common.ok') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import bus from '@/bus'
import { activateCitations, citationState, readCitationConfig, writeCitationConfig, updateCitations, type CitationDocument } from '@/services/citations'

const { t } = useI18n()
const { currentFile } = storeToRefs(useEditorStore())
const { footnote, superSubScript } = storeToRefs(usePreferencesStore())
const visible = ref(false)
const paths = ref('')
const style = ref('ieee')
const customStyle = ref('')
const title = ref('')
const error = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
const currentDocument = (): CitationDocument | null => currentFile.value
  ? {
      id: currentFile.value.id, pathname: currentFile.value.pathname || undefined, markdown: currentFile.value.markdown, isSaved: currentFile.value.isSaved
    }
  : null
const options = () => ({ footnote: footnote.value, superSubScript: superSubScript.value })
const update = (refresh = false) => {
  const doc = currentDocument()
  if (doc) updateCitations(doc, { ...options(), refresh }).catch(() => {})
}
watch(() => [currentFile.value?.id, currentFile.value?.pathname, currentFile.value?.markdown, footnote.value, superSubScript.value], () => {
  clearTimeout(timer)
  const id = currentFile.value?.id || ''
  const switched = citationState.documentId !== id
  activateCitations(id)
  if (switched) update()
  else timer = setTimeout(() => update(), 300)
}, { immediate: true })
const refresh = () => update(true)
const open = () => {
  error.value = ''
  try {
    const config = readCitationConfig(currentFile.value?.markdown || '')
    paths.value = config?.bibliography.join('\n') || ''
    style.value = ['ieee', 'apa'].includes(config?.csl || 'ieee') ? config?.csl || 'ieee' : 'custom'
    customStyle.value = style.value === 'custom' ? config?.csl || '' : ''
    title.value = config?.title || t('citations.references')
  } catch (err) { error.value = String(err) }
  visible.value = true
}
const relative = (path: string) => currentFile.value?.pathname ? window.path.relative(window.path.dirname(currentFile.value.pathname), path) || path : path
const chooseBibliography = async () => {
  const files = await window.electron.ipcRenderer.invoke('mt::citations::choose-files', 'bibliography')
  if (files.length) paths.value = [...new Set([...paths.value.split('\n').filter(Boolean), ...files.map(relative)])].join('\n')
}
const chooseStyle = async () => {
  const files = await window.electron.ipcRenderer.invoke('mt::citations::choose-files', 'style')
  if (files[0]) customStyle.value = relative(files[0])
}
const apply = () => {
  const file = currentFile.value
  if (!file) return
  try {
    const bibliography = paths.value.split('\n').map(path => path.trim()).filter(Boolean)
    if (!bibliography.length) throw new Error(t('citations.invalidBibliography'))
    const csl = style.value === 'custom' ? customStyle.value.trim() : style.value
    if (!csl) throw new Error(t('citations.invalidConfig'))
    const markdown = writeCitationConfig(file.markdown, { bibliography, csl, title: title.value })
    bus.emit('citations-config-change', { markdown })
    visible.value = false
  } catch (err) { error.value = err instanceof Error ? err.message : String(err) }
}
const offSettings = window.electron.ipcRenderer.on('mt::citations-settings', open)
const offSaved = window.electron.ipcRenderer.on('mt::citations-saved', (_event, doc) => {
  clearTimeout(timer)
  updateCitations(doc, { ...options(), saved: true, refresh: true }).catch(() => {}).finally(() => update())
})
window.addEventListener('focus', refresh)
onBeforeUnmount(() => { clearTimeout(timer); offSettings(); offSaved(); window.removeEventListener('focus', refresh) })
</script>
