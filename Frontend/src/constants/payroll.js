export function getPayrollColumns(currency = 'USD') {
  const isUSD = currency === 'USD';
  return [
    { key: 'sent',          label: 'Status',                      align: 'left' },
    { key: 'name',          label: 'Name',                        align: 'left' },
    { key: 'email',         label: 'Email Address',               align: 'left' },
    { key: 'totalHours',    label: 'Total Hours',                 align: 'right' },
    { key: 'rate',          label: isUSD ? 'Rate ($)' : 'Rate (₱)', align: 'right' },
    { key: 'pay',           label: isUSD ? 'Pay ($)' : 'Pay (₱)', align: 'right' },
    { key: 'bonus',         label: isUSD ? 'Bonus ($)' : 'Bonus (₱)', align: 'right' },
    { key: 'totalPay',      label: isUSD ? 'Total USD Pay' : 'Total Pay (₱)', align: 'right' },
    ...(isUSD ? [
      { key: 'exchangeRate',  label: 'Ex Rate',                   align: 'right' },
      { key: 'totalPhpPay',   label: 'Total PHP Pay',             align: 'right', accent: true },
    ] : []),
    { key: 'transferFee',   label: 'Transfer Fee',                align: 'right' },
    { key: 'netPay',        label: 'Net Pay',                     align: 'right', accent: true },
    { key: 'bankName',      label: 'Bank Name',                   align: 'left' },
    { key: 'accountNumber', label: 'Account Number',              align: 'left' },
  ];
}
