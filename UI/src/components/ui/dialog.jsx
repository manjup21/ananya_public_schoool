import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Children, cloneElement } from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

export const Dialog = ({ open, onOpenChange, children, ...props }) => (
  <>
    {Children.map(children, (child) => {
      if (!child || typeof child !== 'object') return child;
      if (child.type === DialogTrigger) {
        return cloneElement(child, {
          onOpen: () => onOpenChange?.(true),
        });
      }
      if (child.type === DialogContent) {
        return cloneElement(child, { open, onOpenChange });
      }
      return child;
    })}
  </>
);

export const DialogTrigger = ({ asChild, children, onClick, onOpen, ...props }) => {
  const handleClick = (e) => {
    onOpen?.();
    onClick?.(e);
  };
  if (asChild && typeof children === 'object' && children?.type) {
    return cloneElement(children, { ...children.props, onClick: handleClick, ...props });
  }
  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
};

function useScrollLock(open) {
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (!open) return;

    scrollYRef.current = window.scrollY;
    const { body, documentElement } = document;

    body.style.position = 'fixed';
    body.style.top = `-${scrollYRef.current}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';

    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      documentElement.style.overflow = '';
      window.scrollTo(0, scrollYRef.current);
    };
  }, [open]);
}

export const DialogContent = ({ open, onOpenChange, className, children, ...props }) => {
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onOpenChange?.(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const preventBackgroundTouch = useCallback((e) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
    }
  }, []);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        aria-hidden
        onClick={() => onOpenChange?.(false)}
        onTouchMove={(e) => e.preventDefault()}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        onClick={() => onOpenChange?.(false)}
        onTouchMove={preventBackgroundTouch}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            'relative w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-lg',
            className
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {children}
          <button
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
            onClick={() => onOpenChange?.(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>,
    document.body
  );
};

export const DialogHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col gap-2 text-center sm:text-left pr-8', className)} {...props} />
);

export const DialogFooter = ({ className, ...props }) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
);

export const DialogTitle = ({ className, ...props }) => (
  <h3 className={cn('text-lg font-semibold leading-none', className)} {...props} />
);

export const DialogDescription = ({ className, ...props }) => (
  <p className={cn('text-sm text-gray-600', className)} {...props} />
);
