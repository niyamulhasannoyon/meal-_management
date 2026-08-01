import * as React from "react";

export function TableContainer({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Table({ className = "", children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={`w-full text-left text-sm text-zinc-700 dark:text-zinc-300 ${className}`} {...props}>
      {children}
    </table>
  );
}

export function TableHeader({ className = "", children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className = "", children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-zinc-200 dark:divide-zinc-800 bg-card ${className}`} {...props}>{children}</tbody>;
}

export function TableRow({ className = "", children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function TableHead({ className = "", children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold tracking-wider text-zinc-600 dark:text-zinc-400 ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ className = "", children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3.5 align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}
