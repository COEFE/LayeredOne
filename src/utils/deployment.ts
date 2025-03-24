'use client';

/**
 * Utility functions for handling deployment environments
 */

/**
 * Checks if the current deployment is a Vercel preview deployment
 */
export const isVercelPreview = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  return hostname.includes('vercel.app') && 
         !hostname.includes('vercel-analytics') && 
         !hostname.startsWith('www') && 
         hostname !== process.env.NEXT_PUBLIC_PRODUCTION_DOMAIN;
};

/**
 * Gets information about the current deployment environment
 */
export const getDeploymentInfo = () => {
  if (typeof window === 'undefined') {
    return {
      environment: 'server',
      domain: null,
      isPreview: false,
      isProduction: false,
      isDevelopment: false,
    };
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isVercelPreviewDeployment = isVercelPreview();
  const isProductionDomain = hostname === process.env.NEXT_PUBLIC_PRODUCTION_DOMAIN;
  
  let environment = 'unknown';
  if (process.env.NODE_ENV === 'development' || isLocalhost) {
    environment = 'development';
  } else if (isVercelPreviewDeployment) {
    environment = 'preview';
  } else if (process.env.NODE_ENV === 'production') {
    environment = 'production';
  }

  return {
    environment,
    domain: hostname,
    isPreview: isVercelPreviewDeployment,
    isProduction: environment === 'production' || isProductionDomain,
    isDevelopment: environment === 'development',
  };
};

/**
 * Gets a list of Firebase authorized domains based on the deployment environment
 * This is useful for debugging authentication issues
 */
export const getRecommendedAuthorizedDomains = (): string[] => {
  const deploymentInfo = getDeploymentInfo();
  const domains = ['localhost'];
  
  if (process.env.NEXT_PUBLIC_PRODUCTION_DOMAIN) {
    domains.push(process.env.NEXT_PUBLIC_PRODUCTION_DOMAIN);
  }
  
  if (deploymentInfo.domain && !domains.includes(deploymentInfo.domain)) {
    domains.push(deploymentInfo.domain);
  }
  
  // Add Vercel domains if applicable
  if (deploymentInfo.isPreview) {
    // Extract the base pattern for this preview
    const hostname = deploymentInfo.domain;
    const baseDomainMatch = hostname.match(/^([^-]+)-[^.]+\..+$/);
    if (baseDomainMatch && baseDomainMatch[1]) {
      // Add a wildcard recommendation for this project's preview deployments
      domains.push(`${baseDomainMatch[1]}-*.vercel.app`);
    }
  }
  
  return domains;
};