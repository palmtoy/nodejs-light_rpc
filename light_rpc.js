var net = require('net');
var uuid = require('node-uuid');
var myPrint = require('./utils').myPrint;

var log = {
	e: function(){
		console.log(arguments);
	}
}

var descrCmd = '__DESCR';
var resultCmd = '__RESULT';
var errorCmd = '__ERROR_CMD';

var newLineCode = '\n'.charCodeAt(0);

exports = module.exports = light_rpc;

function light_rpc(wrapper){
  if(!(this instanceof light_rpc)) {
		return new light_rpc(wrapper);
	}

	this.wrapper = wrapper;
	this.description = {};
	this.callbacks = {};

	for(var p in wrapper){
		this.description[p] = {};
	}

	this.descrStr = command(descrCmd, this.description);
	myPrint('this.descrStr = ', this.descrStr);
  return this;
}

function command(name, data){
	var cmd = {
		command: name,
		data: data
	};
	
	var cmdStr = JSON.stringify(cmd);
	// console.trace();
	myPrint('cmdStr = ', cmdStr);
	return Buffer.byteLength(cmdStr) + '\n' + cmdStr;
}

light_rpc.prototype.connect = function(port, host, callback){
	if(!callback){
		callback = host;
		host = 'localhost';
	}

	var connection = new net.createConnection(port, host);
	var self = this;

	connection.setKeepAlive(true);
	
	connection.on('connect', function(){
		var ret = command(descrCmd);
		// console.trace();
		myPrint('descrCmd, command(descrCmd) = ', descrCmd, ret);
		connection.write(ret);
	});

	var commandsCallback = function(cmd){
		// console.trace();
		myPrint('0 ~ cmd = ', JSON.stringify(cmd));
		if(cmd.command == resultCmd){
			if(self.callbacks[cmd.data.id]){
				myPrint('1 ~ Object.keys(self.callbacks) = ', Object.keys(self.callbacks));
				self.callbacks[cmd.data.id].apply(this, cmd.data.args);
				delete self.callbacks[cmd.data.id];
				myPrint('2 ~ Object.keys(self.callbacks) = ', Object.keys(self.callbacks));
			}
		}
		else if(cmd.command == errorCmd){
			if(self.callbacks[cmd.data.id]){
				self.callbacks[cmd.data.id].call(this, cmd.data.err);
				delete self.callbacks[cmd.data.id];
			}
		}
		else if(cmd.command == descrCmd){
			var remoteObj = {};

			myPrint('3 ~ cmd = ', JSON.stringify(cmd));
			for(var p in cmd.data){
				remoteObj[p] = getRemoteCallFunction(p, self.callbacks, connection);
				myPrint('p = ', p);
			}

			callback(remoteObj, connection);
		}
	}

	var lengthObj = {
		bufferBytes: undefined,
		getLength: true,
		length: -1
	}

	connection.on('data', getOnDataFn(commandsCallback, lengthObj));
	connection.on('error', function(err){
		log.e('CONNECTION_DAMN_ERROR', err);
	});

	connection.on('timeout', function(){
		log.e('RPC connection timeout');
	});

	connection.on('end', function(){
		log.e('RPC connection other side send end event');
	});
}

function getOnDataFn(commandsCallback, lengthObj){
	return function(data){
		myPrint('data = ', data);
		myPrint('1 ~ lengthObj = ', JSON.stringify(lengthObj));
		if(lengthObj.bufferBytes && lengthObj.bufferBytes.length > 0){
			var tmpBuff = new Buffer(lengthObj.bufferBytes.length + data.length);

			lengthObj.bufferBytes.copy(tmpBuff, 0);
			data.copy(tmpBuff, lengthObj.bufferBytes.length);
			
			lengthObj.bufferBytes = tmpBuff;
			myPrint('1 ~ GetOnDataFn is running ...');
		} else {
			lengthObj.bufferBytes = data;
			myPrint('2 ~ GetOnDataFn is running ...');
			myPrint('2 ~ lengthObj.bufferBytes = ', lengthObj.bufferBytes);
		}

		var commands = getComands.call(lengthObj);
		commands.forEach(commandsCallback);
	};
}

function getRemoteCallFunction(cmdName, callbacks, connection){
	return function(){
		var id = uuid.v1();

		if(typeof arguments[arguments.length-1] == 'function'){
			callbacks[id] = arguments[arguments.length-1];
		}

		myPrint('Object.keys(callbacks) = ', Object.keys(callbacks));
		var args = parseArgumentsToArray.call(this, arguments);
		var newCmd = command(cmdName, {id: id, args: args});
		myPrint('newCmd = ', newCmd);

		connection.write(newCmd);
	}
}

