var program = require('commander');
var path = require('path');
var fs = require('fs');
var sio = require('socket.io-client');
var watch = require('watch');
var ss = require('socket.io-stream');
var server =  'http://x.sharecode.io:3333/';
function exit(err) {
	console.error(err);
	process.exit(1);
}
program
	.version('0.0.1')
	.option('-f, --folder <path>', 'path to sync')
	.option('-c, --create', 'create sync session')
	.option('-a, --attach <code>', 'attach to existing sync session')
	.parse(process.argv);


if (!program.create && !program.attach) {
	exit("You need to specify either attaching to or creating a sync session.")
}

if (!program.folder) {
	exit("You need to specify a folder.");
}
var folder = path.resolve('./', program.folder);
var connected = false;

var dontWatch = [];

if (program.create) {
	var sid = '';
	if (!fs.existsSync(folder)) {
		exit("The folder '" + folder + "' does not exists.");
	}
	var io = sio(server);
	io.on('connect', function () {
		io.emit('action', 'create');
		io.on('session', function (id) {
			sid = id;
			io.disconnect();
			io = sio(server + sid);
			io.on('connect', function () {
				console.log("connected to " + sid);
				connected = true;
				startWatch();
			});
			ss(io).on('file', function (stream, data) {
				dontWatch[data.name] = true;
				console.log("v Syncing file " + data.name);
				stream.pipe(fs.createWriteStream(path.resolve(folder, data.name)));
			})
		});
	});
}
if (program.attach) {
	var sid = program.attach;
	io = sio(server + sid);
	io.on('connect', function () {
		console.log("connected to " + sid);
		connected = true;
		startWatch();
	});
	ss(io).on('file', function (stream, data) {
		dontWatch[data.name] = true;
		console.log("v Syncing file " + data.name)
		stream.pipe(fs.createWriteStream(path.resolve(folder, data.name)));
	})
}

var startWatch = function () {

		watch.createMonitor(folder, function (monitor) {
			var watcher = function (f, stat) {

				var name = f.substr(folder.length+1);
				if (dontWatch[name]) {
					delete dontWatch[name];
					return;
				}
				console.log("^ Syncing file " + name)
				var stream = ss.createStream();
				ss(io).emit('file', stream, {name: name});
				fs.createReadStream(f).pipe(stream);
				
			}
			monitor.on("created", watcher);
			monitor.on("changed", watcher);

			monitor.on("removed", function (f, stat) {
				// console.log('r', f, stat);
			})
		});

	}