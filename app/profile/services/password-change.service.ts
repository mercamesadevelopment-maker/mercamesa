async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json as T;
}

export const passwordChangeService = {
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return handle<{ message: string }>(
      await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
    );
  },
};
