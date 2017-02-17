const program = require('commander');
const ngrok = require('ngrok');
const path = require('path');
const fs = require('fs');
const sio = require('socket.io-client');
const watch = require('watch');
const ss = require('socket.io-stream');
const l = require('prnt');

function exit(err) {
	console.error(err);
	process.exit(1);
}

program
	.version('0.0.1')
	.option('-s, --security <n>', 'security level for pin generation')
	.parse(process.argv);

if (!program.security) program.security = 1;

const random = function () {
	var arr = [];
	for (var i=0;i<program.security;i++) arr.push(Math.floor(Math.random()*10000+10000));
	return arr.join("-");
}

var walkSync = function(dir, filelist) {
	let files = fs.readdirSync(dir);
	filelist = filelist || [];
	files.forEach(function(file) {
		if (fs.statSync(dir + file).isDirectory()) {
			filelist = walkSync(dir + file + '/', filelist);
		} else {
			filelist.push(dir+file);
		}
	});
	return filelist;
};

let PIN = random();
let folder = path.resolve(program.args[0] || '.');
console.log("Starting master", folder, PIN);

let shouldBeIgnored = file => {
	let name = file.split('/').pop();
	if (name.startsWith('.')) return true;
	if (name.startsWith('node_modules/')) return true;
	return false;
}

let debounceMap = {};
let socks = [];

watch.createMonitor(folder, function (monitor) {
	var watcher = type => {
		return (f, stat) => {
			clearTimeout(debounceMap[f]);

			debounceMap[f] = setTimeout(() => {
				var name = f.substr(folder.length+1);
				if (shouldBeIgnored(name)) {
					console.log("ignoring ", name);
					return;
				}
				if (fs.lstatSync(f).isDirectory()) {
					console.log("ignoring ", name);
					return;
				}
				console.log("e: " + type, name)
				var stream = ss.createStream();
				if (type == 'remove') {
					socks.forEach(s => s.emit('remove', {name: name}));
					return;
				}
				socks.forEach(s => ss(s).emit('update', stream, {name: name}));
				fs.createReadStream(f).pipe(stream);
			}, 100);
		}
	};

	monitor.on("created", watcher('create'));
	monitor.on("changed", watcher('change'));
	monitor.on("removed", watcher('remove'));
});

var io = require('socket.io')(3333);
io.on('connection', function (socket) {
	socket.on('enter', function (data) {
		if (data.pin == PIN) {
			console.log("Someone connected!");
			socket.auth = true;
			socks.push(socket);
		}
	});
	socket.on('disconnect', function () {
		if (!socket.auth) return;
		socks.splice(socks.indexOf(socket), 1);
	});
	socket.on('init', function () {
		if (!socket.auth) return;
		let files = walkSync(folder+'/');
		files.forEach(f => {
			var name = f.substr(folder.length+1);
			if (shouldBeIgnored(name)) {
				console.log("ignoring ", name);
				return;
			}
			if (fs.lstatSync(f).isDirectory()) {
				console.log("ignoring ", name);
				return;
			}
			var stream = ss.createStream();
			ss(socket).emit('update', stream, {name: name});
			fs.createReadStream(f).pipe(stream);
		})
	})
});

ngrok.connect(3333, function (err, url) {
	console.log("Server started @", url);
});


