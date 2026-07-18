export default function NewTabButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button className="chraude-new-tab" aria-label="New tab" onClick={onClick}>
      +
    </button>
  )
}
