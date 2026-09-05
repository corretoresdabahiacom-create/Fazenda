import React, { useRef, useState, useCallback } from 'react';
import { Camera, X, Check, Loader2, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onResult: (result: any) => void;
  onClose: () => void;
  type: 'animals' | 'pasture';
  title: string;
}

export default function AIAnalyzer({ onResult, onClose, type, title }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingCameraRef = useRef(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    isStartingCameraRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  };

  const startCamera = async () => {
    if (isStartingCameraRef.current || streamRef.current) return; // stream already starting or active
    isStartingCameraRef.current = true;
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      
      // If we were unmounted/stopped in the meantime, dump it immediately
      if (!isStartingCameraRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Câmera bloqueada. Você pode carregar uma foto manualmente.");
    } finally {
      isStartingCameraRef.current = false;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const analyzePhoto = async () => {
    if (!capturedImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const endpoint = type === 'animals' ? '/api/analyze-animals' : '/api/analyze-pasture';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: capturedImage }),
      });

      if (!response.ok) throw new Error("Falha na análise");

      const result = await response.json();
      onResult(result);
      onClose();
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Erro ao analisar imagem. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    startCamera();
  };

  React.useEffect(() => {
    startCamera();
    return () => {
      isStartingCameraRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black md:bg-black/80 flex items-center justify-center p-0 md:p-4"
    >
      <div className="bg-[#1a1a1a] w-full max-w-2xl md:rounded-3xl overflow-hidden flex flex-col h-full md:h-auto md:max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/10 bg-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors md:hidden"
              title="Voltar"
            >
              <ArrowLeft size={20} />
            </button>
            <h3 className="text-white font-bold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#3d5a45] flex items-center justify-center">
                <Camera size={18} />
              </div>
              {title}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Viewport */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[300px]">
          {!capturedImage ? (
            <>
              {stream ? (
                <video 
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && stream) {
                      if (el.srcObject !== stream) {
                        el.srcObject = stream;
                      }
                    }
                  }} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-white p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                    <Camera size={40} />
                  </div>
                  <div>
                    <h4 className="font-bold">Câmera Indisponível</h4>
                    <p className="text-sm text-white/60">Acesso negado ou dispositivo sem câmera.</p>
                    <p className="text-[10px] text-white/40 mt-1">Dica: Tente abrir o app em uma nova aba se estiver no computador.</p>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 px-6 py-3 bg-white text-[#1a1a1a] rounded-2xl font-bold hover:bg-white/90"
                  >
                    Selecionar Arquivo
                  </button>
                </div>
              )}
              {stream && (
                <div className="absolute inset-0 pointer-events-none border-2 border-white/20 m-8 rounded-2xl flex items-center justify-center">
                  <div className="w-12 h-12 border-t-2 border-l-2 border-white/40 absolute top-0 left-0 rounded-tl-2xl" />
                  <div className="w-12 h-12 border-t-2 border-r-2 border-white/40 absolute top-0 right-0 rounded-tr-2xl" />
                  <div className="w-12 h-12 border-b-2 border-l-2 border-white/40 absolute bottom-0 left-0 rounded-bl-2xl" />
                  <div className="w-12 h-12 border-b-2 border-r-2 border-white/40 absolute bottom-0 right-0 rounded-br-2xl" />
                </div>
              )}
            </>
          ) : (
            <img 
              src={capturedImage} 
              alt="Captura" 
              className="w-full h-full object-cover"
            />
          )}

          {error && (
            <div className="absolute top-4 left-4 right-4 bg-red-500 text-white p-3 rounded-xl flex items-center gap-3 shadow-lg z-10">
              <AlertCircle size={20} />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-4 z-20">
              <Loader2 className="w-12 h-12 text-white animate-spin" />
              <p className="text-white font-bold text-lg animate-pulse">Inteligência Artificial Analisando...</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-8 bg-[#1a1a1a] border-t border-white/10">
          <div className="flex items-center justify-center gap-8">
            {!capturedImage ? (
              <div className="flex items-center gap-8">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
                  title="Carregar da Galeria"
                >
                  <RefreshCw size={24} />
                </button>
                <button 
                  onClick={capturePhoto}
                  disabled={!stream}
                  className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-4 border-white/20 active:scale-95 transition-transform disabled:opacity-50"
                >
                  <div className="w-16 h-16 bg-white border-2 border-[#1a1a1a] rounded-full" />
                </button>
                <div className="w-12" /> {/* Spacer to center the capture button */}
              </div>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <button 
                  onClick={reset}
                  disabled={isAnalyzing}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw size={20} />
                  Tentar Novamente
                </button>
                <button 
                  onClick={analyzePhoto}
                  disabled={isAnalyzing}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#3d5a45] text-white rounded-2xl font-bold hover:bg-[#2d4333] shadow-lg shadow-[#3d5a45]/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Check size={20} />
                  Analisar Foto
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />
    </motion.div>
  );
}
