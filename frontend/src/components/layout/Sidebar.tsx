import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  ChartBarIcon,
  CogIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
  { name: 'Orders', path: '/orders', icon: ShoppingBagIcon },
  { name: 'Customers', path: '/customers', icon: UserGroupIcon },
  { name: 'Analytics', path: '/analytics', icon: ChartBarIcon },
  { name: 'Reports', path: '/reports', icon: DocumentTextIcon },
  { name: 'Settings', path: '/settings', icon: CogIcon },
];

const Sidebar: React.FC = () => {
  return (
    <div className="flex flex-col w-64 bg-gray-900">
      <div className="flex items-center h-16 px-6">
        <h1 className="text-xl font-semibold text-white">Shopify MCP</h1>
      </div>
      
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;