import React, { useEffect, useState } from 'react';
import { useLoadingManager, Asset } from './LoadingManager';
import Image from 'next/image';

interface LoadingScreenProps {
  onLoadingComplete?: () => void;
  showTips?: boolean;
  className?: string;
}

// Loading tips to display during loading
const LOADING_TIPS = [
  "Place your base on an elevated terrain for better defense.",
  "Forest hexes provide cover for your units, making them harder to hit.",
  "Mountain hexes give ranged units increased attack range.",
  "Resource hexes can be captured to gain additional resources every turn.",
  "Units can only move on certain terrain types based on their mobility.",
  "Ensure you have a mix of melee and ranged units for a balanced army.",
  "Defensive structures can protect important hexes from enemy attacks.",
  "The game's fog of war makes scouting essential for victory.",
  "Water hexes can only be crossed by naval units.",
  "Try to capture strategic locations early in the game.",
];

// Loading stages for better feedback
const LOADING_STAGES = [
  { id: 'init', label: 'Initializing 3D Engine...' },
  { id: 'textures', label: 'Loading Textures...' },
  { id: 'models', label: 'Loading 3D Models...' },
  { id: 'terrain', label: 'Generating Terrain...' },
  { id: 'optimization', label: 'Optimizing Performance...' },
  { id: 'finalizing', label: 'Finalizing Game World...' }
];

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onLoadingComplete,
  showTips = true,
  className = '',
}) => {
  const { assets, totalProgress, isLoading, isComplete } = useLoadingManager();
  const [currentTip, setCurrentTip] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [recentlyLoaded, setRecentlyLoaded] = useState<Asset[]>([]);
  const [webGLInfo, setWebGLInfo] = useState<string>('');
  const [isReadyToComplete, setIsReadyToComplete] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [blurAmount, setBlurAmount] = useState(8); // Starting blur amount (pixels)
  const [opacity, setOpacity] = useState(1); // Starting opacity
  
  // Track if the onLoadingComplete callback has been called
  const [callbackTriggered, setCallbackTriggered] = useState(false);

  // Calculate loading stage based on progress
  useEffect(() => {
    if (totalProgress < 0.15) {
      setStageIndex(0); // Initializing
    } else if (totalProgress < 0.4) {
      setStageIndex(1); // Textures
    } else if (totalProgress < 0.65) {
      setStageIndex(2); // Models
    } else if (totalProgress < 0.8) {
      setStageIndex(3); // Terrain
    } else if (totalProgress < 0.95) {
      setStageIndex(4); // Optimization
    } else {
      setStageIndex(5); // Finalizing
    }
    
    // When assets are fully loaded, mark ready to complete
    if (totalProgress >= 1 && isComplete) {
      setIsReadyToComplete(true);
    }
  }, [totalProgress, isComplete]);

  // Check WebGL capabilities for informational display
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl) {
        // Type assertion for WebGL context
        const webGLContext = gl as WebGLRenderingContext;
        const debugInfo = webGLContext.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const vendor = webGLContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          const renderer = webGLContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          setWebGLInfo(`${vendor} - ${renderer}`);
        } else {
          setWebGLInfo('WebGL Supported');
        }
      } else {
        setWebGLInfo('WebGL Not Detected');
      }
    } catch (error) {
      console.error('Error detecting WebGL capabilities:', error);
      setWebGLInfo('Error detecting WebGL capabilities');
    }
  }, []);

  // Change tip every 5 seconds
  useEffect(() => {
    if (!showTips) return;

    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 5000);

    return () => {
      clearInterval(tipInterval);
    };
  }, [showTips]);

  // Track recently loaded assets for display
  useEffect(() => {
    if (!isLoading) return;

    // Filter for newly loaded assets
    const newlyLoaded = assets.filter(asset => 
      asset.loaded && !recentlyLoaded.some(loaded => loaded.id === asset.id)
    );

    if (newlyLoaded.length > 0) {
      // Add to recently loaded queue (limit to 5 items)
      setRecentlyLoaded(prev => {
        const combined = [...newlyLoaded, ...prev];
        return combined.slice(0, 5);
      });
    }
  }, [assets, isLoading]);

  // Show "Loading Complete" for a moment before fading out
  useEffect(() => {
    if (isReadyToComplete && !isCompleting && !callbackTriggered) {
      // Start the completion animation sequence
      setIsCompleting(true);
      
      // Wait 1.5 seconds, then start the fade-out animation
      setTimeout(() => {
        // Animate blur reduction and opacity
        const startTime = Date.now();
        const duration = 800; // 800ms for the fade-out animation
        
        const animateOut = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Ease out function
          const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
          const easedProgress = easeOut(progress);
          
          // Reduce blur and opacity
          setBlurAmount(8 * (1 - easedProgress));
          setOpacity(1 - easedProgress);
          
          if (progress < 1) {
            requestAnimationFrame(animateOut);
          } else {
            // Animation complete, call the completion callback
            if (onLoadingComplete && !callbackTriggered) {
              setCallbackTriggered(true);
              onLoadingComplete();
            }
          }
        };
        
        requestAnimationFrame(animateOut);
      }, 1500);
    }
  }, [isReadyToComplete, isCompleting, callbackTriggered, onLoadingComplete]);

  // Format asset name for display
  const formatAssetName = (asset: Asset): string => {
    // Extract filename from URL
    const filename = asset.url.split('/').pop() || asset.url;
    // If the asset has a custom ID that's not the URL, use that
    if (asset.id !== asset.url) {
      return asset.id;
    }
    return filename;
  };

  // Calculate percentage
  const percentLoaded = Math.round(totalProgress * 100);
  const currentStage = LOADING_STAGES[stageIndex];

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-all duration-800 ${className}`}
      style={{
        backdropFilter: `blur(${blurAmount}px)`,
        backgroundColor: `rgba(0, 0, 0, ${0.65 * opacity})`,
        opacity: opacity,
        pointerEvents: opacity > 0 ? 'auto' : 'none'
      }}
    >
      <div className="max-w-lg w-full mx-auto bg-[var(--background)] p-6 rounded-lg shadow-lg border-2 border-[var(--foreground)] text-[var(--foreground)]">
        <div className="text-center mb-6">
          <div className="relative h-16 w-32 mx-auto mb-2">
            <Image 
              src="/world-war-hex-logo.png" 
              alt="World War Hex Logo"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <h2 className="text-2xl font-bold">Loading World War Hex</h2>
        </div>
        
        {/* Current stage indicator */}
        <div className="text-center mb-4 font-semibold animate-pulse">
          {isCompleting ? "Loading Complete!" : currentStage.label}
        </div>
        
        {/* Progress bar */}
        <div className="mb-4 bg-gray-300 rounded-full h-5 overflow-hidden border border-[var(--foreground)]">
          <div 
            className={`h-full transition-all duration-300 ease-out flex items-center justify-end pr-2 text-xs font-bold ${isCompleting ? 'bg-green-500 text-green-700' : 'bg-[var(--accent)]'}`}
            style={{ width: isCompleting ? '100%' : `${percentLoaded}%` }}
          >
            {isCompleting ? 'Done!' : (percentLoaded > 10 && `${percentLoaded}%`)}
          </div>
        </div>
        
        {/* WebGL info */}
        <div className="mb-4 text-center">
          <p className="text-xs opacity-70">
            {webGLInfo}
          </p>
        </div>
        
        {/* Progress stages visualization */}
        <div className="flex justify-between mb-6">
          {LOADING_STAGES.map((stage, index) => (
            <div 
              key={stage.id}
              className={`w-10 h-1 ${isCompleting || index <= stageIndex ? 'bg-[var(--accent)]' : 'bg-gray-300'}`}
            />
          ))}
        </div>
        
        {/* Additional loading message */}
        {isCompleting ? (
          <div className="text-center mb-4 text-sm font-semibold text-green-600 animate-pulse">
            Entering game world...
          </div>
        ) : percentLoaded >= 100 ? (
          <div className="text-center mb-4 text-sm animate-pulse">
            Initializing game world... Please wait.
          </div>
        ) : null}
        
        {/* Recently loaded assets */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Loading:</h3>
          <div className="bg-black bg-opacity-10 rounded-md p-2 h-24 overflow-hidden">
            <ul className="text-sm">
              {isCompleting ? (
                <li className="flex items-center mb-1 animate-fadeIn">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="truncate font-semibold">
                    All assets loaded successfully!
                  </span>
                </li>
              ) : (
                <>
                  {recentlyLoaded.map((asset, index) => (
                    <li 
                      key={asset.id}
                      className="flex items-center mb-1 animate-fadeIn"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      <span className="truncate">
                        {formatAssetName(asset)}
                      </span>
                    </li>
                  ))}
                  {percentLoaded >= 100 && (
                    <li className="flex items-center mb-1 animate-fadeIn">
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                      <span className="truncate">
                        Rendering game world
                      </span>
                    </li>
                  )}
                </>
              )}
            </ul>
          </div>
        </div>
        
        {/* Tips */}
        {showTips && !isCompleting && (
          <div className="bg-[var(--accent-light)] bg-opacity-20 rounded p-3 text-center border border-[var(--accent)] border-opacity-30">
            <p className="italic text-sm transition-opacity duration-300">
              <span className="font-semibold">Tip:</span> {LOADING_TIPS[currentTip]}
            </p>
          </div>
        )}
        
        {/* Ready message */}
        {isCompleting && (
          <div className="bg-green-100 rounded p-3 text-center border border-green-500 border-opacity-50">
            <p className="text-sm text-green-700 font-medium">
              World War Hex is ready to play!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen; 