import React, { useState } from 'react';
import { Menu } from '@headlessui/react';
import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (darkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          {/* Dynamic page title can be added here */}
        </h2>
      </div>

      <div className="flex items-center space-x-4">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          {darkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <BellIcon className="w-5 h-5" />
          <span className="absolute top-0 right-0 flex items-center justify-center w-2 h-2 text-xs text-white bg-red-500 rounded-full"></span>
        </button>

        {/* User menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="flex items-center space-x-2 text-sm focus:outline-none">
            <UserCircleIcon className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">{user?.name || user?.email}</span>
          </Menu.Button>

          <Menu.Items className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50">
            <Menu.Item>
              {({ active }) => (
                <a
                  href="/profile"
                  className={`block px-4 py-2 text-sm ${
                    active ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } text-gray-700 dark:text-gray-200`}
                >
                  Your Profile
                </a>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <a
                  href="/settings"
                  className={`block px-4 py-2 text-sm ${
                    active ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } text-gray-700 dark:text-gray-200`}
                >
                  Settings
                </a>
              )}
            </Menu.Item>
            <hr className="my-1 border-gray-200 dark:border-gray-700" />
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={handleLogout}
                  className={`block w-full text-left px-4 py-2 text-sm ${
                    active ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } text-gray-700 dark:text-gray-200`}
                >
                  Sign out
                </button>
              )}
            </Menu.Item>
          </Menu.Items>
        </Menu>
      </div>
    </header>
  );
};

export default Header;