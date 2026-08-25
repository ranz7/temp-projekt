export type Environment = 'development' | 'preview' | 'production' | 'test'

export function getEnvironment(): Environment {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return 'test'

  const appEnv = process.env.APP_ENV
  if (appEnv === 'production') return 'production'
  if (appEnv === 'preview') return 'preview'

  if (process.env.NODE_ENV === 'production') return 'production'

  return 'development'
}

export function isDevelopment(): boolean {
  return getEnvironment() === 'development'
}

export function isPreview(): boolean {
  return getEnvironment() === 'preview'
}

export function isProduction(): boolean {
  return getEnvironment() === 'production'
}

export function isTest(): boolean {
  return getEnvironment() === 'test'
}
