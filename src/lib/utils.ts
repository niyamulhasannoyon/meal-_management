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

