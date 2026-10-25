import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Document, DocumentCategory } from '@officepilot/shared';
import { api, toReadableError } from '../api/client';

const DOCUMENTS_KEY = ['documents'] as const;
const PROCESSING_STATUSES = new Set(['queued', 'parsing', 'chunking', 'embedding']);

export function useDocuments() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: DOCUMENTS_KEY,
    queryFn: api.listDocuments,
    // Keep polling until every document reaches a terminal state.
    refetchInterval: (current) => {
      const items = current.state.data?.items ?? [];
      return items.some((doc) => PROCESSING_STATUSES.has(doc.status)) ? 800 : false;
    },
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
    [queryClient],
  );

  const uploadMutation = useMutation({
    mutationFn: ({ file, category }: { file: File; category: DocumentCategory }) =>
      api.uploadDocument(file, category),
    onSuccess: () => invalidate(),
    onError: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: () => invalidate(),
  });

  const reindexMutation = useMutation({
    mutationFn: (id: string) => api.reindexDocument(id),
    onSuccess: () => invalidate(),
  });

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const upload = useCallback(
    async (file: File, category: DocumentCategory): Promise<Document> => {
      const result = await uploadMutation.mutateAsync({ file, category });
      return result.document;
    },
    [uploadMutation],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  const reindex = useCallback(
    async (id: string) => reindexMutation.mutateAsync(id),
    [reindexMutation],
  );

  const docs = query.data?.items ?? [];
  const error = query.error ? toReadableError(query.error) : null;

  return {
    docs,
    total: query.data?.total ?? docs.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error,
    refresh,
    upload,
    remove,
    reindex,
    uploading: uploadMutation.isPending,
    deleting: deleteMutation.isPending,
    reindexing: reindexMutation.isPending,
  };
}
