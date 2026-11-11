/** Today (offset 0) or N days away, as a YYYY-MM-DD string in Lagos time. */
export const lagosDay = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date(Date.now() + offset * 86400000));
