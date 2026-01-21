export async function toUint8Array(input: string | File): Promise<Uint8Array> {
    if (typeof input == "string") {
        return new TextEncoder().encode(input);
    }

    const buf = await input.arrayBuffer();
    return new Uint8Array(buf)
}