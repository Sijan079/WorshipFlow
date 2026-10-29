import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// shadcn's pagination, with three changes for this app: the controls are real buttons (the page is
// changed in state, not by a link), Previous and Next are quiet icon controls (no border, no fill, muted
// until hovered) whose words stay for screen readers and the tooltip, and the current page is filled so it
// can be told apart at a glance.

// The icon-only control from DESIGN.md: 44px, muted at rest, accent on hover.
const PAGER_BUTTON = "size-11 text-[var(--text-secondary)] hover:bg-transparent hover:text-[var(--text-accent)]"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="Pages"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  Omit<React.ComponentProps<"button">, "type">

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <Button
      type="button"
      variant={isActive ? "default" : "ghost"}
      size={size}
      className={cn("min-h-11 min-w-11", !isActive && "text-[var(--text-secondary)] hover:text-[var(--text-primary)]", className)}
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      {...props}
    />
  )
}

function PaginationPrevious({
  className,
  text = "Previous",
  ...props
}: Omit<PaginationLinkProps, "size"> & { text?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label="Go to previous page"
      title="Previous page"
      data-slot="pagination-previous"
      className={cn(PAGER_BUTTON, className)}
      {...props}
    >
      <ChevronLeftIcon aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </Button>
  )
}

function PaginationNext({
  className,
  text = "Next",
  ...props
}: Omit<PaginationLinkProps, "size"> & { text?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label="Go to next page"
      title="Next page"
      data-slot="pagination-next"
      className={cn(PAGER_BUTTON, className)}
      {...props}
    >
      <span className="sr-only">{text}</span>
      <ChevronRightIcon aria-hidden="true" />
    </Button>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
