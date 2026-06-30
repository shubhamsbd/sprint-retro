import type { ReactNode } from 'react'

interface LinkProps {
  href: string
  className?: string
  children: ReactNode
}

export function Link({ href, className, children }: LinkProps) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault()
        window.history.pushState({}, '', href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }}
    >
      {children}
    </a>
  )
}
