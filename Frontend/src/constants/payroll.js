export const DEFAULT_EXCHANGE_RATE = 60.22;
export const DEFAULT_TRANSFER_FEE = 10.00;
export const DEFAULT_PAY_PERIOD = 'March 15, 2026 to March 28, 2026';

export const PAYROLL_COLUMNS = [
  { key: 'name',        label: 'Name',           align: 'left' },
  { key: 'email',       label: 'Email Address',  align: 'left' },
  { key: 'totalHours',  label: 'Total Hours',    align: 'right' },
  { key: 'rate',        label: 'Rate',           align: 'right', prefix: '$' },
  { key: 'pay',         label: 'Pay',            align: 'right' },
  { key: 'bonus',       label: 'Bonus',          align: 'right' },
  { key: 'totalPay',    label: 'Total Pay',      align: 'right' },
  { key: 'exchangeRate',label: 'Ex Rate',        align: 'right' },
  { key: 'totalPhpPay', label: 'Total PHP Pay',  align: 'right', prefix: '₱', accent: true }
];
