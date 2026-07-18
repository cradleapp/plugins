import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react'

/**
 * Self-contained, Geist-inspired UI primitives for the plugin panel.
 * No host aliases, no Tailwind — a scoped stylesheet (`clp-` prefix) keeps
 * the panel independent of the host app's styling.
 */

export function UiStyles() {
  return <style>{STYLES}</style>
}

export function Card({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="clp-card">
      <header className="clp-card-header">
        <div className="clp-card-heading">
          <h3 className="clp-card-title">{title}</h3>
          {description ? <p className="clp-card-desc">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className="clp-card-body">{children}</div>
    </section>
  )
}

type BadgeTone = 'solid' | 'outline' | 'success' | 'warning'

export function Badge({ tone = 'outline', children }: { tone?: BadgeTone, children: ReactNode }) {
  return <span className={`clp-badge clp-badge--${tone}`}>{children}</span>
}

export function StatusDot() {
  return <span className="clp-dot" aria-hidden="true" />
}

type ButtonVariant = 'primary' | 'outline' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: boolean
}

export function Button({ variant = 'primary', icon = false, className = '', type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={`clp-btn clp-btn--${variant}${icon ? ' clp-btn--icon' : ''}${className ? ` ${className}` : ''}`}
      {...props}
    />
  )
}

export function Alert({
  tone = 'neutral',
  icon,
  title,
  children,
}: {
  tone?: 'neutral' | 'error'
  icon?: ReactNode
  title: ReactNode
  children: ReactNode
}) {
  return (
    <div className={`clp-alert clp-alert--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {icon ? <span className="clp-alert-icon">{icon}</span> : null}
      <div>
        <p className="clp-alert-title">{title}</p>
        <p className="clp-alert-desc">{children}</p>
      </div>
    </div>
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`clp-input${className ? ` ${className}` : ''}`} {...props} />
}

export function Label({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`clp-label${className ? ` ${className}` : ''}`} {...props} />
}

export function Skeleton({ height = 22 }: { height?: number }) {
  return <div className="clp-skeleton" style={{ height }} aria-hidden="true" />
}

const STYLES = `
.clp-root {
  height: 100%;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.clp-root *, .clp-root *::before, .clp-root *::after { box-sizing: border-box; }
.clp-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.clp-muted { color: #8a8a8a; }
.clp-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

/* Card */
.clp-card {
  border: 1px solid rgba(127, 127, 127, 0.22);
  border-radius: 12px;
  background: #ffffff;
}
@media (prefers-color-scheme: dark) {
  .clp-card { background: rgba(255, 255, 255, 0.03); }
}
.clp-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 0;
}
.clp-card-heading { min-width: 0; }
.clp-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.clp-card-desc { margin: 3px 0 0; font-size: 12px; color: #8a8a8a; line-height: 1.55; }
.clp-card-body { display: flex; flex-direction: column; gap: 12px; padding: 12px 16px 16px; }

/* Badge */
.clp-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(127, 127, 127, 0.3);
  font-size: 11.5px;
  font-weight: 500;
  color: #8a8a8a;
  white-space: nowrap;
}
.clp-badge--solid { background: #171717; border-color: transparent; color: #fafafa; }
.clp-badge--success { color: #2f9e44; border-color: rgba(47, 158, 68, 0.4); }
.clp-badge--warning { color: #e8890c; border-color: rgba(232, 137, 12, 0.4); }
@media (prefers-color-scheme: dark) {
  .clp-badge--solid { background: #ededed; color: #171717; }
  .clp-badge--success { color: #51cf66; }
  .clp-badge--warning { color: #ffa94d; }
}
.clp-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* Button */
.clp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.clp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.clp-btn--primary { background: #171717; color: #fafafa; }
.clp-btn--primary:hover:not(:disabled) { background: #3f3f3f; }
.clp-btn--outline { border-color: rgba(127, 127, 127, 0.32); }
.clp-btn--outline:hover:not(:disabled) { background: rgba(127, 127, 127, 0.1); }
.clp-btn--ghost { color: #8a8a8a; }
.clp-btn--ghost:hover:not(:disabled) { background: rgba(127, 127, 127, 0.1); color: inherit; }
.clp-btn--icon { width: 28px; height: 28px; padding: 0; }
@media (prefers-color-scheme: dark) {
  .clp-btn--primary { background: #ededed; color: #171717; }
  .clp-btn--primary:hover:not(:disabled) { background: #ffffff; }
}
.clp-btn:focus-visible, .clp-input:focus-visible {
  outline: 2px solid rgba(0, 112, 243, 0.55);
  outline-offset: 1px;
}

/* Input & label */
.clp-input {
  height: 30px;
  width: 100%;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(127, 127, 127, 0.32);
  background: transparent;
  color: inherit;
  font: inherit;
}
.clp-input::placeholder { color: #9c9c9c; }
.clp-input:disabled { opacity: 0.5; cursor: not-allowed; }
.clp-label { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 500; }

/* Alert */
.clp-alert {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(127, 127, 127, 0.22);
  background: rgba(127, 127, 127, 0.06);
  font-size: 12.5px;
}
.clp-alert-icon { flex-shrink: 0; margin-top: 1px; color: #8a8a8a; }
.clp-alert-title { margin: 0; font-weight: 600; }
.clp-alert-desc { margin: 2px 0 0; color: #8a8a8a; }
.clp-alert--error { border-color: rgba(224, 49, 49, 0.35); background: rgba(224, 49, 49, 0.07); }
.clp-alert--error .clp-alert-icon, .clp-alert--error .clp-alert-title { color: #e03131; }
@media (prefers-color-scheme: dark) {
  .clp-alert--error { border-color: rgba(255, 135, 135, 0.35); background: rgba(255, 135, 135, 0.08); }
  .clp-alert--error .clp-alert-icon, .clp-alert--error .clp-alert-title { color: #ff8787; }
}

/* Skeleton */
@keyframes clp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.clp-skeleton { border-radius: 10px; background: rgba(127, 127, 127, 0.16); animation: clp-pulse 1.6s ease-in-out infinite; }
`