light_rpc.prototype.listen = function(port){
	this.getServer();
	this.server.listen(port);
}

light_rpc.prototype.getServer = function(){
	var self = this;

	var server = net.createServer(function(c) {
		var commandsCallback = function(cmd){
			if(cmd.command == descrCmd){
					c.write(self.descrStr);
			}
			else if(!self.wrapper[cmd.command]){
				c.write(command('error', {code: 'UNKNOWN_COMMAND'}));
			}
			else {
				var args = cmd.data.args;
				myPrint('1 ~ args = ', JSON.stringify(args));
				args.push(getSendCommandBackFunction(c, cmd.data.id));
				myPrint('cmd = ', JSON.stringify(cmd));
				myPrint('2 ~ args = ', JSON.stringify(args));
				myPrint('Object.keys(self.wrapper) = ', Object.keys(self.wrapper));

				try{
					self.wrapper[cmd.command].apply({}, args);
				}
				catch(err){
					log.e(err);

					var resultCommand = command(errorCmd, {id: cmd.data.id, err: err});
					c.write(resultCommand);
				}
			}
		}

		var lengthObj = {
			bufferBytes: undefined,
			getLength: true,
			length: -1
		}

		c.on('data', getOnDataFn(commandsCallback, lengthObj));
		
		c.on('error', function(exception){
			log.e(exception);
		});
	});

	this.server = server;
	return server;
}

light_rpc.prototype.close = function(){
	this.server.close();
}

function getSendCommandBackFunction(connection, cmdId){
	return function(){
		myPrint('cmdId = ', cmdId);
		var innerArgs = parseArgumentsToArray.call({}, arguments);
		var resultCommand = command(resultCmd, {id: cmdId, args: innerArgs});
		myPrint('resultCommand = ', resultCommand);

		connection.write(resultCommand);
	};
}

function getComands(){
	myPrint('GetComands ~ this.getLength = ', JSON.stringify(this.getLength));
	myPrint('GetComands ~ this.length = ', JSON.stringify(this.length));
	myPrint('GetComands ~ this.bufferBytes = ', this.bufferBytes);
	var commands = [];
	var i = -1;

	var parseCommands = function(){
		if(this.getLength == true){
			i = getNewlineIndex(this.bufferBytes);
			myPrint('i = ', i);
			if(i > -1){
				this.length = Number(this.bufferBytes.slice(0, i).toString());
				this.getLength = false;
				// (i + 1) for \n symbol
				this.bufferBytes = clearBuffer(this.bufferBytes, i + 1);
				myPrint('this.length = ', this.length);
				myPrint('this.bufferBytes = ', this.bufferBytes);
			}
		}

		myPrint('5 ~ this.bufferBytes.length = ', this.bufferBytes.length);
		myPrint('5.1 ~ this.length = ', this.length);
		if(this.bufferBytes && this.bufferBytes.length >= this.length){
			myPrint('6 ~ this.bufferBytes = ', this.bufferBytes);
			var cmd = this.bufferBytes.slice(0, this.length).toString();
			this.getLength = true;

			try{
				myPrint('7 ~ cmd = ', cmd);
				var parsedCmd = JSON.parse(cmd);
				myPrint('8 ~ parsedCmd = ', JSON.stringify(parsedCmd));
			}
			catch(e){
				log.e('ERROR PARSE');
				log.e(cmd);
				log.e(this.length, this.bufferBytes.toString());
				return;
			}
			commands.push(parsedCmd);

			myPrint('9 ~ bufferBytes = ', this.bufferBytes);
			myPrint('9 ~ length = ', this.length);
			this.bufferBytes = clearBuffer(this.bufferBytes, this.length);
			myPrint('9.1 ~ bufferBytes = ', this.bufferBytes);

			if(this.bufferBytes && this.bufferBytes.length > 0){
				parseCommands.call(this);
			}
		}		
	}

	parseCommands.call(this);
	return commands;
}

function getNewlineIndex(buffer){
	if(buffer){
		for(var i = 0, l = buffer.length; i < l; ++i){
			if(buffer[i] == newLineCode){
				return i;
			}
		}
	}

	return -1;
}

function clearBuffer(buffer, length){
	if(buffer.length > length){
		return buffer.slice(length);
	}

	return undefined;
}

light_rpc.connect = function(){
    var rpc = light_rpc();
    return rpc.connect.apply(rpc, arguments);
}

function parseArgumentsToArray(){
	var args = [];
	
	for(var ar in arguments[0]){
		if(typeof arguments[0][ar] != 'function'){
			args.push(arguments[0][ar]);
		}
	}
	
	return args;
}

