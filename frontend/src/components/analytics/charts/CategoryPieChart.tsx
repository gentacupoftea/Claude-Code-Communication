import React, { useRef, useState, useEffect, useMemo, CSSProperties } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useTheme } from "@mui/material/styles";
import { Typography } from "@mui/material";
import { checkComponentAccessibility, srOnly } from "../../../utils/accessibility";
import {
  A11yChartProps,
  getChartA11yProps,
  setupChartKeyboardNavigation
} from "../../../utils/a11yChartPatterns";

interface CategoryData {
  category: string;
  sales: number;
  percentage?: number;
}

interface CategoryPieChartProps extends A11yChartProps {
  data: CategoryData[];
}

const COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F97316", // Orange
  "#06B6D4", // Cyan
];

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ 
  data,
  title = "カテゴリー別売上",
  testId = "category-pie-chart",
  ariaLabel,
  ariaDescription,
  hideTable = false
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  // Calculate percentages
  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
  const dataWithPercentages = data.map((item) => ({
    ...item,
    percentage: (item.sales / totalSales) * 100,
  }));

  // Take top 8 categories and group others
  const topCategories = dataWithPercentages.slice(0, 8);
  const otherCategories = dataWithPercentages.slice(8);

  if (otherCategories.length > 0) {
    const otherSales = otherCategories.reduce(
      (sum, item) => sum + item.sales,
      0,
    );
    const otherPercentage = otherCategories.reduce(
      (sum, item) => sum + (item.percentage || 0),
      0,
    );

    topCategories.push({
      category: "Others",
      sales: otherSales,
      percentage: otherPercentage,
    });
  }
  
  // Prepare chart data for accessibility
  const chartData = useMemo(() => topCategories, [topCategories]);
  
  // Announce selected category to screen reader
  const announceDataPoint = (index: number) => {
    if (!announcerRef.current || index < 0 || index >= chartData.length) return;
    
    const item = chartData[index];
    const message = `${item.category}: ${formatTooltipValue(item.sales)}, ${item.percentage?.toFixed(1)}%`;
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

  const renderCustomLabel = (entry: CategoryData) => {
    if (entry.percentage && entry.percentage > 5) {
      return `${entry.percentage.toFixed(1)}%`;
    }
    return "";
  };

  const formatTooltipValue = (value: number) => `$${value.toLocaleString()}`;

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
        このグラフは{chartData.length}個のカテゴリーで構成されています。
        左右の矢印キーでカテゴリー間を移動できます。
        総売上は{`$${totalSales.toLocaleString()}`}です。
      </div>
      
      {/* Screen reader live region */}
      <div 
        ref={announcerRef} 
        aria-live="polite" 
        aria-atomic="true"
        style={srOnly}
      />
      
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
        <Pie
          data={topCategories}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          outerRadius={100}
          fill="#8884d8"
          dataKey="sales"
        >
          {topCategories.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
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
          formatter={(value) => (
            <span className="text-sm text-gray-900 dark:text-gray-300">
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
      
      {/* Screen reader accessible data table */}
      {!hideTable && (
        <div style={srOnly} tabIndex={-1}>
          <table>
            <caption>{title} データ</caption>
            <thead>
              <tr>
                <th scope="col">カテゴリー</th>
                <th scope="col">売上</th>
                <th scope="col">割合</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((item, index) => (
                <tr 
                  key={index}
                  {...(selectedIndex === index ? { 'aria-current': 'true' } : {})}
                >
                  <td>{item.category}</td>
                  <td>{formatTooltipValue(item.sales)}</td>
                  <td>{item.percentage?.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">合計</th>
                <td>{formatTooltipValue(totalSales)}</td>
                <td>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default CategoryPieChart;
