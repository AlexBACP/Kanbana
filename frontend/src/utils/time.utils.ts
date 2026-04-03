export const timeUtils = {
  minutesToHours: (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  },

  calculateDuration: (start: string, end: string): number => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.round(diff / (1000 * 60));
  },

  formatTimeInput: (date: Date): string => {
    return date.toTimeString().slice(0, 5);
  },
};