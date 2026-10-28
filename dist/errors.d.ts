export declare class PilotError extends Error {
    readonly status: number;
    /**
     * The ALL_CAPS machine code, when the throw site had one. It belongs
     * here rather than in the message prefix -- several existing messages
     * read `SAFETY_FLAG_NOT_FOUND: prose`, which put the code exactly where
     * the status matcher was looking and the prose exactly where nobody
     * would see it.
     */
    readonly code?: string | undefined;
    constructor(status: number, message: string, 
    /**
     * The ALL_CAPS machine code, when the throw site had one. It belongs
     * here rather than in the message prefix -- several existing messages
     * read `SAFETY_FLAG_NOT_FOUND: prose`, which put the code exactly where
     * the status matcher was looking and the prose exactly where nobody
     * would see it.
     */
    code?: string | undefined);
}
