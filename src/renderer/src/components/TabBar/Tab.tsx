import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface TabProps {
  id: string
  title: string
  active: boolean
  onSelect: () => void
  onClose: () => void
}

export default function Tab({ id, title, active, onSelect, onClose }: TabProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`chraude-tab ${active ? 'chraude-tab--active' : ''}`}
      onClick={onSelect}
    >
      <span className="chraude-tab__title">{title}</span>
      <button
        className="chraude-tab__close"
        aria-label="Close tab"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        &times;
      </button>
    </div>
  )
}
