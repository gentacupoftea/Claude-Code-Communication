import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Filter, Download, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";

import SalesTrendChart from "./charts/SalesTrendChart";
import CategoryPieChart from "./charts/CategoryPieChart";
import OrderSummaryChart from "./charts/OrderSummaryChart";
import GeographicMap from "./charts/GeographicMap";
import MetricCard from "./MetricCard";
import DateRangePicker from "../common/DateRangePicker";
import api from "../../services/api";

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
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [isExporting, setIsExporting] = useState(false);

  // Format dates for API calls
  const formatDate = (date: Date) => format(date, "yyyy-MM-dd");

  // Fetch order summary data
  const { data: orderSummary, isLoading: orderLoading } = useQuery({
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
  });

  // Fetch category sales data
  const { data: categoryData, isLoading: categoryLoading } = useQuery({
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
  });

  // Fetch sales trend data
  const { data: trendData, isLoading: trendLoading } = useQuery({
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
  });

  // Fetch geographic distribution data
  const { data: geoData, isLoading: geoLoading } = useQuery({
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
  });

  const handleExport = async (dataType: string, format: string) => {
    setIsExporting(true);
    try {
      const response = await api.get(`/analytics/export/${dataType}`, {
        params: {
          start_date: formatDate(dateRange.startDate),
          end_date: formatDate(dateRange.endDate),
          format,
        },
        responseType: "blob",
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${dataType}_${format}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const summaryData: SummaryData = orderSummary?.summary || {
    total_orders: 0,
    total_revenue: 0,
    average_order_value: 0,
    total_customers: 0,
    conversion_rate: 0,
  };

  const growthRate = trendData?.growth_rate || 0;

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Analytics Dashboard
        </h1>
        <div className="flex items-center space-x-4">
          <DateRangePicker
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onChange={(start, end) =>
              setDateRange({ startDate: start, endDate: end })
            }
          />
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
            className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <MetricCard
          title="Total Orders"
          value={summaryData.total_orders}
          icon={<Filter className="w-5 h-5" />}
          trend={growthRate > 0 ? "up" : growthRate < 0 ? "down" : "neutral"}
          trendValue={Math.abs(growthRate)}
        />
        <MetricCard
          title="Total Revenue"
          value={`$${summaryData.total_revenue.toLocaleString()}`}
          icon={<TrendingUp className="w-5 h-5" />}
          trend={growthRate > 0 ? "up" : growthRate < 0 ? "down" : "neutral"}
          trendValue={Math.abs(growthRate)}
        />
        <MetricCard
          title="Avg Order Value"
          value={`$${summaryData.average_order_value.toFixed(2)}`}
          icon={<Calendar className="w-5 h-5" />}
        />
        <MetricCard
          title="Total Customers"
          value={summaryData.total_customers}
          icon={<Filter className="w-5 h-5" />}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${summaryData.conversion_rate.toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Summary Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Order Summary
            </h3>
            <button
              onClick={() => handleExport("orders", "csv")}
              disabled={isExporting}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          {orderLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <OrderSummaryChart data={orderSummary?.data || []} title="注文概要" />
          )}
        </div>

        {/* Category Sales Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Sales by Category
            </h3>
            <button
              onClick={() => handleExport("categories", "json")}
              disabled={isExporting}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          {categoryLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <CategoryPieChart data={categoryData || []} title="カテゴリー別売上" />
          )}
        </div>

        {/* Sales Trend Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Sales Trend
            </h3>
            <button
              onClick={() => handleExport("trend", "excel")}
              disabled={isExporting}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          {trendLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
              Geographic Distribution
            </h3>
            <button
              onClick={() => handleExport("geographic", "csv")}
              disabled={isExporting}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          {geoLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <GeographicMap data={geoData || []} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
