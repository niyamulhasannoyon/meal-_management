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
  if (typeof dateVal === "string") {
    return dateVal.length >= 7 ? dateVal.substring(0, 7) : dateVal;
  }
  if (typeof dateVal === "object" && dateVal !== null && "toDate" in dateVal && typeof dateVal.toDate === "function") {
    return format(dateVal.toDate(), "yyyy-MM");
  }
  if (dateVal instanceof Date) {
    return format(dateVal, "yyyy-MM");
  }
  try {
    return format(new Date(dateVal as string | number), "yyyy-MM");
  } catch {
    return "";
  }
};

export const getDateStr = (dateVal: DateLikeObj | Date | string | number | null | undefined): string => {
  if (!dateVal) return "";
  if (typeof dateVal === "string") {
    return dateVal.length >= 10 ? dateVal.substring(0, 10) : dateVal;
  }
  if (typeof dateVal === "object" && dateVal !== null && "toDate" in dateVal && typeof dateVal.toDate === "function") {
    return format(dateVal.toDate(), "yyyy-MM-dd");
  }
  if (dateVal instanceof Date) {
    return format(dateVal, "yyyy-MM-dd");
  }
  try {
    return format(new Date(dateVal as string | number), "yyyy-MM-dd");
  } catch {
    return "";
  }
};
