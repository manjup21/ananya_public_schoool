import { Eye, Pencil, Trash2, Calendar } from 'lucide-react';
import { SearchInput } from '../../components/common/SearchInput';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { TablePagination } from '../../components/common/TablePagination';
import { TableEmptyRow } from '../../components/common/TableEmptyRow';
import { FormSelect } from '../../components/common/FormSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { TableSkeletonRows } from '../../components/common/TableSkeletonRows';
import {
  classNameById,
  daysCompact,
  fmtDateRange,
  normalizeSlotsArray,
  scopeLabel,
  sectionNameById,
  SCOPE_OPTIONS,
} from './attendanceConfigHelpers';

function slotSummary(p) {
  const same = (p.same_slots_all_days ?? p.sameSlotsAllDays);
  const slotsGlobal = normalizeSlotsArray(p.slots_global ?? p.slotsGlobal);
  const slotsByDow = p.slots_by_dow ?? p.slotsByDow;

  if (same === true && slotsGlobal.length) {
    const names = slotsGlobal
      .map((s) => String(s?.slot_name ?? s?.name ?? '').trim())
      .filter(Boolean);
    if (!names.length) return '—';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} (+${names.length - 2})`;
  }

  if (same === false && slotsByDow && typeof slotsByDow === 'object') {
    return 'Varies by day';
  }

  const legacy = p.slots_per_day ?? p.slotsPerDay;
  if (legacy != null) return `${legacy} slots`;
  return '—';
}

export function AttendancePatternsTable({
  classes,
  patternsStatus,
  patternsError,
  totalCount,
  totalAllCount = 0,
  filtersHidePatterns = false,
  paginated,
  searchQuery,
  onChangeSearchQuery,
  filterScope,
  onChangeFilterScope,
  filterClassId,
  onChangeFilterClassId,
  filterSectionId,
  onChangeFilterSectionId,
  classOptions,
  sectionOptions,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>All Patterns</CardTitle>
          <div className="text-sm text-gray-600">
            {filtersHidePatterns ? (
              <>
                Showing <span className="font-medium text-gray-900">{totalCount}</span> of{' '}
                <span className="font-medium text-gray-900">{totalAllCount}</span> patterns
              </>
            ) : (
              <>
                Total: <span className="font-medium text-gray-900">{totalCount}</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtersHidePatterns ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Filters are hiding {totalAllCount - totalCount} pattern(s). Set Scope, Class, and Section to{' '}
            <span className="font-medium">All</span> to see everything before creating a new pattern.
          </div>
        ) : null}
        {patternsStatus === 'failed' ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {patternsError || 'Failed to load patterns'}
          </div>
        ) : null}

        <div className="mb-4">
          <SearchInput
            placeholder="Search by pattern name, scope, class, section..."
            value={searchQuery}
            onValueChange={onChangeSearchQuery}
          />
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <FormSelect
            id="att-filter-scope"
            label="Scope"
            value={filterScope}
            onValueChange={onChangeFilterScope}
            options={SCOPE_OPTIONS}
            placeholder="Scope"
            contentClassName="min-w-[var(--radix-select-trigger-width)]"
          />
          <FormSelect
            id="att-filter-class"
            label="Class"
            value={filterClassId}
            onValueChange={onChangeFilterClassId}
            options={classOptions}
            placeholder="Class"
            contentClassName="min-w-[var(--radix-select-trigger-width)]"
          />
          <FormSelect
            id="att-filter-section"
            label="Section"
            value={filterSectionId}
            onValueChange={onChangeFilterSectionId}
            options={sectionOptions}
            placeholder="Section"
            contentClassName="min-w-[var(--radix-select-trigger-width)]"
          />
        </div>

        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Pattern</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Class / Section</TableHead>
                  <TableHead>Date range</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Slots</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patternsStatus === 'loading' ? (
                  <TableSkeletonRows columns={7} rows={4} />
                ) : paginated.length === 0 ? (
                  <TableEmptyRow colSpan={7}>No patterns found</TableEmptyRow>
                ) : (
                  paginated.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-gray-900">{p.name}</TableCell>
                      <TableCell className="space-x-2">
                        <Badge variant="secondary">{scopeLabel(p.scope)}</Badge>
                        <Badge variant={p.is_active === false ? 'outline' : 'default'}>
                          {p.is_active === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {p.scope === 'global'
                          ? '—'
                          : `${classNameById(classes, p.class_id ?? p.classId)} · ${sectionNameById(
                              classes,
                              p.class_id ?? p.classId,
                              p.section_id ?? p.sectionId
                            )}`}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        <span className="inline-flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {fmtDateRange(p.start_date ?? p.startDate, p.end_date ?? p.endDate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600">{daysCompact(p.days_of_week ?? p.daysOfWeek) || '—'}</TableCell>
                      <TableCell className="text-gray-700">{slotSummary(p)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onView(p.id)}
                            title="View"
                            aria-label={p.name ? `View pattern ${p.name}` : 'View pattern'}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(p.id)}
                            title="Edit"
                            aria-label={p.name ? `Edit pattern ${p.name}` : 'Edit pattern'}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(p.id)}
                            title="Delete"
                            aria-label={p.name ? `Delete pattern ${p.name}` : 'Delete pattern'}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <TablePagination
          selectId="att-page-size"
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeSelectContentClassName="w-full min-w-[4.5rem]"
        />
      </CardContent>
    </Card>
  );
}

