/**
 * @fileOverview 日期处理工具函数
 * @module utils/date
 */

export function formatDate(date: Date | number | string, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date');
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const milliseconds = String(d.getMilliseconds()).padStart(3, '0');
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  const monthChinese = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][d.getMonth()];

  return format
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2))
    .replace('MM', month)
    .replace('M', String(d.getMonth() + 1))
    .replace('DD', day)
    .replace('D', String(d.getDate()))
    .replace('HH', hours)
    .replace('H', String(d.getHours()))
    .replace('hh', String(d.getHours() % 12 || 12).padStart(2, '0'))
    .replace('h', String(d.getHours() % 12 || 12))
    .replace('mm', minutes)
    .replace('m', String(d.getMinutes()))
    .replace('ss', seconds)
    .replace('s', String(d.getSeconds()))
    .replace('SSS', milliseconds)
    .replace('S', String(Math.floor(d.getMilliseconds() / 100)))
    .replace('WW', week)
    .replace('W', week)
    .replace('MMM', monthChinese)
    .replace('MMMM', monthChinese + '月');
}

export function parseDate(dateString: string, format: string = 'YYYY-MM-DD HH:mm:ss'): Date {
  const patterns: Record<string, RegExp> = {
    'YYYY-MM-DD': /^(\d{4})-(\d{2})-(\d{2})$/,
    'YYYY/MM/DD': /^(\d{4})\/(\d{2})\/(\d{2})$/,
    'YYYY-MM-DD HH:mm:ss': /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
    'YYYY/MM/DD HH:mm:ss': /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
    'ISO': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
  };

  if (format === 'ISO' || !patterns[format]) {
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const pattern = patterns[format];
  if (!pattern) {
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    throw new Error(`Unknown date format: ${format}`);
  }

  const match = dateString.match(pattern);
  if (!match) {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  const parts: Record<string, number> = {};
  let idx = 1;
  
  if (format.includes('YYYY')) parts['YYYY'] = parseInt(match[idx++]);
  if (format.includes('MM')) parts['MM'] = parseInt(match[idx++]);
  if (format.includes('DD')) parts['DD'] = parseInt(match[idx++]);
  if (format.includes('HH')) parts['HH'] = parseInt(match[idx++]);
  if (format.includes('mm')) parts['mm'] = parseInt(match[idx++]);
  if (format.includes('ss')) parts['ss'] = parseInt(match[idx++]);

  return new Date(
    parts['YYYY'] || 1970,
    (parts['MM'] || 1) - 1,
    parts['DD'] || 1,
    parts['HH'] || 0,
    parts['mm'] || 0,
    parts['ss'] || 0
  );
}

export function addDays(date: Date | number, days: number): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addHours(date: Date | number, hours: number): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

export function addMinutes(date: Date | number, minutes: number): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function addSeconds(date: Date | number, seconds: number): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setSeconds(d.getSeconds() + seconds);
  return d;
}

export function subtractDays(date: Date | number, days: number): Date {
  return addDays(date, -days);
}

export function subtractHours(date: Date | number, hours: number): Date {
  return addHours(date, -hours);
}

export function subtractMinutes(date: Date | number, minutes: number): Date {
  return addMinutes(date, -minutes);
}

export function subtractSeconds(date: Date | number, seconds: number): Date {
  return addSeconds(date, -seconds);
}

export function getTimestamp(date?: Date | number): number {
  if (date === undefined) {
    return Date.now();
  }
  return date instanceof Date ? date.getTime() : date;
}

export function isAfter(date: Date | number, compareDate: Date | number): boolean {
  const d = date instanceof Date ? date.getTime() : date;
  const c = compareDate instanceof Date ? compareDate.getTime() : compareDate;
  return d > c;
}

export function isBefore(date: Date | number, compareDate: Date | number): boolean {
  const d = date instanceof Date ? date.getTime() : date;
  const c = compareDate instanceof Date ? compareDate.getTime() : compareDate;
  return d < c;
}

export function isBetween(date: Date | number, start: Date | number, end: Date | number): boolean {
  return isAfter(date, start) && isBefore(date, end);
}

export function getDateRange(start: Date | number, end: Date | number): Date[] {
  const dates: Date[] = [];
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 0) return '-' + formatDuration(-milliseconds);
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours % 24 > 0) parts.push(`${hours % 24}小时`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}分`);
  if (seconds % 60 > 0 || parts.length === 0) parts.push(`${seconds % 60}秒`);
  
  return parts.join('');
}

export function parseDuration(duration: string): number {
  const units: Record<string, number> = {
    'ms': 1,
    'millisecond': 1,
    'milliseconds': 1,
    's': 1000,
    'sec': 1000,
    'second': 1000,
    'seconds': 1000,
    'm': 60000,
    'min': 60000,
    'minute': 60000,
    'minutes': 60000,
    'h': 3600000,
    'hr': 3600000,
    'hour': 3600000,
    'hours': 3600000,
    'd': 86400000,
    'day': 86400000,
    'days': 86400000,
    'w': 604800000,
    'week': 604800000,
    'weeks': 604800000,
    'M': 2592000000,
    'month': 2592000000,
    'months': 2592000000,
    'y': 31536000000,
    'year': 31536000000,
    'years': 31536000000,
  };
  
  const pattern = /(\d+(?:\.\d+)?)\s*(ms|millisecond|milliseconds|s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days|w|week|weeks|M|month|months|y|year|years)/gi;
  let total = 0;
  let match;
  
  while ((match = pattern.exec(duration)) !== null) {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    total += value * (units[unit] || 0);
  }
  
  return total;
}

export function getWeekNumber(date: Date | number): number {
  const d = date instanceof Date ? date : new Date(date);
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

export function getDayOfYear(date: Date | number): number {
  const d = date instanceof Date ? date : new Date(date);
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export function isWeekend(date: Date | number): boolean {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function isSameDay(date1: Date | number, date2: Date | number): boolean {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

export function getStartOfDay(date: Date | number): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getEndOfDay(date: Date | number): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getStartOfWeek(date: Date | number, weekStartsOn: number = 0): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getEndOfWeek(date: Date | number, weekStartsOn: number = 0): Date {
  const start = getStartOfWeek(date, weekStartsOn);
  start.setDate(start.getDate() + 6);
  start.setHours(23, 59, 59, 999);
  return start;
}

export function getStartOfMonth(date: Date | number): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function getEndOfMonth(date: Date | number): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function getDaysBetween(start: Date | number, end: Date | number): number {
  const s = start instanceof Date ? start.getTime() : start;
  const e = end instanceof Date ? end.getTime() : end;
  return Math.floor((e - s) / 86400000);
}

export function getHoursBetween(start: Date | number, end: Date | number): number {
  const s = start instanceof Date ? start.getTime() : start;
  const e = end instanceof Date ? end.getTime() : end;
  return Math.floor((e - s) / 3600000);
}

export function getMinutesBetween(start: Date | number, end: Date | number): number {
  const s = start instanceof Date ? start.getTime() : start;
  const e = end instanceof Date ? end.getTime() : end;
  return Math.floor((e - s) / 60000);
}

export function getSecondsBetween(start: Date | number, end: Date | number): number {
  const s = start instanceof Date ? start.getTime() : start;
  const e = end instanceof Date ? end.getTime() : end;
  return Math.floor((e - s) / 1000);
}

export function formatRelativeTime(date: Date | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const abs = Math.abs(diff);
  const suffix = diff > 0 ? '前' : '后';

  if (abs < 60000) return '刚刚';
  if (abs < 3600000) return `${Math.floor(abs / 60000)}分钟${suffix}`;
  if (abs < 86400000) return `${Math.floor(abs / 3600000)}小时${suffix}`;
  if (abs < 2592000000) return `${Math.floor(abs / 86400000)}天${suffix}`;
  if (abs < 31536000000) return `${Math.floor(abs / 2592000000)}个月${suffix}`;
  return `${Math.floor(abs / 31536000000)}年${suffix}`;
}

export function formatISODate(date: Date | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString();
}

export function formatChineseDate(date: Date | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][d.getMonth()];
  const day = d.getDate();
  return `${year}年${month}月${day}日`;
}

export function formatChineseDateTime(date: Date | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][d.getMonth()];
  const day = d.getDate();
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}年${month}月${day}日 ${hour}:${minute}`;
}

