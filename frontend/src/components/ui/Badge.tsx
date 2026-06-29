import clsx from 'clsx'

type Variant = 'default' | 'accent' | 'success' | 'danger' | 'warning'

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: Variant }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        {
          'bg-bg-hover text-text-secondary': variant === 'default',
          'bg-accent-light text-accent border border-accent/30': variant === 'accent',
          'bg-green-900/30 text-green-400': variant === 'success',
          'bg-red-900/30 text-red-400': variant === 'danger',
          'bg-yellow-900/30 text-yellow-400': variant === 'warning',
        },
      )}
    >
      {children}
    </span>
  )
}
