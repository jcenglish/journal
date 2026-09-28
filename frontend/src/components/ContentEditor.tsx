import { EditorContent, useEditor, useEditorState, type ChainedCommands, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import styles from './ContentEditor.module.css'

interface ContentEditorProps {
  /** Read once, when the editor is created. */
  initialContent: JSONContent
  /** Receives the whole document on every change. Must be a stable function. */
  onChange: (doc: JSONContent) => void
  labelId: string
}

const extensions = [StarterKit.configure({ link: { openOnClick: false } })]

interface FormatButton {
  label: string
  glyph: string
  isActive: string
  attributes?: Record<string, unknown>
  command: (chain: ChainedCommands) => ChainedCommands
}

const FORMAT_BUTTONS: FormatButton[] = [
  { label: 'Bold', glyph: 'B', isActive: 'bold', command: (chain) => chain.toggleBold() },
  { label: 'Italic', glyph: 'I', isActive: 'italic', command: (chain) => chain.toggleItalic() },
  { label: 'Underline', glyph: 'U', isActive: 'underline', command: (chain) => chain.toggleUnderline() },
  {
    label: 'Heading',
    glyph: 'H',
    isActive: 'heading',
    attributes: { level: 2 },
    command: (chain) => chain.toggleHeading({ level: 2 }),
  },
  { label: 'Bullet list', glyph: '•', isActive: 'bulletList', command: (chain) => chain.toggleBulletList() },
  { label: 'Numbered list', glyph: '1.', isActive: 'orderedList', command: (chain) => chain.toggleOrderedList() },
]

export function ContentEditor({ initialContent, onChange, labelId }: ContentEditorProps) {
  const editor = useEditor({
    extensions,
    content: initialContent,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class: styles.content,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelId,
      },
    },
  })

  // The editor doesn't re-render React on every transaction; this subscribes
  // the toolbar to just the state it displays.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      active: FORMAT_BUTTONS.map((button) => current?.isActive(button.isActive, button.attributes) ?? false),
      canUndo: current?.can().undo() ?? false,
      canRedo: current?.can().redo() ?? false,
    }),
  })

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar} role="group" aria-label="Formatting">
        {FORMAT_BUTTONS.map((button, index) => (
          <button
            key={button.label}
            type="button"
            className={styles.toolButton}
            aria-label={button.label}
            aria-pressed={state?.active[index] ?? false}
            onClick={() => editor && button.command(editor.chain().focus()).run()}
          >
            {button.glyph}
          </button>
        ))}
        <button
          type="button"
          className={styles.toolButton}
          aria-label="Undo"
          disabled={!state?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          ↶
        </button>
        <button
          type="button"
          className={styles.toolButton}
          aria-label="Redo"
          disabled={!state?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          ↷
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
