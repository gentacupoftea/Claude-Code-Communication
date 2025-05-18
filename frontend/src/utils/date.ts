import { format, formatDistance, parseISO } from 'date-fns';

export const formatDate = (date: string | Date, formatStr: string = 'PPP') => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, formatStr);
};

export const formatRelativeTime = (date: string | Date) => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(parsedDate, new Date(), { addSuffix: true });
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};