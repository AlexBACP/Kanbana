import type { ReactNode } from 'react';

export type Slide = {
  role: string;
  badge: string;
  title: string;
  subtitle: string;
  stats: [string, string][];
  sideLabel: string;
  sideItems: string[];
  activeItemIndex: number;
  body: ReactNode;
};

export type Feature = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc: string;
};

export type RoleCard = {
  label: string;
  desc: string;
  color: string;
};