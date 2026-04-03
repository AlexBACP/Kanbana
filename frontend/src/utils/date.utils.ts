export const formatDate = (date: string): string => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatWithTime = (date: string): string => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const isOverdue = (date: string): boolean => {
  return new Date(date) < new Date();
};

export const daysUntil = (date: string): number => {
  const diff = new Date(date).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const isNearDeadline = (date: string): boolean => {
  return daysUntil(date) <= 1 && !isOverdue(date);
};

export const dateUtils = {
  formatDate,
  formatWithTime,
  isOverdue,
  daysUntil,
  isNearDeadline,
};