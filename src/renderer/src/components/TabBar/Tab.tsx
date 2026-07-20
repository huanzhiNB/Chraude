import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// -webkit-app-region is an Electron-only CSS property, not part of the
// standard csstype definitions React.CSSProperties is built from.
type AppRegionStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }

interface TabProps {
  id: string
  title: string
  active: boolean
  // False when this is the window's only tab: there's nothing to tear off
  // to, so instead of capturing the drag for dnd-kit, the tab is left as a
  // native OS drag region — matches Chrome, where dragging a single-tab
  // window's only tab just moves the window.
  draggable: boolean
  onSelect: () => void
  onClose: () => void
}

export default function Tab({
  id,
  title,
  active,
  draggable,
  onSelect,
  onClose
}: TabProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !draggable
  })

  const style: AppRegionStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    // The tabs container (.chraude-tabbar__tabs) inherits 'drag' from the
    // tab bar so empty space around tabs moves the window — a multi-tab
    // pill has to explicitly opt back OUT of that (not just omit the
    // property) to stay clickable/sortable, since 'undefined' here would
    // otherwise inherit the container's 'drag' rather than falling back to
    // no-drag.
    WebkitAppRegion: draggable ? 'no-drag' : 'drag'
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      className={`chraude-tab ${active ? 'chraude-tab--active' : ''}`}
      onClick={onSelect}
    >
      <span className="chraude-tab__title">{title}</span>
      <button
        className="chraude-tab__close"
        aria-label="Close tab"
        style={{ WebkitAppRegion: 'no-drag' } as AppRegionStyle}
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
