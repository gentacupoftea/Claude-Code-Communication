import React, { useRef, useState, useEffect, useMemo, CSSProperties } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@mui/material/styles";
import { Typography } from "@mui/material";
import { checkComponentAccessibility, srOnly } from "../../../utils/accessibility";
import {
  A11yChartProps,
  getChartA11yProps,
  setupChartKeyboardNavigation
} from "../../../utils/a11yChartPatterns";

interface OrderSummaryData {
  period: string;
  order_count: number;
  total_revenue: number;
  average_order_value: number;
  unique_customers: number;
}

interface OrderSummaryChartProps extends A11yChartProps {
  data: OrderSummaryData[];
}

const OrderSummaryChart: React.FC<OrderSummaryChartProps> = ({ 
  data,
  title = "注文概要",
  testId = "order-summary-chart",
  ariaLabel,
  ariaDescription,
  hideTable = false
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  // Format data for the chart
  const chartData = useMemo(() => data.map((item) => ({
    period: item.period,
    orders: item.order_count,
    revenue: item.total_revenue,
    aov: item.average_order_value,
  })), [data]);

  const formatTooltipValue = (value: number, name: string) => {
    if (name === "revenue" || name === "aov") {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  const formatYAxisValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value}`;
  };

  // Calculate totals for screen reader information
  const totals = useMemo(() => {
    const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = chartData.reduce((sum, item) => sum + item.orders, 0);
    const avgAOV = totalRevenue / totalOrders || 0;
    
    return {
      totalRevenue,
      totalOrders,
      avgAOV
    };
  }, [chartData]);
  
  // Announce selected data point to screen reader
  const announceDataPoint = (index: number) => {
    if (!announcerRef.current || index < 0 || index >= chartData.length) return;
    
    const item = chartData[index];
    const message = `${item.period}: 売上${formatTooltipValue(item.revenue, "revenue")}, 注文数${formatTooltipValue(item.orders, "orders")}, 平均注文額${formatTooltipValue(item.aov, "aov")}`;
    announcerRef.current.textContent = message;
  };
  
  // Set up keyboard navigation
  useEffect(() => {
    if (!chartRef.current || chartData.length === 0) return;
    
    const cleanup = setupChartKeyboardNavigation(
      chartRef,
      {
        selectedIndex,
        setSelectedIndex,
        dataLength: chartData.length
      },
      announceDataPoint
    );
    
    // Run accessibility check only if chart is rendered
    if (chartRef.current) {
      setTimeout(() => checkComponentAccessibility(chartRef.current), 100);
    }
    
    return cleanup;
  }, [chartData, selectedIndex]);
  
  return (
    <div
      ref={chartRef}
      {...getChartA11yProps({ testId, title, ariaLabel, ariaDescription }, theme, selectedIndex)}
      className="w-full"
    >
      <Typography variant="h6" id={`${testId}-title`} className="mb-4 text-center">
        {title}
      </Typography>
      
      {/* Screen reader description */}
      <div id={`${testId}-desc`} style={srOnly}>
        このグラフは{chartData.length}期間の注文概要を表示しています。
        左右の矢印キーで期間間を移動できます。
        総売上は{formatTooltipValue(totals.totalRevenue, "revenue")}、
        総注文数は{totals.totalOrders}件、
        平均注文額は{formatTooltipValue(totals.avgAOV, "aov")}です。
      </div>
      
      {/* Screen reader live region */}
      <div 
        ref={announcerRef} 
        aria-live="polite" 
        aria-atomic="true"
        style={srOnly}
      />
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
        <XAxis dataKey="period" stroke="#9CA3AF" style={{ fontSize: 12 }} />
        <YAxis
          yAxisId="left"
          stroke="#9CA3AF"
          style={{ fontSize: 12 }}
          tickFormatter={formatYAxisValue}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#9CA3AF"
          style={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={formatTooltipValue}
          contentStyle={{
            backgroundColor: "rgba(17, 24, 39, 0.8)",
            border: "none",
            borderRadius: "8px",
            color: "#F3F4F6",
          }}
        />
        <Legend
          wrapperStyle={{
            paddingTop: "20px",
          }}
        />
        <Bar
          yAxisId="left"
          dataKey="revenue"
          fill="#3B82F6"
          name="Revenue"
          radius={[8, 8, 0, 0]}
        />
        <Bar
          yAxisId="right"
          dataKey="orders"
          fill="#10B981"
          name="Orders"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
    
    {/* Screen reader accessible data table */}
    {!hideTable && (
      <div style={srOnly} tabIndex={-1}>
        <table>
          <caption>{title} データ</caption>
          <thead>
            <tr>
              <th scope="col">期間</th>
              <th scope="col">売上</th>
              <th scope="col">注文数</th>
              <th scope="col">平均注文額</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((item, index) => (
              <tr 
                key={index}
                {...(selectedIndex === index ? { 'aria-current': 'true' } : {})}
              >
                <td>{item.period}</td>
                <td>{formatTooltipValue(item.revenue, "revenue")}</td>
                <td>{formatTooltipValue(item.orders, "orders")}</td>
                <td>{formatTooltipValue(item.aov, "aov")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">合計</th>
              <td>{formatTooltipValue(totals.totalRevenue, "revenue")}</td>
              <td>{totals.totalOrders}</td>
              <td>{formatTooltipValue(totals.avgAOV, "aov")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    )}
  </div>
  );
};

export default OrderSummaryChart;
