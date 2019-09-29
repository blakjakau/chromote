
module.exports = function(http, config) {	
	var hal;

	
	//console.log('Loading the xdo HAL module'); hal = require('./hal/xdo.js'); 
	console.log('Loading the uinput HAL module'); hal = require('./hal/uinput.js'); 

	var WebSocketServer = require('websocket').server;

	var socket = new WebSocketServer({
		httpServer:http,
		autoAcceptConnections: false
	});

	var session = require('cookie-session');
	var connectionID = 0;
	var messageID = 0;
	var ws = {
		connections: [], // track our connections!
		lastEvent: 0,
		keysDown:{},
		parse: function(message, connection) {
			if(message.id != connection.serialID) {
				connection.pending.push({
					id: message.id,
					message: message,
					connection, connection
				});
				connection.pending.sort((a,b)=>{
					return a.id - b.id;
				});
				if(connection.pending[0].id==connection.serialID) {
					ws.parse(connection.pending.shift(), connection);
				}
				//	console.log(connection.id, connection.pending[0].id, connection.serialID);
				/// some failsafe here to flush the buffer if a message is actually lost?
				return;
			}

			//console.log(connection.serialID, message.id, message.type, message.data);
			connection.serialID++;

			// assuming the message is a valid object...
			// if we got here, it means that the connection has already constructed an object for us.
			//console.log(message, connection.id);
			if(message.type) {
				switch(message.type) {
					case "clearInputState": hal.clearInput(); break;
					case "input": hal.process(message.data); break;
				}
			}

			connection.pending.sort((a,b)=>{
				return b.id - a.id;
			});

			if(connection.pending[0]==connection.serialID) {
				ws.parse(connection.pending.shift(), connection);
			}

		},		
	// replicate message to all live ADMIN class clients (Except the source)
		adminBroadcast: function(message, from) {
			ws.connections.forEach(function(conn) {
				if(from && conn.id == from.id) return; // skip the source
				if(conn.user && conn.user.groups && conn.user.groups.indexOf('admin')==-1 && conn.user.groups.indexOf('dev')==-1) return;
				if(conn.connected) {
					conn.sendUTF(JSON.stringify({
					 client: (from && from.id?from.id:0),
					 data: message
					}));
				}
			});
		},
		eventBroadcast: function(message) {
			ws.connections.forEach(function(conn) {
				if(conn.connected) {
					conn.sendUTF(JSON.stringify({
					 client: 'server',
					 data: message
					}));
				}
			});
		},
	// replicate message to all live clients (Except the source)
		broadcast: function(message, from) { 
			ws.connections.forEach(function(conn) {
				if(from && conn.id == from.id) return; // skip the source
				if(conn.connected) {
					conn.sendUTF(JSON.stringify({
					 client: (from && from.id?from.id:0),
					 data: message
					}));
				}
			});
		},		
		send: function(message, conn) {
			conn.sendUTF(JSON.stringify({
				client: "server",
				data: message
			}));

		},
		handleRequest: function(request) {
		// because websockets are seperate to their upgraded http request
		// we need to re-parse the session stuff. here we are just repeating
		// the session code we gave express, so it *should* be seamless
			session({ name:'share-Session', secret: 'omg...things', signed: false })(request.httpRequest, {}, function() { });
			
			var origins = ['http://localhost:27131', "https://build.jakbox.net"];
			// if(origins.indexOf(request.origin)==-1) {
			// 	request.reject();
			// 	console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
			// 	return;
			// }
			//oauth2.aware(request.httpRequest);
			// console.log(request.httpRequest.headers);    
			var connection = request.accept('software-router-rtc', request.origin);

			// store the session state on the connection object for future reference.
			connection.session = request.httpRequest.session;
			connection.user = connection.session.user;
			connection.ua  = request.userAgent;
			connection.url = connection.session.lastPath;

			console.log("WS:", request.httpRequest.headers['user-agent']);
			connectionID++;
			connection.id = connectionID;
			connection.pending = [];
			connection.serialID = 1;
			connection.started = new Date();
			connection.userAgentString = request.httpRequest.headers['user-agent']
			ws.connections.push(connection);
			console.log((new Date()) + ' Connection accepted.', ws.connections.length);
			
			ws.adminBroadcast({
				type:'client.connect',
				message:'Client '+connection.id+' connected.',
				clients:ws.connections.length,
				data: {
					id: connection.id,
					url: connection.url,
					user: connection.user,
					ua: connection.userAgentString,
					timestamp: connection.started
				}
			}, {id:0});

			// store an array of connections
			connection.on('message', function(message) {
				if (message.type === 'utf8') {
					try {
						ws.parse(JSON.parse(message.utf8Data), connection);
					} catch(e) {
						console.log((new Date())+" Failed to process message from "+connection.id);
						console.log("ERROR:\n"+e+"\n");
						console.log("DATA:\n"+message.utf8Data+"\n");
					}
				}
				else if (message.type === 'binary') {
					console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
					connection.sendBytes(message.binaryData);
				}
			});	

			ws.send({ type:'host.control', readystate:1 }, connection);

			connection.on('close', function(reasonCode, description) {
				// update the session model, in case we don't load another page
				// make sure we're onyl updating the session model outsite the router...

				console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
				ws.adminBroadcast({
					type:'client.disconnect',
					message:'Client '+connection.id+' disconnected.',
					clients:ws.connections.length-1,
					data: {
						id: connection.id
					}
				}, {id:0});
				for(var i=0,l=ws.connections.length; i<l; i++){
					if(ws.connections[i].id == connection.id) {
						console.log(new Date() + " connections: "+ws.connections.length);
						ws.connections.splice(i, 1);
						return;
					}
				}
				console.log(new Date() + " connections: "+ws.connections.length);
			});
		}
	}
	socket.on('request', ws.handleRequest);

	hal.handler = ws;
	return ws;
}