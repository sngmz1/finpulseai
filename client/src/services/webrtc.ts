// WebRTC & Audio Service for Real-time Peer-to-Peer Voice Mesh
import { SignalOfferPayload, SignalAnswerPayload, SignalIceCandidatePayload } from '../../../shared/types';

export interface WebRTCEvents {
  onRemoteTrack: (peerId: string, stream: MediaStream) => void;
  onPeerDisconnected: (peerId: string) => void;
  onVoiceActivity: (isSpeaking: boolean) => void;
  onError: (error: string) => void;
  onConnectionState: (peerId: string, state: RTCPeerConnectionState) => void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export class WebRTCService {
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private isSpeakingState = false;
  private isMuted = false;
  private events: Partial<WebRTCEvents> = {};
  public localUserId: string = '';

  // Signaling dispatchers provided by parent socket
  public sendOffer?: (data: SignalOfferPayload) => void;
  public sendAnswer?: (data: SignalAnswerPayload) => void;
  public sendIceCandidate?: (data: SignalIceCandidatePayload) => void;

  constructor(events: Partial<WebRTCEvents> = {}, localUserId: string = '') {
    this.events = events;
    this.localUserId = localUserId;
  }

  /**
   * Check if local audio stream is already active and capturing
   */
  public hasLocalStream(): boolean {
    return this.localStream !== null && this.localStream.getAudioTracks().some((t) => t.readyState === 'live');
  }

  /**
   * Request microphone access and setup AudioContext for Voice Activity Detection
   */
  public async initMicrophone(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.hasLocalStream()) {
        this.setMute(false);
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume().catch(() => {});
        }
        return { success: true };
      }

      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return {
          success: false,
          error: `Microphone access is blocked by browsers over unencrypted HTTP (${window.location.host}). Please access via localhost or HTTPS.`,
        };
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { success: false, error: 'Media devices API not available in this browser environment.' };
      }

      let stream: MediaStream | null = null;

      // 1. First attempt: High quality voice with DSP processing
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (firstErr: any) {
        // If advanced constraints failed (e.g. OverconstrainedError or driver constraint incompatibility), try standard audio
        if (firstErr.name !== 'NotAllowedError' && firstErr.name !== 'PermissionDeniedError') {
          console.warn('Advanced audio constraints failed, trying basic fallback:', firstErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
          } catch (secondErr) {
            throw secondErr;
          }
        } else {
          throw firstErr;
        }
      }

      this.localStream = stream;
      
      // Update any existing peer connections with new tracks
      this.peerConnections.forEach((pc) => {
        stream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      });

      this.initVoiceActivityDetection(stream);
      return { success: true };
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      let errorMsg = 'Microphone access is required for voice chat.';
      const msg = (err.message || '').toLowerCase();

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        if (msg.includes('system') || msg.includes('os') || msg.includes('denied by system')) {
          errorMsg = 'Windows Privacy settings blocked the microphone. Open Windows Settings ➔ Privacy & Security ➔ Microphone ➔ Turn ON "Let apps access your microphone" & "Let desktop apps access your microphone".';
        } else {
          errorMsg = 'Microphone permission was denied. Click the lock/tune icon on the left of your URL address bar, set Microphone to "Allow", then click TRY AGAIN.';
        }
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No microphone device found. Please verify that your microphone or headset is connected.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Your microphone is currently in use by another application (such as Zoom, Teams, Discord, or another browser tab). Please close it and click TRY AGAIN.';
      } else if (err.name === 'OverconstrainedError') {
        errorMsg = 'Requested microphone hardware settings are not supported by your audio device.';
      } else if (err.message) {
        errorMsg = `Microphone error: ${err.message}`;
      }

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Setup Web Audio API AnalyserNode for gentle voice amplitude detection
   */
  private initVoiceActivityDetection(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(() => {});
      }

      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      let silenceFrames = 0;

      const checkAudioLevel = () => {
        if (!this.analyser || this.isMuted) {
          if (this.isSpeakingState) {
            this.isSpeakingState = false;
            this.events.onVoiceActivity?.(false);
          }
          this.animFrameId = requestAnimationFrame(checkAudioLevel);
          return;
        }

        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;

        // Threshold for human speech activity (typical speaking range > 18)
        if (average > 18) {
          silenceFrames = 0;
          if (!this.isSpeakingState) {
            this.isSpeakingState = true;
            this.events.onVoiceActivity?.(true);
          }
        } else {
          silenceFrames++;
          // Hold speech indicator for a few frames to prevent jarring on/off flicker
          if (silenceFrames > 12 && this.isSpeakingState) {
            this.isSpeakingState = false;
            this.events.onVoiceActivity?.(false);
          }
        }

        this.animFrameId = requestAnimationFrame(checkAudioLevel);
      };

      this.animFrameId = requestAnimationFrame(checkAudioLevel);
    } catch (err) {
      console.warn('Could not initialize Web Audio Analyser:', err);
    }
  }

  /**
   * Get or create RTCPeerConnection for a remote peer
   */
  public getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(peerId);
    if (pc && pc.signalingState !== 'closed') {
      return pc;
    }

    pc = new RTCPeerConnection({
      iceServers: DEFAULT_ICE_SERVERS,
      iceCandidatePoolSize: 2,
    });

    // Add local audio tracks if microphone is active
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc!.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.sendIceCandidate) {
        this.sendIceCandidate({
          fromUserId: this.localUserId,
          toUserId: peerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.events.onRemoteTrack?.(peerId, event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      this.events.onConnectionState?.(peerId, pc!.connectionState);
      if (pc!.connectionState === 'disconnected' || pc!.connectionState === 'failed') {
        this.events.onPeerDisconnected?.(peerId);
      }
    };

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  /**
   * Helper to drain any queued ICE candidates once remote description is set
   */
  private async drainIceCandidates(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const candidates = this.pendingCandidates.get(peerId);
    if (candidates && candidates.length > 0) {
      for (const cand of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('Error applying queued ICE candidate:', e);
        }
      }
      this.pendingCandidates.delete(peerId);
    }
  }

  /**
   * Connect with a peer by creating an offer
   */
  public async callPeer(peerId: string): Promise<void> {
    try {
      const pc = this.getOrCreatePeerConnection(peerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      if (pc.signalingState !== 'stable') {
        return;
      }

      await pc.setLocalDescription(offer);

      if (this.sendOffer) {
        this.sendOffer({
          fromUserId: this.localUserId,
          toUserId: peerId,
          offer,
        });
      }
    } catch (err) {
      console.warn(`callPeer failed for ${peerId}:`, err);
    }
  }

  /**
   * Handle incoming WebRTC Offer with polite peer negotiation
   */
  public async handleOffer(fromPeerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      const pc = this.getOrCreatePeerConnection(fromPeerId);
      // Polite peer: the one whose ID is lexicographically smaller yields
      const isPolite = this.localUserId ? this.localUserId < fromPeerId : true;
      const offerCollision = pc.signalingState !== 'stable';

      if (offerCollision && !isPolite) {
        console.log(`[WebRTC] Glare detected. Impolite peer ignoring offer from ${fromPeerId}`);
        return;
      }

      if (offerCollision && isPolite) {
        console.log(`[WebRTC] Glare detected. Polite peer rolling back for ${fromPeerId}`);
        await pc.setLocalDescription({ type: 'rollback' });
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await this.drainIceCandidates(fromPeerId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.sendAnswer) {
        this.sendAnswer({
          fromUserId: this.localUserId,
          toUserId: fromPeerId,
          answer,
        });
      }
    } catch (err) {
      console.warn(`handleOffer error from ${fromPeerId}:`, err);
    }
  }

  /**
   * Handle incoming WebRTC Answer
   */
  public async handleAnswer(fromPeerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      const pc = this.peerConnections.get(fromPeerId);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await this.drainIceCandidates(fromPeerId, pc);
      }
    } catch (err) {
      console.warn(`handleAnswer error from ${fromPeerId}:`, err);
    }
  }

  /**
   * Handle incoming ICE Candidate
   */
  public async handleIceCandidate(fromPeerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(fromPeerId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Error adding ICE candidate:', err);
      }
    } else {
      if (!this.pendingCandidates.has(fromPeerId)) {
        this.pendingCandidates.set(fromPeerId, []);
      }
      this.pendingCandidates.get(fromPeerId)!.push(candidate);
    }
  }

  /**
   * Toggle local microphone mute
   */
  public setMute(muted: boolean): boolean {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (muted && this.isSpeakingState) {
      this.isSpeakingState = false;
      this.events.onVoiceActivity?.(false);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Output sink routing (speaker / headset) if supported by browser
   */
  public async setAudioOutputDevice(audioElement: HTMLAudioElement, deviceId: string): Promise<boolean> {
    if ('setSinkId' in audioElement) {
      try {
        await (audioElement as any).setSinkId(deviceId);
        return true;
      } catch (err) {
        console.warn('Failed to set audio sink ID:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Clean up all active peer connections, media tracks, and AudioContext
   */
  public close(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    this.peerConnections.clear();
    this.pendingCandidates.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.isSpeakingState = false;
  }
}

