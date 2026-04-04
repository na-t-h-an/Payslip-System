export const PAYROLL_COLUMNS = [
  { key: 'sent',        label: 'Status',           align: 'left' },
  { key: 'name',        label: 'Name',             align: 'left' },
  { key: 'email',       label: 'Email Address',  align: 'left' },
  { key: 'totalHours',  label: 'Total Hours',    align: 'right' },
  { key: 'rate',        label: 'Rate',           align: 'right', prefix: '$' },
  { key: 'pay',         label: 'Pay',              align: 'right' },
  { key: 'bonus',       label: 'Bonus',            align: 'right' },
  { key: 'totalPay',    label: 'Total USD Pay', align: 'right' },
  { key: 'exchangeRate',label: 'Ex Rate',          align: 'right' },
  { key: 'totalPhpPay',    label: 'Total PHP Pay',    align: 'right', prefix: '₱', accent: true },
  { key: 'accountNumber', label: 'Account Number',   align: 'left' },
];
