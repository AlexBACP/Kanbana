import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketService } from '../services/ticket.service';
import { CreateTicketDto, UpdateTicketStatusDto, TicketStatus } from '../types/ticket.types';

export const useTickets = (projectId: number) => {
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', projectId],
    queryFn: () => ticketService.getAll(projectId),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateTicketDto) => ticketService.create(dto),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateTicketStatusDto }) =>
      ticketService.updateStatus(id, dto),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tickets', projectId] }),
  });

  const ticketsByStatus = (status: TicketStatus) =>
    tickets.filter((t) => t.estado === status);

  return {
    tickets,
    isLoading,
    ticketsByStatus,
    createTicket: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending,
  };
};