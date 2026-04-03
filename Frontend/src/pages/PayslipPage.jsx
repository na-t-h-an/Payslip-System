import PageHeader from '../components/shared/PageHeader';
import PayslipGenerator from '../components/payslip/PayslipGenerator';

export default function PayslipPage() {
  return (
    <div>
      <PageHeader title="Generate Payslip" />
      <PayslipGenerator />
    </div>
  );
}
