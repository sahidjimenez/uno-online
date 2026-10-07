import type { ReactNode } from 'react'
export function StatusScreen({ title, description, loading, children }: { title: string; description?: string; loading?: boolean; children?: ReactNode }) {
  return <main className="nexo-status-screen"><section className="nexo-status-card">
    <div className="table-brand"><strong>NEXO</strong></div>
    <div className={`status-emblem ${loading ? 'is-loading' : ''}`} aria-hidden="true">◇</div>
    <h1>{title}</h1>{description && <p>{description}</p>}<div className="status-actions">{children}</div>
  </section></main>
}
