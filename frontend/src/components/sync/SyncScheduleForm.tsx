import React, { useState, useEffect } from 'react';
import { SyncSchedule } from '../../api/syncService';
import useSyncSchedule from '../../hooks/useSyncSchedule';

interface SyncScheduleFormProps {
  scheduleId?: string;
  defaultValues?: Partial<Omit<SyncSchedule, 'id'>>;
  onSubmit?: (schedule: SyncSchedule) => void;
  onCancel?: () => void;
  className?: string;
}

const SyncScheduleForm: React.FC<SyncScheduleFormProps> = ({
  scheduleId,
  defaultValues,
  onSubmit,
  onCancel,
  className
}) => {
  const { getSchedule, createSchedule, updateSchedule } = useSyncSchedule();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formValues, setFormValues] = useState<Partial<Omit<SyncSchedule, 'id'>>>({
    type: 'shopify',
    frequency: 'daily',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isActive: true,
    ...defaultValues
  });

  // Set next run time to 24 hours from now by default
  const [nextRunDate, setNextRunDate] = useState<string>(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [nextRunTime, setNextRunTime] = useState<string>(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[1].substring(0, 5)
  );

  // Load existing schedule if editing
  useEffect(() => {
    if (scheduleId) {
      const fetchSchedule = async () => {
        setIsLoading(true);
        try {
          const schedule = await getSchedule(scheduleId);
          if (schedule) {
            setFormValues({
              type: schedule.type,
              frequency: schedule.frequency,
              isActive: schedule.isActive,
              timeZone: schedule.timeZone,
              cronExpression: schedule.cronExpression,
              config: schedule.config
            });

            // Parse the nextRunAt date and time
            if (schedule.nextRunAt) {
              const date = new Date(schedule.nextRunAt);
              setNextRunDate(date.toISOString().split('T')[0]);
              setNextRunTime(date.toISOString().split('T')[1].substring(0, 5));
            }
          }
        } catch (err) {
          setError('Failed to load schedule');
          console.error('Error loading schedule:', err);
        } finally {
          setIsLoading(false);
        }
      };

      fetchSchedule();
    }
  }, [scheduleId, getSchedule]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormValues(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormValues(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Combine date and time for nextRunAt
      const nextRunAt = `${nextRunDate}T${nextRunTime}:00.000Z`;

      const scheduleData = {
        ...formValues,
        nextRunAt
      } as Omit<SyncSchedule, 'id'>;

      let result: SyncSchedule | null;

      if (scheduleId) {
        // Update existing schedule
        result = await updateSchedule(scheduleId, scheduleData);
      } else {
        // Create new schedule
        result = await createSchedule(scheduleData);
      }

      if (result) {
        setSuccess(scheduleId ? 'Schedule updated successfully' : 'Schedule created successfully');
        if (onSubmit) {
          onSubmit(result);
        }
      } else {
        setError('Failed to save schedule');
      }
    } catch (err) {
      setError('An error occurred while saving the schedule');
      console.error('Error saving schedule:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Advanced configuration section for cron expressions
  const renderAdvancedConfig = () => {
    if (formValues.frequency !== 'custom') {
      return null;
    }

    return (
      <div className="mt-4">
        <label htmlFor="cronExpression" className="block text-sm font-medium text-gray-700">
          Cron Expression
        </label>
        <div className="mt-1">
          <input
            type="text"
            name="cronExpression"
            id="cronExpression"
            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            placeholder="* * * * *"
            value={formValues.cronExpression || ''}
            onChange={handleInputChange}
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Use standard cron format (minute hour day month weekday)
        </p>
      </div>
    );
  };

  // Platform specific configuration
  const renderPlatformConfig = () => {
    switch (formValues.type) {
      case 'shopify':
        return (
          <div className="mt-4">
            <label htmlFor="shopifyConfig" className="block text-sm font-medium text-gray-700">
              Shopify Configuration (JSON)
            </label>
            <div className="mt-1">
              <textarea
                id="shopifyConfig"
                name="configJson"
                rows={3}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder='{"includeProducts": true, "includeOrders": true}'
                value={formValues.config ? JSON.stringify(formValues.config, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const config = e.target.value ? JSON.parse(e.target.value) : {};
                    setFormValues(prev => ({ ...prev, config }));
                  } catch (err) {
                    // Allow invalid JSON during typing, it will be validated on submit
                    handleInputChange(e);
                  }
                }}
              />
            </div>
          </div>
        );
      case 'rakuten':
        return (
          <div className="mt-4">
            <label htmlFor="rakutenConfig" className="block text-sm font-medium text-gray-700">
              Rakuten Configuration (JSON)
            </label>
            <div className="mt-1">
              <textarea
                id="rakutenConfig"
                name="configJson"
                rows={3}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder='{"includeProducts": true, "includeOrders": true}'
                value={formValues.config ? JSON.stringify(formValues.config, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const config = e.target.value ? JSON.parse(e.target.value) : {};
                    setFormValues(prev => ({ ...prev, config }));
                  } catch (err) {
                    // Allow invalid JSON during typing, it will be validated on submit
                    handleInputChange(e);
                  }
                }}
              />
            </div>
          </div>
        );
      case 'amazon':
        return (
          <div className="mt-4">
            <label htmlFor="amazonConfig" className="block text-sm font-medium text-gray-700">
              Amazon Configuration (JSON)
            </label>
            <div className="mt-1">
              <textarea
                id="amazonConfig"
                name="configJson"
                rows={3}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder='{"includeProducts": true, "includeOrders": true}'
                value={formValues.config ? JSON.stringify(formValues.config, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const config = e.target.value ? JSON.parse(e.target.value) : {};
                    setFormValues(prev => ({ ...prev, config }));
                  } catch (err) {
                    // Allow invalid JSON during typing, it will be validated on submit
                    handleInputChange(e);
                  }
                }}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white shadow overflow-hidden sm:rounded-lg ${className}`}>
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          {scheduleId ? 'Edit Sync Schedule' : 'Create New Sync Schedule'}
        </h3>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {success && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}
        
        <form className="mt-5 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            {/* Type */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                Sync Type
              </label>
              <select
                id="type"
                name="type"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={formValues.type || 'shopify'}
                onChange={handleInputChange}
              >
                <option value="shopify">Shopify</option>
                <option value="rakuten">Rakuten</option>
                <option value="amazon">Amazon</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            
            {/* Frequency */}
            <div>
              <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">
                Frequency
              </label>
              <select
                id="frequency"
                name="frequency"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={formValues.frequency || 'daily'}
                onChange={handleInputChange}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom (Cron)</option>
              </select>
            </div>
            
            {/* Next Run Date */}
            <div>
              <label htmlFor="nextRunDate" className="block text-sm font-medium text-gray-700">
                Next Run Date
              </label>
              <input
                type="date"
                id="nextRunDate"
                name="nextRunDate"
                className="mt-1 block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                value={nextRunDate}
                onChange={(e) => setNextRunDate(e.target.value)}
              />
            </div>
            
            {/* Next Run Time */}
            <div>
              <label htmlFor="nextRunTime" className="block text-sm font-medium text-gray-700">
                Next Run Time
              </label>
              <input
                type="time"
                id="nextRunTime"
                name="nextRunTime"
                className="mt-1 block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                value={nextRunTime}
                onChange={(e) => setNextRunTime(e.target.value)}
              />
            </div>
            
            {/* Timezone */}
            <div>
              <label htmlFor="timeZone" className="block text-sm font-medium text-gray-700">
                Time Zone
              </label>
              <select
                id="timeZone"
                name="timeZone"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={formValues.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                onChange={handleInputChange}
              >
                {/* Common timezones */}
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            
            {/* Active Status */}
            <div className="flex items-center h-10 mt-6">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={formValues.isActive !== false}
                onChange={(e) => setFormValues(prev => ({ ...prev, isActive: e.target.checked }))}
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                Schedule is active
              </label>
            </div>
          </div>
          
          {/* Advanced configuration */}
          {renderAdvancedConfig()}
          
          {/* Platform specific configuration */}
          {renderPlatformConfig()}
          
          {/* Form actions */}
          <div className="pt-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : scheduleId ? 'Update Schedule' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SyncScheduleForm;