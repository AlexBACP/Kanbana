import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../services/project.service';
import { CreateProjectDto } from '../types/project.types';

export const useProjects = () => {
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateProjectDto) => projectService.create(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  return {
    projects,
    isLoading,
    createProject: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
};