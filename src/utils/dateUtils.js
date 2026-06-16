const dayjs = require('dayjs');

const formatDate = (date, format = 'YYYY-MM-DD') => {
  return dayjs(date).format(format);
};

const formatDateTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  return dayjs(date).format(format);
};

const isDateExpired = (date) => {
  return dayjs().isAfter(dayjs(date), 'day');
};

const addDays = (date, days) => {
  return dayjs(date).add(days, 'day').toDate();
};

const addHours = (date, hours) => {
  return dayjs(date).add(hours, 'hour').toDate();
};

const diffDays = (date1, date2) => {
  return dayjs(date1).diff(dayjs(date2), 'day');
};

const diffHours = (date1, date2) => {
  return dayjs(date1).diff(dayjs(date2), 'hour');
};

const isValidIdCard = (idCard) => {
  const reg = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
  if (!reg.test(idCard)) {
    return false;
  }
  if (idCard.length === 18) {
    const year = parseInt(idCard.substr(6, 4));
    const month = parseInt(idCard.substr(10, 2));
    const day = parseInt(idCard.substr(12, 2));
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return false;
    }
  }
  return true;
};

const generateRandomCode = (length = 6) => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateLicenseNumber = () => {
  const prefix = 'DL';
  const dateStr = dayjs().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${dateStr}${random}`;
};

const getDatesBetween = (startDate, endDate) => {
  const dates = [];
  let current = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).startOf('day');
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    dates.push(current.toDate());
    current = current.add(1, 'day');
  }
  return dates;
};

const parseTimeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const timeOverlap = (start1, end1, start2, end2) => {
  const s1 = parseTimeToMinutes(start1);
  const e1 = parseTimeToMinutes(end1);
  const s2 = parseTimeToMinutes(start2);
  const e2 = parseTimeToMinutes(end2);
  return s1 < e2 && s2 < e1;
};

module.exports = {
  formatDate,
  formatDateTime,
  isDateExpired,
  addDays,
  addHours,
  diffDays,
  diffHours,
  isValidIdCard,
  generateRandomCode,
  generateLicenseNumber,
  getDatesBetween,
  parseTimeToMinutes,
  timeOverlap,
};
