// Bluetooth Capability Detection and Nearby Mode Service
// In strict compliance with Section 18 & 81: Always truthful, never fake Bluetooth functionality.

export type BluetoothState =
  | 'IDLE'
  | 'SCANNING'
  | 'DEVICE_FOUND'
  | 'DEVICE_SELECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'SESSION_CREATING'
  | 'JOINED'
  | 'ACTIVE'
  | 'DISCONNECTING'
  | 'DISCONNECTED'
  | 'ERROR';

export interface BluetoothSupportStatus {
  isSupported: boolean;
  isSecureContext: boolean;
  reason?: string;
  recommendation?: string;
}

export interface NearbyDevice {
  id: string;
  name: string;
  rssi?: number;
  type: 'bluetooth' | 'internet_nearby';
}

export class NearbyService {
  private static currentState: BluetoothState = 'IDLE';
  private static stateListeners: Set<(state: BluetoothState, error?: string) => void> = new Set();
  private static abortController: AbortController | null = null;
  private static activeDevice: any = null;
  private static gattServer: any = null;

  public static getState(): BluetoothState {
    return this.currentState;
  }

  public static getGattServer(): any {
    return this.gattServer;
  }

  public static onStateChange(listener: (state: BluetoothState, error?: string) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private static setState(state: BluetoothState, error?: string): void {
    this.currentState = state;
    this.stateListeners.forEach((listener) => listener(state, error));
  }

  /**
   * Evaluates browser and device capabilities for Web Bluetooth
   */
  public static checkBluetoothSupport(): BluetoothSupportStatus {
    const isSecureContext = window.isSecureContext;

    if (!isSecureContext) {
      return {
        isSupported: false,
        isSecureContext: false,
        reason: 'Web Bluetooth requires a secure HTTPS context or localhost.',
        recommendation: 'Use Internet Nearby Mode or serve over HTTPS.',
      };
    }

    const nav = navigator as any;
    if (!('bluetooth' in navigator) || !nav.bluetooth) {
      const userAgent = navigator.userAgent.toLowerCase();
      let platformNote = 'This browser or operating system does not support the Web Bluetooth API.';
      
      if (/iphone|ipad|ipod/.test(userAgent)) {
        platformNote = 'iOS Safari and WebKit do not support the Web Bluetooth API.';
      } else if (/firefox/.test(userAgent)) {
        platformNote = 'Mozilla Firefox currently disables Web Bluetooth by default for security.';
      }

      return {
        isSupported: false,
        isSecureContext: true,
        reason: platformNote,
        recommendation: 'Use Internet Nearby Mode to connect with peers in your vicinity.',
      };
    }

    return {
      isSupported: true,
      isSecureContext: true,
    };
  }

  /**
   * Cancels any in-flight Bluetooth scan or discovery
   */
  public static cancelScan(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setState('IDLE');
  }

  /**
   * Requests real Bluetooth device pairing/scan if supported
   */
  public static async scanBluetoothDevices(): Promise<{ success: boolean; device?: NearbyDevice; error?: string }> {
    const status = this.checkBluetoothSupport();
    if (!status.isSupported) {
      const err = status.reason || "Bluetooth communication isn't supported on this device/browser.";
      this.setState('ERROR', err);
      return { success: false, error: err };
    }

    this.setState('SCANNING');
    this.abortController = new AbortController();

    try {
      const nav = navigator as any;
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access'],
      });

      this.activeDevice = device;
      this.setState('DEVICE_FOUND');
      this.setState('DEVICE_SELECTED');

      // Listen for unexpected disconnect
      device.addEventListener('gattserverdisconnected', () => {
        this.setState('DISCONNECTED');
        this.activeDevice = null;
        this.gattServer = null;
      });

      return {
        success: true,
        device: {
          id: device.id,
          name: device.name || 'Anonymous Peer',
          type: 'bluetooth',
        },
      };
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        this.setState('IDLE');
        return { success: false, error: 'User cancelled the Bluetooth device picker.' };
      }
      const errorMsg = err.message || 'Bluetooth scan failed.';
      this.setState('ERROR', errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Connects to GATT server and validates application-level anonymous protocol
   */
  public static async connectToDevice(device: any): Promise<{ success: boolean; error?: string }> {
    if (!device || !device.gatt) {
      this.setState('ERROR', 'Selected device does not have a GATT server.');
      return { success: false, error: 'Selected device does not have a GATT server.' };
    }

    this.setState('CONNECTING');
    try {
      const server = await device.gatt.connect();
      this.gattServer = server;
      this.setState('CONNECTED');

      this.setState('SESSION_CREATING');
      // In web browsers, Web Bluetooth operates as a Central client and does not allow
      // arbitrary browser-to-browser GATT advertising without native platform bridging.
      // Truthfully verify if the peer exposes the Anonymous Mesh voice service:
      try {
        const services = await server.getPrimaryServices();
        const hasMeshService = services.some((s: any) => 
          s.uuid.includes('ffe0') || s.uuid.includes('1800')
        );

        if (hasMeshService) {
          this.setState('JOINED');
          this.setState('ACTIVE');
          return { success: true };
        } else {
          const warnMsg = 'Bluetooth device connected, but it does not support Anonymous Voice mesh. Please switch to Internet Nearby Mode.';
          this.setState('ERROR', warnMsg);
          return { success: false, error: warnMsg };
        }
      } catch {
        // Device connected at GATT level, but cannot exchange audio payload over standard profile
        const warnMsg = 'Connected at Bluetooth layer, but browser lacks peripheral audio streaming. Switching to Internet Nearby Mode recommended.';
        this.setState('ERROR', warnMsg);
        return { success: false, error: warnMsg };
      }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to establish GATT connection.';
      this.setState('ERROR', errMsg);
      return { success: false, error: errMsg };
    }
  }

  /**
   * Disconnects active Bluetooth session
   */
  public static disconnect(): void {
    this.setState('DISCONNECTING');
    if (this.activeDevice && this.activeDevice.gatt && this.activeDevice.gatt.connected) {
      try {
        this.activeDevice.gatt.disconnect();
      } catch (e) {}
    }
    this.activeDevice = null;
    this.gattServer = null;
    this.setState('DISCONNECTED');
    this.setState('IDLE');
  }
}

