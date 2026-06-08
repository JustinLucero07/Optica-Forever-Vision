import { ChevronLeft, ChevronRight } from "lucide-react"

const PER_PAGE_OPTIONS = [10, 15, 25, 50, 100]

interface Props {
  page: number
  total: number
  perPage?: number
  onChange: (p: number) => void
  onPerPageChange?: (n: number) => void
}

export function Paginador({ page, total, perPage = 15, onChange, onPerPageChange }: Props) {
  const pages = Math.ceil(total / perPage)
  const from  = Math.min((page - 1) * perPage + 1, total)
  const to    = Math.min(page * perPage, total)

  if (total === 0) return null

  const visible: (number | "…")[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) {
      if (visible.length > 0 && typeof visible[visible.length - 1] === "number" && (visible[visible.length - 1] as number) < p - 1) {
        visible.push("…")
      }
      visible.push(p)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t gap-3 bg-muted/20">
      {/* Info + Filas por página */}
      <div className="flex items-center gap-4 order-2 sm:order-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{from}–{to}</span>
          {" "}de{" "}
          <span className="font-semibold text-foreground">{total}</span>
        </p>
        {onPerPageChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Filas:</span>
            <select
              value={perPage}
              onChange={e => { onPerPageChange(Number(e.target.value)); onChange(1) }}
              className="text-xs border border-border rounded-lg px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {PER_PAGE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navegación */}
      {pages > 1 && (
        <div className="flex items-center gap-1 order-1 sm:order-2">
          <button
            onClick={() => onChange(page - 1)}
            disabled={page === 1}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </button>

          {visible.map((v, i) =>
            v === "…" ? (
              <span key={`dot-${i}`} className="px-1.5 text-muted-foreground text-xs select-none">…</span>
            ) : (
              <button
                key={v}
                onClick={() => onChange(v as number)}
                className={[
                  "w-8 h-8 rounded-lg text-xs font-medium transition-all duration-150",
                  v === page
                    ? "text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                ].join(" ")}
                style={v === page ? { background: "hsl(var(--primary))" } : undefined}
              >
                {v}
              </button>
            )
          )}

          <button
            onClick={() => onChange(page + 1)}
            disabled={page === pages}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
