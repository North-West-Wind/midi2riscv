import * as fs from "fs";
import * as midiManager from "midi-file";

type CombinedEvent = {
	time: number;
	tempo: number;
	notes: {
		pitch: number;
		duration: number;
		instrument: number;
		volume: number;
	}[];
}

type TempoEvent = {
	time: number;
	multiplier: number;
};

const inPath = process.argv[2];
const outPath = process.argv[3];

const input = fs.readFileSync(inPath);
const parsed = midiManager.parseMidi(input);
fs.writeFileSync("midi.json", JSON.stringify(parsed, null, 2));

let code = ".text";

const events: CombinedEvent[] = [];
const tempoEvents: TempoEvent[] = [];

for (const track of parsed.tracks) {
	let totalTime = 0;
	let instrument = 0;
	let tempoIndex = 0;
	for (let ii = 0; ii < track.length; ii++) {
		const event = track[ii];
		totalTime += event.deltaTime;
		if (event.type === "programChange") instrument = event.programNumber;
		else if (event.type === "setTempo") {
			const milli = event.microsecondsPerBeat / 1000;
			tempoEvents.push({ time: totalTime, multiplier: milli / (parsed.header.ticksPerBeat || 480) });
		} else if (event.type === "noteOn") {
			const note = {
				pitch: event.noteNumber,
				duration: 0,
				instrument,
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
			while (tempoIndex + 1 < tempoEvents.length && tempoEvents[tempoIndex+1].time < totalTime) {
				tempoIndex++;
			}
			note.duration = Math.round((note.duration + 1) * tempoEvents[tempoIndex].multiplier);
			const existing = events.find(e => e.time == totalTime);
			if (existing) existing.notes.push(note);
			else events.push({
				time: totalTime ,
				tempo: tempoEvents[tempoIndex].multiplier,
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
	code += `li a0, ${Math.round((ii == 0 ? event.time : event.time - sorted[ii-1].time) * event.tempo)}`;
	code += "\n\t";
	code += "ecall";

	code += "\n\t";
	code += `li a7, 31`;
	let lastPitch = -1, lastDuration = -1, lastInstrument = -1, lastVolume = -1;
	for (const note of event.notes) {
		if (lastPitch != note.pitch) {
			code += "\n\t";
			code += `li a0, ${note.pitch}`;
			lastPitch = note.pitch;
		}
		if (lastDuration != note.duration) {
			code += "\n\t";
			code += `li a1, ${note.duration}`;
			lastDuration = note.duration;
		}
		if (lastInstrument != note.instrument) {
			code += "\n\t";
			code += `li a2, ${note.instrument}`;
			lastInstrument = note.instrument;
		}
		if (lastVolume != note.volume) {
			code += "\n\t";
			code += `li a3, ${note.volume}`;
			lastVolume = note.volume;
		}
		code += "\n\t";
		code += "ecall";
	}
}

fs.writeFileSync(outPath, code);