/** Placeholder for routes that wait for URL data (the game id) behind Suspense. */
export function PageLoading() {
  return (
    <div
      className="p-20 text-center text-ink-faint"
      role="status"
      aria-live="polite"
    >
      <div className="pixel text-[12px] text-cyan">LOADING</div>
    </div>
  );
}
