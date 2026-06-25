export interface VoiceNavEvent {
    type: string;
    data?: any;
}

export interface VoiceNavSocketHandlers {
    onEvent: (event: VoiceNavEvent) => void;
    onPcm: (chunk: Uint8Array) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onError?: () => void;
}

const NEWLINE = 0x0a;

function splitBinaryFrame(buf: Uint8Array): { header: VoiceNavEvent | null; payload: Uint8Array } {
    const sep = buf.indexOf(NEWLINE);
    if (sep === -1) return { header: null, payload: new Uint8Array(0) };

    let header: VoiceNavEvent | null = null;
    try {
        header = JSON.parse(new TextDecoder().decode(buf.subarray(0, sep)));
    } catch {
        header = null;
    }
    return { header, payload: buf.subarray(sep + 1) };
}

export class VoiceNavSocket {
    private ws: WebSocket | null = null;
    private handlers: VoiceNavSocketHandlers;

    constructor(handlers: VoiceNavSocketHandlers) {
        this.handlers = handlers;
    }

    get isOpen(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    connect(url: string): void {
        if (this.ws) return;

        const ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        this.ws = ws;

        ws.onopen = () => { console.log('voicenav: ws open', url); this.handlers.onOpen?.(); };
        ws.onerror = (e: any) => { console.log('voicenav: ws error', e?.message ?? e); this.handlers.onError?.(); };
        ws.onclose = (e: any) => {
            console.log('voicenav: ws close', e?.code, e?.reason);
            this.ws = null;
            this.handlers.onClose?.();
        };
        ws.onmessage = (event: WebSocketMessageEvent) => this.handleMessage(event);
    }

    private handleMessage(event: WebSocketMessageEvent): void {
        if (event.data instanceof ArrayBuffer) {
            const { header, payload } = splitBinaryFrame(new Uint8Array(event.data));
            if (!header) { console.log('voicenav: binary frame: no header'); return; }
            console.log('voicenav: binary', header.type, 'payload', payload.length);
            if (header.type === 'tts_chunk') {
                this.handlers.onPcm(payload);
            } else {
                this.handlers.onEvent(header);
            }
            return;
        }

        try {
            const raw: string =
                typeof event.data === 'string'
                    ? event.data
                    : new TextDecoder().decode(event.data as any);
            const nl = raw.indexOf('\n');
            const json = JSON.parse(nl !== -1 ? raw.slice(0, nl) : raw);
            console.log('voicenav: event', json?.type, JSON.stringify(json?.data)?.slice(0, 200));
            this.handlers.onEvent(json);
        } catch (err) {
            console.log('voicenav: frame parse failed:', String(event.data).slice(0, 200), err);
        }
    }

    sendJson(type: string, data: Record<string, unknown> = {}): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...data }));
        }
    }

    sendAudio(bytes: Uint8Array, mimeType: string): void {
        if (this.ws?.readyState !== WebSocket.OPEN) return;

        const header = new TextEncoder().encode(JSON.stringify({ mimeType }) + '\n');
        const frame = new Uint8Array(header.length + bytes.length);
        frame.set(header, 0);
        frame.set(bytes, header.length);
        this.ws.send(frame.buffer);
    }

    close(): void {
        const ws = this.ws;
        this.ws = null;
        if (ws) {
            ws.onopen = null as any;
            ws.onclose = null as any;
            ws.onerror = null as any;
            ws.onmessage = null as any;
            try {
                ws.close();
            } catch {
            }
        }
    }
}
