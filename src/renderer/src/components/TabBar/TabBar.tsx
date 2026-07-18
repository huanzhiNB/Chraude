import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useTabStore } from '../../state/store'
import Tab from './Tab'
import NewTabButton from './NewTabButton'
import './TabBar.css'

export default function TabBar(): React.JSX.Element {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const paneTitles = useTabStore((s) => s.paneTitles)
  const addTab = useTabStore((s) => s.addTab)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const reorderTabs = useTabStore((s) => s.reorderTabs)

  // Require a small drag distance before a pointer-down counts as a drag, so
  // a plain click (e.g. to select a tab or hit the close button) never gets
  // eaten by dnd-kit's drag detection.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderTabs(String(active.id), String(over.id))
    }
  }

  return (
    <div className="chraude-tabbar">
      <div className="chraude-tabbar__spacer" />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <div className="chraude-tabbar__tabs">
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                id={tab.id}
                title={paneTitles[tab.activePaneId] ?? tab.title}
                active={tab.id === activeTabId}
                onSelect={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <NewTabButton onClick={addTab} />
    </div>
  )
}
