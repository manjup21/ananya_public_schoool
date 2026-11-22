import { cn } from '../ui/utils';

/**
 * Shared page-level header: responsive title + description with optional actions.
 * Stacks vertically on mobile, becomes a row at `sm` and up.
 *
 * Usage:
 *   <PageHeader
 *     title="Student Management"
 *     description="Add, edit, and manage student information"
 *     actions={<Button>Add Student</Button>}
 *   />
 */
export function PageHeader({ title, description, actions, className, titleClassName, descriptionClassName }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <h2
          className={cn(
            'text-2xl sm:text-3xl font-bold text-gray-900',
            titleClassName
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className={cn('text-gray-600 mt-1', descriptionClassName)}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end w-full sm:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
