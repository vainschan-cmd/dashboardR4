'use client';

import React from 'react';
import {
  LayoutDashboard,
  Target,
  Wallet,
  Ship,
  Menu,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onToggleSidebar: () => void;
  isSidebarOpen?: boolean;
}

export default function MobileBottomNav({
  activeTab,
  onSelectTab,
  onToggleSidebar,
  isSidebarOpen = false,
}: MobileBottomNavProps) {
  const quickNavItems = [
    { id: 'beranda', label: 'Summary', icon: LayoutDashboard },
    { id: 'isu_strategis', label: 'Isu Strategis', icon: Target },
    { id: 'keuangan', label: 'Keuangan', icon: Wallet },
    { id: 'opkom', label: 'Operasi', icon: Ship },
  ];

  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="Navigasi Bawah Layar HP"
      role="navigation"
    >
      <div className="mobile-bottom-nav-inner">
        {quickNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id && !isSidebarOpen;
          return (
            <button
              key={item.id}
              type="button"
              className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="mobile-bottom-nav-icon-wrap">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.3 : 1.75}
                  color={isActive ? 'var(--accent-blue)' : 'var(--text-muted)'}
                  aria-hidden="true"
                />
                {isActive && <span className="mobile-bottom-nav-indicator" />}
              </div>
              <span
                className="mobile-bottom-nav-label"
                style={{
                  color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Tombol Menu Lainnya / Drawer */}
        <button
          type="button"
          className={`mobile-bottom-nav-item ${isSidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          aria-label="Buka Semua Menu"
          aria-expanded={isSidebarOpen}
        >
          <div className="mobile-bottom-nav-icon-wrap">
            <Menu
              size={20}
              strokeWidth={isSidebarOpen ? 2.3 : 1.75}
              color={isSidebarOpen ? 'var(--accent-blue)' : 'var(--text-muted)'}
              aria-hidden="true"
            />
            {isSidebarOpen && <span className="mobile-bottom-nav-indicator" />}
          </div>
          <span
            className="mobile-bottom-nav-label"
            style={{
              color: isSidebarOpen ? 'var(--accent-blue)' : 'var(--text-muted)',
              fontWeight: isSidebarOpen ? 700 : 500,
            }}
          >
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
}

