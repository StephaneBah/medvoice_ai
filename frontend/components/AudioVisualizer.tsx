
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
  isProcessing: boolean;
  /** Real AnalyserNode from AudioContext – when provided, uses live frequency data */
  analyserNode?: AnalyserNode | null;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording, isProcessing, analyserNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prepare a reusable buffer when an AnalyserNode is supplied
    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 0;
    const dataArray = bufferLength ? new Uint8Array(bufferLength) : null;

    let startTime = Date.now();

    const render = () => {
      const { width, height } = canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) / 2;
      const time = (Date.now() - startTime) / 1000;

      ctx.clearRect(0, 0, width, height);

      // Background circles
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (baseRadius / 3.2) * i, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Animated inner pulse
      if (isRecording || isProcessing) {
        // Sample real frequency data if available
        if (analyserNode && dataArray) {
          analyserNode.getByteFrequencyData(dataArray);
        }

        const pulse = Math.sin(time * 3) * (baseRadius * 0.07) + baseRadius * 0.52;
        const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, pulse);
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.2)');
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulse, 0, Math.PI * 2);
        ctx.fill();

        // Moving data points — use real audio data when available
        const points = 60;
        const radius = isProcessing ? baseRadius * 0.48 : baseRadius * 0.62;
        ctx.beginPath();
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2;

          let noise: number;
          if (isRecording && dataArray && dataArray.length > 0) {
            // Map the 60 points across the frequency bins
            const binIndex = Math.floor((i / points) * dataArray.length);
            // Normalize 0-255 to a displacement in pixels (0-20px)
            noise = (dataArray[binIndex] / 255) * 20;
          } else if (isRecording) {
            noise = Math.sin(time * 5 + i * 0.5) * 10;
          } else {
            noise = Math.sin(time * 10 + i * 0.1) * 3;
          }

          const r = radius + noise;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = isProcessing ? 'rgba(34, 211, 238, 0.8)' : 'rgba(6, 182, 212, 1)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Idle state: steady subtle circle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.52, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isRecording, isProcessing, analyserNode]);

  return (
    <div className="relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={220}
        height={220}
        className="relative z-10 w-44 h-44 md:w-52 md:h-52"
      />
      {isRecording && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 md:w-36 md:h-36 rounded-full border border-cyan-500/50 animate-pulse-ring pointer-events-none" />
      )}
    </div>
  );
};

export default AudioVisualizer;