export function formatUnixTimestamp(date?: Date | number): string {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  return String(Math.floor(d.getTime() / 1000));
}

export function formatTimeAgo(date: Date | number): string {
  return formatRelativeTime(date);
}

export function isValidDate(date: Date | number | string): boolean {
  if (date instanceof Date) {
    return !isNaN(date.getTime());
  }
  const d = new Date(date);
  return !isNaN(d.getTime());
}

export function isExpired(timestamp: number | Date): boolean {
  const t = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  return Date.now() > t;
}

export function getAge(birthDate: Date | number): number {
  const birth = birthDate instanceof Date ? birthDate : new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function getAgeInDays(birthDate: Date | number): number {
  const birth = birthDate instanceof Date ? birthDate.getTime() : birthDate;
  return Math.floor((Date.now() - birth) / 86400000);
}

export function getAgeInHours(birthDate: Date | number): number {
  const birth = birthDate instanceof Date ? birthDate.getTime() : birthDate;
  return Math.floor((Date.now() - birth) / 3600000);
}

export function getAgeInMinutes(birthDate: Date | number): number {
  const birth = birthDate instanceof Date ? birthDate.getTime() : birthDate;
  return Math.floor((Date.now() - birth) / 60000);
}

export function getAgeInSeconds(birthDate: Date | number): number {
  const birth = birthDate instanceof Date ? birthDate.getTime() : birthDate;
  return Math.floor((Date.now() - birth) / 1000);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

export function formatTimezone(): string {
  const offset = getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}

export function parseTimestamp(timestamp: number | string): number {
  if (typeof timestamp === 'number') {
    if (timestamp < 10000000000) {
      return timestamp * 1000;
    }
    return timestamp;
  }
  return parseInt(timestamp);
}

export function now(): number {
  return Date.now();
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function tomorrow(): Date {
  const d = today();
  d.setDate(d.getDate() + 1);
  return d;
}

export function yesterday(): Date {
  const d = today();
  d.setDate(d.getDate() - 1);
  return d;
}
