import type { ResizerSpec } from '../../state/paneTree'

const THICKNESS = 6

interface SplitResizerProps {
  resizer: ResizerSpec
  onMouseDown: (e: React.MouseEvent) => void
}

export default function SplitResizer({
  resizer,
  onMouseDown
}: SplitResizerProps): React.JSX.Element {
  const style: React.CSSProperties =
    resizer.direction === 'row'
      ? {
          top: `${resizer.crossStart}%`,
          height: `${resizer.crossExtent}%`,
          left: `calc(${resizer.centerPct}% - ${THICKNESS / 2}px)`,
          width: `${THICKNESS}px`,
          cursor: 'col-resize'
        }
      : {
          left: `${resizer.crossStart}%`,
          width: `${resizer.crossExtent}%`,
          top: `calc(${resizer.centerPct}% - ${THICKNESS / 2}px)`,
          height: `${THICKNESS}px`,
          cursor: 'row-resize'
        }

  return (
    <div
      onMouseDown={onMouseDown}
      style={{ position: 'absolute', background: '#3a3a3a', zIndex: 1, ...style }}
    />
  )
}
