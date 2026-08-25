import { config as loadEnv } from 'dotenv'
import type { NextConfig } from 'next'

loadEnv({ path: '.env', quiet: true })
loadEnv({ path: '.env.local', override: true, quiet: true })

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['postgres'],
  agentRules: false
}

export default nextConfig
