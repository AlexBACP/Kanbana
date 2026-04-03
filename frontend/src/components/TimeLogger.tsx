import { useState } from 'react';
import { Clock, Play, Square } from 'lucide-react';
import { Button } from './Button';
import { timeUtils } from '../utils/time.utils';
import api from '../services/api';

interface TimeLoggerProps {
  ticketId: number;
  onLogged?: () => void;
}

export const TimeLogger = ({ ticketId, onLogged }: TimeLoggerProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = () => {
    setStartTime(new Date());
    setIsRunning(true);
  };

  const handleStop = async () => {
    if (!startTime) return;
    const endTime = new Date();
    const totalMinutes = timeUtils.calculateDuration(
      startTime.toISOString(),
      endTime.toISOString(),
    );

    setIsLoading(true);
    try {
      await api.post(`/tickets/${ticketId}/time-logs`, {
        hora_inicio: startTime.toISOString(),
        hora_fin: endTime.toISOString(),
        total_minutos: totalMinutes,
      });
      onLogged?.();
    } finally {
      setIsLoading(false);
      setIsRunning(false);
      setStartTime(null);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <Clock size={16} className="text-gray-400" />
      <div className="flex-1">
        {isRunning && startTime ? (
          <p className="text-sm text-gray-600">
            Iniciado a las{' '}
            <span className="font-medium">
              {timeUtils.formatTimeInput(startTime)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-gray-500">Registrar tiempo trabajado</p>
        )}
      </div>
      {isRunning ? (
        <Button
          size="sm"
          variant="danger"
          onClick={handleStop}
          isLoading={isLoading}
        >
          <Square size={14} />
          Detener
        </Button>
      ) : (
        <Button size="sm" onClick={handleStart}>
          <Play size={14} />
          Iniciar
        </Button>
      )}
    </div>
  );
};