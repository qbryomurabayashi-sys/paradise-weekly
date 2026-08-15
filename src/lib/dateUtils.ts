import { differenceInCalendarWeeks } from 'date-fns';

export const getFiscalWeek = (date: Date) => {
  const fiscalYear = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  const startOfFiscalYear = new Date(fiscalYear, 6, 1); // July 1st
  return differenceInCalendarWeeks(date, startOfFiscalYear, { weekStartsOn: 1 }) + 1;
};
