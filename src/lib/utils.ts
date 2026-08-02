import { format } from "date-fns";

export const sortUsers = <T extends { name: string }>(usersArray: T[]): T[] => {
  const userOrder = ["Niloy", "Abir Hossian", "Niyamul Hasan", "Mouno", "Siyam", "Farhan"];
  return [...usersArray].sort((a, b) => {
    const indexA = userOrder.findIndex(name => a.name.includes(name));
    const indexB = userOrder.findIndex(name => b.name.includes(name));
    
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    
    return indexA - indexB;
  });
};

export const formatCurrency = (value: number | string): string => {
  const num = Number(value);
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

export interface DateLikeObj {
  toDate?: () => Date;
  seconds?: number;
}

export const getMonthStr = (dateVal: DateLikeObj | Date | string | number | null | undefined): string => {
  if (!dateVal) return "";

  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? "" : format(dateVal, "yyyy-MM");
  }

  if (typeof dateVal === "object" && dateVal !== null) {
    const obj = dateVal as DateLikeObj;
    if (typeof obj.toDate === "function") {
      return format(obj.toDate(), "yyyy-MM");
    }
    if (typeof obj.seconds === "number") {
      return format(new Date(obj.seconds * 1000), "yyyy-MM");
    }
  }

  if (typeof dateVal === "string") {
    const trimmed = dateVal.trim();
    // Standard YYYY-MM
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // YYYY-M or YYYY-M-D
    const parts = trimmed.split(/[-/T]/);
    if (parts.length >= 2 && parts[0].length === 4) {
      const year = parts[0];
      const month = parts[1].padStart(2, "0");
      if (!isNaN(Number(year)) && !isNaN(Number(month))) {
        return `${year}-${month}`;
      }
    }
  }

  try {
    const d = new Date(dateVal as string | number);
    return isNaN(d.getTime()) ? "" : format(d, "yyyy-MM");
  } catch {
    return "";
  }
};

export const getDateStr = (dateVal: DateLikeObj | Date | string | number | null | undefined): string => {
  if (!dateVal) return "";

  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? "" : format(dateVal, "yyyy-MM-dd");
  }

  if (typeof dateVal === "object" && dateVal !== null) {
    const obj = dateVal as DateLikeObj;
    if (typeof obj.toDate === "function") {
      return format(obj.toDate(), "yyyy-MM-dd");
    }
    if (typeof obj.seconds === "number") {
      return format(new Date(obj.seconds * 1000), "yyyy-MM-dd");
    }
  }

  if (typeof dateVal === "string") {
    const trimmed = dateVal.trim();
    // Standard YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parts = trimmed.split(/[-/T]/);
    if (parts.length >= 3 && parts[0].length === 4) {
      const year = parts[0];
      const month = parts[1].padStart(2, "0");
      const day = parts[2].padStart(2, "0");
      if (!isNaN(Number(year)) && !isNaN(Number(month)) && !isNaN(Number(day))) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  try {
    const d = new Date(dateVal as string | number);
    return isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
  } catch {
    return "";
  }
};
