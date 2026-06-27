import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"

interface Crumb { label: string; to?: string }

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
          {c.to
            ? <Link to={c.to} className="hover:text-foreground transition-colors">{c.label}</Link>
            : <span className="text-foreground font-medium">{c.label}</span>
          }
        </span>
      ))}
    </nav>
  )
}
