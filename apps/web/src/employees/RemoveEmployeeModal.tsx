import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { type EmployeeDetail, api } from '../api/client';
import { notifyFailed, notifySaved } from './save-feedback';

interface RemoveEmployeeModalProps {
  opened: boolean;
  employee: EmployeeDetail;
  onClose: () => void;
}

export function RemoveEmployeeModal({
  opened,
  employee,
  onClose,
}: RemoveEmployeeModalProps): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => api.removeEmployee(employee.id),
    onSuccess: async () => {
      onClose();
      notifySaved('Employee removed', `${employee.fullName} was removed.`);
      await navigate('/employees');
      // Dropped only after leaving the page, so the page does not refetch someone who is gone.
      queryClient.removeQueries({ queryKey: ['employee', employee.id] });
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      await queryClient.invalidateQueries({ queryKey: ['meta'] });
    },
    onError: (error) => {
      notifyFailed(error.message);
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Remove employee"
      centered
      closeButtonProps={{ 'aria-label': 'Close' }}
    >
      <Stack gap="md">
        <Text>
          <Text span fw={600}>
            {employee.fullName}
          </Text>{' '}
          and their salary history will be permanently deleted. This cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={remove.isPending}
            onClick={() => {
              remove.mutate();
            }}
          >
            Yes, remove
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
