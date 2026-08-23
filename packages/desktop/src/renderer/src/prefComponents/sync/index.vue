<template>
  <div class="pref-sync">
    <h4>{{ t('preferences.sync.title') }}</h4>
    <p class="description">
      {{ t('preferences.sync.description') }}
    </p>

    <section class="sync-form">
      <label for="gist-id">{{ t('preferences.sync.gistId') }}</label>
      <el-input
        id="gist-id"
        v-model="gistId"
        :placeholder="t('preferences.sync.gistIdPlaceholder')"
        clearable
      />

      <label for="github-token">{{ t('preferences.sync.token') }}</label>
      <el-input
        id="github-token"
        v-model="token"
        type="password"
        show-password
        autocomplete="off"
        :placeholder="t('preferences.sync.tokenPlaceholder')"
      />
      <div class="notes">
        {{ t('preferences.sync.tokenNotes') }}
      </div>

      <div class="buttons">
        <el-button
          size="small"
          @click="saveConfiguration"
        >
          {{ t('preferences.sync.save') }}
        </el-button>
        <el-button
          size="small"
          @click="clearToken"
        >
          {{ t('preferences.sync.clearToken') }}
        </el-button>
      </div>
    </section>

    <section class="sync-actions">
      <el-button
        type="primary"
        :loading="busy === 'upload'"
        :disabled="busy !== ''"
        @click="upload"
      >
        {{ t('preferences.sync.upload') }}
      </el-button>
      <el-button
        :loading="busy === 'download'"
        :disabled="busy !== ''"
        @click="download"
      >
        {{ t('preferences.sync.download') }}
      </el-button>
    </section>

    <p
      v-if="state.gistUrl"
      class="gist-link"
    >
      <span>{{ t('preferences.sync.gistLink') }} </span>
      <a @click="openGist">{{ state.gistUrl }}</a>
    </p>

    <p class="notes sync-notes">
      {{ t('preferences.sync.contentsNotes') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import notice from '@/services/notification'
import type { SettingsSyncResult, SettingsSyncState } from '@shared/types/settingsSync'

const { t } = useI18n()

const state = ref<SettingsSyncState>({ gistId: '', gistUrl: '', hasToken: false })
const gistId = ref('')
const token = ref('')
const busy = ref<'' | 'upload' | 'download'>('')

const showError = (error: unknown): void => {
  notice.notify({
    title: t('preferences.sync.errorTitle'),
    message: error instanceof Error ? error.message : String(error),
    type: 'error'
  })
}

const refreshState = async (): Promise<void> => {
  try {
    state.value = await window.electron.ipcRenderer.invoke('mt::settings-sync::get-state')
    gistId.value = state.value.gistId
  } catch (error) {
    showError(error)
  }
}

const configure = async (): Promise<void> => {
  state.value = await window.electron.ipcRenderer.invoke('mt::settings-sync::configure', {
    gistId: gistId.value,
    token: token.value
  })
  gistId.value = state.value.gistId
  token.value = ''
}

const saveConfiguration = async (): Promise<void> => {
  try {
    await configure()
    notice.notify({
      title: t('preferences.sync.saved'),
      type: 'primary'
    })
  } catch (error) {
    showError(error)
  }
}

const clearToken = async (): Promise<void> => {
  try {
    state.value = await window.electron.ipcRenderer.invoke('mt::settings-sync::configure', {
      gistId: gistId.value,
      clearToken: true
    })
    token.value = ''
    notice.notify({
      title: t('preferences.sync.tokenCleared'),
      type: 'primary'
    })
  } catch (error) {
    showError(error)
  }
}

const saveBeforeAction = async (): Promise<void> => {
  if (gistId.value !== state.value.gistId || token.value.trim()) {
    await configure()
  }
}

const showSuccess = (result: SettingsSyncResult, message: string): void => {
  state.value = {
    gistId: result.gistId,
    gistUrl: result.gistUrl,
    hasToken: state.value.hasToken
  }
  gistId.value = result.gistId
  notice.notify({
    title: message,
    message: result.backupPath
      ? `${t('preferences.sync.backupCreated')} ${result.backupPath}`
      : result.gistUrl,
    type: 'primary'
  })
}

const upload = async (): Promise<void> => {
  busy.value = 'upload'
  try {
    await saveBeforeAction()
    const result = await window.electron.ipcRenderer.invoke('mt::settings-sync::upload')
    showSuccess(result, t('preferences.sync.uploadSuccess'))
  } catch (error) {
    showError(error)
  } finally {
    busy.value = ''
  }
}

const download = async (): Promise<void> => {
  busy.value = 'download'
  try {
    await saveBeforeAction()
    const result = await window.electron.ipcRenderer.invoke('mt::settings-sync::download')
    showSuccess(result, t('preferences.sync.downloadSuccess'))
  } catch (error) {
    showError(error)
  } finally {
    busy.value = ''
  }
}

const openGist = (): void => {
  if (state.value.gistUrl) {
    window.electron.shell.openExternal(state.value.gistUrl)
  }
}

onMounted(refreshState)
</script>

<style scoped>
.pref-sync {
  color: var(--editorColor);
  max-width: 720px;
}

.description {
  margin: 20px 0;
  font-size: 14px;
}

.sync-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 560px;
}

.sync-form label {
  margin-top: 12px;
  font-size: 14px;
}

.notes {
  color: var(--editorColor80);
  font-size: 12px;
  line-height: 1.5;
  user-select: text;
}

.buttons,
.sync-actions {
  margin-top: 16px;
}

.sync-actions {
  display: flex;
  gap: 8px;
}

.gist-link {
  margin-top: 20px;
  font-size: 13px;
}

.gist-link a {
  color: var(--themeColor);
  cursor: pointer;
  user-select: text;
}

.sync-notes {
  margin-top: 24px;
}
</style>
