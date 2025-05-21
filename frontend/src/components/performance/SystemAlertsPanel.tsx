import React, { useState, useEffect, useMemo } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import usePerformanceMetrics from '../../hooks/usePerformanceMetrics';
import useRealtimeUpdates from '../../hooks/useRealtimeUpdates';
import { SystemAlert } from '../../api/performanceService';

interface SystemAlertsPanelProps {
  maxAlerts?: number;
  showControls?: boolean;
  initialLevel?: 'info' | 'warning' | 'error' | 'critical';
  onAlertClick?: (alert: SystemAlert) => void;
  className?: string;
}

const SystemAlertsPanel: React.FC<SystemAlertsPanelProps> = ({
  maxAlerts = 5,
  showControls = true,
  initialLevel,
  onAlertClick,
  className
}) => {
  const [selectedLevel, setSelectedLevel] = useState<'info' | 'warning' | 'error' | 'critical' | undefined>(initialLevel);
  const [showAcknowledged, setShowAcknowledged] = useState<boolean>(false);
  const { alerts, fetchSystemAlerts, acknowledgeAlert } = usePerformanceMetrics(
    [], // No initial metrics needed
    { level: selectedLevel, limit: maxAlerts } // Initial alert options
  );

  // Subscribe to real-time alert updates
  useRealtimeUpdates('performance:alert:created');

  // Alert level options
  const levelOptions = useMemo(() => [
    { value: undefined, label: 'All Levels' },
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'error', label: 'Error' },
    { value: 'critical', label: 'Critical' }
  ], []);

  // Handle level filter change
  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'info' | 'warning' | 'error' | 'critical' | '';
    setSelectedLevel(value ? value as any : undefined);
  };

  // Handle show acknowledged checkbox change
  const handleShowAcknowledgedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowAcknowledged(e.target.checked);
  };

  // Fetch alerts when filters change
  useEffect(() => {
    fetchSystemAlerts({
      level: selectedLevel,
      acknowledged: showAcknowledged ? undefined : false,
      limit: maxAlerts
    });
  }, [selectedLevel, showAcknowledged, maxAlerts, fetchSystemAlerts]);

  // Handle acknowledging an alert
  const handleAcknowledgeAlert = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await acknowledgeAlert(id);
    
    // Refresh alerts after acknowledging
    fetchSystemAlerts({
      level: selectedLevel,
      acknowledged: showAcknowledged ? undefined : false,
      limit: maxAlerts
    });
  };

  // Format alert timestamp
  const formatAlertTime = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return timestamp;
    }
  };

  // Get icon and color based on alert level
  const getAlertAttributes = (level: string) => {
    switch (level) {
      case 'critical':
        return {
          iconClassName: 'h-5 w-5 text-red-600',
          iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800'
        };
      case 'error':
        return {
          iconClassName: 'h-5 w-5 text-red-500',
          iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-700'
        };
      case 'warning':
        return {
          iconClassName: 'h-5 w-5 text-yellow-500',
          iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800'
        };
      case 'info':
      default:
        return {
          iconClassName: 'h-5 w-5 text-blue-500',
          iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-700'
        };
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900">System Alerts</h3>
          
          {showControls && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <input
                  id="show-acknowledged"
                  name="show-acknowledged"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={showAcknowledged}
                  onChange={handleShowAcknowledgedChange}
                />
                <label htmlFor="show-acknowledged" className="ml-2 block text-sm text-gray-700">
                  Show acknowledged
                </label>
              </div>
              
              <select
                id="alert-level"
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={selectedLevel || ''}
                onChange={handleLevelChange}
              >
                {levelOptions.map(option => (
                  <option key={option.value || 'all'} value={option.value || ''}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              <button
                onClick={() => fetchSystemAlerts({
                  level: selectedLevel,
                  acknowledged: showAcknowledged ? undefined : false,
                  limit: maxAlerts
                })}
                className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                title="Refresh alerts"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          )}
        </div>
        
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No alerts found.
            </div>
          ) : (
            alerts.map(alert => {
              const { iconClassName, iconPath, bgColor, borderColor, textColor } = getAlertAttributes(alert.level);
              
              return (
                <div 
                  key={alert.id}
                  className={`p-4 ${bgColor} border ${borderColor} rounded-md ${onAlertClick ? 'cursor-pointer' : ''} ${alert.acknowledged ? 'opacity-60' : ''}`}
                  onClick={onAlertClick ? () => onAlertClick(alert) : undefined}
                >
                  <div className="flex justify-between">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className={iconClassName} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d={iconPath} />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className={`text-sm font-medium ${textColor}`}>
                          {alert.message}
                        </h3>
                        <div className="mt-2 text-sm flex flex-wrap gap-2">
                          <span className="text-gray-500">
                            Source: {alert.source}
                          </span>
                          <span className="text-gray-500">
                            Category: {alert.category}
                          </span>
                          <span className="text-gray-500">
                            {formatAlertTime(alert.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start ml-4">
                      {!alert.acknowledged && (
                        <button
                          type="button"
                          onClick={(e) => handleAcknowledgeAlert(alert.id, e)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {alerts.length > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => fetchSystemAlerts({
                level: selectedLevel,
                acknowledged: showAcknowledged ? undefined : false,
                limit: maxAlerts + 5
              })}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemAlertsPanel;