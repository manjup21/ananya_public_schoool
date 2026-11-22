import { createContext, useContext } from 'react';
import { cn } from './utils';

const TabsContext = createContext({ value: '', onValueChange: () => {} });

export const Tabs = ({ value, onValueChange, className, children, ...props }) => (
  <TabsContext.Provider value={{ value: value ?? '', onValueChange: onValueChange ?? (() => {}) }}>
    <div className={cn('flex flex-col gap-2', className)} data-value={value} {...props}>
      {children}
    </div>
  </TabsContext.Provider>
);

export const TabsList = ({ className, ...props }) => (
  <div
    className={cn(
      'inline-flex h-9 items-center justify-center rounded-lg bg-gray-100 p-1',
      className
    )}
    {...props}
  />
);

export const TabsTrigger = ({ value, className, children, ...props }) => {
  const { value: selected, onValueChange } = useContext(TabsContext);
  const isActive = selected === value;
  return (
    <button
      type="button"
      role="tab"
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400',
        isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
        className
      )}
      onClick={() => onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, className, children, ...props }) => {
  const { value: selected } = useContext(TabsContext);
  if (selected !== value) return null;
  return (
    <div role="tabpanel" className={cn('flex-1 outline-none', className)} {...props}>
      {children}
    </div>
  );
};
