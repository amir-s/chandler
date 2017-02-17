const program = require('commander');
const path = require('path');
const fs = require('fs');
const sio = require('socket.io-client');
const watch = require('watch');
const ss = require('socket.io-stream');
const mkdirp = require('mkdirp');

function exit(err) {
	console.error(err);
	process.exit(1);
}
program
	.version('0.0.1')
	.option('-a, --attach <address>', 'attach the master')
	.option('-p, --pin <code>', 'pin code form the master')
	.parse(process.argv);

let folder = path.resolve(program.args[0] || '.');

var io = sio(program.attach);
io.on('connect', function () {
	io.emit('enter', {pin: program.pin});
	io.emit('init');
	ss(io).on('update', function (stream, data) {
		console.log("Syncing file " + data.name);
		mkdirp.sync(path.dirname(path.resolve(folder, data.name)));
		stream.pipe(fs.createWriteStream(path.resolve(folder, data.name)));
	});
	io.on('remove', function (data) {
		console.log("Syncing file " + data.name);
		fs.unlink(path.resolve(folder, data.name), () => 1);
	});
});

