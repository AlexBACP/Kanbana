import { useQuery } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ticketService } from '../services/ticket.service';
import { Ticket } from '../types/ticket.types';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, AlertCircle } from 'lucide-react';

const locales = {
  'es': es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export const CalendarPage = () => {
  const navigate = useNavigate();

  // Obtenemos todos los tickets (sin filtrar por proyecto para ver el panorama general)
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', 'all'],
    queryFn: () => ticketService.getAll(),
  });

  // Transformamos los tickets al formato que requiere react-big-calendar
  const events = tickets
    .filter(ticket => ticket.fecha_limite) // Solo tickets con fecha límite
    .map(ticket => ({
      id: ticket.id,
      title: ticket.titulo,
      start: new Date(ticket.fecha_limite!),
      end: new Date(ticket.fecha_limite!),
      resource: ticket,
    }));

  const eventStyleGetter = (event: { resource: Ticket }) => {
    const ticket = event.resource;
    let backgroundColor = '#3b82f6'; // blue-500 por defecto

    if (ticket.prioridad === 'alta') backgroundColor = '#ef4444'; // red-500
    if (ticket.prioridad === 'media') backgroundColor = '#f97316'; // orange-500
    if (ticket.estado === 'done') backgroundColor = '#22c55e'; // green-500

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '12px',
        padding: '2px 6px',
      }
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="text-primary-600" />
            Calendario de Entregas
          </h1>
          <p className="text-gray-500 text-sm">Visualiza las fechas límite de tus tareas</p>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600">Crítica</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-gray-600">Alta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Finalizado</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex-1 min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-gray-400 gap-2">
            <Clock className="animate-spin" size={20} />
            Cargando calendario...
          </div>
        ) : events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
            <AlertCircle size={40} className="text-gray-300" />
            <p>No hay tareas con fecha límite asignada.</p>
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            culture="es"
            messages={{
              next: "Siguiente",
              previous: "Anterior",
              today: "Hoy",
              month: "Mes",
              week: "Semana",
              day: "Día",
              agenda: "Agenda",
              date: "Fecha",
              time: "Hora",
              event: "Tarea",
              noEventsInRange: "No hay entregas en este rango de fechas.",
            }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event) => navigate(`/tickets/${event.id}`)}
            className="font-sans text-sm text-gray-700"
          />
        )}
      </div>
    </div>
  );
};