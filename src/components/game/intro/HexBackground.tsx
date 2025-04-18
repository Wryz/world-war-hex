import React, { useEffect, useRef } from 'react';

const HexBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Store the grid and its dimensions to prevent regeneration
  const hexGridRef = useRef<{
    grid: number[][],
    cols: number,
    rows: number
  }>({ grid: [], cols: 0, rows: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Hex grid parameters
    const hexSize = 50; // Smaller to prevent overlap
    const hexHeight = hexSize * Math.sqrt(3);
    const hexVerticalOffset = hexHeight;
    const hexHorizontalOffset = hexSize * 1.5; // Exact horizontal spacing for tiling

    // Get biome colors from CSS variables
    const getBiomeColors = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      return [
        computedStyle.getPropertyValue('--biome-plain').trim() || '#9cde57',
        computedStyle.getPropertyValue('--biome-mountain').trim() || '#b8b8b8',
        computedStyle.getPropertyValue('--biome-forest').trim() || '#38a63c',
        computedStyle.getPropertyValue('--biome-water').trim() || '#5ad2ff',
        computedStyle.getPropertyValue('--biome-desert').trim() || '#ffe066',
        computedStyle.getPropertyValue('--biome-resource').trim() || '#ffcc66',
      ];
    };

    const biomeColors = getBiomeColors();

    // Create or expand the hex grid
    function getOrCreateHexGrid(cols: number, rows: number) {
      const { grid, cols: existingCols, rows: existingRows } = hexGridRef.current;
      
      // If we don't have a grid yet, create a new one
      if (grid.length === 0) {
        return createNewGrid(cols, rows);
      }
      
      // If the existing grid is big enough, use it
      if (cols <= existingCols && rows <= existingRows) {
        return grid;
      }
      
      // Otherwise, expand the grid
      return expandGrid(grid, existingCols, existingRows, cols, rows);
    }
    
    // Create a brand new grid with clustering
    function createNewGrid(cols: number, rows: number) {
      // Initialize grid with random biome types
      const grid: number[][] = [];
      
      for (let row = 0; row < rows; row++) {
        grid[row] = [];
        for (let col = 0; col < cols; col++) {
          // Start with random biome type (0-5)
          grid[row][col] = Math.floor(Math.random() * biomeColors.length);
        }
      }
      
      // Apply clustering algorithm
      applyClusteringAlgorithm(grid, cols, rows);
      
      // Store the grid and its dimensions
      hexGridRef.current = { grid, cols, rows };
      return grid;
    }
    
    // Expand an existing grid
    function expandGrid(existingGrid: number[][], existingCols: number, existingRows: number, newCols: number, newRows: number) {
      // Create a new grid with the new dimensions
      const newGrid: number[][] = [];
      
      // Copy existing data and fill new areas
      for (let row = 0; row < newRows; row++) {
        newGrid[row] = [];
        for (let col = 0; col < newCols; col++) {
          if (row < existingRows && col < existingCols) {
            // Copy existing data
            newGrid[row][col] = existingGrid[row][col];
          } else {
            // For new areas, use a biome similar to adjacent cells if possible
            if (row > 0 && col > 0) {
              // Get neighboring cells that exist
              const neighbors = [];
              
              // Check left
              if (col > 0 && newGrid[row][col-1] !== undefined) {
                neighbors.push(newGrid[row][col-1]);
              }
              
              // Check above
              if (row > 0 && newGrid[row-1][col] !== undefined) {
                neighbors.push(newGrid[row-1][col]);
              }
              
              // Check diagonal
              if (row > 0 && col > 0 && newGrid[row-1][col-1] !== undefined) {
                neighbors.push(newGrid[row-1][col-1]);
              }
              
              if (neighbors.length > 0) {
                // Use a random neighbor's biome type (70% chance)
                if (Math.random() < 0.7) {
                  const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
                  newGrid[row][col] = randomNeighbor;
                } else {
                  // Otherwise random
                  newGrid[row][col] = Math.floor(Math.random() * biomeColors.length);
                }
              } else {
                // No neighbors, use random
                newGrid[row][col] = Math.floor(Math.random() * biomeColors.length);
              }
            } else {
              // Edge cells, use random
              newGrid[row][col] = Math.floor(Math.random() * biomeColors.length);
            }
          }
        }
      }
      
      // Apply clustering algorithm to the new areas only
      applyClusteringAlgorithm(newGrid, newCols, newRows, existingCols, existingRows);
      
      // Store the updated grid and dimensions
      hexGridRef.current = { grid: newGrid, cols: newCols, rows: newRows };
      return newGrid;
    }
    
    // Apply clustering algorithm to smooth out the grid
    function applyClusteringAlgorithm(grid: number[][], cols: number, rows: number, startCol = 0, startRow = 0) {
      const iterations = 3; // More iterations for better clustering
      
      for (let iter = 0; iter < iterations; iter++) {
        const newGrid = JSON.parse(JSON.stringify(grid)); // Deep copy
        
        for (let row = startRow; row < rows; row++) {
          for (let col = startCol; col < cols; col++) {
            // Get neighboring cells (considering hex grid)
            const neighbors = [];
            
            // Determine neighbors based on even/odd column
            const isEvenCol = col % 2 === 0;
            
            // Neighbor directions for hex grid
            const directions = isEvenCol ? [
              [-1, 0], [1, 0], // Left, Right
              [-1, -1], [0, -1], // Upper Left, Upper
              [-1, 1], [0, 1]  // Lower Left, Lower
            ] : [
              [-1, 0], [1, 0], // Left, Right
              [0, -1], [1, -1], // Upper, Upper Right
              [0, 1], [1, 1]  // Lower, Lower Right
            ];
            
            for (const [dx, dy] of directions) {
              const nx = col + dx;
              const ny = row + dy;
              
              if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                neighbors.push(grid[ny][nx]);
              }
            }
            
            // Count occurrences of each biome type among neighbors
            const counts = Array(biomeColors.length).fill(0);
            for (const neighbor of neighbors) {
              counts[neighbor]++;
            }
            
            // 80% chance to change to the most common neighboring biome
            if (Math.random() < 0.8) {
              let maxCount = 0;
              let maxBiome = grid[row][col]; // Default to current
              
              for (let i = 0; i < counts.length; i++) {
                if (counts[i] > maxCount) {
                  maxCount = counts[i];
                  maxBiome = i;
                }
              }
              
              newGrid[row][col] = maxBiome;
            }
          }
        }
        
        // Update grid for next iteration
        for (let row = startRow; row < rows; row++) {
          for (let col = startCol; col < cols; col++) {
            grid[row][col] = newGrid[row][col];
          }
        }
      }
    }

    function drawHexagon(x: number, y: number, size: number, color: string) {
      if (!ctx) return;
      
      // Calculate the six points of the hexagon
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const xPos = x + size * Math.cos(angle);
        const yPos = y + size * Math.sin(angle);
        points.push({ x: xPos, y: yPos });
      }
      
      // Fill the hexagon
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      
      // Draw solid white border
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function drawHexGrid() {
      if (!canvas || !ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Fill background with the new background color from CSS
      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#fcf3c7';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate number of hexagons needed to fill the screen
      const cols = Math.ceil(canvas.width / hexHorizontalOffset) + 2;
      const rows = Math.ceil(canvas.height / hexVerticalOffset) + 2;
      
      // Get or create the hex grid
      const hexGrid = getOrCreateHexGrid(cols, rows);

      // Draw hexagons
      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          // Calculate position - ensure perfect tiling
          const x = col * hexHorizontalOffset;
          const y = row * hexVerticalOffset + (col % 2 === 0 ? 0 : hexHeight / 2);
          
          // Get biome type from grid (with bounds checking)
          const biomeIndex = row >= 0 && row < hexGrid.length && col >= 0 && col < hexGrid[0].length
            ? hexGrid[row][col]
            : Math.floor(Math.random() * biomeColors.length);
          
          // Get color for this biome
          const color = biomeColors[biomeIndex];
          
          // Draw the hexagon
          drawHexagon(x, y, hexSize, color);
        }
      }
    }

    // Set canvas to full window size and draw
    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawHexGrid();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full -z-10"
      style={{ opacity: 0.9 }}
    />
  );
};

export default HexBackground; 