import * as fs from "fs";
import * as midiManager from "midi-file";

const input = fs.readFileSync("input.mid");
const parsed = midiManager.parseMidi(input);
fs.writeFileSync("midi.json", JSON.stringify(parsed, null, 2));

let code = `
.text
	li a7, 31
`