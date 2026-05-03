import { ref, watch } from 'vue'

const STORAGE_KEY = 'plotnote-theme'

const stored = localStorage.getItem(STORAGE_KEY)
const isDark = ref(stored !== 'light')

function applyTheme(dark) {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

applyTheme(isDark.value)

watch(isDark, (val) => {
  applyTheme(val)
  localStorage.setItem(STORAGE_KEY, val ? 'dark' : 'light')
})

export function useTheme() {
  function toggleTheme() {
    isDark.value = !isDark.value
  }

  return { isDark, toggleTheme }
}
