import { DEFAULT_EXCHANGE_RATE, DEFAULT_TRANSFER_FEE, DEFAULT_PAY_PERIOD } from '../constants/payroll';
import { calculatePay } from '../utils/calculatePay';

const buildEmployee = (id, name, email, totalHours, rate, bonus = 0) => {
  const pay = totalHours * rate;
  const totalPay = pay + bonus;
  const totalPhpPay = totalPay * DEFAULT_EXCHANGE_RATE;
  return { id, name, email, totalHours, rate, pay, bonus, totalPay, exchangeRate: DEFAULT_EXCHANGE_RATE, totalPhpPay };
};

export const MOCK_EMPLOYEES = [
  buildEmployee(1, 'Anna Katrina Marcos', 'anna.rm0417@gmail.com', 85.50, 9.00, 30.00),
  buildEmployee(2, 'Analiza Patrocino', 'analiza.patrocinio2022@gmail.com', 36.58, 4.00, 0),
  buildEmployee(3, 'Maria Santos', 'maria.santos88@gmail.com', 72.00, 7.50, 15.00),
  buildEmployee(4, 'John Carlo Reyes', 'johncarlo.reyes@gmail.com', 90.00, 10.00, 50.00),
  buildEmployee(5, 'Patricia Dela Cruz', 'patricia.delacruz@gmail.com', 60.25, 6.00, 0),
  buildEmployee(6, 'Miguel Angelo Garcia', 'miguel.garcia91@gmail.com', 78.30, 8.00, 20.00),
  buildEmployee(7, 'Christine Joy Tan', 'christine.tan2024@gmail.com', 45.00, 5.50, 0),
  buildEmployee(8, 'Roberto Villanueva', 'roberto.villanueva@gmail.com', 88.75, 9.50, 40.00),
  buildEmployee(9, 'Diana Rose Mendoza', 'diana.mendoza@gmail.com', 55.00, 6.50, 10.00),
  buildEmployee(10, 'Kevin James Lim', 'kevin.lim2023@gmail.com', 67.40, 7.00, 0),
];

export const MOCK_PAY_PERIOD_CONFIG = {
  payPeriod: DEFAULT_PAY_PERIOD,
  exchangeRate: DEFAULT_EXCHANGE_RATE,
  transferFee: DEFAULT_TRANSFER_FEE,
};

export const getMockPayslip = (employeeId, config = {}) => {
  const emp = MOCK_EMPLOYEES.find(e => e.id === employeeId);
  if (!emp) return null;

  const exchangeRate = config.exchangeRate || DEFAULT_EXCHANGE_RATE;
  const transferFee = config.transferFee || DEFAULT_TRANSFER_FEE;
  const bonus = config.bonusOverride !== '' && config.bonusOverride != null
    ? parseFloat(config.bonusOverride)
    : emp.bonus;

  const { totalPayUSD, convertedPayPHP, netPay } = calculatePay({
    totalHours: emp.totalHours,
    rate: emp.rate,
    bonus: isNaN(bonus) ? 0 : bonus,
    exchangeRate,
    transferFee,
  });

  return {
    payTo: emp.name,
    payPeriod: config.payPeriod || DEFAULT_PAY_PERIOD,
    emailAddress: emp.email,
    hoursWorked: emp.totalHours,
    agentRate: emp.rate,
    bonus: isNaN(bonus) ? 0 : bonus,
    totalPayUSD,
    currentExchangeRate: exchangeRate,
    convertedPayPHP,
    deductions: { transferFee },
    netPay,
  };
};
