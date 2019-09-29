// Websocket stuff

// websocket handler for chromote app
// instanciates a websocket for communication with a
// chromote reciever
var host = document.location.host;
host = '192.168.0.10:9095';

(function() {

  return function(config) {
    var socket;
    var	events = (function() {
  		'use strict';
  		var handler = {}; var handlers = {};
  		handler.hasListeners = function hasListeners(name) { if(handlers[name]) return true; return false; }
  		handler.trigger = handler.fire = function trigger(event, data, cb) { if(typeof cb != 'function') { cb = function() { return null; } } if(handlers[event] === undefined) { return cb(null, data); } var count = handlers[event].length; var current = -1; var nextOp = function nextOp(err, data) { if(err) return cb(err, data); current++; if(current == count) {  return cb(null, data); } else { handlers[event][current](data, nextOp); } }; nextOp(null, data); return handler; };
  		handler.add = handler.on = function add(event, func) { if(typeof event !== 'string')  throw new Error('Handler.add() requires a string identifier for event'); if(typeof func !== 'function')  throw new Error('Handler.add() requires a valid function'); if(handlers[event] ===  undefined) { handlers[event] = []; } handlers[event].push(func); return handler; };
  		return handler;
  	})();
  	
    this.host = (window.location.protocol=="https:"?"wss:":"ws:")+"//"+document.location.host+"";
    this.reconnect = true; // should we auto-reconnect
    this.reconnectTime = 125; // how quickly
    this.minReconnectTime = 125; // or rather, how quickly, the first time`
    this.maxReconnectTime = 5000; // which will get progressively longer, until this long
    this.refreshTime = 1200*1000; // session refresh - ping the server (if url specified)
  	this.on = function(e, f) { events.on(e,f) };
	  this.trigger = function(e, d, f) { events.trigger(e, d, f) };
	  this.createSocket = function() {
  		var socket = new WebSocket(this.socketHost, "software-router-rtc");
  		socket.on = socket.addEventListener;
  		return socket;
	  };
	  this.connect = function() {
		//console.debug("CONNECTING");
		socket = this.createSocket();
		if(socket !== null) {
			socket.on('open', function(event) {
				clearTimeout(this.refreshTimeout);
				//this.refreshTimeout = setTimeout(function(){this.refreshSession();}, this.refreshTime);
				//console.debug('socket open to server @ ', socketHost, event);
				this.reconnectTime = this.minReconnectTime;
				this.trigger('connect');
				this.serialID = 1;
				this.connented = true;
				this.ready = false;
			});
			socket.on('message', function(event) {
				var message = JSON.parse(event.data).data;
				message.source = event;
				this.parse(message);
			});
			socket.on('error', function(event) {
				//console.debug('socket error', event);
			});
			socket.on('close', function(event) {
				clearTimeout(this.refreshTimeout);
				this.trigger('disconnect');
				//console.debug('socket closed ', event);
				if(this.reconnect) {
					this.connected = false;
					if(this.reconnectTime < this.maxReconnectTime) {
						this.reconnectTime*=2;
					}
					//console.debug('reconnect in', this.reconnectTime, "ms");
					setTimeout(function() { this.connect(); }, this.reconnectTime);
				}
			});
		}
	};
	
  };
})();


