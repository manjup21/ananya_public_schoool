import { useMemo } from 'react';

/** Client-side paging; `currentPage` is clamped so shrinking filters never leave an empty page. */
export function usePagedRows(rows, page, pageSize) {
  const list = Array.isArray(rows) ? rows : [];
  const totalCount = list.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return (Array.isArray(rows) ? rows : []).slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);
  return { totalCount, totalPages, currentPage, pageRows };
}
