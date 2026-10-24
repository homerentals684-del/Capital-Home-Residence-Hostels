import { LayoutDashboard, Wallet, Receipt, ClipboardList, Bell } from 'lucide-react';
import type { NavItem } from '@/components/app/AppShell';
export const SIGN_IN_DESTINATION = '/dashboard' as const;
export const tenantNav: NavItem[] = [
  { key: 'overview', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { key: 'requests', label: 'My Requests', icon: ClipboardList, section: 'My Stay', to: '/requests' },
  { key: 'notifications', label: 'Notifications', icon: Bell, section: 'My Stay', to: '/notifications' },
  { key: 'pay', label: 'Pay Rent', icon: Wallet, section: 'Finance', to: '/pay' },
  { key: 'payments', label: 'Payments & Receipts', icon: Receipt, section: 'Finance', to: '/payments' },
];
