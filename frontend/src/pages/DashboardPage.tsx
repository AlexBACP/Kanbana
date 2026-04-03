import { motion } from "framer-motion";
import { AdminDashboard } from "../layouts/AdminDashboard";
import { useAuthStore } from "../store/auth.store";
import { Users, FolderKanban, ClipboardList, ShieldCheck } from "lucide-react"; // Iconos de tu bitácora 

export const DashboardPage = () => {
  const { user } = useAuthStore();

  // 1. REEMPLAZO DEL "CARGANDO" POR ANIMACIÓN DE ESQUELETO
  if (!user) {
    return (
      <div className="p-8 space-y-8 animate-pulse bg-dark-bg min-h-screen">
        <div className="h-10 w-72 bg-dark-border rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-dark-card border border-dark-border rounded-2xl" />
          ))}
        </div>
        <div className="h-96 bg-dark-card border border-dark-border rounded-3xl" />
      </div>
    );
  }

  // 2. CONTENIDO DE RELLENO Y DASHBOARD REAL
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-dark-bg"
    >
      {/* Sección de Bienvenida (Relleno visual) */}
      <div className="px-8 pt-8 pb-4">
        <h1 className="text-3xl font-black text-dark-text tracking-tight">
          Panel <span className="text-primary-500">Administrativo</span>
        </h1>
        <p className="text-dark-muted mt-1 font-medium">
          Bienvenido, {user.nombre} — Gestionando la formación ADSO. [cite: 53]
        </p>
      </div>

      {/* Grid de Métricas Rápidas (Relleno de contenido) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8 pt-0">
        <StatCard icon={<Users className="text-blue-400" />} label="Total Usuarios" value="--" />
        <StatCard icon={<FolderKanban className="text-emerald-400" />} label="Proyectos" value="--" />
        <StatCard icon={<ClipboardList className="text-amber-400" />} label="Fichas Activas" value="--" />
        <StatCard icon={<ShieldCheck className="text-purple-400" />} label="Auditoría" value="OK" />
      </div>

      {/* Tu componente original con toda la lógica interna */}
      <AdminDashboard /> 
    </motion.div>
  );
};

// Componente auxiliar para las tarjetas
const StatCard = ({ icon, label, value }: any) => (
  <div className="bg-dark-card border border-dark-border p-6 rounded-2xl hover:border-primary-500/40 transition-colors shadow-lg">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-dark-bg rounded-xl border border-dark-border">{icon}</div>
      <div>
        <p className="text-xs font-black text-dark-muted uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold text-dark-text mt-1">{value}</p>
      </div>
    </div>
  </div>
);