<template>
  <div class="about-dialog">
    <el-dialog
      v-model="showAboutDialog"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="400px"
    >
      <img
        class="logo"
        :src="MarkTextLogo"
      >
      <el-row>
        <el-col :span="24">
          <h3 class="title">
            {{ name }}
          </h3>
        </el-col>
        <el-col :span="24">
          <div class="text">
            {{ store.appVersion }}
          </div>
        </el-col>
        <el-col :span="24">
          <div
            class="text"
            style="min-height: auto"
          >
            {{ copyright }}
          </div>
        </el-col>
        <el-col :span="24">
          <div class="text">
            {{ copyrightContributors }}
          </div>
        </el-col>
        <el-col :span="24">
          <div
            class="text"
            style="font-size: 11px"
          >
            citeproc-js · © 2009–2019 Frank Bennett · CPAL-1.0
            <a
              href="https://github.com/Juris-M/citeproc-js"
              @click.prevent="openCitationSource"
            >Source</a>
          </div>
        </el-col>
      </el-row>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '@/store'
import bus from '../../bus'
import MarkTextLogo from '../../assets/images/logo.png'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const name = 'MarkText'
const copyright = t('about.copyright', { year: new Date().getFullYear() })
const copyrightContributors = t('about.copyrightContributors')
const showAboutDialog = ref(false)
const openCitationSource = () => window.electron.shell.openExternal('https://github.com/Juris-M/citeproc-js')

const store = useMainStore()

const showDialog = () => {
  showAboutDialog.value = true
  bus.emit('editor-blur')
}

onMounted(() => {
  bus.on('aboutDialog', showDialog)
})

onBeforeUnmount(() => {
  bus.off('aboutDialog', showDialog)
})
</script>

<style>
.about-dialog el-row,
.about-dialog el-col {
  display: block;
}

.about-dialog img.logo {
  width: 80px;
  height: 80px;
  display: inherit;
  margin: 0 auto;
}

.about-dialog .title,
.about-dialog .text {
  min-height: 32px;
  text-align: center;
}

.about-dialog .title {
  color: var(--floatFontColor);
}

.about-dialog .text {
  color: var(--floatFontColor);
}
</style>
