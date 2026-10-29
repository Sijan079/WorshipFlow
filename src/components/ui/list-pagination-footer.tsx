"use client";

import type { Page } from "@/lib/list-pagination";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

// The footer of a register: which rows are showing, and the way to the other pages. It stays on a short
// list too, with both arrows off, so the place for the controls never moves or goes missing.
export function ListPaginationFooter({ page, pageCount, from, to, total, noun, onPageChange }: Pick<Page<unknown>, "page" | "pageCount" | "from" | "to" | "total"> & { noun: string; onPageChange: (page: number) => void }) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--rule-default)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">Showing {from} to {to} of {total} {noun}</p>
      <Pagination className="mx-0 w-auto justify-between sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={() => onPageChange(page - 1)} disabled={page <= 1} />
          </PaginationItem>
          <PaginationItem>
            <span className="min-w-24 px-2 text-center text-sm text-[var(--text-secondary)]">Page {page} of {pageCount}</span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
