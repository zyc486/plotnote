export function debounce(fn, delay) {
  let timer = null
  const debounced = function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
  debounced.cancel = () => {
    clearTimeout(timer)
    timer = null
  }
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
      fn()
    }
  }
  return debounced
}

export function throttle(fn, limit) {
  let inThrottle = false
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
