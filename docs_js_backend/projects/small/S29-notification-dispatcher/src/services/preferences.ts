const preferencesStore: Map<string, Record<string, boolean>> = new Map();

export async function getUserPreferences(userId: string): Promise<Record<string, boolean>> {
  return preferencesStore.get(userId) || {
    email: true,
    sms: true,
    push: true,
    inapp: true,
  };
}

export async function setUserPreferences(userId: string, prefs: Record<string, boolean>) {
  preferencesStore.set(userId, prefs);
}
