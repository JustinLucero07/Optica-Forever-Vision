import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative z-50 w-full bg-background shadow-xl overflow-y-auto",
          "rounded-t-2xl sm:rounded-xl",
          "max-h-[92vh] sm:max-h-[90vh]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b sticky top-0 bg-background z-10">
      <div className="font-semibold text-base sm:text-lg">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-accent">
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}

export function DialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-4 sm:px-6 py-4 sm:py-5", className)}>{children}</div>
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 px-4 sm:px-6 py-4 border-t sticky bottom-0 bg-background">
      {children}
    </div>
  )
}
