import React, { useRef, useState, useEffect, useMemo, CSSProperties } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { useTheme } from "@mui/material/styles";
import { Typography } from "@mui/material";
import { checkComponentAccessibility, srOnly } from "../../../utils/accessibility";
import {
  A11yChartProps,
  getChartA11yProps,
  setupChartKeyboardNavigation
} from "../../../utils/a11yChartPatterns";

interface SalesTrendChartProps extends A11yChartProps {
  currentData: Array<{ date: string; sales: number }>;
  previousData?: Array<{ date: string; sales: number }>;
  growthRate?: number;
}

const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  currentData,
  previousData,
  growthRate,
  title = "Sales Trend",
  testId = "sales-trend-chart",
  ariaLabel,
  ariaDescription,
  hideTable = false,
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  // Combine current and previous data for the chart
  const combinedData = currentData.map((item, index) => {
    const prevItem = previousData?.[index];
    return {
      date: format(parseISO(item.date), "MMM dd"),
      current: item.sales,
      previous: prevItem?.sales || null,
    };
  });

  const formatTooltipValue = (value: number) => `$${value.toLocaleString()}`;
  
  // Prepare accessible chart data
  const chartData = useMemo(() => combinedData, [combinedData]);
  
  // Calculate totals for screen reader description
  const totals = useMemo(() => {
    const currentTotal = currentData.reduce((sum, item) => sum + item.sales, 0);
    const previousTotal = previousData 
      ? previousData.reduce((sum, item) => sum + item.sales, 0)
      : null;
    return { currentTotal, previousTotal };
  }, [currentData, previousData]);
  
  // Announce selected data point to screen reader
  const announceDataPoint = (index: number) => {
    if (!announcerRef.current || index < 0 || index >= chartData.length) return;
    
    const item = chartData[index];
    const message = `${item.date}: Current sales ${formatTooltipValue(item.current)}${item.previous ? `, Previous year ${formatTooltipValue(item.previous)}` : ''}`;
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
      className="w-full h-full"
      {...getChartA11yProps({ testId, title, ariaLabel, ariaDescription }, theme, selectedIndex)}
    >
      {/* Screen reader description */}
      <div id={`${testId}-desc`} style={srOnly}>
        このグラフは{chartData.length}件のデータポイントで構成されています。
        左右の矢印キーでデータポイント間を移動できます。
        今期売上合計は{formatTooltipValue(totals.currentTotal)}
        {totals.previousTotal ? `、前年同期は${formatTooltipValue(totals.previousTotal)}` : ''}です。
      </div>
      
      {/* Screen reader live region */}
      <div 
        ref={announcerRef} 
        aria-live="polite" 
        aria-atomic="true"
        style={srOnly}
      />
      <Typography variant="h6" id={`${testId}-title`} className="mb-4 text-center">
        {title}
      </Typography>
      
      {growthRate !== undefined && (
        <div className="mb-4 flex items-center justify-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Year-over-year growth:
          </span>
          <span
            className={`ml-2 text-lg font-bold ${
              growthRate > 0
                ? "text-green-600"
                : growthRate < 0
                  ? "text-red-600"
                  : "text-gray-600"
            }`}
          >
            {growthRate > 0 ? "+" : ""}
            {growthRate.toFixed(1)}%
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={combinedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: 12 }} />
          <YAxis
            stroke="#9CA3AF"
            style={{ fontSize: 12 }}
            tickFormatter={(value) => `$${value}`}
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
          <Line
            type="monotone"
            dataKey="current"
            stroke="#3B82F6"
            strokeWidth={2}
            name="Current Period"
            dot={{ fill: "#3B82F6", r: 4 }}
            activeDot={{ r: 6 }}
          />
          {previousData && (
            <Line
              type="monotone"
              dataKey="previous"
              stroke="#9CA3AF"
              strokeWidth={2}
              name="Previous Year"
              strokeDasharray="5 5"
              dot={{ fill: "#9CA3AF", r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Screen reader accessible data table */}
      {!hideTable && (
        <div style={srOnly} tabIndex={-1}>
          <table>
            <caption>{title} データ</caption>
            <thead>
              <tr>
                <th scope="col">日付</th>
                <th scope="col">今期売上</th>
                {previousData && <th scope="col">前年同期</th>}
              </tr>
            </thead>
            <tbody>
              {chartData.map((item, index) => (
                <tr 
                  key={index}
                  {...(selectedIndex === index ? { 'aria-current': 'true' } : {})}
                >
                  <td>{item.date}</td>
                  <td>{formatTooltipValue(item.current)}</td>
                  {previousData && <td>{item.previous ? formatTooltipValue(item.previous) : '-'}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">合計</th>
                <td>{formatTooltipValue(totals.currentTotal)}</td>
                {previousData && <td>{totals.previousTotal ? formatTooltipValue(totals.previousTotal) : '-'}</td>}
              </tr>
              {growthRate !== undefined && (
                <tr>
                  <th scope="row">成長率</th>
                  <td colSpan={previousData ? 2 : 1}>{growthRate > 0 ? "+" : ""}{growthRate.toFixed(1)}%</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesTrendChart;
