'use client';

import React, { useState } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

const ResizeHandle = styled('div')<{ position: string }>(({ position }) => {
  const getPositionStyles = () => {
    switch (position) {
      case 'n':
        return { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' };
      case 'ne':
        return { top: -4, right: -4, cursor: 'nesw-resize' };
      case 'e':
        return { top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' };
      case 'se':
        return { bottom: -4, right: -4, cursor: 'nwse-resize' };
      case 's':
        return { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' };
      case 'sw':
        return { bottom: -4, left: -4, cursor: 'nesw-resize' };
      case 'w':
        return { top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' };
      case 'nw':
        return { top: -4, left: -4, cursor: 'nwse-resize' };
      default:
        return {};
    }
  };

  return {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: '50%',
    backgroundColor: '#34d399',
    border: '2px solid white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    zIndex: 10,
    opacity: 0,
    transition: 'opacity 0.2s ease',
    '&:hover': {
      opacity: 1,
    },
    ...getPositionStyles(),
  };
});

const ResizableContainer = styled(Box)({
  position: 'relative',
  display: 'inline-block',
  '&:hover': {
    '& .resize-handle': {
      opacity: 1,
    },
  },
});

const ResizeOverlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(52, 211, 153, 0.1)',
  border: '2px dashed #34d399',
  borderRadius: '8px',
  pointerEvents: 'none',
  zIndex: 5,
});

interface ResizableChartProps {
  children: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
  defaultWidth?: number;
  defaultHeight?: number;
}

export const ResizableChart: React.FC<ResizableChartProps> = ({
  children,
  minWidth = 600,
  minHeight = 400,
  defaultWidth = 800,
  defaultHeight = 500,
}) => {
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isResizing, setIsResizing] = useState(false);

  const handleResize = (event: any, { size }: any) => {
    setSize(size);
  };

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  const handleResizeStop = () => {
    setIsResizing(false);
  };

  return (
    <ResizableContainer>
      <Resizable
        width={size.width}
        height={size.height}
        onResize={handleResize}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
        minConstraints={[minWidth, minHeight]}
        resizeHandles={['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']}
        handle={(h, ref) => (
          <ResizeHandle 
            ref={ref} 
            className="resize-handle" 
            position={h} 
            key={h}
          />
        )}
      >
        <Box
          sx={{
            width: size.width,
            height: size.height,
            position: 'relative',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {isResizing && <ResizeOverlay />}
          {children}
        </Box>
      </Resizable>
    </ResizableContainer>
  );
};

export default ResizableChart;