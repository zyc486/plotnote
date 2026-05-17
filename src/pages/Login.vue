<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="w-full max-w-sm">
      <h1 class="text-2xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100">PlotNote</h1>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div class="flex mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            v-for="tab in ['login', 'register']"
            :key="tab"
            @click="mode = tab"
            :class="[
              'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
              mode === tab
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow'
                : 'text-gray-500 dark:text-gray-400'
            ]"
          >
            {{ tab === 'login' ? '登录' : '注册' }}
          </button>
        </div>

        <form @submit.prevent="handleSubmit">
          <input
            v-model="email"
            type="email"
            placeholder="邮箱"
            required
            class="w-full px-3 py-2 mb-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            v-model="password"
            type="password"
            placeholder="密码"
            required
            minlength="6"
            class="w-full px-3 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <p v-if="error" class="text-red-500 text-sm mb-3">{{ error }}</p>

          <button
            type="submit"
            :disabled="submitting"
            class="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
          >
            {{ submitting ? '处理中...' : (mode === 'login' ? '登录' : '注册') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const mode = ref('login')
const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function handleSubmit() {
  error.value = ''
  submitting.value = true
  try {
    if (mode.value === 'login') {
      await authStore.login(email.value, password.value)
    } else {
      await authStore.register(email.value, password.value)
    }
    router.push('/')
  } catch (e) {
    error.value = e.message || '操作失败'
  } finally {
    submitting.value = false
  }
}
</script>
