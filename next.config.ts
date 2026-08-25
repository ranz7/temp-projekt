import { config as loadEnv } from 'dotenv'
import type { NextConfig } from 'next'

loadEnv({ path: '.env', quiet: true })
loadEnv({ path: '.env.local', override: true, quiet: true })

const nextConfig: NextConfig = {
  // The Docker runtime image copies `.next/standalone` and runs `node server.js`,
  // so the image carries only the files the server actually traced.
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['postgres'],
  agentRules: false
}

export default nextConfig
