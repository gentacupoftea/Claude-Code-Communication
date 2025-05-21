import React, { useState, useMemo } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import useSyncJobs from '../../hooks/useSyncJobs';
import { SyncJob, SyncJobFilter } from '../../api/syncService';

interface SyncJobsTableProps {
  initialFilters?: SyncJobFilter;
  limit?: number;
  showControls?: boolean;
  onJobClick?: (job: SyncJob) => void;
  className?: string;
}

const SyncJobsTable: React.FC<SyncJobsTableProps> = ({
  initialFilters,
  limit = 10,
  showControls = true,
  onJobClick,
  className
}) => {
  const [filters, setFilters] = useState<SyncJobFilter>(initialFilters || {});
  const { jobs, stats, isLoading, error, refetch, startJob, cancelJob, retryJob } = useSyncJobs({
    ...filters,
    limit
  });

  // Sync job type options
  const jobTypes = useMemo(() => [
    { value: '', label: 'All Types' },
    { value: 'shopify', label: 'Shopify' },
    { value: 'rakuten', label: 'Rakuten' },
    { value: 'amazon', label: 'Amazon' },
    { value: 'custom', label: 'Custom' }
  ], []);

  // Sync job status options
  const statusOptions = useMemo(() => [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'running', label: 'Running' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' }
  ], []);

  // Handle filter changes
  const handleFilterChange = (field: keyof SyncJobFilter, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Handle job type filter change
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as SyncJobFilter['type'] | '';
    handleFilterChange('type', value || undefined);
  };

  // Handle job status filter change
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as SyncJobFilter['status'] | '';
    handleFilterChange('status', value || undefined);
  };

  // Handle date range changes
  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    handleFilterChange(field, value || undefined);
  };

  // Start a new sync job
  const handleStartJob = async (type: string) => {
    await startJob(type);
    refetch();
  };

  // Cancel a running job
  const handleCancelJob = async (jobId: string) => {
    await cancelJob(jobId);
    refetch();
  };

  // Retry a failed job
  const handleRetryJob = async (jobId: string) => {
    await retryJob(jobId);
    refetch();
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = parseISO(dateString);
      return format(date, 'MMM d, yyyy HH:mm:ss');
    } catch (e) {
      return dateString;
    }
  };

  // Calculate elapsed time or duration
  const calculateDuration = (job: SyncJob) => {
    try {
      const startDate = parseISO(job.startedAt);
      
      if (job.status === 'running' || job.status === 'pending') {
        return formatDistanceToNow(startDate, { addSuffix: false });
      } else if (job.completedAt) {
        const endDate = parseISO(job.completedAt);
        const durationMs = endDate.getTime() - startDate.getTime();
        const seconds = Math.floor(durationMs / 1000);
        
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        return `${hours}h ${remainingMinutes}m`;
      }
      
      return '-';
    } catch (e) {
      return '-';
    }
  };

  if (error) {
    return <div className="text-red-500">Error loading sync jobs: {error.message}</div>;
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Sync Jobs</h3>
        
        {showControls && (
          <div className="mt-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Filters */}
            <div>
              <label htmlFor="job-type" className="block text-sm font-medium text-gray-700">
                Job Type
              </label>
              <select
                id="job-type"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={filters.type || ''}
                onChange={handleTypeChange}
              >
                {jobTypes.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="job-status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="job-status"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={filters.status || ''}
                onChange={handleStatusChange}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                type="date"
                id="start-date"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={filters.startDate || ''}
                onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                id="end-date"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={filters.endDate || ''}
                onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        {showControls && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleStartJob('shopify')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Start Shopify Sync
            </button>
            <button
              type="button"
              onClick={() => handleStartJob('rakuten')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Start Rakuten Sync
            </button>
            <button
              type="button"
              onClick={() => handleStartJob('amazon')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              Start Amazon Sync
            </button>
            <button
              type="button"
              onClick={refetch}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Stats summary */}
        {stats && (
          <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="text-sm text-gray-500">Total Jobs</div>
              <div className="text-xl font-semibold">{stats.totalJobs}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="text-sm text-gray-500">Completed Jobs</div>
              <div className="text-xl font-semibold text-green-600">{stats.completedJobs}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="text-sm text-gray-500">Failed Jobs</div>
              <div className="text-xl font-semibold text-red-600">{stats.failedJobs}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="text-sm text-gray-500">Avg Duration</div>
              <div className="text-xl font-semibold">
                {stats.averageJobDuration < 60 
                  ? `${stats.averageJobDuration}s` 
                  : `${Math.floor(stats.averageJobDuration / 60)}m ${stats.averageJobDuration % 60}s`}
              </div>
            </div>
          </div>
        )}

        {/* Jobs table */}
        <div className="mt-4 -mx-4 sm:-mx-6 overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">ID</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Progress</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Started</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Duration</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Items</th>
                  {showControls && (
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={showControls ? 8 : 7} className="py-10 text-center text-gray-500">
                      Loading sync jobs...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={showControls ? 8 : 7} className="py-10 text-center text-gray-500">
                      No sync jobs found.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr 
                      key={job.id} 
                      className={`${onJobClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      onClick={onJobClick ? () => onJobClick(job) : undefined}
                    >
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {job.id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">
                        {job.type}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                          job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                          job.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className={`h-2.5 rounded-full ${
                              job.status === 'completed' ? 'bg-green-600' :
                              job.status === 'failed' ? 'bg-red-600' : 'bg-blue-600'
                            }`} 
                            style={{ width: `${job.progress}%` }}>
                          </div>
                        </div>
                        <span className="text-xs mt-1">{job.progress}%</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {formatDate(job.startedAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {calculateDuration(job)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {job.dataProcessed !== undefined && job.totalItems !== undefined ? 
                          `${job.dataProcessed}/${job.totalItems}` : '-'}
                      </td>
                      {showControls && (
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          {job.status === 'running' || job.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelJob(job.id);
                              }}
                              className="text-red-600 hover:text-red-900 mr-4"
                            >
                              Cancel
                            </button>
                          ) : job.status === 'failed' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryJob(job.id);
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Retry
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncJobsTable;