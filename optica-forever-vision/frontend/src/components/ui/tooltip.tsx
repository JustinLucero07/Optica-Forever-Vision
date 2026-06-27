import { useState, useRef } from "react"
import { createPortal } from "react-dom"

interface TooltipProps {
  content: string
  children: React.ReactElement
  side?: "top" | "bottom" | "left" | "right"
}

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLElement>(null)

  function show() {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const offsets = {
      top:    { top: r.top - 32 + window.scrollY,  left: r.left + r.width / 2 + window.scrollX },
      bottom: { top: r.bottom + 6 + window.scrollY, left: r.left + r.width / 2 + window.scrollX },
      left:   { top: r.top + r.height / 2 + window.scrollY - 12, left: r.left - 8 + window.scrollX },
      right:  { top: r.top + r.height / 2 + window.scrollY - 12, left: r.right + 8 + window.scrollX },
    }
    setPos(offsets[side])
    setVisible(true)
  }

  const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>

  return (
    <>
      {/* @ts-ignore */}
      {<child.type
        {...child.props}
        ref={ref}
        onMouseEnter={(e: React.MouseEvent) => { child.props.onMouseEnter?.(e as any); show() }}
        onMouseLeave={(e: React.MouseEvent) => { child.props.onMouseLeave?.(e as any); setVisible(false) }}
        onFocus={(e: React.FocusEvent) => { child.props.onFocus?.(e as any); show() }}
        onBlur={(e: React.FocusEvent)  => { child.props.onBlur?.(e as any);  setVisible(false) }}
      />}
      {visible && createPortal(
        <div
          className="pointer-events-none fixed z-[99999] px-2 py-1 rounded-md text-xs font-medium bg-foreground text-background shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
          style={{
            top: pos.top,
            left: pos.left,
            transform: side === "top" || side === "bottom" ? "translateX(-50%)" : side === "left" ? "translateX(-100%)" : "none",
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  )
}
