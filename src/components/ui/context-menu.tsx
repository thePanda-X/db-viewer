import { type ReactNode, useCallback, useRef, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'

export interface ContextMenuItem {
  label?: string
  icon?: ReactNode
  onClick?: () => void
  separator?: boolean
  destructive?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  children: ReactNode
  className?: string
}

export function ContextMenu({ items, children, className }: ContextMenuProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (anchorRef.current) {
      anchorRef.current.style.left = `${e.clientX}px`
      anchorRef.current.style.top = `${e.clientY}px`
    }
    setOpen(true)
  }, [])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <div onContextMenu={handleContextMenu} className={className}>
        {children}
      </div>
      <DropdownMenuTrigger asChild>
        <span
          ref={anchorRef}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          side="bottom"
          align="start"
          sideOffset={0}
          className="min-w-[140px]"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {items.map((item, i) => (
            <span key={i}>
              {item.separator ? (
                <DropdownMenuSeparator />
              ) : (
                <DropdownMenuItem
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setOpen(false)
                    item.onClick?.()
                  }}
                  className={item.destructive ? 'text-destructive focus:text-destructive' : ''}
                >
                  {item.icon && <span className="mr-2 flex h-3.5 w-3.5 items-center justify-center">{item.icon}</span>}
                  {item.label}
                </DropdownMenuItem>
              )}
            </span>
          ))}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  )
}
