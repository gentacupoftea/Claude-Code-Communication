import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleDateChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    if (start && end) {
      onChange(start, end);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <Calendar className="w-5 h-5" />
        <span>
          {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
        </span>
      </button>
      
      {isOpen && (
        <div className="absolute top-12 right-0 z-50">
          <DatePicker
            selected={startDate}
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
            selectsRange
            inline
            onClickOutside={() => setIsOpen(false)}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;