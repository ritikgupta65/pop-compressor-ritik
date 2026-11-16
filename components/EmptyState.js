export default function EmptyState({ hidden, onPick }) {
  return (
    <div className="empty" hidden={hidden}>
      <h1>Smaller images, <em>your</em> call on quality</h1>
      <p>Lossless keeps every pixel. Auto finds the smallest palette that still clears your quality floor, and stays lossless when it can&apos;t. Every tile has its own slider.</p>
      <button className="btn primary" onClick={onPick}>Add files</button>
      <span className="hint">drag &amp; drop &nbsp;·&nbsp; ⌘V paste &nbsp;·&nbsp; 20 files max</span>
    </div>
  );
}
