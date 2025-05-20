import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Filter,
  Download,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { format, subDays, isValid } from "date-fns";
import { useTranslation } from "react-i18next";
import debounce from "lodash/debounce";

import SalesTrendChart from "./charts/SalesTrendChart";
import CategoryPieChart from "./charts/CategoryPieChart";
import OrderSummaryChart from "./charts/OrderSummaryChart";
import GeographicMap from "./charts/GeographicMap";
import MetricCard from "./MetricCard";
import DateRangePicker from "../common/DateRangePicker";
import LoadingSpinner from "../common/LoadingSpinner";
import ErrorBoundary from "../common/ErrorBoundary";
import api from "../../services/api";
import { useAuth } from "../../contexts/MockAuthContext";
import { toast } from "../../utils/toast";

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface SummaryData {
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  total_customers: number;
  conversion_rate: number;
}

const AnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  // const queryClient = useQueryClient();

  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "excel">(
    "csv",
  );

  // Validate date range
  const isValidDateRange = useMemo(() => {
    return (
      isValid(dateRange.startDate) &&
      isValid(dateRange.endDate) &&
      dateRange.startDate <= dateRange.endDate
    );
  }, [dateRange]);

  // Format dates for API calls
  const formatDate = useCallback((date: Date) => {
    return format(date, "yyyy-MM-dd") + "T00:00:00Z";
  }, []);

  // Debounced date change handler
  const debouncedDateChange = useCallback(
    debounce((start: Date, end: Date) => {
      setDateRange({ startDate: start, endDate: end });
    }, 500),
    [],
  );

  // Query options with stale time and error handling
  const queryOptions = {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex: number) =>
      Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: isValidDateRange && !!user,
    onError: (error: any) => {
      console.error("Query error:", error);
      toast.error(t("analytics.error.fetch_failed"));
    },
  };

  // Fetch order summary data
  const {
    data: orderSummary,
    isLoading: orderLoading,
    error: orderError,
  } = useQuery({
    queryKey: ["order-summary", dateRange, groupBy],
    queryFn: async () => {
      const response = await api.get("/analytics/orders/summary", {
        params: {
          start_date: formatDate(dateRange.startDate),
          end_date: formatDate(dateRange.endDate),
          group_by: groupBy,
        },
      });
      return response.data;
    },
    ...queryOptions,
  });

  // Fetch category sales data
  const {
    data: categoryData,
    isLoading: categoryLoading,
    error: categoryError,
  } = useQuery({
    queryKey: ["category-sales", dateRange],
    queryFn: async () => {
      const response = await api.get("/analytics/sales/by-category", {
        params: {
          start_date: formatDate(dateRange.startDate),
          end_date: formatDate(dateRange.endDate),
        },
      });
      return response.data.data;
    },
    ...queryOptions,
  });

  // Fetch sales trend data
  const {
    data: trendData,
    isLoading: trendLoading,
    error: trendError,
  } = useQuery({
    queryKey: ["sales-trend", dateRange],
    queryFn: async () => {
      const response = await api.get("/analytics/sales/trend", {
        params: {
          start_date: formatDate(dateRange.startDate),
          end_date: formatDate(dateRange.endDate),
          compare_previous: true,
        },
      });
      return response.data;
    },
    ...queryOptions,
  });

  // Fetch geographic distribution data
  const {
    data: geoData,
    isLoading: geoLoading,
    error: geoError,
  } = useQuery({
    queryKey: ["geographic-sales", dateRange],
    queryFn: async () => {
      const response = await api.get("/analytics/sales/geographic", {
        params: {
          start_date: formatDate(dateRange.startDate),
          end_date: formatDate(dateRange.endDate),
        },
      });
      return response.data.data;
    },
    ...queryOptions,
  });

  const handleExport = useCallback(
    async (dataType: string) => {
      if (!user?.permissions?.includes("analytics:export")) {
        toast.error(t("analytics.error.no_export_permission"));
        return;
      }

      setIsExporting(true);
      try {
        const response = await api.get(`/analytics/export/${dataType}`, {
          params: {
            start_date: formatDate(dateRange.startDate),
            end_date: formatDate(dateRange.endDate),
            format: exportFormat,
          },
          responseType: "blob",
        });

        // Create download link
        const contentType = response.headers["content-type"];
        const blob = new Blob([response.data], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        // Get filename from Content-Disposition header or generate one
        const contentDisposition = response.headers["content-disposition"];
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        const filename = filenameMatch
          ? filenameMatch[1]
          : `${dataType}_${Date.now()}.${exportFormat}`;

        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(url);
        toast.success(t("analytics.export.success"));
      } catch (error) {
        console.error("Export failed:", error);
        toast.error(t("analytics.export.failed"));
      } finally {
        setIsExporting(false);
      }
    },
    [user, formatDate, dateRange, exportFormat, t],
  );

  const summaryData: SummaryData = orderSummary?.summary || {
    total_orders: 0,
    total_revenue: 0,
    average_order_value: 0,
    total_customers: 0,
    conversion_rate: 0,
  };

  const growthRate = trendData?.growth_rate || 0;

  // Loading state
  const isLoading =
    orderLoading || categoryLoading || trendLoading || geoLoading;

  // Error state
  const hasError = orderError || categoryError || trendError || geoError;

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600 dark:text-gray-400">
          {t("common.authentication_required")}
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("analytics.dashboard.title")}
          </h1>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <DateRangePicker
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onChange={debouncedDateChange}
            />
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
              className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              aria-label={t("analytics.groupBy.label")}
            >
              <option value="day">{t("analytics.groupBy.daily")}</option>
              <option value="week">{t("analytics.groupBy.weekly")}</option>
              <option value="month">{t("analytics.groupBy.monthly")}</option>
            </select>
            <select
              value={exportFormat}
              onChange={(e) =>
                setExportFormat(e.target.value as typeof exportFormat)
              }
              className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              aria-label={t("analytics.export.format_label")}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="excel">Excel</option>
            </select>
          </div>
        </div>

        {/* Validation Error */}
        {!isValidDateRange && (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">
              {t("analytics.error.invalid_date_range")}
            </p>
          </div>
        )}

        {/* Summary Metrics */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"
              ></div>
            ))}
          </div>
        ) : hasError ? (
          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
            <p className="text-red-700 dark:text-red-400">
              {t("analytics.error.metrics_load_failed")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <MetricCard
              title={t("analytics.metrics.total_orders")}
              value={summaryData.total_orders}
              icon={<Filter className="w-5 h-5" />}
              trend={
                growthRate > 0 ? "up" : growthRate < 0 ? "down" : "neutral"
              }
              trendValue={Math.abs(growthRate)}
            />
            <MetricCard
              title={t("analytics.metrics.total_revenue")}
              value={`$${summaryData.total_revenue.toLocaleString()}`}
              icon={<TrendingUp className="w-5 h-5" />}
              trend={
                growthRate > 0 ? "up" : growthRate < 0 ? "down" : "neutral"
              }
              trendValue={Math.abs(growthRate)}
            />
            <MetricCard
              title={t("analytics.metrics.avg_order_value")}
              value={`$${summaryData.average_order_value.toFixed(2)}`}
              icon={<Calendar className="w-5 h-5" />}
            />
            <MetricCard
              title={t("analytics.metrics.total_customers")}
              value={summaryData.total_customers}
              icon={<Filter className="w-5 h-5" />}
            />
            <MetricCard
              title={t("analytics.metrics.conversion_rate")}
              value={`${summaryData.conversion_rate.toFixed(1)}%`}
              icon={<TrendingUp className="w-5 h-5" />}
            />
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Summary Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("analytics.charts.order_summary")}
              </h3>
              <button
                onClick={() => handleExport("orders")}
                disabled={isExporting || orderLoading || !!orderError}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label={t("analytics.export.label")}
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            {orderLoading ? (
              <LoadingSpinner />
            ) : orderError ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-red-500">
                  {t("analytics.error.chart_load_failed")}
                </p>
              </div>
            ) : (
              <OrderSummaryChart data={orderSummary?.data || []} title="注文概要" />
            )}
          </div>

          {/* Category Sales Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("analytics.charts.category_sales")}
              </h3>
              <button
                onClick={() => handleExport("categories")}
                disabled={isExporting || categoryLoading || !!categoryError}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label={t("analytics.export.label")}
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            {categoryLoading ? (
              <LoadingSpinner />
            ) : categoryError ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-red-500">
                  {t("analytics.error.chart_load_failed")}
                </p>
              </div>
            ) : (
              <CategoryPieChart data={categoryData || []} title="カテゴリー別売上" />
            )}
          </div>

          {/* Sales Trend Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("analytics.charts.sales_trend")}
              </h3>
              <button
                onClick={() => handleExport("trend")}
                disabled={isExporting || trendLoading || !!trendError}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label={t("analytics.export.label")}
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            {trendLoading ? (
              <LoadingSpinner />
            ) : trendError ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-red-500">
                  {t("analytics.error.chart_load_failed")}
                </p>
              </div>
            ) : (
              <SalesTrendChart
                currentData={trendData?.current || []}
                previousData={trendData?.previous || []}
                growthRate={trendData?.growth_rate || 0}
                title="売上トレンド"
              />
            )}
          </div>

          {/* Geographic Distribution */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("analytics.charts.geographic_distribution")}
              </h3>
              <button
                onClick={() => handleExport("geographic")}
                disabled={isExporting || geoLoading || !!geoError}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label={t("analytics.export.label")}
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            {geoLoading ? (
              <LoadingSpinner />
            ) : geoError ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-red-500">
                  {t("analytics.error.chart_load_failed")}
                </p>
              </div>
            ) : (
              <GeographicMap data={geoData || []} />
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AnalyticsDashboard;
