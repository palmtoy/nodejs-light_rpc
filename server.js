var light_rpc = require('./light_rpc.js');
var myPrint = require('./utils').myPrint;


var port = 5556;

var rpc = new light_rpc({
  /*
	combine: function(a, b, callback){
		myPrint('Combine is running ...');
		callback(a + b);
	},

	minus: function(a, b, callback){
		callback(a - b);
	},
	*/

	multiply: function(t, cb){
		cb(t * 2);
	}
});

rpc.listen(port);

console.log('\nRPC server is running ...');

