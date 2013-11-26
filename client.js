var light_rpc = require('./light_rpc.js');
var myPrint = require('./utils').myPrint;

var port = 5556;

light_rpc.connect(port, 'localhost', function(remote, conn){
	myPrint('Object.keys(remote) = ', Object.keys(remote));
	remote.combine(99, 100, function(res){
		console.log('combine ~  res(99+100) = ', res);
	});

	remote.minus(199, 100, function(res){
		console.log('minus ~  res(199-100) = ', res);
	});

	remote.multiply(88, function(res){
		console.log('multiply ~ res(88*2)   = ', res);
		// close connect
		conn.destroy();
		conn.end();
	});
});

