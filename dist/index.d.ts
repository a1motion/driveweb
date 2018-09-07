export default class DriveInterface {
    ip: string;
    readonly PORT: number;
    readonly PROTOCOL_DEVICE: number;
    readonly LEN_WRAPPER: number;
    readonly REQ_GET: number;
    readonly LEN_GET: number;
    readonly REQ_SET: number;
    readonly LEN_SET: number;
    readonly EX_TYPE: number;
    readonly EX_LOCK_FAIL: number;
    readonly EX_LOCK_TIMEOUT: number;
    readonly EX_SETUP_FAIL: number;
    readonly LOCK_SLEEP: number;
    readonly LOCK_RETRIES: number;
    readonly SETUP_SLEEP: number;
    readonly SETUP_RETRIES: number;
    readonly COMMS_RETRIES: number;
    readonly DEVICE_RETRIES: number;
    private socket;
    private messages;
    constructor(ip: string);
    getParameter(paramId: number): Promise<number>;
    getParameters(paramIds: number[]): Promise<number[]>;
    setParameter(paramId: number, value: number): Promise<number>;
    setParameters(paramMap: {
        [x: string]: number;
    }): Promise<{
        [x: string]: number;
    }>;
    private sleep;
    private deviceTransaction;
    private transaction;
}
