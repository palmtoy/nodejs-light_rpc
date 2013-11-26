Simple RPC server/client based on NodeJS native 'net' lib sockets. 

Tested with nodejs >= 0.8.2

Sample server looks like:

    var light_rpc = require('./light_rpc.js');
    var myPrint = require('./utils').myPrint;

    var port = 5556;

    var rpc = new light_rpc({
        combine: function(a, b, callback){
            myPrint('Combine is running ...');
            callback(a + b);
        },

        minus: function(a, b, callback){
            callback(a - b);
        },

        multiply: function(t, cb){
            cb(t * 2);
        }
    });

    rpc.listen(port);

    console.log('\nRPC server is running ...');


Sample client:

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