window.syn = {
	socketHost: (window.location.protocol=="https:"?"wss:":"ws:")+"//"+host+"",
	socket:null,
	ready:false,
	messageQueue: [],
	clients:0,
	cache: {
		users:[],
		routes:[],
	},

	connected:false,
	reconnect: true,
	reconnectTime: 125,
	minReconnectTime: 125,
	maxReconnectTime: 10000,
	refreshTime: 1200*1000, // 20 minute session refresh
	refreshTimeout: null,
	Handler: (function() {
		'use strict';
		var handler = {}; var handlers = {};
		handler.hasListeners = function hasListeners(name) { if(handlers[name]) return true; return false; }
		handler.trigger = handler.fire = function trigger(event, data, cb) { if(typeof cb != 'function') { var cb = function() { return null; } } if(handlers[event] == undefined) { return cb(null, data); } var count = handlers[event].length; var current = -1; var nextOp = function nextOp(err, data) { if(err) return cb(err, data); current++; if(current == count) {  return cb(null, data); } else { handlers[event][current](data, nextOp); } }; nextOp(null, data); return handler; };
		handler.add = handler.on = function add(event, func) { if(typeof event !== 'string')  throw new Error('Handler.add() requires a string identifier for event'); if(typeof func !== 'function')  throw new Error('Handler.add() requires a valid function'); if(handlers[event] ==  undefined) { handlers[event] = []; } handlers[event].push(func); return handler; };
		return handler;
	})(),
	on: function(e, f) { syn.Handler.on(e,f) },
	trigger: function(e, d, f) { syn.Handler.trigger(e, d, f) },
	createSocket: function() {
		var socket = new WebSocket(syn.socketHost, "software-router-rtc");
		socket.on = socket.addEventListener;
		return socket;
	},

	connect: function() {
		//console.debug("CONNECTING");
		syn.socket = syn.createSocket();
		if(syn.socket != null) {
			syn.socket.on('open', function(event) {
				clearTimeout(syn.refreshTimeout);
				//syn.refreshTimeout = setTimeout(function(){syn.refreshSession();}, syn.refreshTime);
				//console.debug('socket open to server @ ', syn.socketHost, event);
				syn.reconnectTime = syn.minReconnectTime;
				syn.trigger('connect');
				syn.serialID = 1;
				syn.connented = true;
				syn.ready = false;
			});
			syn.socket.on('message', function(event) {
				var message = JSON.parse(event.data).data;
				message.source = event;
				syn.parse(message);
			});
			syn.socket.on('error', function(event) {
				//console.debug('socket error', event);
			});
			syn.socket.on('close', function(event) {
				clearTimeout(syn.refreshTimeout);
				syn.trigger('disconnect');
				//console.debug('socket closed ', event);
				if(syn.reconnect) {
					syn.connected = false;
					if(syn.reconnectTime < syn.maxReconnectTime) {
						syn.reconnectTime*=2;
					}
					//console.debug('reconnect in', syn.reconnectTime, "ms");
					setTimeout(function() { syn.connect(); }, syn.reconnectTime);
				}
			});
		}
	},

	refreshSession: function() {
		// ping the server to entend the session, but DON'T update the connection timeout!
		clearTimeout(syn.refreshTimeout);

		var xhr = new XMLHttpRequest();
		xhr.open('GET', encodeURI('/_router/_sessionBump'));
		xhr.onload = function() {
		    if (xhr.status === 200) {
		        //console.log(xhr.responseText);
		    } else {
		        console.log(xhr.responseText);
		    }
		};
		xhr.send();
		syn.refreshTimeout = setTimeout(function(){syn.refreshSession();}, syn.refreshTime);
	},

	updateUserTimeout:undefined,
	parse:function(message) {
		//console.debug(message);
		if(message.type == "host.control" && message.readystate == 1) {
			console.log(message);
			syn.ready = true;
			syn.trigger('ready');
		}

    if(message.type == 'copy') {
      // now we have to get message.clipboard into the local clipboard... somehow
      var i = document.getElementById('input');
      i.value = message.clipboard;
      i.select();
      try{
        document.execCommand('cut');
      } catch(e) {
        console.error(e);
      }
      // fan-bloody-tastic... now we have a shared clipboard!
    }


		if(message.type=='client.connect') {
			syn.cache.users.push(message.data);
			clearTimeout(syn.updateUserTimeout);
			syn.trigger('client.connect', message.data.user);
		}

		if(message.type=='client.disconnect') {
			// remove user from list
			for(var i=0,l=syn.cache.users.length;i<l;i++) {
				if(syn.cache.users[i].id == message.data.id) {
					syn.cache.users.splice(i,1);
					i--; l--;
				}
			}
			// because disconnect happend on page navigation, just before reconnect, we'll delay this call
			clearTimeout(syn.updateUserTimeout);
			//syn.updateUserTimeout = setTimeout(function() { routerController.updateUserList(syn.cache.users); }, 2500);
			syn.trigger('client.disconnect', message.data.user);
		}

		if(message.type=='data'){
			switch(message.message) { // which data?
				case "routes":
					//console.log(message.data);
					syn.cache['routes'] = message.data;
				break;
				case "self":
					syn.user = message.data.user;
					syn.trigger('self');
				break;
				case "users":
					//console.log(message.data);
					syn.cache['users'] = message.data;
					//routerController.updateUserList(syn.cache.users);
				break;
			}
		}
	},
	serialID:1,
	send: function(message) {
		if(!syn.ready) { return; }
		//return;
		if(typeof message == 'string') {
			message = {
				id:syn.serialID++,
				message:message
			}
		}
		if(!message.type) {
			message.type = 'client.generic';
		}
		if(!message.id) {
			message.id = syn.serialID++
		}
		syn.socket.send(JSON.stringify(message));
	}
};
syn.connect();