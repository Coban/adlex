
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server external packages for better compatibility
  serverExternalPackages: [
    '@supabase/node-fetch', 
    '@supabase/supabase-js',
    '@supabase/ssr'
  ],
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Handle node modules on client side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }
    
    // Externalize problematic packages for server
    if (isServer) {
      config.externals = config.externals ?? [];
      config.externals.push('@supabase/node-fetch');
    }
    
    return config;
  },
};

export default nextConfig;
