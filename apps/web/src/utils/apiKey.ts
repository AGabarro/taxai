const STORAGE_KEY = 'taxai_api_key'

export const getApiKey = (): string => localStorage.getItem(STORAGE_KEY) ?? ''
export const setApiKey = (key: string): void => { localStorage.setItem(STORAGE_KEY, key) }
export const clearApiKey = (): void => { localStorage.removeItem(STORAGE_KEY) }
