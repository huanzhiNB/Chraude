import { useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useChromeStore } from '../../state/chromeStore'
import Tab from './Tab'
import NewTabButton from './NewTabButton'
import './TabBar.css'

// How far past the tab bar's own edge a drop has to land — above OR below
// — before it counts as "pull this tab out into its own window" rather than
// a reorder. Chrome allows tearing off by dragging away from the strip in
// either vertical direction, not just downward.
const TEAR_OFF_THRESHOLD_PX = 40

export default function TabBar(): React.JSX.Element {
  const tabs = useChromeStore((s) => s.tabs)
  const activeTabId = useChromeStore((s) => s.activeTabId)
  const reorderTabs = useChromeStore((s) => s.reorderTabs)
  const tabBarRef = useRef<HTMLDivElement>(null)

  // Require a small drag distance before a pointer-down counts as a drag, so
  // a plain click (e.g. to select a tab or hit the close button) never gets
  // eaten by dnd-kit's drag detection.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    const tabBarRect = tabBarRef.current?.getBoundingClientRect()

    // Chromium doesn't reliably keep delivering DOM pointermove events once
    // the cursor exits this window's own bounds — dragging a tab down stays
    // inside the window (the tab's content view is just another child view
    // of the same window), so dnd-kit's reported delta tracks it fine, but
    // dragging up immediately leaves the window and the delta can get stuck
    // at the last in-bounds position. Querying the true OS cursor position
    // sidesteps that entirely, regardless of drag direction.
    window.chraude.system.getCursorScreenPoint().then((screenPoint) => {
      const dropViewportY = screenPoint.y - window.screenY
      const pastBottom = tabBarRect
        ? dropViewportY > tabBarRect.bottom + TEAR_OFF_THRESHOLD_PX
        : false
      const pastTop = tabBarRect ? dropViewportY < tabBarRect.top - TEAR_OFF_THRESHOLD_PX : false

      if (pastBottom || pastTop) {
        window.chraude.chrome.detachTab(String(active.id), screenPoint)
        return
      }

      if (over && active.id !== over.id) {
        reorderTabs(String(active.id), String(over.id))
      }
    })
  }

  return (
    <div className="chraude-tabbar" ref={tabBarRef}>
      <div className="chraude-tabbar__spacer" />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <div className="chraude-tabbar__tabs">
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                id={tab.id}
                title={tab.title}
                active={tab.id === activeTabId}
                draggable={tabs.length > 1}
                onSelect={() => window.chraude.chrome.activateTab(tab.id)}
                onClose={() => window.chraude.chrome.closeTab(tab.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <NewTabButton onClick={() => window.chraude.chrome.newTab()} />
    </div>
  )
}
