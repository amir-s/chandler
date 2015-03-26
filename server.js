var io = require('socket.io')(3333);
var ss = require('socket.io-stream');

var random = function () {
	var arr = [];
	for (var i=0;i<1;i++) arr.push(Math.floor(Math.random()*10000+10000));
	return arr.join("-");
}
var socks = {};
io.on('connection', function (socket) {
	socket.on('action', function (act) {
		if (act == 'create') {
			var session = random();
			var sess = io.of('/' + session);
			socks[session] = [];
			sess.on('connection', function (socket) {
				socket.n = session;
				console.log("someone connected to " + session);
				socks[session].push(socket);
				ss(socket).on('file', function(stream, data) {
					var ostream = ss.createStream();
					console.log("here", data);
					broadcast(socket, 'file', stream, data)
					stream.pipe(ostream);
					// var outstream = ss.createStream();
				});
			})
			socket.emit('session', session);

			
		}
	})
})
var broadcast = function (except, type, stream, data) {
	var session = except.n;
	for (var i=0;i<socks[session].length;i++) {
		if (socks[session][i] == except) continue;
		var ostream = ss.createStream();
		ss(socks[session][i]).emit('file', ostream, data)
		stream.pipe(ostream);
	}
}