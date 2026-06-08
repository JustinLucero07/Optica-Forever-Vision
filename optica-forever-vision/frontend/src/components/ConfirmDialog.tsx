import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title, description, confirmLabel = "Confirmar",
  destructive = true, loading = false, onConfirm, onCancel,
}: Props) {
  return (
    <Dialog open={open} onClose={onCancel} className="max-w-sm">
      <DialogHeader onClose={onCancel}>{title}</DialogHeader>
      <DialogBody>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button
          variant={destructive ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
