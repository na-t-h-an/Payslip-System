export const calculatePay = ({ totalHours, rate, bonus = 0, exchangeRate, transferFee }) => {
  const pay = totalHours * rate;
  const totalPayUSD = pay + bonus;
  const convertedPayPHP = totalPayUSD * exchangeRate;
  const netPay = convertedPayPHP - transferFee;
  return { pay, totalPayUSD, convertedPayPHP, netPay };
};
