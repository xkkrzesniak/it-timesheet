import { type InputHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-text-secondary font-medium">{label}</label>}
      <input
        ref={ref}
        className={clsx(
          'bg-bg-input border border-border rounded-lg px-3 py-2 text-text-primary placeholder-text-muted text-sm',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors',
          error && 'border-danger focus:ring-danger',
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  ),
)
Input.displayName = 'Input'
