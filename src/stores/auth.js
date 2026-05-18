import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../utils/supabase'
import { clearCachedUserId } from '../utils/helpers'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)
  let unsubscribe = null

  const isLoggedIn = computed(() => !!user.value)

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user || null
    loading.value = false

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user || null
    })
    unsubscribe = data?.subscription
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    user.value = data.user
    return data.user
  }

  async function register(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    user.value = data.user
    return data.user
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
    clearCachedUserId()
    if (unsubscribe) {
      unsubscribe.unsubscribe()
      unsubscribe = null
    }
  }

  return { user, loading, isLoggedIn, init, login, register, logout }
})
