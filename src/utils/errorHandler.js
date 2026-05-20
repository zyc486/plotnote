export function handleError(err, context, toastFn) {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, err)
  }

  if (err.message?.includes('fetch') || err.message?.includes('network')) {
    toastFn?.('网络连接失败，请检查网络', 'error')
    return
  }

  if (err.code === 'PGRST301' || err.code === '42501') {
    toastFn?.('数据访问权限不足', 'error')
    return
  }

  toastFn?.(err.message || '操作失败，请重试', 'error')
}
