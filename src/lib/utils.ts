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
