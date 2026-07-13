"use client";

import { createClient } from "./client";

export async function getBrowserAccessToken(): Promise<string> {
  const { data, error } = await createClient().auth.getSession();
  const accessToken = data.session?.access_token;
  if (error || !accessToken) {
    throw new Error("Your session has expired. Sign in again.");
  }
  return accessToken;
}
