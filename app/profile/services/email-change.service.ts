interface RequestEmailChangeResult {
  message: string;
  cooldownSeconds: number;
}

interface VerifyEmailChangeResult {
  email: string;
}

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    const error = new Error(json.error ?? 'Request failed') as Error & { retryAfterSeconds?: number };
    if (typeof json.retryAfterSeconds === 'number') error.retryAfterSeconds = json.retryAfterSeconds;
    throw error;
  }
  return json as T;
}

export const emailChangeService = {
  async requestChange(newEmail: string, currentPassword: string): Promise<RequestEmailChangeResult> {
    return handle<RequestEmailChangeResult>(
      await fetch('/api/auth/request-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: newEmail, current_password: currentPassword }),
      })
    );
  },

  async verifyChange(code: string): Promise<VerifyEmailChangeResult> {
    return handle<VerifyEmailChangeResult>(
      await fetch('/api/auth/verify-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
    );
  },
};
