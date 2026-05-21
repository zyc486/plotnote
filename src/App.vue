<script setup>
import { ref } from 'vue'
import { useTheme } from './utils/theme'
import Toast from './components/Toast.vue'

const toastRef = ref(null)
const { isDark, toggleTheme } = useTheme()

function showToast(message, type = 'success') {
  toastRef.value?.show(message, type)
}
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
    <Toast ref="toastRef" />
    <router-view v-slot="{ Component }">
      <component :is="Component" :toast="showToast" />
    </router-view>
  </div>
</template>
