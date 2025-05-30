// デザインキャンバス用カスタムフック

import { useState, useCallback, useRef, useEffect } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import {
  DesignElement,
  DesignCanvasState,
  DesignCanvasActions,
  DesignTool,
  AlignmentType,
} from '../types/design.types';
import {
  snapToGrid,
  alignElements as alignElementsUtil,
  distributeElements as distributeElementsUtil,
  designElementToFabric,
  fabricToDesignElement,
  exportCanvas as exportCanvasUtil,
} from '../utils/design.utils';

const MAX_HISTORY_SIZE = 50;

export const useDesignCanvas = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  
  const [state, setState] = useState<DesignCanvasState>({
    elements: [],
    selectedIds: [],
    tool: 'select',
    zoom: 1,
    pan: { x: 0, y: 0 },
    gridEnabled: true,
    gridSize: 8,
    history: {
      past: [],
      future: [],
    },
  });

  // 履歴を更新
  const updateHistory = useCallback((newElements: DesignElement[]) => {
    setState(prev => ({
      ...prev,
      elements: newElements,
      history: {
        past: [...prev.history.past, prev.elements].slice(-MAX_HISTORY_SIZE),
        future: [],
      },
    }));
  }, []);

  // 要素を追加
  const addElement = useCallback((element: Omit<DesignElement, 'id' | 'zIndex'>) => {
    const newElement: DesignElement = {
      ...element,
      id: uuidv4(),
      zIndex: state.elements.length,
    };

    if (state.gridEnabled) {
      newElement.x = snapToGrid(newElement.x, state.gridSize);
      newElement.y = snapToGrid(newElement.y, state.gridSize);
      if (newElement.width) {
        newElement.width = snapToGrid(newElement.width, state.gridSize);
      }
      if (newElement.height) {
        newElement.height = snapToGrid(newElement.height, state.gridSize);
      }
    }

    const newElements = [...state.elements, newElement];
    updateHistory(newElements);

    // Fabric.jsキャンバスにも追加
    if (fabricCanvasRef.current) {
      const fabricObject = designElementToFabric(newElement);
      fabricCanvasRef.current.add(fabricObject);
      fabricCanvasRef.current.renderAll();
    }

    return newElement.id;
  }, [state.elements, state.gridEnabled, state.gridSize, updateHistory]);

  // 要素を更新
  const updateElement = useCallback((id: string, updates: Partial<DesignElement>) => {
    const newElements = state.elements.map(el =>
      el.id === id ? { ...el, ...updates } : el
    );
    updateHistory(newElements);

    // Fabric.jsキャンバスも更新
    if (fabricCanvasRef.current) {
      const fabricObject = fabricCanvasRef.current.getObjects().find(
        obj => (obj as any).id === id
      );
      if (fabricObject) {
        fabricObject.set(updates as any);
        fabricCanvasRef.current.renderAll();
      }
    }
  }, [state.elements, updateHistory]);

  // 要素を削除
  const deleteElements = useCallback((ids: string[]) => {
    const newElements = state.elements.filter(el => !ids.includes(el.id));
    updateHistory(newElements);

    // Fabric.jsキャンバスからも削除
    if (fabricCanvasRef.current) {
      const objectsToRemove = fabricCanvasRef.current.getObjects().filter(
        obj => ids.includes((obj as any).id)
      );
      objectsToRemove.forEach(obj => fabricCanvasRef.current!.remove(obj));
      fabricCanvasRef.current.renderAll();
    }

    setState(prev => ({ ...prev, selectedIds: [] }));
  }, [state.elements, updateHistory]);

  // 要素を選択
  const selectElements = useCallback((ids: string[]) => {
    setState(prev => ({ ...prev, selectedIds: ids }));

    // Fabric.jsの選択も更新
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.discardActiveObject();
      const objects = fabricCanvasRef.current.getObjects().filter(
        obj => ids.includes((obj as any).id)
      );
      if (objects.length > 0) {
        if (objects.length === 1) {
          fabricCanvasRef.current.setActiveObject(objects[0]);
        } else {
          const selection = new fabric.ActiveSelection(objects, {
            canvas: fabricCanvasRef.current,
          });
          fabricCanvasRef.current.setActiveObject(selection);
        }
        fabricCanvasRef.current.renderAll();
      }
    }
  }, []);

  // 要素をグループ化
  const groupElements = useCallback((ids: string[]) => {
    const groupId = uuidv4();
    const newElements = state.elements.map(el =>
      ids.includes(el.id) ? { ...el, groupId } : el
    );
    updateHistory(newElements);
  }, [state.elements, updateHistory]);

  // グループを解除
  const ungroupElements = useCallback((groupId: string) => {
    const newElements = state.elements.map(el =>
      el.groupId === groupId ? { ...el, groupId: undefined } : el
    );
    updateHistory(newElements);
  }, [state.elements, updateHistory]);

  // レイヤー順序の変更
  const reorderElements = useCallback((ids: string[], direction: 'front' | 'back' | 'forward' | 'backward') => {
    let newElements = [...state.elements];
    const selectedElements = newElements.filter(el => ids.includes(el.id));
    const otherElements = newElements.filter(el => !ids.includes(el.id));

    switch (direction) {
      case 'front':
        newElements = [...otherElements, ...selectedElements];
        break;
      case 'back':
        newElements = [...selectedElements, ...otherElements];
        break;
      case 'forward':
        // 選択要素を1つ前に移動
        selectedElements.forEach(selected => {
          const currentIndex = newElements.indexOf(selected);
          if (currentIndex < newElements.length - 1) {
            newElements.splice(currentIndex, 1);
            newElements.splice(currentIndex + 1, 0, selected);
          }
        });
        break;
      case 'backward':
        // 選択要素を1つ後ろに移動
        selectedElements.reverse().forEach(selected => {
          const currentIndex = newElements.indexOf(selected);
          if (currentIndex > 0) {
            newElements.splice(currentIndex, 1);
            newElements.splice(currentIndex - 1, 0, selected);
          }
        });
        break;
    }

    // zIndexを更新
    newElements = newElements.map((el, index) => ({ ...el, zIndex: index }));
    updateHistory(newElements);

    // Fabric.jsのレイヤー順序も更新
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.getObjects().forEach(obj => {
        const element = newElements.find(el => el.id === (obj as any).id);
        if (element) {
          obj.moveTo(element.zIndex);
        }
      });
      fabricCanvasRef.current.renderAll();
    }
  }, [state.elements, updateHistory]);

  // 要素を整列
  const alignElements = useCallback((ids: string[], alignment: AlignmentType) => {
    const elementsToAlign = state.elements.filter(el => ids.includes(el.id));
    const alignmentUpdates = alignElementsUtil(elementsToAlign, alignment);
    
    const newElements = state.elements.map((el, index) => {
      const alignIndex = elementsToAlign.findIndex(aligned => aligned.id === el.id);
      if (alignIndex !== -1) {
        return { ...el, ...alignmentUpdates[alignIndex] };
      }
      return el;
    });
    
    updateHistory(newElements);
  }, [state.elements, updateHistory]);

  // 要素を分散配置
  const distributeElements = useCallback((ids: string[], direction: 'horizontal' | 'vertical') => {
    const elementsToDistribute = state.elements.filter(el => ids.includes(el.id));
    const distributionUpdates = distributeElementsUtil(elementsToDistribute, direction);
    
    const newElements = state.elements.map((el, index) => {
      const distIndex = elementsToDistribute.findIndex(dist => dist.id === el.id);
      if (distIndex !== -1) {
        return { ...el, ...distributionUpdates[distIndex] };
      }
      return el;
    });
    
    updateHistory(newElements);
  }, [state.elements, updateHistory]);

  // 元に戻す
  const undo = useCallback(() => {
    if (state.history.past.length === 0) return;

    const newPast = [...state.history.past];
    const previousElements = newPast.pop()!;
    
    setState(prev => ({
      ...prev,
      elements: previousElements,
      history: {
        past: newPast,
        future: [prev.elements, ...prev.history.future].slice(0, MAX_HISTORY_SIZE),
      },
    }));

    // Fabric.jsキャンバスを再構築
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear();
      previousElements.forEach(element => {
        const fabricObject = designElementToFabric(element);
        fabricCanvasRef.current!.add(fabricObject);
      });
      fabricCanvasRef.current.renderAll();
    }
  }, [state.history.past, state.elements]);

  // やり直し
  const redo = useCallback(() => {
    if (state.history.future.length === 0) return;

    const newFuture = [...state.history.future];
    const nextElements = newFuture.shift()!;
    
    setState(prev => ({
      ...prev,
      elements: nextElements,
      history: {
        past: [...prev.history.past, prev.elements].slice(-MAX_HISTORY_SIZE),
        future: newFuture,
      },
    }));

    // Fabric.jsキャンバスを再構築
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear();
      nextElements.forEach(element => {
        const fabricObject = designElementToFabric(element);
        fabricCanvasRef.current!.add(fabricObject);
      });
      fabricCanvasRef.current.renderAll();
    }
  }, [state.history.future, state.elements]);

  // その他のアクション
  const setTool = useCallback((tool: DesignTool['action']) => {
    setState(prev => ({ ...prev, tool }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState(prev => ({ ...prev, zoom }));
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setZoom(zoom);
      fabricCanvasRef.current.renderAll();
    }
  }, []);

  const setPan = useCallback((pan: { x: number; y: number }) => {
    setState(prev => ({ ...prev, pan }));
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.relativePan(new fabric.Point(pan.x, pan.y));
      fabricCanvasRef.current.renderAll();
    }
  }, []);

  const toggleGrid = useCallback(() => {
    setState(prev => ({ ...prev, gridEnabled: !prev.gridEnabled }));
  }, []);

  const clearCanvas = useCallback(() => {
    updateHistory([]);
    setState(prev => ({ ...prev, selectedIds: [] }));
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear();
      fabricCanvasRef.current.renderAll();
    }
  }, [updateHistory]);

  const exportCanvas = useCallback(async (format: 'png' | 'svg' | 'json') => {
    if (!fabricCanvasRef.current) return '';
    return exportCanvasUtil(fabricCanvasRef.current, format);
  }, []);

  const importCanvas = useCallback(async (data: string | File) => {
    // 実装は省略（ファイル形式に応じた処理が必要）
  }, []);

  // Fabric.jsキャンバスの初期化
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasRef.current.width,
      height: canvasRef.current.height,
      backgroundColor: '#ffffff',
    });

    fabricCanvasRef.current = canvas;

    // グリッドの描画
    const drawGrid = () => {
      if (!state.gridEnabled) return;
      
      const gridSize = state.gridSize * state.zoom;
      const width = canvas.getWidth();
      const height = canvas.getHeight();

      // 既存のグリッド線を削除
      canvas.getObjects('line').forEach(obj => {
        if ((obj as any).isGrid) {
          canvas.remove(obj);
        }
      });

      // 縦線を描画
      for (let x = 0; x <= width; x += gridSize) {
        const line = new fabric.Line([x, 0, x, height], {
          stroke: '#e0e0e0',
          strokeWidth: 1,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
        (line as any).isGrid = true;
        canvas.add(line);
      }

      // 横線を描画
      for (let y = 0; y <= height; y += gridSize) {
        const line = new fabric.Line([0, y, width, y], {
          stroke: '#e0e0e0',
          strokeWidth: 1,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
        (line as any).isGrid = true;
        canvas.add(line);
      }

      canvas.sendToBack(...canvas.getObjects('line').filter(obj => (obj as any).isGrid));
    };

    drawGrid();

    return () => {
      canvas.dispose();
    };
  }, [canvasRef, state.gridEnabled, state.gridSize, state.zoom]);

  const actions: DesignCanvasActions = {
    addElement,
    updateElement,
    deleteElements,
    selectElements,
    groupElements,
    ungroupElements,
    moveToFront: (ids) => reorderElements(ids, 'front'),
    moveToBack: (ids) => reorderElements(ids, 'back'),
    moveForward: (ids) => reorderElements(ids, 'forward'),
    moveBackward: (ids) => reorderElements(ids, 'backward'),
    alignElements,
    distributeElements,
    undo,
    redo,
    setTool,
    setZoom,
    setPan,
    toggleGrid,
    clearCanvas,
    exportCanvas,
    importCanvas,
  };

  return {
    state,
    actions,
    fabricCanvas: fabricCanvasRef.current,
  };
};