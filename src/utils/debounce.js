export function debounce(fn, delay) {
  let timer = null
  function debounced(...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
  debounced.cancel = () => {
    clearTimeout(timer)
    timer = null
  }
  return debounced
}
