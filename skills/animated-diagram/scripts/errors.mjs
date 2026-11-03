// errors.mjs — something missing from the machine (Chrome, ffmpeg, the npm install): the CLI prints the message alone.
export class SetupError extends Error { constructor(msg) { super(msg); this.name = 'SetupError'; } }
