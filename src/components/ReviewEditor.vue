<script setup>
import { EditorContent } from '@tiptap/vue-3'

const props = defineProps({
  editor: Object,
})

const emit = defineEmits(['setLink'])

function setLink() {
  emit('setLink')
}
</script>

<template>
  <div class="flex-1 flex flex-col" v-if="editor">
    <div class="flex items-center justify-between mb-2">
      <label class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">感想</label>
    </div>

    <div class="flex items-center gap-0.5 mb-2 flex-wrap">
      <button @click="editor.chain().focus().toggleBold().run()" title="加粗" :class="editor.isActive('bold') ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'" class="w-9 h-9 flex items-center justify-center rounded-md text-xs font-bold transition-colors">B</button>
      <button @click="editor.chain().focus().toggleItalic().run()" title="斜体" :class="editor.isActive('italic') ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'" class="w-9 h-9 flex items-center justify-center rounded-md text-xs italic transition-colors font-serif">I</button>
      <button @click="editor.chain().focus().toggleUnderline().run()" title="下划线" :class="editor.isActive('underline') ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'" class="w-9 h-9 flex items-center justify-center rounded-md text-xs underline transition-colors">U</button>
      <button @click="editor.chain().focus().toggleStrike().run()" title="删除线" :class="editor.isActive('strike') ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'" class="w-9 h-9 flex items-center justify-center rounded-md text-xs line-through transition-colors">S</button>
      <span class="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5"></span>
      <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" title="标题1" :class="editor.isActive('heading', { level: 1 }) ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'" class="w-9 h-9 flex items-center justify-center rounded-md text-xs font-bold transition-colors">H₁</button>
      <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" title="标题2" :class="editor.isActive('heading', { level: 2 }) ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'" class="w-9 h-9 flex items-center justify-center rounded-md text-xs font-bold transition-colors">H₂</button>
      <span class="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5"></span>
      <button @click="editor.chain().focus().toggleBlockquote().run()" title="引用" :class="editor.isActive('blockquote') ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'" class="w-9 h-9 flex items-center justify-center rounded-md text-xs transition-colors">❝</button>
      <button @click="editor.chain().focus().toggleBulletList().run()" title="列表" :class="editor.isActive('bulletList') ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'" class="w-9 h-9 flex items-center justify-center rounded-md text-xs transition-colors">≡</button>
      <button @click="editor.chain().focus().setHorizontalRule().run()" title="分割线" class="w-9 h-9 flex items-center justify-center rounded-md text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">—</button>
      <span class="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5"></span>
      <button @click="setLink" title="链接" class="w-9 h-9 flex items-center justify-center rounded-md text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">🔗</button>
    </div>

    <EditorContent :editor="editor" />
    <p class="text-[10px] text-zinc-300 dark:text-zinc-600 mt-2">停止输入后自动保存</p>
  </div>
</template>
