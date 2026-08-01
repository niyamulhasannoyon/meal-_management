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

export const getMonthStr = (dateVal: any): string => {
  if (!dateVal) return "";
  if (typeof dateVal === "string") {
    return dateVal.length >= 7 ? dateVal.substring(0, 7) : dateVal;
  }
  if (dateVal?.toDate) {
    return format(dateVal.toDate(), "yyyy-MM");
  }
  if (dateVal instanceof Date) {
    return format(dateVal, "yyyy-MM");
  }
  try {
    return format(new Date(dateVal), "yyyy-MM");
  } catch {
    return "";
  }
};

export const getDateStr = (dateVal: any): string => {
  if (!dateVal) return "";
  if (typeof dateVal === "string") {
    return dateVal.length >= 10 ? dateVal.substring(0, 10) : dateVal;
  }
  if (dateVal?.toDate) {
    return format(dateVal.toDate(), "yyyy-MM-dd");
  }
  if (dateVal instanceof Date) {
    return format(dateVal, "yyyy-MM-dd");
  }
  try {
    return format(new Date(dateVal), "yyyy-MM-dd");
  } catch {
    return "";
  }
};
