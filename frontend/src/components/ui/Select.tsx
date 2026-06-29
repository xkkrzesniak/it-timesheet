import { type SelectHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-text-secondary font-medium">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          'bg-bg-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors',
          error && 'border-danger',
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  ),
)
Select.displayName = 'Select'
