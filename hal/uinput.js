//uinput interface for LINUX
//
// this HAL module creates a virtual input device mapping both keyboard AND mouse using the linux uinput bindings
// provided by the node module uinput
//
module.exports = (function() {
	const spawn = require('child_process').spawn;
	const execSync = require('child_process').execSync;
	const exec = require('child_process').exec;
	const fs = require('fs');
	var uinput = require('uinput');

	var environCaps = {
		clipboard: (function(){
			try {
				xsel = execSync('which xsel');
				if(xsel) {
					console.log('Clipboard supported via', xsel.toString())
					return xsel;
				}
			} catch(e) {
				console.log('No Clipboard support. To use shared clipboard, install xsel or xclip (e.g. on ubuntu: apt-get install xsel)')
				return false;
			}
		 })()
	}

	var keysDown = {};
	var deviceCaps = [];
	var noop = function() {};
	var wheelOffset = 0;
	var wheelMax = 3;
	// we need these outside the config, so we can reference them later
	var input_stream;
	var keyMap = {
		'F1':59,'F2':60,'F3':61,'F4':62,'F5':63,'F6':64,'F7':65,'F8':66,'F9':67,'F10':68,

		// 'EXCLAM':2,'AT':3,'NUMBERSIGN':4,'DOLLAR':5,'PERCENT':6,'ASCIICIRCUM':7,'AMPERSAND':8,'ASTERISK':9,'PARENLEFT':10,'PARENRIGHT':11,
		// 'GRAVE':41,'ASCIITILDE':41,
		// 'PLUS':13,'EQUAL':13,'UNDERSCORE':12,'MINUS':12,
		// 'COMMA':51,'PERIOD':52,'QUESTION':53,'SLASH':53,
		// 'GRAVE':41,'ASCIITILDE':41,
		// 'SEMICOLON':39,'COLON':39,'APOSTROPHE':40,'QUOTEDBL':40,
		// 'BRACKETLEFT':26,'BRACELEFT':26,'BRACKETRIGHT':27,'BRACERIGHT':27,'BACKSLASH':43,'BAR':43,

		'RESERVED':0,
		'ESCAPE':1,		'!':2,'@':3,'#':4,'$':5,'%':6,'^':7,'&':8,'*':9,'(':10,')':11,'_':12,'+':13,'BACKSPACE':14,
		'`':41,'~':41,	'1':2,'2':3,'3':4,'4':5,'5':6,'6':7,'7':8,'8':9,'9':10,'0':11,'-':12,'=':13,
		'TAB':15,'Q':16,'W':17,'E':18,'R':19,'T':20,'Y':21,'U':22,'I':23,'O':24,'P':25,
		'A':30,'S':31,'D':32,'F':33,'G':34,'H':35,'J':36,'K':37,'L':38,';':39,':':39,'\'':40,'"':40,'ENTER':28,'RETURN':28,
		'Z':44,'X':45,'C':46,'V':47,'B':48,'N':49,'M':50,'<':51,'>':52,',':51,'.':52,'?':53,'/':53,'[':26,'{':26,']':27,'}':27,'\\':43,'|':43,
		'CONTROL':29,'ALT':56,' ':57,
		

		'LEFTSHIFT':42,
		'SHIFT':54,
		'KPASTERISK':55,
		'SPACE':57, 'CAPSLOCK':58, 'NUMLOCK':69, 'SCROLLLOCK':70,
		'KP7':71,'KP8':72,'KP9':73,
		'KP4':75, 'KP5':76, 'KP6':77,'KPMINUS':74,
		'KPPLUS':78, 'KP1':79, 'KP2':80, 'KP3':81, 'KP0':82,'KPDOT':83,
		'ZENKAKUHANKAKU':85,
		'102ND':86,
		'F11':87,
		'F12':88,
		'RO':89, 'KATAKANA':90, 'HIRAGANA':91, 'HENKAN':92, 'KATAKANAHIRAGANA':93, 'MUHENKAN':94, 'KPJPCOMMA':95, 'KPENTER':96, 'RIGHTCTRL':97,
		'KPSLASH':98, 'SYSRQ':99, 'RIGHTALT':100, 'LINEFEED':101, 'HOME':102, 'UP':103, 'PAGEUP':104, 'LEFT':105, 'RIGHT':106, 'END':107, 'DOWN':108,
		'PAGEDOWN':109, 'INSERT':110, 'DELETE':111, 'MACRO':112, 'MUTE':113, 'VOLUMEDOWN':114, 'VOLUMEUP':115, 'POWER':116
	}

	//our mouse is a relative pointing device only...
	// this way, we can ignore any trixy screen scaling
	// issues between the client and the host
	// Also means that if it's used for gaming it won't break
	for(var k  in uinput) {
		if(k.indexOf('KEY_')==0&& uinput[k] < 538)	{
			// iterate the keys, because ultimately, we want the
			// keyboard driver to be able to trigger ALL the keys

			deviceCaps.push(uinput[k]);
		} else {
			//console.log(k, uinput[k]);
		}

	}
	// we need to add the mouse caps to the ev_key array, to be able to send click events
	var mouseCaps = [ uinput.BTN_LEFT, uinput.BTN_RIGHT, uinput.BTN_MIDDLE, uinput.BTN_SIDE, uinput.BTN_EXTRA ]
	mouseCaps.forEach((m)=>{
		deviceCaps.push(m);
	});

	// now we build the options block
	var pointer_options = {
	    EV_KEY : deviceCaps,
	    EV_REL : [ uinput.REL_X, uinput.REL_Y, uinput.REL_WHEEL, uinput.REL_HWHEEL ],
	};

	//creating a virtual device for mouse and keyboard input
	uinput.setup(pointer_options, function(err, istream) {
		if(err) throw(err);
		input_stream = istream;
	    var absmax = new Array(uinput.ABS_CNT).fill(0);
	    absmax[uinput.ABS_X] = 1024;
	    absmax[uinput.ABS_Y] = 1024;
	    var create_options = {
	        name : 'chromote-combined-HID',
	        id : {
	            bustype : uinput.BUS_VIRTUAL,
	            vendor : 0x1,
	            product : 0x1,
	            version : 1
	        },
	        absmax : absmax
	    };
	    uinput.create(input_stream, create_options, function(err) {
			if(err) throw(err);
		});
	})

	var mouseTrack; // defined later... hopefully
	var hal = {
		handler:null,
		clearInput: function() {
			for(var k in keysDown) {
				uinput.send_event(input_stream, uinput.EV_KEY, k, 0, noop);
				keysDown[k] = false;
			}
		},
		process: function(input) {
			switch(input.type) {
				case 'mousemove':
					uinput.send_event(input_stream, uinput.EV_REL, uinput.REL_X, input.x, noop);
					uinput.send_event(input_stream, uinput.EV_REL, uinput.REL_Y, input.y, noop);
					uinput.send_event(input_stream, uinput.EV_SYN, uinput.SYN_REPORT, 0, noop);
					mouseTrack(input.x, input.y);
				break;
				case "mousewheel":
					
					// wheelOffset+=input.z/50;

					// if(Math.abs(wheelOffset)>2) {
					// 	if(Math.abs(wheelOffset)>1) {
					// 		wheelOffset= Math.max(-20, Math.min(20, wheelOffset));
					// 	}
					// 	uinput.send_event(input_stream, uinput.EV_REL, uinput.REL_WHEEL, wheelOffset, noop);
					// 	uinput.send_event(input_stream, uinput.EV_SYN, uinput.SYN_REPORT, 0, noop);
					// 	wheelOffset = 0;
					// }

					// console.log(input.z, wheelOffset);
					// return;
					
					// 	uinput.send_event(input_stream, uinput.EV_REL, uinput.REL_WHEEL, input.z/10, noop);
					// 	uinput.send_event(input_stream, uinput.EV_SYN, uinput.SYN_REPORT, 0, noop);
					// 	wheelOffset = 0;

					// 	return;

					wheelOffset+=(input.z>0)?input.z/240:(input.z/240);

					if(Math.abs(wheelOffset)>1) {
						if(Math.abs(wheelOffset)>1) {
							wheelOffset= Math.max(-20, Math.min(20, wheelOffset));
						}
						uinput.send_event(input_stream, uinput.EV_REL, uinput.REL_WHEEL, wheelOffset, noop);
						uinput.send_event(input_stream, uinput.EV_SYN, uinput.SYN_REPORT, 0, noop);
						wheelOffset = 0;
					}
				break;
				case "mousedown":
				case "mouseup":
					var btn = uinput.BTN_LEFT;
					var state = input.type=='mousedown'?1:0;
					switch(input.button) {
						case 1: btn=uinput.BTN_LEFT; break;
						case 3: btn=uinput.BTN_RIGHT; break;
						case 2: btn=uinput.BTN_MIDDLE; break;
						case 4: btn=uinput.BTN_SIDE; break;
						case 5: btn=uinput.BTN_EXTRA; break;
					}
					uinput.send_event(input_stream, uinput.EV_KEY, btn, state, noop);
					uinput.send_event(input_stream, uinput.EV_SYN, uinput.SYN_REPORT, 0, noop);
					keysDown['mouse'+btn] = state==1?true:false;

				break;
				case "copy":
					var mapped = keyMap[input.key.toUpperCase()];
					if(!mapped) {
						//console.log('unmapped key', input.key);
					} else {
						// console.log('COPY', input.key, mapped);
						uinput.send_event(input_stream, uinput.EV_KEY, mapped, 0, noop);
						uinput.send_event(input_stream, uinput.EV_SYN, uinput.SYN_REPORT, 0, noop);
						keysDown[mapped] = false;

						if(environCaps.clipboard) {
							// can we branch hal to use either xsel or xclip?
							//setTimeout(function(handler) {
								var result = execSync('xsel --output --clipboard');
								// now we have the clipboard text, let's send it back to the chromote source
								if(hal.handler) {
									hal.handler.eventBroadcast({
										type:'copy',
										clipboard:result.toString()
									});
								}
							//}, 50)
						}
					}
				break;
				case 'paste':
					// process a paste event using the chromote source clipboard
					// via xsel (if available), otherwise a client-side paste (CTRL+V) will happen

					if(environCaps.clipboard) {
						if(input.clipboard) {
							fs.writeFileSync('/tmp/chromote-clipboard.tmp', input.clipboard);
							execSync('cat /tmp/chromote-clipboard.tmp | xsel --input --clipboard');
						}
					}

					var mapped = keyMap['V'];
					uinput.send_event(input_stream, uinput.EV_KEY, mapped, 1, noop);
					uinput.send_event(input_stream, uinput.EV_SYN, uinput.SYN_REPORT, 0, noop);
					keysDown[mapped] = true;

					uinput.send_event(input_stream, uinput.EV_KEY, mapped, 0, noop);
					uinput.send_event(input_stream, uinput.EV_SYN, uinput.SYN_REPORT, 0, noop);
					keysDown[mapped] = false;

				break;
				case "keydown":
					var mapped = keyMap[input.key.toUpperCase()];
					if(!mapped) {
						// console.log('unmapped key', input.key);
					} else {
						// console.log(input.key, mapped);
						//spawn('xdotool',['keydown', input.key]);
						uinput.send_event(input_stream, uinput.EV_KEY, mapped, 1, noop);
						uinput.send_event(input_stream, uinput.EV_SYN, uinput.SYN_REPORT, 0, noop);
						keysDown[mapped] = true;
					}
				break;
				case "keyup":
					var mapped = keyMap[input.key.toUpperCase()];
					if(!mapped) {
						//console.log('unmapped key', input.key);
					} else {
						//console.log(input.key, mapped);
						//spawn('xdotool',['keyup', input.key]);
						uinput.send_event(input_stream, uinput.EV_KEY, mapped, 0, noop);
						uinput.send_event(input_stream, uinput.EV_SYN, uinput.SYN_REPORT, 0, noop);
						keysDown[mapped] = false;
					}
				break;
			}
		}
	}
	
	mouseTrack = (function() {

		// see if we can use xdotool to get the absolute mouse position
		var xdoSupport = (function() {
			try {
				var xdo = execSync('which xdotool');
				if(xdo) {
					console.log('Screen-edge supported via', xdo.toString())
					return true;
				}
			} catch(e) {
				console.log('No screen-edge support. To use screen edge triggers, install xdotool (e.g. on ubuntu: apt-get install xdotool)');
				return false;
			}
		})();

		// get the resolution of the desktop, this will all go pear shapped
		// if the desktop isn't a rectangle (e.g. multiple monitors but NOT in a line/stack)
		var maxX = 0, maxY = 0;
		try {
			var dimensions = execSync("xdpyinfo | grep 'dimensions';");
			;(function() {
				var bits = dimensions.toString().split(/\s/);
				bits = bits.filter(b => b.length>0);
				var dim = bits[1].split('x');
				maxX = dim[0]-1;
				maxY = dim[1]-1;
				console.log('Screen resolution', maxX+1, maxY+1);
			})();
		} catch(e) {
			console.log(e.toString());
			return function(){};
		}

		// adding tracking for the current mouse coord in real time, so that we can use an "active-edge" approach
		var locX=0, locY=0;
		var edgeTolerance = 32; // how hard do we push against an edge before it triggers?

		var movX=0,movY=0;
		var checking = false
		var worker = function(x, y) {
			if(!xdoSupport) return;
			if(checking) {
				//don't do an edge check if we're still waiting for the last, but update the x/y values
				// so we're getting the full story!
				movX+=parseInt(x);
				movY+=parseInt(y);
				return;
			} else {
				movX=parseInt(x);
				movY=parseInt(y);
			}
			var child = spawn('xdotool', ['getmouselocation']);
			var res='';
			checking = true;
			child.stdout.on('data', data=>{ res+=data.toString(); });
			child.on('close', code=>{
				checking=false;
				if(code==0) {
					var bits = res.split(' ');
					locX = bits[0].split(':')[1];
					locY = bits[1].split(':')[1];
					
					var edge=undefined;
					if( parseInt(locY)+parseInt(movY) > maxY+edgeTolerance ) { edge = 'bottom'; }
					if( parseInt(locY)+parseInt(movY) < -edgeTolerance ) { edge = 'top'; }
					if( parseInt(locX)+parseInt(movX) > maxX+edgeTolerance ) { edge = 'right'; }
					if( parseInt(locX)+parseInt(movX) < 0-edgeTolerance ) { edge = 'left'; }

					worker.x = locX;
					worker.y = locY;
					worker.edge = edge;
					
					if(edge !== undefined) {
						//console.log('edge trigger',locX/maxX, locY/maxY, edge);
						// send a EDGE message the handler
						// but NOT if a key or mouse button is currently DOWN;

						for(var k in keysDown) {
							if(keysDown[k]) {
								return;
							}
						}
						if(hal.handler) {
							hal.handler.eventBroadcast({
								type:'edge',
								edge:edge,
								x: locX/maxX,
								y: locY/maxY,
							});
						}
					}
				}
			});
		}
		worker.x = undefined;
		worker.y = undefined;
		worker.edge = undefined;
		return worker;
	})();
	return hal;
})();
