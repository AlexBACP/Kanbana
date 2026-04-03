import { AdminDashboard } from '../layouts/AdminDashboard';
import { LeadersPanel } from '../dashboard/panels/LeadersPanel';

export const LeadersPage = () => {
  return (
    <AdminDashboard>
      <LeadersPanel />
    </AdminDashboard>
  );
};

// Es importante exportarlo por defecto para que App.tsx lo encuentre fácilmente
export default LeadersPage;