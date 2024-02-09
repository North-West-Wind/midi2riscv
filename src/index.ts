import * as fs from "fs";
import * as midiManager from "midi-file";

type CombinedEvent = {
	time: number;
	notes: {
		pitch: number;
		duration: number;
		instrument: number;
		volume: number;
	}[];
}

const input = fs.readFileSync("input.mid");
const parsed = midiManager.parseMidi(input);
fs.writeFileSync("midi.json", JSON.stringify(parsed, null, 2));

let code = ".text";

const events: CombinedEvent[] = [];

for (const track of parsed.tracks) {
	let totalTime = 0;
	for (let ii = 0; ii < track.length; ii++) {
		const event = track[ii];
		totalTime += event.deltaTime;
		if (event.type === "noteOn") {
			const note = {
				pitch: event.noteNumber,
				duration: 0,
				instrument: event.channel,
				volume: event.velocity
			};
			let jj = ii;
			let duration = 0;
			while (note.duration == 0) {
				jj++;
				const nextEvent = track[jj];
				duration += nextEvent.deltaTime;
				if (nextEvent.type === "noteOff" && nextEvent.noteNumber == note.pitch) note.duration = duration;
			}
			const existing = events.find(e => e.time == totalTime);
			if (existing) existing.notes.push(note);
			else events.push({
				time: totalTime,
				notes: [note]
			});
		}
	}
}

const sorted = events.sort((a, b) => a.time - b.time);
for (let ii = 0; ii < sorted.length; ii++) {
	const event = sorted[ii];
	code += "\n\t";
	code += "li a7, 32";
	code += "\n\t";
	code += `li a0, ${ii == 0 ? event.time : event.time - sorted[ii-1].time}`;
	code += "\n\t";
	code += "ecall";
	for (const note of event.notes) {
		code += "\n\t";
		code += `li a7, 31`;
		code += "\n\t";
		code += `li a0, ${note.pitch}`;
		code += "\n\t";
		code += `li a1, ${note.duration}`;
		code += "\n\t";
		code += `li a2, ${note.instrument}`;
		code += "\n\t";
		code += `li a3, ${note.volume}`;
		code += "\n\t";
		code += "ecall";
	}
}

fs.writeFileSync("output.asm", code);