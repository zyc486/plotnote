const rules = [
  { pattern: /^### (.+)$/gm, replacement: '<h3>$1</h3>' },
  { pattern: /^## (.+)$/gm, replacement: '<h2>$1</h2>' },
  { pattern: /^# (.+)$/gm, replacement: '<h1>$1</h1>' },
  { pattern: /\*\*(.+?)\*\*/g, replacement: '<strong>$1</strong>' },
  { pattern: /\*(.+?)\*/g, replacement: '<em>$1</em>' },
  { pattern: /~~(.+?)~~/g, replacement: '<del>$1</del>' },
  { pattern: /`(.+?)`/g, replacement: '<code class="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-sm">$1</code>' },
  { pattern: /^&gt; (.+)$/gm, replacement: '<blockquote class="pl-3 border-l-2 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 italic">$1</blockquote>' },
  { pattern: /^\- (.+)$/gm, replacement: '<li class="ml-4 list-disc">$1</li>' },
  { pattern: /\[(.+?)\]\((.+?)\)/g, replacement: '<a href="$2" target="_blank" class="text-indigo-500 hover:underline">$1</a>' },
  { pattern: /\n{2,}/g, replacement: '</p><p>' },
  { pattern: /\n/g, replacement: '<br>' },
]

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function unescapeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export function renderMarkdown(text) {
  if (!text) return ''
  let html = escapeHtml(text)
  for (const rule of rules) {
    html = html.replace(rule.pattern, rule.replacement)
  }
  // unescape entities inside code blocks so they display as-is
  html = html.replace(/<code[^>]*>([\s\S]*?)<\/code>/g, (match, content) => {
    return match.replace(content, unescapeHtml(content))
  })
  return `<p>${html}</p>`
}

export function stripMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
    .replace(/^[#>\-]\s*/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
}
