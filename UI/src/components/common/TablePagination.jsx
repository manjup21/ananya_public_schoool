import { Button } from '../ui/button';
import { FormSelect } from './FormSelect';
import { cn } from '../ui/utils';

/**
 * Shared footer for client-side table paging: page size, optional range summary, page indicator, prev/next.
 */
export function TablePagination({
  page,
  pageSize,
  totalCount,
  totalPages: totalPagesProp,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  selectId = 'table-page-size',
  showRangeSummary = true,
  pageSizeSelectContentClassName = 'w-[4.5rem]',
  className,
}) {
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const safeTotal = Math.max(0, Number(totalCount) || 0);
  const totalPages = Math.max(
    1,
    Number.isFinite(Number(totalPagesProp)) && Number(totalPagesProp) > 0
      ? Math.trunc(Number(totalPagesProp))
      : Math.ceil(safeTotal / safePageSize) || 1
  );
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const rangeStart = safeTotal === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const rangeEnd = Math.min(safePage * safePageSize, safeTotal);
  const sizeOptions = pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }));

  return (
    <div
      className={cn(
        'mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">Rows per page</div>
          <FormSelect
            id={selectId}
            label=""
            value={String(safePageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
            options={sizeOptions}
            contentClassName={pageSizeSelectContentClassName}
          />
        </div>
        {showRangeSummary ? (
          <div className="text-sm text-gray-600">
            Showing{' '}
            <span className="font-medium text-gray-900">
              {rangeStart}-{rangeEnd}
            </span>{' '}
            of <span className="font-medium text-gray-900">{safeTotal}</span>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
        <div className="text-sm text-gray-600 order-1 sm:order-0">
          Page <span className="font-medium text-gray-900">{safePage}</span> of{' '}
          <span className="font-medium text-gray-900">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2 order-2 sm:order-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
