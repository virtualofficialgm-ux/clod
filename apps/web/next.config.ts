import type { NextConfig } from 'next';

const config: NextConfig = {
  // Внутренние пакеты монорепозитория поставляются исходниками на TypeScript
  transpilePackages: ['@parri/ui', '@parri/shared'],
  reactStrictMode: true,
};

export default config;
