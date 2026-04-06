import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface BrandingData {
  companyName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  sidebarColor: string;
  accentColor: string;
  footerText?: string;
}

const DEFAULT_BRANDING: BrandingData = {
  companyName: "Vine Management",
  primaryColor: "#317C3C",
  sidebarColor: "#1B3E1E",
  accentColor: "#8BC53F",
};

const BrandingContext = createContext<BrandingData>(DEFAULT_BRANDING);

export function useBranding() {
  return useContext(BrandingContext);
}

function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyBrandingColors(branding: BrandingData) {
  const root = document.documentElement;
  const primaryHsl = hexToHsl(branding.primaryColor);
  const sidebarHsl = hexToHsl(branding.sidebarColor);
  const accentHsl = hexToHsl(branding.accentColor);

  if (primaryHsl) {
    root.style.setProperty("--primary", primaryHsl);
    root.style.setProperty("--ring", primaryHsl);
  }
  if (sidebarHsl) {
    root.style.setProperty("--sidebar-background", sidebarHsl);
  }
  if (accentHsl) {
    root.style.setProperty("--sidebar-accent", accentHsl);
  }

  // Update page title
  if (branding.companyName) {
    document.title = branding.companyName;
  }

  // Update favicon
  if (branding.faviconUrl) {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingData>(DEFAULT_BRANDING);

  const { data } = useQuery<BrandingData>({
    queryKey: ["/api/branding"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data) {
      const merged = { ...DEFAULT_BRANDING, ...data };
      setBranding(merged);
      applyBrandingColors(merged);
    }
  }, [data]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
