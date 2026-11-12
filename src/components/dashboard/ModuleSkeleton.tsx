/**
 * Loading placeholder for lazily imported dashboard modules (`CODE-02`).
 *
 * Every module below is code-split, and they used to share this markup by
 * declaring it inside `page.tsx` — which meant the shell's own bundle carried a
 * component only ever rendered by a `dynamic()` fallback.
 */
export default function ModuleSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
      <div className="skeleton-shimmer" style={{ height: '56px', borderRadius: 'var(--radius-md)' }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
        }}
      >
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="skeleton-shimmer"
            style={{ height: '104px', borderRadius: 'var(--radius-md)' }}
          />
        ))}
      </div>
      <div className="skeleton-shimmer" style={{ height: '320px', borderRadius: 'var(--radius-md)' }} />
    </div>
  );
}
