// File: src/app/simple/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { createRealtimeConnection } from "@/app/lib/realtimeConnection";
import marleneConfig from "@/app/agentConfigs/marlene";
import Image from "next/image";

interface CameraRequest { id: string; left: number; }
interface UIEvent { name: string; icon: string; color: string; }

export default function SimplePage() {
  const [connected, setConnected] = useState(false);
  const [uiEvents, setUiEvents] = useState<UIEvent[]>([]);
  const [cameraRequests, setCameraRequests] = useState<CameraRequest[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [agentIsSpeaking, setAgentIsSpeaking] = useState(false);
  const [speechIntensity, setSpeechIntensity] = useState(0);
  const [verificationActive, setVerificationActive] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0);
  const [messagesDisabled, setMessagesDisabled] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const intensityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    startConnection();
    
    // Atualizar o relógio a cada segundo
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    
    updateClock(); // Inicializar imediatamente
    const clockInterval = setInterval(updateClock, 60000); // Atualizar a cada minuto
    
    return () => { 
      stopConnection(); 
      closeCamera(); 
      clearInterval(clockInterval);
      
      if (intensityTimerRef.current) {
        clearInterval(intensityTimerRef.current);
      }
      
      if (verificationTimerRef.current) {
        clearTimeout(verificationTimerRef.current);
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Função para configurar análise de áudio
  const setupAudioAnalysis = () => {
    if (!audioRef.current || !audioRef.current.srcObject) return;
    
    try {
      // Criar contexto de áudio apenas se ainda não existir
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      
      // Criar source do áudio
      const stream = audioRef.current.srcObject as MediaStream;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Criar analisador
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Configurar timer para atualizar intensidade
      if (intensityTimerRef.current) {
        clearInterval(intensityTimerRef.current);
      }
      
      intensityTimerRef.current = setInterval(() => {
        if (!analyserRef.current || !agentIsSpeaking) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calcular média de intensidade (0-255)
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        
        // Normalizar para 0-100
        const intensity = Math.min(100, Math.max(0, average / 2.55));
        setSpeechIntensity(intensity);
      }, 100);
    } catch (error) {
      console.error("Erro ao configurar análise de áudio:", error);
    }
  };

  // Função segura para enviar mensagens pelo DataChannel
  const safelySendMessage = (message: any): boolean => {
    try {
      if (dcRef.current && dcRef.current.readyState === "open") {
        dcRef.current.send(JSON.stringify(message));
        return true;
      } else {
        console.warn("DataChannel não está aberto, mas continuando o fluxo");
        return false;
      }
    } catch (err) {
      console.warn("Erro ao enviar mensagem:", err);
      return false;
    }
  };

  // Função atualizada para simular o processo de verificação natural
  const startVerificationSequence = () => {
    if (verificationActive) return; // Evita iniciar mais de uma vez
    
    setVerificationActive(true);
    setVerificationStep(1);
    // Desabilita mensagens de texto durante a verificação
    setMessagesDisabled(true);
    
    // Limpa qualquer timer existente
    if (verificationTimerRef.current) {
      clearTimeout(verificationTimerRef.current);
    }
    
    // Determina se é possível enviar mensagens
    const canSendMessages = dcRef.current && dcRef.current.readyState === "open";
    if (!canSendMessages) {
      console.warn("Não é possível iniciar a sequência: DataChannel não está aberto");
      setVerificationActive(false);
      setMessagesDisabled(false);
      return;
    }
    
    // Passo 1: Marlene fala naturalmente (sem texto)
    verificationTimerRef.current = setTimeout(() => {
      setVerificationStep(2);
      
      // Solicita uma resposta do agente, sem mostrar texto
      try {
        safelySendMessage({ 
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "[VERIFICAÇÃO INICIADA]" }],
          },
        });
        
        safelySendMessage({ type: "response.create" });
      } catch (err) {
        console.warn("Erro ao solicitar resposta durante verificação:", err);
      }
      
      // Passo 2: Segunda etapa da verificação (3 segundos depois)
      verificationTimerRef.current = setTimeout(() => {
        setVerificationStep(3);
        
        // Passo 3: Verificação concluída (4 segundos depois)
        verificationTimerRef.current = setTimeout(() => {
          setVerificationStep(4);
          
          // Passo 4: Fechamento da câmera (1 segundo depois)
          verificationTimerRef.current = setTimeout(() => {
            try {
              // Envia a chamada de função close_camera
              safelySendMessage({
                type: "conversation.item.create",
                item: {
                  id: uuidv4(),
                  type: "function_call",
                  function: {
                    name: "close_camera",
                    arguments: "{}",
                  },
                },
              });
              
              // Fecha a câmera na UI independente da resposta
              closeCamera();
              
            } catch (error) {
              console.warn("Erro ao fechar câmera, mas continuando fluxo:", error);
              closeCamera(); // Garante que a câmera seja fechada mesmo com erro
            }
            
            // Passo 5: Continuação do fluxo (1 segundo depois)
            verificationTimerRef.current = setTimeout(() => {
              try {
                // Solicita uma resposta do agente para continuar o fluxo
                safelySendMessage({ 
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: "[VERIFICAÇÃO CONCLUÍDA]" }],
                  },
                });
                
                safelySendMessage({ type: "response.create" });
                
                // Finaliza o ciclo de verificação
                setVerificationActive(false);
                setVerificationStep(0);
                // Reabilita mensagens de texto
                setMessagesDisabled(false);
                
              } catch (err) {
                console.warn("Erro na etapa final, mas verificação foi concluída:", err);
                setVerificationActive(false);
                setVerificationStep(0);
                setMessagesDisabled(false);
              }
            }, 1000);
            
          }, 1000);
        }, 4000);
      }, 3000);
    }, 2000);
  };

  // Quando receber o stream, anexa ao <video>
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.autoplay = true;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(console.error);
        
        // Inicia automaticamente a sequência de verificação depois de garantir que o vídeo está reproduzindo
        setTimeout(() => {
          startVerificationSequence();
        }, 1000);
      };
    }
  }, [cameraStream]);

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
    } catch (err) {
      console.error("openCamera erro:", err);
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  }

  function triggerIcon(evt: UIEvent) {
    setUiEvents(u => [...u, evt]);
    setTimeout(() => setUiEvents(u => u.slice(1)), 3000);
  }

  // Função melhorada para lidar com desconexões inesperadas
  const handleUnexpectedDisconnection = () => {
    // Se estiver em verificação, conclui o fluxo local
    if (verificationActive) {
      console.warn("Conexão interrompida durante verificação. Finalizando localmente.");
      closeCamera();
      setVerificationActive(false);
      setVerificationStep(0);
      setMessagesDisabled(false);
    } else {
      setConnected(false);
      setAgentIsSpeaking(false);
    }
  };

  async function startConnection() {
    if (connected) return;

    if (!audioRef.current) {
      const a = document.createElement("audio");
      a.autoplay = true;
      audioRef.current = a;
    }
    
    try {
      const { pc, dc } = await createRealtimeConnection(
        process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
        audioRef
      );
      
      pcRef.current = pc;
      dcRef.current = dc;

      // Configurar áudio e análise quando a conexão for estabelecida
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
          setupAudioAnalysis();
        }
      };

      // Adicionar tratamento de erros mais robusto
      pc.onerror = (err) => {
        console.warn("PeerConnection erro - tratando graciosamente:", err);
        // Só altera o estado se não estiver em verificação
        if (!verificationActive) {
          setConnected(false);
          setAgentIsSpeaking(false);
        }
      };
      
      pc.oniceconnectionstatechange = () => {
        console.log("ICE state change:", pc.iceConnectionState);
        if (pc.iceConnectionState === "disconnected" || 
            pc.iceConnectionState === "failed" ||
            pc.iceConnectionState === "closed") {
          handleUnexpectedDisconnection();
        }
      };

      dc.onopen = () => {
        console.log("DataChannel aberto");
        setConnected(true);
        
        // Envia a configuração da sessão
        safelySendMessage({
          type: "session.update",
          session: {
            modalities: ["audio", "text"],
            instructions: marleneConfig[0].instructions,
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200,
              create_response: true,
            },
            tools: marleneConfig[0].tools,
          },
        });
        
        // Inicia a conversa
        safelySendMessage({ type: "response.create" });
      };

      dc.onmessage = e => {
        let msg: any;
        try {
          msg = JSON.parse(e.data);
        } catch (err) {
          console.error("Falha ao parsear mensagem RTC:", e.data);
          return;
        }

        // Salva o sessionId se recebido
        if (msg.type === "session.created" && msg.session?.id) {
          sessionIdRef.current = msg.session.id;
        }

        // Detectar quando o agente começa e termina de falar
        if (msg.type === "audio_started") {
          setAgentIsSpeaking(true);
        } else if (msg.type === "audio_ended") {
          setAgentIsSpeaking(false);
          setSpeechIntensity(0);
        }

        if (msg.type === "response.done" && Array.isArray(msg.response?.output)) {
          msg.response.output.forEach((it: any) => {
            // solicita o balãozinho de câmera
            if (it.type === "function_call" && it.name === "open_camera") {
              setCameraRequests(c => [...c, { id: uuidv4(), left: 50 }]);
            }

            // ícone de UI
            if (it.type === "function_call" && it.name === "ui_event") {
              let args: UIEvent | null = null;
              try {
                args = JSON.parse(it.arguments);
              } catch (err) {
                console.error("Falha ao parsear ui_event args:", it.arguments, err);
              }
              if (args) triggerIcon(args);
            }

            // fechamento manual da câmera (caso não esteja em verificação)
            if (it.type === "function_call" && it.name === "close_camera" && !verificationActive) {
              closeCamera();
            }
          });
        }
      };

      dc.onerror = (ev) => {
        console.warn("DataChannel erro - tratando graciosamente:", ev);
        // Não interrompe o fluxo de verificação se estiver ativo
        if (!verificationActive) {
          setConnected(false);
          setAgentIsSpeaking(false);
        }
      };
      
      dc.onclose = () => {
        console.log("DataChannel fechado");
        handleUnexpectedDisconnection();
      };

    } catch (err) {
      console.error("startConnection falhou:", err);
      setConnected(false);
      setAgentIsSpeaking(false);
    }
  }

  function stopConnection() {
    // Limpar todos os timers
    if (verificationTimerRef.current) {
      clearTimeout(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }
    
    if (intensityTimerRef.current) {
      clearInterval(intensityTimerRef.current);
      intensityTimerRef.current = null;
    }
    
    // Cancelar qualquer verificação em andamento
    setVerificationActive(false);
    setVerificationStep(0);
    setMessagesDisabled(false);
    
    // Fechar a câmera
    closeCamera();
    
    // Fechar a conexão
    const dc = dcRef.current, pc = pcRef.current;
    if (dc?.readyState === "open") {
      try { 
        dc.send(JSON.stringify({ type: "stop" })); 
      } catch (err) {
        console.warn("Erro ao enviar mensagem de parada:", err);
      }
    }
    
    if (dc) {
      try {
        dc.close();
      } catch (err) {
        console.warn("Erro ao fechar DataChannel:", err);
      }
    }
    
    if (pc) {
      try {
        pc.close();
      } catch (err) {
        console.warn("Erro ao fechar PeerConnection:", err);
      }
    }
    
    // Limpar contexto de áudio
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (err) {
        console.warn("Erro ao fechar AudioContext:", err);
      }
    }
    
    setConnected(false);
    setAgentIsSpeaking(false);
    sessionIdRef.current = null;
  }

  // Calcular a cor do gradiente com base na intensidade
  const getGradientColor = () => {
    // Base: #EC7000 (laranja Itaú)
    // Quanto maior a intensidade, mais "quente" fica o gradiente
    const baseHue = 27; // laranja
    const saturation = 100;
    const lightness = Math.max(30, 50 - speechIntensity / 5); // 50 para baixa intensidade, 30 para alta
    
    return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
  };

  return (
    <div className="stage">
      <div className="blur-backdrop"></div>
      <div className="phone-mockup">
        <div className="button-vol-up" />
        <div className="button-vol-down" />
        <div className="button-power" />
        <div className="camera-hole" />
        <div className="notch" />
        <div className="screen">
          {/* Barra de status do telefone */}
          <div className="status-bar">
            <div className="status-bar-time">{currentTime}</div>
            <div className="status-bar-icons">
              {/* Ícone de sinal de celular */}
              <svg className="status-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 16h2v4H4v-4zm4-4h2v8H8v-8zm4-4h2v12h-2V8zm4-4h2v16h-2V4z" strokeWidth="2"/>
              </svg>
              {/* Ícone de WiFi */}
              <svg className="status-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 6c5.52 0 10 4.48 10 10H2c0-5.52 4.48-10 10-10z" strokeWidth="1.5"/>
                <path d="M12 11c2.76 0 5 2.24 5 5H7c0-2.76 2.24-5 5-5z" strokeWidth="1.5"/>
                <circle cx="12" cy="18" r="1" strokeWidth="1.5"/>
              </svg>
              {/* Ícone de bateria */}
              <svg className="status-icon" width="24" height="18" viewBox="0 0 24 12" fill="none" stroke="currentColor">
                <rect x="2" y="2" width="18" height="8" rx="1" strokeWidth="1.5"/>
                <path d="M22 5v2" strokeWidth="2" strokeLinecap="round"/>
                <rect x="4" y="4" width="13" height="4" fill="currentColor"/>
              </svg>
            </div>
          </div>

          {/* Browser navbar */}
          <div className="browser-navbar">
            <div className="browser-navbar-left">
              <button className="browser-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="browser-navbar-center">
              <div className="browser-urlbar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="browser-lock-icon">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2"/>
                </svg>
                <span className="browser-url">formalizacao.com.br</span>
              </div>
            </div>
            <div className="browser-navbar-right">
              <button className="browser-btn">
                <div className="browser-tab">1</div>
              </button>
              <button className="browser-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="1" strokeWidth="3"/>
                  <circle cx="12" cy="5" r="1" strokeWidth="3"/>
                  <circle cx="12" cy="19" r="1" strokeWidth="3"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Logo do Itaú */}
          <div className="itau-logo">
            <Image 
              src="/images/brand.svg" 
              alt="Itaú Logo" 
              width={0}
              height={0}
              style={{ width: 'auto', height: 'auto', maxHeight: '40px' }}
              priority
            />
          </div>
          
          {/* Header com título e nome */}
          <div className="header-content">
            <h1 className="page-title">Crédito Consignado</h1>
            <p className="user-name">Maria Justina Linhares</p>
          </div>

          {/* Indicador de verificação */}
          {verificationActive && (
            <div className="verification-indicator">
              <div className="verification-step-text">
                {verificationStep === 1 && "Aguardando análise..."}
                {verificationStep === 2 && "Analisando documento..."}
                {verificationStep === 3 && "Verificando identidade..."}
                {verificationStep === 4 && "Verificação concluída!"}
              </div>
              <div className="verification-progress">
                <div 
                  className="verification-bar" 
                  style={{ 
                    width: `${(verificationStep / 4) * 100}%`,
                    backgroundColor: verificationStep === 4 ? '#2cb67d' : '#ff8548'
                  }}
                ></div>
              </div>
            </div>
          )}

          {/* ícones de evento */}
          {uiEvents.map((evt, i) => (
            <div key={i} className="ui-event-icon" style={{ color: evt.color }}>
              {evt.icon}
            </div>
          ))}

          {/* balaozinho de câmera */}
          {cameraRequests.map(req => (
            <div
              key={req.id}
              className="camera-request-bubble"
              style={{ left: `${req.left}%` }}
              onClick={() => {
                openCamera();
                setCameraRequests(c => c.filter(x => x.id !== req.id));
              }}
            >
              📷
            </div>
          ))}

          {/* preview da câmera */}
          {cameraStream && (
            <div className="camera-bubble">
              <video ref={videoRef} className="camera-video" />
              <button className="camera-close" onClick={() => {
                // Cancela a verificação se estiver em andamento
                if (verificationActive) {
                  if (verificationTimerRef.current) {
                    clearTimeout(verificationTimerRef.current);
                  }
                  setVerificationActive(false);
                  setVerificationStep(0);
                  setMessagesDisabled(false);
                }
                closeCamera();
              }}>×</button>
            </div>
          )}

          {/* botão PTT */}
          <button
            className={`ptt-button ${connected ? "speaking" : "paused"}`}
            onClick={() => connected ? stopConnection() : startConnection()}
          />
          
          {/* Footer com gradiente animado */}
          <div className={`animated-footer ${agentIsSpeaking ? "speaking" : ""}`}></div>
          <audio ref={audioRef} autoPlay hidden />
        </div>
      </div>

      <style jsx>{`
        /* Estilos gerais */
        .stage {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          overflow: hidden;
          background-color: #f0f0f0;
          position: relative;
        }
        
        .blur-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at center, rgba(252, 98, 0, 0.1) 0%, rgba(252, 98, 0, 0) 70%);
          filter: blur(100px);
          z-index: 0;
        }

        /* Indicador de verificação */
        .verification-indicator {
          position: absolute;
          top: 200px;
          left: 50%;
          transform: translateX(-50%);
          width: 80%;
          text-align: center;
          z-index: 20;
          background-color: rgba(255, 255, 255, 0.9);
          padding: 12px;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .verification-step-text {
          font-size: 14px;
          margin-bottom: 8px;
          color: #333;
          font-weight: 500;
        }

        .verification-progress {
          width: 100%;
          height: 6px;
          background-color: #e0e0e0;
          border-radius: 3px;
          overflow: hidden;
        }

        .verification-bar {
          height: 100%;
          background-color: #ff8548;
          transition: width 0.5s ease;
        }

        /* Logo do Itaú */
        .itau-logo {
          position: absolute;
          top: 120px;
          left: 25px;
          z-index: 10;
        }
        
        /* Header content */
        .header-content {
          position: absolute;
          top: 120px;
          right: 25px;
          text-align: right;
          z-index: 10;
        }
        
        .page-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          color: #333;
        }
        
        .user-name {
          font-size: 16px;
          font-weight: normal;
          margin: 4px 0 0;
          color: #666;
        }
        
        /* Completely seamless footer gradient */
        .animated-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 200px; /* Even taller for more gradient space */
          background: transparent;
          z-index: 5;
          overflow: hidden;
        }

        /* Create the gradient as a pseudo-element */
        .animated-footer::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 200px;
          /* Smoother horizontal gradient */
          background: linear-gradient(
            to right,
            #FC6200 0%,
            rgba(252, 98, 0, 0.7) 20%,
            rgba(252, 98, 0, 0.5) 40%,
            rgba(252, 98, 0, 0.3) 60%,
            rgba(252, 98, 0, 0.1) 80%,
            rgba(255, 255, 255, 0.9) 100%
          );
          /* Create ultra-smooth vertical fade */
          mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(0, 0, 0, 0.0005) 5%,
            rgba(0, 0, 0, 0.001) 10%,
            rgba(0, 0, 0, 0.002) 15%,
            rgba(0, 0, 0, 0.005) 20%,
            rgba(0, 0, 0, 0.01) 25%,
            rgba(0, 0, 0, 0.02) 30%,
            rgba(0, 0, 0, 0.03) 35%,
            rgba(0, 0, 0, 0.05) 40%,
            rgba(0, 0, 0, 0.08) 45%,
            rgba(0, 0, 0, 0.12) 50%,
            rgba(0, 0, 0, 0.18) 55%,
            rgba(0, 0, 0, 0.25) 60%,
            rgba(0, 0, 0, 0.35) 65%,
            rgba(0, 0, 0, 0.45) 70%,
            rgba(0, 0, 0, 0.6) 75%,
            rgba(0, 0, 0, 0.75) 80%,
            rgba(0, 0, 0, 0.9) 90%,
            rgba(0, 0, 0, 1) 100%
          );
          -webkit-mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(0, 0, 0, 0.0005) 5%,
            rgba(0, 0, 0, 0.001) 10%,
            rgba(0, 0, 0, 0.002) 15%,
            rgba(0, 0, 0, 0.005) 20%,
            rgba(0, 0, 0, 0.01) 25%,
            rgba(0, 0, 0, 0.02) 30%,
            rgba(0, 0, 0, 0.03) 35%,
            rgba(0, 0, 0, 0.05) 40%,
            rgba(0, 0, 0, 0.08) 45%,
            rgba(0, 0, 0, 0.12) 50%,
            rgba(0, 0, 0, 0.18) 55%,
            rgba(0, 0, 0, 0.25) 60%,
            rgba(0, 0, 0, 0.35) 65%,
            rgba(0, 0, 0, 0.45) 70%,
            rgba(0, 0, 0, 0.6) 75%,
            rgba(0, 0, 0, 0.75) 80%,
            rgba(0, 0, 0, 0.9) 90%,
            rgba(0, 0, 0, 1) 100%
          );
          border-top-left-radius: 30px;
          border-top-right-radius: 30px;
          z-index: 1;
        }

        .animated-footer.speaking::after {
          animation: wave-gradient 5s ease infinite;
          background-size: 200% 100%;
        }

        /* Subtle glow effect when speaking */
        .animated-footer.speaking::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100px;
          background: radial-gradient(
            ellipse at center bottom, 
            rgba(252, 98, 0, 0.15) 0%, 
            rgba(252, 98, 0, 0) 70%
          );
          z-index: 0;
          opacity: 0;
          animation: glow-pulse 2s infinite alternate;
        }

        @keyframes wave-gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%; 
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes glow-pulse {
          0% {
            opacity: 0.2;
          }
          100% {
            opacity: 0.5;
          }
        }
        
        @keyframes pulse-gradient {
          0% {
            opacity: 0.85;
            height: 80px;
          }
          100% {
            opacity: 1;
            height: calc(80px + var(--speech-intensity, 0) * 0.5px);
          }
        }
        
        /* mockup chapado */
        .phone-mockup {
          position: relative;
          width: 360px;
          height: 780px;
          border-radius: 48px;
          background: #FFF;
          box-shadow:
            0 20px 30px rgba(0,0,0,0.25),
            inset 0 0 0 2px rgba(255,255,255,0.05);
          z-index: 1;
        }

        /* side buttons */
        .button-vol-up,
        .button-vol-down,
        .button-power {
          position: absolute;
          width: 4px;
          background: #e7e7e7;
          border-radius: 2px;
        }
        .button-vol-up { left: -4px; top: 140px; height: 40px; }
        .button-vol-down { left: -4px; top: 200px; height: 40px; }
        .button-power { right: -4px; top: 180px; height: 80px; }

        /* top camera hole */
        .camera-hole {
          position: absolute;
          top: 16px;
          left: calc(50% - 6px);
          width: 12px;
          height: 12px;
          background: #000;
          border: 2px solid #222;
          border-radius: 50%;
          box-shadow: inset 0 0 2px rgba(255,255,255,0.2);
        }

        /* notch */
        .notch {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 140px;
          height: 30px;
          background: #e7e7e7;
          border-bottom-left-radius: 16px;
          border-bottom-right-radius: 16px;
        }

        /* screen */
        .screen {
          position: absolute;
          top: 45px;
          left: 8px;
          width: calc(100% - 19px);
          height: calc(100% - 66px);
          background: rgb(249, 247, 245);
          border-radius: 10px 10px 32px 32px;
          overflow: hidden;
          box-shadow: 
            inset 0 0 40px rgba(0,0,0,0.05),
            inset 0 0 2px rgba(0,0,0,0.1);
          position: relative;
        }
        
        /* Adiciona uma textura sutil de ruído */
        .screen::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url("data:image/png;base64,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");
          opacity: 0.02;
          z-index: 2;
          pointer-events: none;
        }
        
        /* Adiciona reflexo e gradiente de vidro */
        .screen::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0) 50%),
            linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 30%, rgba(0,0,0,0.05) 100%);
          z-index: 3;
          pointer-events: none;
          border-radius: 10px 10px 32px 32px;
        }

        /* Status bar do telefone */
        .status-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 36px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 20px;
          color: #333;
          background: rgba(245, 245, 245, 0.8);
          z-index: 10;
          font-family: 'MinhaFonte', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
        }
        
        .status-bar-time {
          font-weight: 600;
          font-size: 15px;
          color: #222;
        }
        
        .status-bar-icons {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .status-icon {
          height: 14px;
          width: auto;
          color: #222;
          opacity: 0.85;
        }

        /* Browser navbar */
        .browser-navbar {
          position: relative;
          width: 100%;
          height: 44px;
          background-color: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 8px;
          border-bottom: 1px solid rgba(0,0,0,0.1);
          z-index: 10;
          margin-top: 40px;
        }

        .browser-navbar-left, .browser-navbar-right {
          display: flex;
          align-items: center;
        }

        .browser-navbar-center {
          flex: 1;
          display: flex;
          justify-content: center;
        }

        .browser-urlbar {
          background-color: #e9e9e9;
          height: 32px;
          width: 90%;
          border-radius: 16px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          color: #333;
          font-size: 14px;
          font-weight: 500;
        }

        .browser-lock-icon {
          margin-right: 8px;
          opacity: 0.7;
        }

        .browser-url {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .browser-btn {
          background: none;
          border: none;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
          border-radius: 50%;
        }

        .browser-btn:active {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .browser-tab {
          width: 24px;
          height: 24px;
          border: 1.5px solid #333;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        /* UI icon */
        .ui-event-icon {
          position: absolute;
          top: 90px; /* Ajustado para ficar abaixo do logo */
          right: 16px;
          font-size: 2rem;
          animation: pop .4s ease-out;
          z-index: 11;
        }
        @keyframes pop {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }

        /* camera request bubble */
        .camera-request-bubble {
          position: absolute;
          bottom: -90px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 80px;
          background: #fff;
          border-radius: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          cursor: pointer;
          z-index: 11;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          animation: rise 1.5s ease-out forwards;
        }
        @keyframes rise {
          from { transform: translate(-50%, 0); }
          to   { transform: translate(-50%, -200px); }
        }

        /* camera preview */
        .camera-bubble {
          position: absolute;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          width: 160px;
          height: 140px;
          border-radius: 16px;
          overflow: hidden;
          z-index: 12;
          box-shadow: 0 8px 16px rgba(0,0,0,0.3);
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
          0%,100% { transform: translate(-50%, 0); }
          50%     { transform: translate(-50%, -8px); }
        }
        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .camera-close {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0,0,0,0.4);
          color: #fff;
          border: none;
          border-radius: 12px;
          width: 24px;
          height: 24px;
          z-index: 13;
          cursor: pointer;
        }

        .ptt-button {
          position: absolute;
          bottom: 60px;
          right: 30px;
          width: 70px;
          height: 70px;
          border: none;
          border-radius: 35px;
          background: linear-gradient(45deg, #ff9d55, #ff8548);
          box-shadow: 
            0 4px 12px rgba(255, 133, 0, 0.3),
            0 2px 4px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          z-index: 11;
        }
        
        .ptt-button.speaking {
          animation: pulse 2s infinite;
        }
        
        .ptt-button.paused {
          opacity: 0.7;
          background: linear-gradient(45deg, #ff9d55, #ff8548);
          animation: none;
        }
        
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 133, 0, 0.5);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(255, 133, 0, 0);
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 133, 0, 0);
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}