"use client";

import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from '@/lib/env';

export function createSupabaseBrowserClient() {
  return createBrowserClient(getPublicSupabaseUrl(), getPublicSupabaseAnonKey());
}
